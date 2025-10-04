import AWS from 'aws-sdk';
import crypto from 'crypto';
import path from 'path';
import { logger } from '../utils/logger';
import { storageEncryptionService } from './StorageEncryptionService';

export interface StorageConfig {
  provider: 'aws' | 'gcp' | 'azure' | 'minio' | 'local';
  bucketName: string;
  region: string;
  endpoint?: string;
  enableEncryption: boolean;
  enableVersioning: boolean;
  enableAccessLogging: boolean;
  publicAccessBlocked: boolean;
  presignedUrlTTL: number;
  maxFileSize: number;
  allowedOperations: ('read' | 'write' | 'delete')[];
  enableVirusScan: boolean;
  enableBackup: boolean;
  retentionPeriod: number; // days
  enableCDN: boolean;
  cdnDomain?: string;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  acl?: 'private' | 'public-read' | 'public-read-write';
  storageClass?: 'STANDARD' | 'REDUCED_REDUNDANCY' | 'GLACIER' | 'DEEP_ARCHIVE';
  enableEncryption?: boolean;
  expiresIn?: number;
}

export interface PresignedUrlOptions {
  operation: 'getObject' | 'putObject' | 'deleteObject';
  expiresIn?: number;
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  storageClass: string;
  metadata: Record<string, string>;
  tags: Record<string, string>;
  isEncrypted: boolean;
  presignedUrl?: string;
}

export class SecureStorageService {
  private static instance: SecureStorageService;
  private config: StorageConfig;
  private s3Client!: AWS.S3;
  private uploadedFiles: Map<string, { uploadedAt: Date; size: number }> = new Map();

  private constructor() {
    this.config = {
      provider: (process.env.STORAGE_PROVIDER as StorageConfig['provider']) || 'aws',
      bucketName: process.env.STORAGE_BUCKET_NAME || 'botrt-secure-storage',
      region: process.env.STORAGE_REGION || 'us-east-1',
      endpoint: process.env.STORAGE_ENDPOINT,
      enableEncryption: process.env.STORAGE_ENABLE_ENCRYPTION !== 'false',
      enableVersioning: process.env.STORAGE_ENABLE_VERSIONING !== 'false',
      enableAccessLogging: process.env.STORAGE_ENABLE_ACCESS_LOGGING !== 'false',
      publicAccessBlocked: process.env.STORAGE_BLOCK_PUBLIC_ACCESS !== 'false',
      presignedUrlTTL: parseInt(process.env.STORAGE_PRESIGNED_URL_TTL || '3600'), // 1 hour
      maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE || '104857600'), // 100MB
      allowedOperations: ['read', 'write'],
      enableVirusScan: process.env.STORAGE_ENABLE_VIRUS_SCAN === 'true',
      enableBackup: process.env.STORAGE_ENABLE_BACKUP !== 'false',
      retentionPeriod: parseInt(process.env.STORAGE_RETENTION_PERIOD || '2555'), // 7 years
      enableCDN: process.env.STORAGE_ENABLE_CDN === 'true',
      cdnDomain: process.env.STORAGE_CDN_DOMAIN
    };

    this.initializeClient();
    this.startCleanupTimer();

    logger.info('Secure storage service initialized', {
      provider: this.config.provider,
      bucket: this.config.bucketName,
      region: this.config.region,
      encryption: this.config.enableEncryption
    });
  }

  public static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  private async initializeClient(): Promise<void> {
    try {
      // Get AWS credentials from environment variables
      const awsCredentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      };

      const s3Config: AWS.S3.ClientConfiguration = {
        region: this.config.region,
        accessKeyId: awsCredentials.accessKeyId,
        secretAccessKey: awsCredentials.secretAccessKey,
        signatureVersion: 'v4',
        sslEnabled: true,
        httpOptions: {
          timeout: 30000,
          agent: undefined
        }
      };

      // Custom endpoint for MinIO or other S3-compatible services
      if (this.config.endpoint) {
        s3Config.endpoint = this.config.endpoint;
        s3Config.s3ForcePathStyle = true;
      }

      this.s3Client = new AWS.S3(s3Config);

      // Verify bucket access and configuration
      await this.verifyBucketConfiguration();

    } catch (error: unknown) {
      logger.error('Failed to initialize storage client:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Verify bucket exists and has correct security configuration
   */
  private async verifyBucketConfiguration(): Promise<void> {
    try {
      // Check if bucket exists
      await this.s3Client.headBucket({ Bucket: this.config.bucketName }).promise();

      // Verify encryption configuration
      if (this.config.enableEncryption) {
        try {
          const encryption = await this.s3Client.getBucketEncryption({
            Bucket: this.config.bucketName
          }).promise();

          logger.info('Bucket encryption verified', {
            bucket: this.config.bucketName,
            encryption: encryption.ServerSideEncryptionConfiguration
          });

        } catch (_error) {
          logger.warn('Bucket encryption not configured, setting up default encryption');
          await this.configureBucketEncryption();
        }
      }

      // Verify versioning
      if (this.config.enableVersioning) {
        const versioning = await this.s3Client.getBucketVersioning({
          Bucket: this.config.bucketName
        }).promise();

        if (versioning.Status !== 'Enabled') {
          logger.warn('Bucket versioning not enabled, enabling versioning');
          await this.enableBucketVersioning();
        }
      }

      // Verify public access is blocked
      if (this.config.publicAccessBlocked) {
        try {
          const publicAccessBlock = await this.s3Client.getPublicAccessBlock({
            Bucket: this.config.bucketName
          }).promise();

          if (!publicAccessBlock.PublicAccessBlockConfiguration?.BlockPublicAcls) {
            logger.warn('Public access not properly blocked, configuring block');
            await this.blockPublicAccess();
          }

        } catch (_error: unknown) {
          logger.warn('Public access block not configured, setting up block');
          await this.blockPublicAccess();
        }
      }

      // Configure lifecycle policy
      await this.configureBucketLifecycle();

    } catch (error: unknown) {
      logger.error('Bucket configuration verification failed:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Configure bucket encryption
   */
  private async configureBucketEncryption(): Promise<void> {
    try {
      await this.s3Client.putBucketEncryption({
        Bucket: this.config.bucketName,
        ServerSideEncryptionConfiguration: {
          Rules: [{
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            },
            BucketKeyEnabled: true
          }]
        }
      }).promise();

      logger.info('Bucket encryption configured', {
        bucket: this.config.bucketName
      });

    } catch (error: unknown) {
      logger.error('Failed to configure bucket encryption:', error as Record<string, unknown>);
    }
  }

  /**
   * Enable bucket versioning
   */
  private async enableBucketVersioning(): Promise<void> {
    try {
      await this.s3Client.putBucketVersioning({
        Bucket: this.config.bucketName,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      }).promise();

      logger.info('Bucket versioning enabled', {
        bucket: this.config.bucketName
      });

    } catch (error: unknown) {
      logger.error('Failed to enable bucket versioning:', error as Record<string, unknown>);
    }
  }

  /**
   * Block public access
   */
  private async blockPublicAccess(): Promise<void> {
    try {
      await this.s3Client.putPublicAccessBlock({
        Bucket: this.config.bucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true
        }
      }).promise();

      logger.info('Public access blocked', {
        bucket: this.config.bucketName
      });

    } catch (error: unknown) {
      logger.error('Failed to block public access:', error as Record<string, unknown>);
    }
  }

  /**
   * Configure bucket lifecycle policy
   */
  private async configureBucketLifecycle(): Promise<void> {
    try {
      const lifecycleConfiguration: AWS.S3.BucketLifecycleConfiguration = {
        Rules: [
          {
            ID: 'DeleteOldVersions',
            Status: 'Enabled',
            Filter: {},
            NoncurrentVersionExpiration: {
              NoncurrentDays: 90
            }
          },
          {
            ID: 'DeleteIncompleteMultipartUploads',
            Status: 'Enabled',
            Filter: {},
            AbortIncompleteMultipartUpload: {
              DaysAfterInitiation: 7
            }
          }
        ]
      };

      // Add retention policy if configured
      if (this.config.retentionPeriod > 0) {
        lifecycleConfiguration.Rules.push({
          ID: 'DataRetention',
          Status: 'Enabled',
          Filter: {},
          Expiration: {
            Days: this.config.retentionPeriod
          }
        });
      }

      await this.s3Client.putBucketLifecycleConfiguration({
        Bucket: this.config.bucketName,
        LifecycleConfiguration: lifecycleConfiguration
      }).promise();

      logger.info('Bucket lifecycle policy configured', {
        bucket: this.config.bucketName,
        retentionPeriod: this.config.retentionPeriod
      });

    } catch (error: unknown) {
      logger.error('Failed to configure bucket lifecycle:', error as Record<string, unknown>);
    }
  }

  /**
   * Upload file securely
   */
  async uploadFile(
    key: string,
    data: Buffer | string,
    options: UploadOptions = {}
  ): Promise<StorageObject> {
    try {
      // Validate file size
      const dataSize = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
      if (dataSize > this.config.maxFileSize) {
        throw new Error(`File size ${dataSize} exceeds maximum of ${this.config.maxFileSize}`);
      }

      // Sanitize key
      const sanitizedKey = this.sanitizeKey(key);

      // Encrypt data if enabled
      let uploadData = data;
      let isEncrypted = false;

      if (options.enableEncryption !== false && this.config.enableEncryption) {
        if (Buffer.isBuffer(data)) {
          uploadData = await storageEncryptionService.encryptBuffer(data);
        } else {
          uploadData = await storageEncryptionService.encryptBuffer(Buffer.from(data));
        }
        isEncrypted = true;
      }

      // Prepare metadata
      const metadata = {
        'original-name': path.basename(key),
        'upload-timestamp': new Date().toISOString(),
        'content-hash': crypto.createHash('sha256').update(data).digest('hex'),
        'is-encrypted': isEncrypted.toString(),
        ...options.metadata
      };

      // Prepare tags
      const tags = {
        'Environment': process.env.NODE_ENV || 'development',
        'Service': 'botrt-ecommerce',
        'Encrypted': isEncrypted.toString(),
        ...options.tags
      };

      // Upload parameters
      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: this.config.bucketName,
        Key: sanitizedKey,
        Body: uploadData,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: metadata,
        Tagging: this.objectToTagString(tags),
        ACL: options.acl || 'private',
        StorageClass: options.storageClass || 'STANDARD'
      };

      // Add server-side encryption
      if (this.config.enableEncryption) {
        uploadParams.ServerSideEncryption = 'AES256';
      }

      // Set expiration if specified
      if (options.expiresIn) {
        const expiresDate = new Date();
        expiresDate.setSeconds(expiresDate.getSeconds() + options.expiresIn);
        uploadParams.Expires = expiresDate;
      }

      // Perform upload
      const result = await this.s3Client.upload(uploadParams).promise();

      // Track uploaded file
      this.uploadedFiles.set(sanitizedKey, {
        uploadedAt: new Date(),
        size: dataSize
      });

      const storageObject: StorageObject = {
        key: sanitizedKey,
        size: dataSize,
        lastModified: new Date(),
        etag: result.ETag || '',
        storageClass: uploadParams.StorageClass || 'STANDARD',
        metadata,
        tags,
        isEncrypted
      };

      logger.info('File uploaded successfully', {
        key: sanitizedKey,
        size: dataSize,
        encrypted: isEncrypted,
        bucket: this.config.bucketName
      });

      return storageObject;

    } catch (error: unknown) {
      logger.error('File upload failed:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Download file securely
   */
  async downloadFile(key: string): Promise<{
    data: Buffer;
    metadata: Record<string, string>;
    contentType: string;
  }> {
    try {
      const sanitizedKey = this.sanitizeKey(key);

      const params: AWS.S3.GetObjectRequest = {
        Bucket: this.config.bucketName,
        Key: sanitizedKey
      };

      const result = await this.s3Client.getObject(params).promise();

      if (!result.Body) {
        throw new Error('File not found or empty');
      }

      let data = result.Body as Buffer;
      const metadata = result.Metadata || {};
      const isEncrypted = metadata['is-encrypted'] === 'true';

      // Decrypt if necessary
      if (isEncrypted && this.config.enableEncryption) {
        data = await storageEncryptionService.decryptBuffer(data);
      }

      logger.info('File downloaded successfully', {
        key: sanitizedKey,
        size: data.length,
        encrypted: isEncrypted
      });

      return {
        data,
        metadata,
        contentType: result.ContentType || 'application/octet-stream'
      };

    } catch (error: unknown) {
      logger.error('File download failed:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Generate presigned URL for secure file access
   */
  async generatePresignedUrl(
    key: string,
    options: PresignedUrlOptions
  ): Promise<string> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const expiresIn = options.expiresIn || this.config.presignedUrlTTL;

      // Check if operation is allowed
      if (!this.config.allowedOperations.includes(options.operation.replace('Object', '') as StorageConfig['allowedOperations'][number])) {
        throw new Error(`Operation ${options.operation} is not allowed`);
      }

      const params: any = {
        Bucket: this.config.bucketName,
        Key: sanitizedKey,
        Expires: expiresIn,
        ...(options.contentType && { ContentType: options.contentType }),
        ...(options.contentLength && { ContentLength: options.contentLength }),
        ...(options.metadata && { Metadata: options.metadata })
      };

      const presignedUrl = await this.s3Client.getSignedUrlPromise(options.operation, params);

      // Log presigned URL generation for audit
      logger.info('Presigned URL generated', {
        key: sanitizedKey,
        operation: options.operation,
        expiresIn,
        contentType: options.contentType
      });

      return presignedUrl;

    } catch (error: unknown) {
      logger.error('Failed to generate presigned URL:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Delete file securely
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const sanitizedKey = this.sanitizeKey(key);

      // Check if delete operation is allowed
      if (!this.config.allowedOperations.includes('delete')) {
        throw new Error('Delete operation is not allowed');
      }

      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: this.config.bucketName,
        Key: sanitizedKey
      };

      await this.s3Client.deleteObject(params).promise();

      // Remove from tracking
      this.uploadedFiles.delete(sanitizedKey);

      logger.info('File deleted successfully', {
        key: sanitizedKey,
        bucket: this.config.bucketName
      });

    } catch (error: unknown) {
      logger.error('File deletion failed:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * List files with filtering and pagination
   */
  async listFiles(
    prefix?: string,
    maxKeys: number = 1000,
    continuationToken?: string
  ): Promise<{
    objects: StorageObject[];
    isTruncated: boolean;
    nextContinuationToken?: string;
  }> {
    try {
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: this.config.bucketName,
        MaxKeys: Math.min(maxKeys, 1000),
        Prefix: prefix
      };

      if (continuationToken) {
        params.ContinuationToken = continuationToken;
      }

      const result = await this.s3Client.listObjectsV2(params).promise();

      const objects: StorageObject[] = [];

      if (result.Contents) {
        for (const obj of result.Contents) {
          if (obj.Key) {
            // Get object metadata and tags
            const [metadata, tags] = await Promise.all([
              this.getObjectMetadata(obj.Key),
              this.getObjectTags(obj.Key)
            ]);

            objects.push({
              key: obj.Key,
              size: obj.Size || 0,
              lastModified: obj.LastModified || new Date(),
              etag: obj.ETag || '',
              storageClass: obj.StorageClass || 'STANDARD',
              metadata: metadata || {},
              tags: tags || {},
              isEncrypted: metadata?.['is-encrypted'] === 'true'
            });
          }
        }
      }

      return {
        objects,
        isTruncated: result.IsTruncated || false,
        nextContinuationToken: result.NextContinuationToken
      };

    } catch (error: unknown) {
      logger.error('File listing failed:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Get object metadata
   */
  private async getObjectMetadata(key: string): Promise<Record<string, string> | null> {
    try {
      const result = await this.s3Client.headObject({
        Bucket: this.config.bucketName,
        Key: key
      }).promise();

      return result.Metadata || null;

    } catch (_error) {
      return null;
    }
  }

  /**
   * Get object tags
   */
  private async getObjectTags(key: string): Promise<Record<string, string> | null> {
    try {
      const result = await this.s3Client.getObjectTagging({
        Bucket: this.config.bucketName,
        Key: key
      }).promise();

      const tags: Record<string, string> = {};
      if (result.TagSet) {
        for (const tag of result.TagSet) {
          if (tag.Key && tag.Value) {
            tags[tag.Key] = tag.Value;
          }
        }
      }

      return tags;

    } catch (_error) {
      return null;
    }
  }

  /**
   * Generate secure file access URL with CDN support
   */
  async generateSecureAccessUrl(
    key: string,
    _expiresIn: number = 3600
  ): Promise<string> {
    try {
      // Use CDN if configured
      if (this.config.enableCDN && this.config.cdnDomain) {
        // Generate CloudFront signed URL (implementation would depend on CDN provider)
        return this.generateCDNSignedUrl(key, _expiresIn);
      }

      // Fall back to S3 presigned URL
      return await this.generatePresignedUrl(key, {
        operation: 'getObject',
        expiresIn: _expiresIn
      });

    } catch (error: unknown) {
      logger.error('Failed to generate secure access URL:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Generate CDN signed URL (placeholder for CloudFront integration)
   */
  private generateCDNSignedUrl(key: string, _expiresIn: number): string {
    // This would implement CloudFront signed URL generation
    // For now, return the CDN URL with the key
    const sanitizedKey = this.sanitizeKey(key);
    return `https://${this.config.cdnDomain}/${sanitizedKey}`;
  }

  /**
   * Utility methods
   */
  private sanitizeKey(key: string): string {
    // Remove leading slashes and normalize path
    return key
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/')
      .replace(/[^a-zA-Z0-9._/-]/g, '_');
  }

  private objectToTagString(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Clean up expired files
   */
  private startCleanupTimer(): void {
    setInterval(async () => {
      try {
        await this.cleanupExpiredFiles();
      } catch (error: unknown) {
        logger.error('File cleanup error:', error as Record<string, unknown>);
      }
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private async cleanupExpiredFiles(): Promise<void> {
    try {
      // This would implement cleanup of expired files based on lifecycle policies
      // For now, just clean up tracking map
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, data] of this.uploadedFiles.entries()) {
        // Clean up tracking for files older than 30 days
        if (now - data.uploadedAt.getTime() > 30 * 24 * 60 * 60 * 1000) {
          this.uploadedFiles.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info('File tracking cleanup completed', {
          cleanedCount,
          remainingFiles: this.uploadedFiles.size
        });
      }

    } catch (error: unknown) {
      logger.error('File cleanup error:', error as Record<string, unknown>);
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    config: StorageConfig;
    trackedFiles: number;
    provider: string;
  } {
    return {
      config: this.config,
      trackedFiles: this.uploadedFiles.size,
      provider: this.config.provider
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: StorageConfig & { trackedFiles: number; provider: string };
    bucketAccessible: boolean;
  }> {
    try {
      const stats = this.getStats();

      // Test bucket access
      await this.s3Client.headBucket({ Bucket: this.config.bucketName }).promise();

      return {
        status: 'healthy',
        stats: { ...stats.config, trackedFiles: stats.trackedFiles, provider: stats.provider as StorageConfig['provider']  },
        bucketAccessible: true
      };

    } catch (error: unknown) {
      logger.error('Secure storage service health check failed:', error as Record<string, unknown>);
      return {
        status: 'error',
        stats: { ...this.config, trackedFiles: this.uploadedFiles.size, provider: this.config.provider },
        bucketAccessible: false
      };
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): StorageConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const secureStorageService = SecureStorageService.getInstance();

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureStorageService = exports.SecureStorageService = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
const StorageEncryptionService_1 = require("./StorageEncryptionService");
class SecureStorageService {
    constructor() {
        this.uploadedFiles = new Map();
        this.config = {
            provider: process.env.STORAGE_PROVIDER || 'aws',
            bucketName: process.env.STORAGE_BUCKET_NAME || 'botrt-secure-storage',
            region: process.env.STORAGE_REGION || 'us-east-1',
            endpoint: process.env.STORAGE_ENDPOINT,
            enableEncryption: process.env.STORAGE_ENABLE_ENCRYPTION !== 'false',
            enableVersioning: process.env.STORAGE_ENABLE_VERSIONING !== 'false',
            enableAccessLogging: process.env.STORAGE_ENABLE_ACCESS_LOGGING !== 'false',
            publicAccessBlocked: process.env.STORAGE_BLOCK_PUBLIC_ACCESS !== 'false',
            presignedUrlTTL: parseInt(process.env.STORAGE_PRESIGNED_URL_TTL || '3600'),
            maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE || '104857600'),
            allowedOperations: ['read', 'write'],
            enableVirusScan: process.env.STORAGE_ENABLE_VIRUS_SCAN === 'true',
            enableBackup: process.env.STORAGE_ENABLE_BACKUP !== 'false',
            retentionPeriod: parseInt(process.env.STORAGE_RETENTION_PERIOD || '2555'),
            enableCDN: process.env.STORAGE_ENABLE_CDN === 'true',
            cdnDomain: process.env.STORAGE_CDN_DOMAIN
        };
        this.initializeClient();
        this.startCleanupTimer();
        logger_1.logger.info('Secure storage service initialized', {
            provider: this.config.provider,
            bucket: this.config.bucketName,
            region: this.config.region,
            encryption: this.config.enableEncryption
        });
    }
    static getInstance() {
        if (!SecureStorageService.instance) {
            SecureStorageService.instance = new SecureStorageService();
        }
        return SecureStorageService.instance;
    }
    async initializeClient() {
        try {
            const awsCredentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
            };
            const s3Config = {
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
            if (this.config.endpoint) {
                s3Config.endpoint = this.config.endpoint;
                s3Config.s3ForcePathStyle = true;
            }
            this.s3Client = new aws_sdk_1.default.S3(s3Config);
            await this.verifyBucketConfiguration();
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize storage client:', error);
            throw error;
        }
    }
    async verifyBucketConfiguration() {
        try {
            await this.s3Client.headBucket({ Bucket: this.config.bucketName }).promise();
            if (this.config.enableEncryption) {
                try {
                    const encryption = await this.s3Client.getBucketEncryption({
                        Bucket: this.config.bucketName
                    }).promise();
                    logger_1.logger.info('Bucket encryption verified', {
                        bucket: this.config.bucketName,
                        encryption: encryption.ServerSideEncryptionConfiguration
                    });
                }
                catch (_error) {
                    logger_1.logger.warn('Bucket encryption not configured, setting up default encryption');
                    await this.configureBucketEncryption();
                }
            }
            if (this.config.enableVersioning) {
                const versioning = await this.s3Client.getBucketVersioning({
                    Bucket: this.config.bucketName
                }).promise();
                if (versioning.Status !== 'Enabled') {
                    logger_1.logger.warn('Bucket versioning not enabled, enabling versioning');
                    await this.enableBucketVersioning();
                }
            }
            if (this.config.publicAccessBlocked) {
                try {
                    const publicAccessBlock = await this.s3Client.getPublicAccessBlock({
                        Bucket: this.config.bucketName
                    }).promise();
                    if (!publicAccessBlock.PublicAccessBlockConfiguration?.BlockPublicAcls) {
                        logger_1.logger.warn('Public access not properly blocked, configuring block');
                        await this.blockPublicAccess();
                    }
                }
                catch (_error) {
                    logger_1.logger.warn('Public access block not configured, setting up block');
                    await this.blockPublicAccess();
                }
            }
            await this.configureBucketLifecycle();
        }
        catch (error) {
            logger_1.logger.error('Bucket configuration verification failed:', error);
            throw error;
        }
    }
    async configureBucketEncryption() {
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
            logger_1.logger.info('Bucket encryption configured', {
                bucket: this.config.bucketName
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to configure bucket encryption:', error);
        }
    }
    async enableBucketVersioning() {
        try {
            await this.s3Client.putBucketVersioning({
                Bucket: this.config.bucketName,
                VersioningConfiguration: {
                    Status: 'Enabled'
                }
            }).promise();
            logger_1.logger.info('Bucket versioning enabled', {
                bucket: this.config.bucketName
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to enable bucket versioning:', error);
        }
    }
    async blockPublicAccess() {
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
            logger_1.logger.info('Public access blocked', {
                bucket: this.config.bucketName
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to block public access:', error);
        }
    }
    async configureBucketLifecycle() {
        try {
            const lifecycleConfiguration = {
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
            logger_1.logger.info('Bucket lifecycle policy configured', {
                bucket: this.config.bucketName,
                retentionPeriod: this.config.retentionPeriod
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to configure bucket lifecycle:', error);
        }
    }
    async uploadFile(key, data, options = {}) {
        try {
            const dataSize = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
            if (dataSize > this.config.maxFileSize) {
                throw new Error(`File size ${dataSize} exceeds maximum of ${this.config.maxFileSize}`);
            }
            const sanitizedKey = this.sanitizeKey(key);
            let uploadData = data;
            let isEncrypted = false;
            if (options.enableEncryption !== false && this.config.enableEncryption) {
                if (Buffer.isBuffer(data)) {
                    uploadData = await StorageEncryptionService_1.storageEncryptionService.encryptBuffer(data);
                }
                else {
                    uploadData = await StorageEncryptionService_1.storageEncryptionService.encryptBuffer(Buffer.from(data));
                }
                isEncrypted = true;
            }
            const metadata = {
                'original-name': path_1.default.basename(key),
                'upload-timestamp': new Date().toISOString(),
                'content-hash': crypto_1.default.createHash('sha256').update(data).digest('hex'),
                'is-encrypted': isEncrypted.toString(),
                ...options.metadata
            };
            const tags = {
                'Environment': process.env.NODE_ENV || 'development',
                'Service': 'botrt-ecommerce',
                'Encrypted': isEncrypted.toString(),
                ...options.tags
            };
            const uploadParams = {
                Bucket: this.config.bucketName,
                Key: sanitizedKey,
                Body: uploadData,
                ContentType: options.contentType || 'application/octet-stream',
                Metadata: metadata,
                Tagging: this.objectToTagString(tags),
                ACL: options.acl || 'private',
                StorageClass: options.storageClass || 'STANDARD'
            };
            if (this.config.enableEncryption) {
                uploadParams.ServerSideEncryption = 'AES256';
            }
            if (options.expiresIn) {
                const expiresDate = new Date();
                expiresDate.setSeconds(expiresDate.getSeconds() + options.expiresIn);
                uploadParams.Expires = expiresDate;
            }
            const result = await this.s3Client.upload(uploadParams).promise();
            this.uploadedFiles.set(sanitizedKey, {
                uploadedAt: new Date(),
                size: dataSize
            });
            const storageObject = {
                key: sanitizedKey,
                size: dataSize,
                lastModified: new Date(),
                etag: result.ETag || '',
                storageClass: uploadParams.StorageClass || 'STANDARD',
                metadata,
                tags,
                isEncrypted
            };
            logger_1.logger.info('File uploaded successfully', {
                key: sanitizedKey,
                size: dataSize,
                encrypted: isEncrypted,
                bucket: this.config.bucketName
            });
            return storageObject;
        }
        catch (error) {
            logger_1.logger.error('File upload failed:', error);
            throw error;
        }
    }
    async downloadFile(key) {
        try {
            const sanitizedKey = this.sanitizeKey(key);
            const params = {
                Bucket: this.config.bucketName,
                Key: sanitizedKey
            };
            const result = await this.s3Client.getObject(params).promise();
            if (!result.Body) {
                throw new Error('File not found or empty');
            }
            let data = result.Body;
            const metadata = result.Metadata || {};
            const isEncrypted = metadata['is-encrypted'] === 'true';
            if (isEncrypted && this.config.enableEncryption) {
                data = await StorageEncryptionService_1.storageEncryptionService.decryptBuffer(data);
            }
            logger_1.logger.info('File downloaded successfully', {
                key: sanitizedKey,
                size: data.length,
                encrypted: isEncrypted
            });
            return {
                data,
                metadata,
                contentType: result.ContentType || 'application/octet-stream'
            };
        }
        catch (error) {
            logger_1.logger.error('File download failed:', error);
            throw error;
        }
    }
    async generatePresignedUrl(key, options) {
        try {
            const sanitizedKey = this.sanitizeKey(key);
            const expiresIn = options.expiresIn || this.config.presignedUrlTTL;
            if (!this.config.allowedOperations.includes(options.operation.replace('Object', ''))) {
                throw new Error(`Operation ${options.operation} is not allowed`);
            }
            const params = {
                Bucket: this.config.bucketName,
                Key: sanitizedKey,
                Expires: expiresIn,
                ...(options.contentType && { ContentType: options.contentType }),
                ...(options.contentLength && { ContentLength: options.contentLength }),
                ...(options.metadata && { Metadata: options.metadata })
            };
            const presignedUrl = await this.s3Client.getSignedUrlPromise(options.operation, params);
            logger_1.logger.info('Presigned URL generated', {
                key: sanitizedKey,
                operation: options.operation,
                expiresIn,
                contentType: options.contentType
            });
            return presignedUrl;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate presigned URL:', error);
            throw error;
        }
    }
    async deleteFile(key) {
        try {
            const sanitizedKey = this.sanitizeKey(key);
            if (!this.config.allowedOperations.includes('delete')) {
                throw new Error('Delete operation is not allowed');
            }
            const params = {
                Bucket: this.config.bucketName,
                Key: sanitizedKey
            };
            await this.s3Client.deleteObject(params).promise();
            this.uploadedFiles.delete(sanitizedKey);
            logger_1.logger.info('File deleted successfully', {
                key: sanitizedKey,
                bucket: this.config.bucketName
            });
        }
        catch (error) {
            logger_1.logger.error('File deletion failed:', error);
            throw error;
        }
    }
    async listFiles(prefix, maxKeys = 1000, continuationToken) {
        try {
            const params = {
                Bucket: this.config.bucketName,
                MaxKeys: Math.min(maxKeys, 1000),
                Prefix: prefix
            };
            if (continuationToken) {
                params.ContinuationToken = continuationToken;
            }
            const result = await this.s3Client.listObjectsV2(params).promise();
            const objects = [];
            if (result.Contents) {
                for (const obj of result.Contents) {
                    if (obj.Key) {
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
        }
        catch (error) {
            logger_1.logger.error('File listing failed:', error);
            throw error;
        }
    }
    async getObjectMetadata(key) {
        try {
            const result = await this.s3Client.headObject({
                Bucket: this.config.bucketName,
                Key: key
            }).promise();
            return result.Metadata || null;
        }
        catch (_error) {
            return null;
        }
    }
    async getObjectTags(key) {
        try {
            const result = await this.s3Client.getObjectTagging({
                Bucket: this.config.bucketName,
                Key: key
            }).promise();
            const tags = {};
            if (result.TagSet) {
                for (const tag of result.TagSet) {
                    if (tag.Key && tag.Value) {
                        tags[tag.Key] = tag.Value;
                    }
                }
            }
            return tags;
        }
        catch (_error) {
            return null;
        }
    }
    async generateSecureAccessUrl(key, _expiresIn = 3600) {
        try {
            if (this.config.enableCDN && this.config.cdnDomain) {
                return this.generateCDNSignedUrl(key, _expiresIn);
            }
            return await this.generatePresignedUrl(key, {
                operation: 'getObject',
                expiresIn: _expiresIn
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to generate secure access URL:', error);
            throw error;
        }
    }
    generateCDNSignedUrl(key, _expiresIn) {
        const sanitizedKey = this.sanitizeKey(key);
        return `https://${this.config.cdnDomain}/${sanitizedKey}`;
    }
    sanitizeKey(key) {
        return key
            .replace(/^\/+/, '')
            .replace(/\/+/g, '/')
            .replace(/[^a-zA-Z0-9._/-]/g, '_');
    }
    objectToTagString(tags) {
        return Object.entries(tags)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
    }
    startCleanupTimer() {
        setInterval(async () => {
            try {
                await this.cleanupExpiredFiles();
            }
            catch (error) {
                logger_1.logger.error('File cleanup error:', error);
            }
        }, 24 * 60 * 60 * 1000);
    }
    async cleanupExpiredFiles() {
        try {
            const now = Date.now();
            let cleanedCount = 0;
            for (const [key, data] of this.uploadedFiles.entries()) {
                if (now - data.uploadedAt.getTime() > 30 * 24 * 60 * 60 * 1000) {
                    this.uploadedFiles.delete(key);
                    cleanedCount++;
                }
            }
            if (cleanedCount > 0) {
                logger_1.logger.info('File tracking cleanup completed', {
                    cleanedCount,
                    remainingFiles: this.uploadedFiles.size
                });
            }
        }
        catch (error) {
            logger_1.logger.error('File cleanup error:', error);
        }
    }
    getStats() {
        return {
            config: this.config,
            trackedFiles: this.uploadedFiles.size,
            provider: this.config.provider
        };
    }
    async healthCheck() {
        try {
            const stats = this.getStats();
            await this.s3Client.headBucket({ Bucket: this.config.bucketName }).promise();
            return {
                status: 'healthy',
                stats: { ...stats.config, trackedFiles: stats.trackedFiles, provider: stats.provider },
                bucketAccessible: true
            };
        }
        catch (error) {
            logger_1.logger.error('Secure storage service health check failed:', error);
            return {
                status: 'error',
                stats: { ...this.config, trackedFiles: this.uploadedFiles.size, provider: this.config.provider },
                bucketAccessible: false
            };
        }
    }
    getConfiguration() {
        return { ...this.config };
    }
}
exports.SecureStorageService = SecureStorageService;
exports.secureStorageService = SecureStorageService.getInstance();
//# sourceMappingURL=SecureStorageService.js.map
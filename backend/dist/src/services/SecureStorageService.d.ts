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
    retentionPeriod: number;
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
export declare class SecureStorageService {
    private static instance;
    private config;
    private s3Client;
    private uploadedFiles;
    private constructor();
    static getInstance(): SecureStorageService;
    private initializeClient;
    private verifyBucketConfiguration;
    private configureBucketEncryption;
    private enableBucketVersioning;
    private blockPublicAccess;
    private configureBucketLifecycle;
    uploadFile(key: string, data: Buffer | string, options?: UploadOptions): Promise<StorageObject>;
    downloadFile(key: string): Promise<{
        data: Buffer;
        metadata: Record<string, string>;
        contentType: string;
    }>;
    generatePresignedUrl(key: string, options: PresignedUrlOptions): Promise<string>;
    deleteFile(key: string): Promise<void>;
    listFiles(prefix?: string, maxKeys?: number, continuationToken?: string): Promise<{
        objects: StorageObject[];
        isTruncated: boolean;
        nextContinuationToken?: string;
    }>;
    private getObjectMetadata;
    private getObjectTags;
    generateSecureAccessUrl(key: string, _expiresIn?: number): Promise<string>;
    private generateCDNSignedUrl;
    private sanitizeKey;
    private objectToTagString;
    private startCleanupTimer;
    private cleanupExpiredFiles;
    getStats(): {
        config: StorageConfig;
        trackedFiles: number;
        provider: string;
    };
    healthCheck(): Promise<{
        status: string;
        stats: StorageConfig & {
            trackedFiles: number;
            provider: string;
        };
        bucketAccessible: boolean;
    }>;
    getConfiguration(): StorageConfig;
}
export declare const secureStorageService: SecureStorageService;
//# sourceMappingURL=SecureStorageService.d.ts.map
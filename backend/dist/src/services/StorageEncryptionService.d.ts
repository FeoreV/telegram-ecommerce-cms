export interface StorageEncryptionConfig {
    enabled: boolean;
    encryptionAlgorithm: string;
    keyDerivationIterations: number;
    storageBasePath: string;
    backupPath: string;
    tempPath: string;
}
export interface EncryptedFileMetadata {
    originalName: string;
    encryptedName: string;
    size: number;
    encryptedSize: number;
    mimeType: string;
    checksum: string;
    encryptedAt: Date;
    keyVersion: string;
}
export interface StorageStats {
    totalFiles: number;
    totalSize: number;
    encryptedFiles: number;
    encryptedSize: number;
    compressionRatio: number;
}
export declare class StorageEncryptionService {
    private static instance;
    private config;
    private constructor();
    static getInstance(): StorageEncryptionService;
    initialize(): Promise<void>;
    private ensureDirectories;
    private verifyEncryption;
    encryptFile(filePath: string, originalName: string, mimeType?: string): Promise<EncryptedFileMetadata>;
    decryptFile(encryptedName: string): Promise<{
        data: Buffer;
        metadata: EncryptedFileMetadata;
    }>;
    private encryptData;
    private decryptData;
    encryptBuffer(data: Buffer): Promise<Buffer>;
    decryptBuffer(encryptedData: Buffer): Promise<Buffer>;
    private generateEncryptedFilename;
    private storeMetadata;
    private loadMetadata;
    deleteFile(encryptedName: string): Promise<void>;
    listFiles(): Promise<EncryptedFileMetadata[]>;
    getStorageStats(): Promise<StorageStats>;
    encryptExistingFiles(sourceDir: string): Promise<number>;
    healthCheck(): Promise<{
        status: string;
        enabled: boolean;
        stats: StorageStats;
        directories: {
            [key: string]: boolean;
        };
    }>;
    private directoryExists;
    getConfiguration(): StorageEncryptionConfig;
}
export declare const storageEncryptionService: StorageEncryptionService;
//# sourceMappingURL=StorageEncryptionService.d.ts.map
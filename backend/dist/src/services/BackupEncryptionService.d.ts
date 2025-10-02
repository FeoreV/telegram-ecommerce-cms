export interface BackupEncryptionConfig {
    enabled: boolean;
    backupPath: string;
    encryptedBackupPath: string;
    compressionEnabled: boolean;
    compressionLevel: number;
    retentionDays: number;
    keyRotationDays: number;
}
export interface BackupMetadata {
    backupId: string;
    originalName: string;
    encryptedName: string;
    createdAt: Date;
    size: number;
    encryptedSize: number;
    checksum: string;
    keyVersion: string;
    compressionRatio: number;
    backupType: 'database' | 'files' | 'logs' | 'full';
    retentionUntil: Date;
}
export interface BackupStats {
    totalBackups: number;
    totalSize: number;
    encryptedSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    averageCompressionRatio: number;
}
export declare class BackupEncryptionService {
    private static instance;
    private config;
    private constructor();
    static getInstance(): BackupEncryptionService;
    initialize(): Promise<void>;
    private ensureDirectories;
    private verifyEncryption;
    createEncryptedBackup(sourcePath: string, backupType: BackupMetadata['backupType'], backupName?: string): Promise<BackupMetadata>;
    restoreFromBackup(backupId: string, targetPath: string): Promise<BackupMetadata>;
    private encryptData;
    private decryptData;
    private compressData;
    private decompressData;
    private generateBackupId;
    private storeBackupMetadata;
    private loadBackupMetadata;
    listBackups(backupType?: BackupMetadata['backupType']): Promise<BackupMetadata[]>;
    cleanupExpiredBackups(): Promise<number>;
    deleteBackup(backupId: string): Promise<void>;
    getBackupStats(): Promise<BackupStats>;
    healthCheck(): Promise<{
        status: string;
        enabled: boolean;
        stats: BackupStats;
        directories: {
            [key: string]: boolean;
        };
    }>;
    private directoryExists;
    getConfiguration(): BackupEncryptionConfig;
}
export declare const backupEncryptionService: BackupEncryptionService;
//# sourceMappingURL=BackupEncryptionService.d.ts.map
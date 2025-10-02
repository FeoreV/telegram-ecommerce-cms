export interface BackupConfig {
    enableSecureBackups: boolean;
    enableEncryption: boolean;
    enableCompression: boolean;
    enableDeduplication: boolean;
    enableIntegrityChecks: boolean;
    encryptionAlgorithm: string;
    keyRotationIntervalDays: number;
    enableEnvelopeEncryption: boolean;
    encryptionKeyStrength: number;
    enableAutomaticBackups: boolean;
    fullBackupIntervalHours: number;
    incrementalBackupIntervalHours: number;
    backupRetentionDays: number;
    maxBackupVersions: number;
    backupStorageType: 'local' | 's3' | 'azure' | 'gcp' | 'vault';
    storageEndpoint?: string;
    storageRegion?: string;
    storageBucket?: string;
    enableCrossRegionReplication: boolean;
    enableAccessLogging: boolean;
    enableTamperDetection: boolean;
    enableBackupSigning: boolean;
    enableImmutableStorage: boolean;
    maxParallelBackups: number;
    backupBandwidthLimitMBps: number;
    enableResumableBackups: boolean;
    backupChunkSizeMB: number;
    enableGDPRCompliance: boolean;
    enableSOXCompliance: boolean;
    enableHIPAACompliance: boolean;
    enablePCICompliance: boolean;
    enableBackupMonitoring: boolean;
    enableAlerting: boolean;
    alertWebhookUrl?: string;
}
export interface BackupMetadata {
    id: string;
    timestamp: Date;
    type: 'full' | 'incremental' | 'differential' | 'snapshot';
    source: string;
    version: string;
    encrypted: boolean;
    encryptionKeyId: string;
    encryptionAlgorithm: string;
    keyDerivationFunction: string;
    checksum: string;
    checksumAlgorithm: string;
    signature?: string;
    signatureAlgorithm?: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    compressionAlgorithm?: string;
    storageLocation: string;
    storageProvider: string;
    storageRegion?: string;
    storageClass?: string;
    backupDuration: number;
    throughputMBps: number;
    networkBandwidthUsed: number;
    complianceFlags: {
        gdpr: boolean;
        sox: boolean;
        hipaa: boolean;
        pci: boolean;
    };
    auditTrail: BackupAuditEvent[];
    retentionPolicy: string;
    expirationDate: Date;
    immutable: boolean;
    recoveryTested: boolean;
    lastRecoveryTest?: Date;
    recoveryRTO: number;
    recoveryRPO: number;
}
export interface BackupAuditEvent {
    timestamp: Date;
    action: 'created' | 'encrypted' | 'stored' | 'verified' | 'tested' | 'restored' | 'deleted';
    user: string;
    details: Record<string, unknown>;
    outcome: 'success' | 'failure' | 'warning';
}
export interface RestoreOptions {
    backupId: string;
    targetLocation: string;
    verifyIntegrity: boolean;
    enableProgressTracking: boolean;
    maxBandwidthMBps?: number;
    preservePermissions: boolean;
    preserveTimestamps: boolean;
    decryptionKeyId?: string;
}
export interface BackupJob {
    id: string;
    type: 'backup' | 'restore' | 'verify';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    source: string;
    destination: string;
    progress: number;
    startTime: Date;
    endTime?: Date;
    errorMessage?: string;
    metadata?: BackupMetadata;
}
export declare class SecureBackupService {
    private static instance;
    private config;
    private activeJobs;
    private backupMetadata;
    private encryptionKeys;
    private backupScheduler;
    private constructor();
    static getInstance(): SecureBackupService;
    private initializeSecureBackup;
    private initializeEncryptionKeys;
    private initializeStorage;
    private initializeS3Storage;
    private initializeAzureStorage;
    private initializeGCPStorage;
    private initializeVaultStorage;
    private initializeLocalStorage;
    private loadBackupMetadata;
    private verifyExistingBackups;
    createBackup(source: string, type?: BackupMetadata['type'], options?: {
        compression?: boolean;
        encryption?: boolean;
        immediateUpload?: boolean;
        retentionPolicy?: string;
    }): Promise<string>;
    private createBackupMetadata;
    private selectEncryptionKey;
    private generateBackupPath;
    private performBackup;
    private readSourceData;
    private createDatabaseBackup;
    private createFileBackup;
    private compressData;
    private encryptBackupData;
    private signBackupData;
    private writeBackupData;
    private uploadBackupToStorage;
    verifyBackupIntegrity(backupId: string): Promise<boolean>;
    private readBackupData;
    private verifyBackupSignature;
    restoreFromBackup(options: RestoreOptions): Promise<string>;
    private decryptBackupData;
    private decompressData;
    private restoreData;
    private handleCorruptedBackup;
    private logBackupEvent;
    private startAutomaticBackups;
    private performScheduledBackup;
    private getBackupSources;
    getStats(): {
        config: BackupConfig;
        totalBackups: number;
        activeJobs: number;
        storageUsed: number;
        lastBackup?: Date;
        nextScheduledBackup?: Date;
        recentBackups: number;
        failedJobs: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: {
            config: BackupConfig;
            totalBackups: number;
            activeJobs: number;
            storageUsed: number;
            lastBackup?: Date;
            nextScheduledBackup?: Date;
            recentBackups: number;
            failedJobs: number;
        };
    }>;
}
export declare const secureBackupService: SecureBackupService;
//# sourceMappingURL=SecureBackupService.d.ts.map
export interface EncryptionConfig {
    enableFieldLevelEncryption: boolean;
    encryptionKeyRotationDays: number;
    auditRetentionDays: number;
    encryptedFields: {
        [tableName: string]: string[];
    };
}
export interface EncryptionStats {
    totalEncryptedRecords: number;
    encryptedTables: number;
    lastKeyRotation: Date | null;
    auditLogSize: number;
}
export declare class DatabaseEncryptionService {
    private static instance;
    private config;
    private constructor();
    static getInstance(): DatabaseEncryptionService;
    initialize(): Promise<void>;
    private checkEncryptionSchema;
    private setupEncryptionKeys;
    encryptExistingData(tableName: string, batchSize?: number): Promise<number>;
    private encryptRecord;
    private getKeyNameForTable;
    rotateEncryptionKeys(): Promise<{
        [tableName: string]: number;
    }>;
    getEncryptionStats(): Promise<EncryptionStats>;
    cleanupAuditLogs(): Promise<number>;
    healthCheck(): Promise<{
        status: string;
        encryptionEnabled: boolean;
        schemaExists: boolean;
        stats: EncryptionStats;
    }>;
    getConfiguration(): EncryptionConfig;
}
export declare const databaseEncryptionService: DatabaseEncryptionService;
//# sourceMappingURL=DatabaseEncryptionService.d.ts.map
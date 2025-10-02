export interface BackupOptions {
    includeUploads?: boolean;
    includeAuditLogs?: boolean;
    compression?: boolean;
}
export interface BackupInfo {
    id: string;
    filename: string;
    size: number;
    createdAt: Date;
    type: 'manual' | 'scheduled';
    status: 'creating' | 'completed' | 'failed';
    options: BackupOptions;
    metadata: {
        version: string;
        recordCounts: Record<string, number>;
    };
}
export declare class BackupService {
    private static backupsDir;
    private static uploadsDir;
    static initialize(): Promise<void>;
    static createBackup(adminId: string, options?: BackupOptions, type?: 'manual' | 'scheduled'): Promise<BackupInfo>;
    private static exportDatabaseData;
    private static exportUploads;
    private static compressBackup;
    static restoreFromBackup(backupFilename: string, adminId: string, options?: {
        restoreUploads?: boolean;
        skipExisting?: boolean;
    }): Promise<void>;
    private static restoreTable;
    private static checkRecordExists;
    private static insertRecord;
    private static restoreUploads;
    private static getDatabaseStats;
    static listBackups(): Promise<BackupInfo[]>;
    static deleteBackup(filename: string, adminId: string): Promise<void>;
    static scheduleBackup(cronExpression: string, options: BackupOptions): Promise<void>;
}
export default BackupService;
//# sourceMappingURL=backupService.d.ts.map
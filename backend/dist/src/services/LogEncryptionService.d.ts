import { Transform, TransformCallback } from 'stream';
export interface LogEncryptionConfig {
    enabled: boolean;
    logBasePath: string;
    encryptedLogPath: string;
    rotationSize: number;
    rotationInterval: number;
    retentionDays: number;
    compressionEnabled: boolean;
    realtimeEncryption: boolean;
}
export interface EncryptedLogMetadata {
    logId: string;
    originalFile: string;
    encryptedFile: string;
    createdAt: Date;
    rotatedAt: Date;
    size: number;
    encryptedSize: number;
    checksum: string;
    keyVersion: string;
    logLevel: string;
    service: string;
}
export interface LogStats {
    totalLogs: number;
    totalSize: number;
    encryptedSize: number;
    oldestLog: Date | null;
    newestLog: Date | null;
    logsByLevel: {
        [level: string]: number;
    };
}
export declare class LogEncryptionService {
    private static instance;
    private config;
    private encryptionStreams;
    private constructor();
    static getInstance(): LogEncryptionService;
    initialize(): Promise<void>;
    private ensureDirectories;
    createEncryptedLogStream(logFile: string, logLevel?: string, service?: string): EncryptedLogStream;
    encryptLogFile(logFilePath: string, logLevel?: string, service?: string): Promise<EncryptedLogMetadata>;
    decryptLogFile(logId: string, targetPath?: string): Promise<{
        data: Buffer;
        metadata: EncryptedLogMetadata;
    }>;
    private encryptLogData;
    private decryptLogData;
    private compressLogData;
    private decompressLogData;
    private generateLogId;
    private storeLogMetadata;
    private loadLogMetadata;
    private setupLogRotation;
    private rotateLogsIfNeeded;
    private cleanupOldLogs;
    listLogs(service?: string, logLevel?: string): Promise<EncryptedLogMetadata[]>;
    deleteLog(logId: string): Promise<void>;
    getLogStats(): Promise<LogStats>;
    healthCheck(): Promise<{
        status: string;
        enabled: boolean;
        realtimeEncryption: boolean;
        stats: LogStats;
        activeStreams: number;
    }>;
    getConfiguration(): LogEncryptionConfig;
}
declare class EncryptedLogStream extends Transform {
    private buffer;
    private config;
    private logFile;
    private logLevel;
    private service;
    constructor(logFile: string, logLevel: string, service: string, config: LogEncryptionConfig);
    _transform(chunk: unknown, encoding: BufferEncoding, callback: TransformCallback): void;
    _flush(callback: TransformCallback): void;
    private encryptLogLine;
}
export declare const logEncryptionService: LogEncryptionService;
export {};
//# sourceMappingURL=LogEncryptionService.d.ts.map
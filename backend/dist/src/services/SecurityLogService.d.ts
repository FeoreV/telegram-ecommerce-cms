export interface SecurityLogConfig {
    enableSecurityLogging: boolean;
    enableEncryption: boolean;
    enableCompression: boolean;
    enableWriteOnceStorage: boolean;
    logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
    securityEventLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    storageType: 'file' | 's3' | 'elasticsearch' | 'splunk';
    retentionDays: number;
    maxLogSize: number;
    rotationInterval: number;
    encryptionAlgorithm: string;
    keyRotationInterval: number;
    enableIntegrityChecks: boolean;
    enableSIEMIntegration: boolean;
    siemEndpoint?: string;
    siemApiKey?: string;
    siemFormat: 'CEF' | 'LEEF' | 'JSON' | 'SYSLOG';
    alertThresholds: {
        failedLogins: number;
        suspiciousActivity: number;
        dataAccess: number;
        privilegedAccess: number;
    };
}
export interface SecurityEvent {
    id: string;
    timestamp: Date;
    eventType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    category: 'authentication' | 'authorization' | 'data_access' | 'system' | 'network' | 'application';
    userId?: string;
    sessionId?: string;
    ipAddress: string;
    userAgent?: string;
    resource?: string;
    action?: string;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
    details: Record<string, any>;
    riskScore: number;
    tags: string[];
    correlationId?: string;
    geoLocation?: {
        country: string;
        region: string;
        city: string;
        coordinates?: {
            latitude: number;
            longitude: number;
        };
    };
    deviceInfo?: {
        fingerprint: string;
        type: string;
        os: string;
        browser: string;
    };
    compliance: {
        pii: boolean;
        gdpr: boolean;
        pci: boolean;
        hipaa: boolean;
    };
}
export interface LogEntry {
    id: string;
    timestamp: Date;
    level: string;
    message: string;
    metadata: SecurityEvent;
    source: string;
    encrypted: boolean;
    checksum: string;
    signature?: string;
}
export interface SIEMAlert {
    id: string;
    timestamp: Date;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    description: string;
    events: SecurityEvent[];
    indicators: string[];
    recommendations: string[];
    status: 'open' | 'investigating' | 'resolved' | 'false_positive';
}
export declare class SecurityLogService {
    private static instance;
    private config;
    private logBuffer;
    private encryptionKeys;
    private alertRules;
    private readonly bufferFlushInterval;
    private readonly maxBufferSize;
    private isInitialized;
    private constructor();
    static getInstance(): SecurityLogService;
    waitForInitialization(timeoutMs?: number): Promise<void>;
    private initializeSecurityLogging;
    private initializeEncryptionKeys;
    private initializeAlertRules;
    private initializeStorage;
    private initializeFileStorage;
    private initializeElasticsearchStorage;
    private initializeS3Storage;
    private initializeSplunkStorage;
    private testSIEMConnection;
    private createTestEvent;
    logSecurityEvent(event: Partial<SecurityEvent>): Promise<void>;
    logAuthenticationEvent(userId: string, action: string, success: boolean, ipAddress: string, userAgent?: string, details?: Record<string, any>): Promise<void>;
    logDataAccessEvent(userId: string, resource: string, action: string, success: boolean, ipAddress: string, details?: Record<string, any>): Promise<void>;
    logPrivilegedAccessEvent(userId: string, action: string, resource: string, ipAddress: string, success: boolean, details?: Record<string, any>): Promise<void>;
    logNetworkSecurityEvent(eventType: string, severity: SecurityEvent['severity'], ipAddress: string, details?: Record<string, any>): Promise<void>;
    logApplicationSecurityEvent(eventType: string, severity: SecurityEvent['severity'], ipAddress: string, userAgent?: string, details?: Record<string, any>): Promise<void>;
    private calculateNetworkRiskScore;
    private calculateApplicationRiskScore;
    private checkAlertRules;
    private evaluateAlertRule;
    private evaluateThresholdRule;
    private evaluateMatchRule;
    private evaluatePatternRule;
    private triggerAlert;
    private extractIndicators;
    private generateRecommendations;
    private flushBuffer;
    private writeEventsToStorage;
    private writeToFileStorage;
    private writeToElasticsearch;
    private writeToS3Storage;
    private writeToSplunk;
    private createLogEntry;
    private encryptLogData;
    private sendToSIEM;
    private formatEventsForSIEM;
    private formatAsCEF;
    private formatAsLEEF;
    private formatAsSyslog;
    private formatAsJSON;
    private mapSeverityToCEF;
    private mapSeverityToSyslog;
    private sendAlertToSIEM;
    private storeAlert;
    private startBackgroundTasks;
    private rotateLogsIfNeeded;
    private rotateEncryptionKeysIfNeeded;
    getStats(): {
        config: SecurityLogConfig;
        bufferSizes: Record<string, number>;
        encryptionEnabled: boolean;
        siemConnected: boolean;
    };
    healthCheck(): Promise<{
        status: string;
        stats: ReturnType<SecurityLogService['getStats']>;
    }>;
}
export declare const securityLogService: SecurityLogService;
//# sourceMappingURL=SecurityLogService.d.ts.map
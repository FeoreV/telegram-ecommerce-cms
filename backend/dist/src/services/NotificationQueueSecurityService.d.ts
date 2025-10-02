export declare enum QueueType {
    EMAIL_QUEUE = "email_queue",
    PUSH_NOTIFICATION_QUEUE = "push_notification_queue",
    SMS_QUEUE = "sms_queue",
    TELEGRAM_QUEUE = "telegram_queue",
    WEBHOOK_QUEUE = "webhook_queue",
    SYSTEM_ALERT_QUEUE = "system_alert_queue",
    BATCH_NOTIFICATION_QUEUE = "batch_notification_queue",
    PRIORITY_QUEUE = "priority_queue"
}
export declare enum QueueSecurity {
    BASIC = "basic",
    ENHANCED = "enhanced",
    MAXIMUM = "maximum"
}
export interface QueueConfiguration {
    id: string;
    name: string;
    type: QueueType;
    securityLevel: QueueSecurity;
    encryptionRequired: boolean;
    integrityCheckRequired: boolean;
    auditRequired: boolean;
    encryptionKeyId: string;
    encryptionAlgorithm: string;
    keyRotationInterval: number;
    maxMessageSize: number;
    messageRetention: number;
    deadLetterQueue: boolean;
    allowedProducers: string[];
    allowedConsumers: string[];
    requireAuthentication: boolean;
    maxThroughput: number;
    burstCapacity: number;
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    hipaaCompliant: boolean;
    auditRetention: number;
}
export interface SecureMessage {
    id: string;
    queueType: QueueType;
    payload: string;
    originalSize: number;
    compressedSize?: number;
    encrypted: boolean;
    encryptionKeyId: string;
    integrityHash: string;
    digitalSignature?: string;
    priority: number;
    createdAt: Date;
    expiresAt?: Date;
    retryCount: number;
    maxRetries: number;
    producerId: string;
    consumerId?: string;
    correlationId?: string;
    auditTrail: {
        timestamp: Date;
        action: string;
        actor: string;
        details: Record<string, any>;
    }[];
    containsPII: boolean;
    dataClassification: string;
    retentionPolicy: string;
}
export interface QueueMetrics {
    queueType: QueueType;
    messagesProduced: number;
    messagesConsumed: number;
    messagesInQueue: number;
    deadLetterMessages: number;
    averageProcessingTime: number;
    throughputPerMinute: number;
    errorRate: number;
    encryptionRate: number;
    integrityFailures: number;
    unauthorizedAccess: number;
    auditEvents: number;
    piiMessages: number;
    retentionViolations: number;
    complianceScore: number;
    periodStart: Date;
    periodEnd: Date;
}
export interface TemplateSecurityConfig {
    templateId: string;
    encryptionRequired: boolean;
    encryptionKeyId: string;
    allowedVariables: string[];
    bannedPatterns: RegExp[];
    maxSize: number;
    containsPII: boolean;
    piiFields: string[];
    redactionRequired: boolean;
    allowedRoles: string[];
    requireApproval: boolean;
    version: string;
    lastModified: Date;
    modifiedBy: string;
    approved: boolean;
    approvedBy?: string;
    approvedAt?: Date;
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    retentionPeriod: number;
}
export declare class NotificationQueueSecurityService {
    private static instance;
    private queueConfigurations;
    private queueMetrics;
    private templateConfigs;
    private activeMessages;
    private encryptionKeys;
    private compressionEnabled;
    private constructor();
    static getInstance(): NotificationQueueSecurityService;
    private initializeQueueSecurity;
    private initializeQueueEncryptionKeys;
    private setupQueueMonitoring;
    private initializeMetricsCollection;
    private loadQueueConfigurations;
    private loadTemplateConfigurations;
    enqueueSecureMessage(queueType: QueueType, payload: any, options?: {
        priority?: number;
        correlationId?: string;
        expiresAt?: Date;
        maxRetries?: number;
        producerId?: string;
        containsPII?: boolean;
        dataClassification?: string;
    }): Promise<string>;
    dequeueSecureMessage(queueType: QueueType, consumerId: string): Promise<{
        messageId: string;
        payload: any;
        metadata: any;
    } | null>;
    private moveToDeadLetterQueue;
    encryptTemplate(templateId: string, templateContent: string, variables?: Record<string, any>): Promise<{
        encryptedContent: string;
        encryptionKeyId: string;
        integrityHash: string;
        metadata: any;
    }>;
    rotateQueueKeys(queueType?: QueueType): Promise<void>;
    private startSecurityMonitoring;
    private updateMetrics;
    getStats(): {
        queues: number;
        templates: number;
        activeMessages: number;
        totalMessagesProduced: number;
        totalMessagesConsumed: number;
        averageEncryptionRate: number;
        averageComplianceScore: number;
        keyRotations: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const notificationQueueSecurityService: NotificationQueueSecurityService;
//# sourceMappingURL=NotificationQueueSecurityService.d.ts.map
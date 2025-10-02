export declare enum WebSocketEventType {
    ORDER_UPDATE = "order_update",
    PAYMENT_STATUS = "payment_status",
    INVENTORY_ALERT = "inventory_alert",
    SYSTEM_NOTIFICATION = "system_notification",
    CHAT_MESSAGE = "chat_message",
    USER_ACTIVITY = "user_activity",
    STORE_UPDATE = "store_update",
    ADMIN_ALERT = "admin_alert"
}
export declare enum MessageSensitivity {
    PUBLIC = "public",
    INTERNAL = "internal",
    CONFIDENTIAL = "confidential",
    RESTRICTED = "restricted"
}
export interface WebSocketMessage {
    id: string;
    type: WebSocketEventType;
    payload: any;
    originalPayload: any;
    sensitivity: MessageSensitivity;
    encrypted: boolean;
    redacted: boolean;
    secretsDetected: boolean;
    targetUserId?: string;
    targetStoreId?: string;
    targetRole?: string;
    broadcast: boolean;
    timestamp: Date;
    expiresAt?: Date;
    priority: number;
    processedAt?: Date;
    deliveredAt?: Date;
    acknowledged: boolean;
    auditTrail: {
        timestamp: Date;
        action: string;
        details: Record<string, any>;
    }[];
    containsPII: boolean;
    gdprSubject: boolean;
    businessJustification?: string;
}
export interface WebSocketConnection {
    id: string;
    userId: string;
    userRole: string;
    storeId?: string;
    ipAddress: string;
    userAgent: string;
    connectionTime: Date;
    lastActivity: Date;
    authenticated: boolean;
    authorized: boolean;
    encryptionEnabled: boolean;
    riskScore: number;
    sessionId: string;
    messagesSent: number;
    messagesReceived: number;
    rateLimitWindow: Date;
    rateLimitCount: number;
    suspiciousActivity: boolean;
    blockedUntil?: Date;
}
export interface SecurityPolicy {
    id: string;
    name: string;
    eventTypes: WebSocketEventType[];
    enableSecretDetection: boolean;
    enablePIIRedaction: boolean;
    enableContentValidation: boolean;
    allowedRoles: string[];
    requireStoreAccess: boolean;
    requireExplicitPermission: boolean;
    maxMessagesPerMinute: number;
    maxPayloadSize: number;
    encryptionRequired: boolean;
    auditRequired: boolean;
    retentionPeriod: number;
    businessHours: boolean;
    ipWhitelist?: string[];
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    enabled: boolean;
    priority: number;
}
export interface SecretDetectionResult {
    detected: boolean;
    secrets: {
        type: string;
        value: string;
        confidence: number;
        position: number;
        redactedValue: string;
    }[];
    riskScore: number;
    actionTaken: 'block' | 'redact' | 'alert' | 'log';
}
export declare class WebSocketSecurityService {
    private static instance;
    private securityPolicies;
    private activeConnections;
    private messageHistory;
    private blockedIPs;
    private suspiciousPatterns;
    private constructor();
    static getInstance(): WebSocketSecurityService;
    private initializeWebSocketSecurity;
    private initializeSecurityMonitoring;
    private loadSecurityBlacklists;
    private setupThreatDetection;
    private loadSecurityPolicies;
    private setupSuspiciousPatterns;
    processOutgoingMessage(connectionId: string, eventType: WebSocketEventType, payload: any, options?: {
        targetUserId?: string;
        targetStoreId?: string;
        broadcast?: boolean;
        priority?: number;
        expiresAt?: Date;
        businessJustification?: string;
    }): Promise<WebSocketMessage | null>;
    private validateConnectionAuthorization;
    private checkRateLimit;
    private determineSensitivity;
    private applySecurityProcessing;
    private detectSecrets;
    private calculateSecretConfidence;
    private calculateEntropy;
    private getSecretType;
    private generateRedactedValue;
    private redactSecrets;
    private detectAndRedactPII;
    private validateMessageContent;
    private encryptMessage;
    private calculateMessageRiskScore;
    registerConnection(connectionId: string, userId: string, userRole: string, storeId: string | undefined, ipAddress: string, userAgent: string, sessionId: string): Promise<void>;
    unregisterConnection(connectionId: string): Promise<void>;
    private startSecurityMonitoring;
    private cleanupExpiredMessages;
    private monitorSuspiciousActivity;
    private updateConnectionRiskScores;
    getStats(): {
        policies: number;
        activeConnections: number;
        messageHistory: number;
        blockedIPs: number;
        suspiciousConnections: number;
        messagesWithSecrets: number;
        encryptedMessages: number;
        redactedMessages: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const webSocketSecurityService: WebSocketSecurityService;
//# sourceMappingURL=WebSocketSecurityService.d.ts.map
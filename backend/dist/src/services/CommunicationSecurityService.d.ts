import { DataCategory } from './DataClassificationService';
export declare enum CommunicationType {
    TELEGRAM_MESSAGE = "telegram_message",
    EMAIL = "email",
    PUSH_NOTIFICATION = "push_notification",
    SMS = "sms",
    WEBHOOK = "webhook",
    WEBSOCKET = "websocket",
    IN_APP_NOTIFICATION = "in_app_notification",
    SYSTEM_ALERT = "system_alert"
}
export declare enum RedactionLevel {
    MINIMAL = "minimal",
    STANDARD = "standard",
    AGGRESSIVE = "aggressive",
    COMPLETE = "complete"
}
export declare enum NotificationPriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    CRITICAL = "critical",
    EMERGENCY = "emergency"
}
export interface PIIRedactionRule {
    id: string;
    name: string;
    description: string;
    communicationTypes: CommunicationType[];
    dataCategories: DataCategory[];
    fieldPatterns: RegExp[];
    redactionLevel: RedactionLevel;
    redactionStrategy: 'mask' | 'replace' | 'remove' | 'generalize';
    maskingCharacter: string;
    replacementText?: string;
    conditions: {
        priority?: NotificationPriority[];
        userConsent?: boolean;
        businessNecessity?: boolean;
        legalBasis?: string[];
        recipientType?: ('customer' | 'employee' | 'vendor' | 'admin')[];
    };
    preserveStructure: boolean;
    preserveLength: boolean;
    preserveBusinessContext: boolean;
    regulations: string[];
    auditRequired: boolean;
    enabled: boolean;
    priority: number;
    validateAfterRedaction: boolean;
}
export interface CommunicationTemplate {
    id: string;
    name: string;
    type: CommunicationType;
    subject?: string;
    body: string;
    metadata: Record<string, any>;
    encryptionRequired: boolean;
    redactionLevel: RedactionLevel;
    allowedVariables: string[];
    bannedVariables: string[];
    containsPII: boolean;
    piiFields: string[];
    businessJustification?: string;
    validated: boolean;
    lastValidated?: Date;
    validationErrors: string[];
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    consentRequired: boolean;
    retentionPeriod: number;
}
export interface NotificationEvent {
    id: string;
    type: CommunicationType;
    templateId?: string;
    subject?: string;
    body: string;
    originalBody: string;
    variables: Record<string, any>;
    recipients: {
        userId?: string;
        email?: string;
        phone?: string;
        telegramChatId?: string;
        deviceTokens?: string[];
    }[];
    redactionApplied: boolean;
    redactedFields: string[];
    encryptionApplied: boolean;
    priority: NotificationPriority;
    createdAt: Date;
    processedAt?: Date;
    sentAt?: Date;
    consentVerified: boolean;
    legalBasis: string[];
    auditTrail: {
        timestamp: Date;
        action: string;
        details: Record<string, any>;
    }[];
    status: 'pending' | 'processing' | 'sent' | 'failed' | 'blocked';
    deliveryAttempts: number;
    lastError?: string;
}
export interface RedactionResult {
    redactedContent: string;
    originalContent: string;
    redactedFields: {
        field: string;
        category: DataCategory;
        originalValue: string;
        redactedValue: string;
        redactionReason: string;
    }[];
    complianceScore: number;
    privacyRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
export interface CommunicationSecurityConfig {
    globalRedactionLevel: RedactionLevel;
    encryptionEnabled: boolean;
    auditAllCommunications: boolean;
    rateLimits: {
        perUser: {
            window: number;
            limit: number;
        };
        perEmail: {
            window: number;
            limit: number;
        };
        perPhone: {
            window: number;
            limit: number;
        };
        global: {
            window: number;
            limit: number;
        };
    };
    contentValidation: {
        maxLength: number;
        allowedHtml: string[];
        bannedPatterns: RegExp[];
        malwareScanning: boolean;
    };
    privacyControls: {
        requireConsent: boolean;
        honorOptOut: boolean;
        respetDoNotTrack: boolean;
        anonymizeMetrics: boolean;
    };
    compliance: {
        gdprEnabled: boolean;
        ccpaEnabled: boolean;
        canSpamCompliant: boolean;
        dataRetentionDays: number;
    };
}
export declare class CommunicationSecurityService {
    private static instance;
    private redactionRules;
    private templates;
    private notifications;
    private config;
    private piiPatterns;
    private blockedRecipients;
    private constructor();
    static getInstance(): CommunicationSecurityService;
    private initializeCommunicationSecurity;
    private initializeCommunicationEncryption;
    private loadBlockedRecipients;
    private setupCommunicationMonitoring;
    private loadRedactionRules;
    private loadCommunicationTemplates;
    private setupPIIPatterns;
    private loadConfiguration;
    processSecureNotification(type: CommunicationType, templateId: string | undefined, recipients: any[], variables: Record<string, any>, options?: {
        priority?: NotificationPriority;
        bypassRedaction?: boolean;
        forceEncryption?: boolean;
        businessJustification?: string;
    }): Promise<string>;
    private validateRecipients;
    private validateTemplateCompliance;
    private interpolateTemplate;
    private applyPIIRedaction;
    private applyRedactionStrategy;
    private applyDefaultRedaction;
    private getDataCategoryForPattern;
    private calculateComplianceScore;
    private assessPrivacyRisk;
    private applyContentEncryption;
    private verifyConsentAndLegalBasis;
    private validateCommunicationContent;
    private performMalwareScanning;
    getStats(): {
        redactionRules: number;
        templates: number;
        processedNotifications: number;
        redactionRate: number;
        encryptionRate: number;
        averageComplianceScore: number;
        blockedRecipients: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const communicationSecurityService: CommunicationSecurityService;
//# sourceMappingURL=CommunicationSecurityService.d.ts.map
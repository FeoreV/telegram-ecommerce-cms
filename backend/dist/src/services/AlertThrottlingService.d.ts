export declare enum AlertType {
    LOW_STOCK = "low_stock",
    OUT_OF_STOCK = "out_of_stock",
    PRICE_CHANGE = "price_change",
    INVENTORY_DISCREPANCY = "inventory_discrepancy",
    SYSTEM_ERROR = "system_error",
    SECURITY_INCIDENT = "security_incident",
    PAYMENT_FAILURE = "payment_failure",
    ORDER_ANOMALY = "order_anomaly",
    USER_ACTIVITY_SUSPICIOUS = "user_activity_suspicious"
}
export declare enum AlertPriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    CRITICAL = "critical",
    EMERGENCY = "emergency"
}
export declare enum ThrottlingStrategy {
    TIME_BASED = "time_based",
    COUNT_BASED = "count_based",
    SIMILARITY_BASED = "similarity_based",
    ESCALATION_BASED = "escalation_based",
    ADAPTIVE = "adaptive"
}
export interface AlertDefinition {
    id: string;
    type: AlertType;
    name: string;
    description: string;
    triggerConditions: {
        field: string;
        operator: '>' | '<' | '=' | '!=' | '>=' | '<=' | 'contains' | 'regex';
        value: any;
    }[];
    priority: AlertPriority;
    severity: number;
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
    throttlingStrategy: ThrottlingStrategy;
    throttlingConfig: {
        timeWindowMs: number;
        maxAlertsInWindow: number;
        cooldownPeriodMs: number;
        similarityThreshold: number;
        escalationThreshold: number;
        adaptiveLearning: boolean;
    };
    deduplicationEnabled: boolean;
    deduplicationFields: string[];
    deduplicationWindowMs: number;
    notificationChannels: string[];
    recipients: string[];
    escalationRecipients: string[];
    suppressionEnabled: boolean;
    activeHours: {
        start: string;
        end: string;
    };
    activeDays: number[];
    timezone: string;
    autoResolve: boolean;
    autoResolveConditions: {
        field: string;
        operator: string;
        value: any;
    }[];
    autoResolveTimeoutMs: number;
    auditRequired: boolean;
    complianceRelevant: boolean;
    retentionPeriod: number;
    enabled: boolean;
    createdBy: string;
    createdAt: Date;
    lastModified: Date;
}
export interface Alert {
    id: string;
    definitionId: string;
    type: AlertType;
    title: string;
    message: string;
    details: Record<string, any>;
    sourceSystem: string;
    sourceId: string;
    storeId?: string;
    priority: AlertPriority;
    severity: number;
    fingerprint: string;
    triggeredAt: Date;
    acknowledgedAt?: Date;
    resolvedAt?: Date;
    escalatedAt?: Date;
    status: 'active' | 'acknowledged' | 'resolved' | 'suppressed' | 'escalated';
    acknowledgedBy?: string;
    resolvedBy?: string;
    resolution?: string;
    throttled: boolean;
    throttleReason?: string;
    originalCount: number;
    relatedAlerts: string[];
    notificationsSent: number;
    notificationChannels: string[];
    lastNotificationAt?: Date;
    escalationLevel: number;
    escalationHistory: {
        level: number;
        escalatedAt: Date;
        escalatedTo: string[];
        reason: string;
    }[];
    businessImpact: string;
    affectedUsers: number;
    affectedOrders: number;
    estimatedRevenueLoss: number;
    securityRelevant: boolean;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    autoResolutionAttempted: boolean;
    autoResolutionSuccessful: boolean;
    auditTrail: {
        timestamp: Date;
        action: string;
        user: string;
        details: Record<string, any>;
    }[];
}
export interface ThrottlingState {
    definitionId: string;
    alertType: AlertType;
    windowStart: Date;
    alertsInCurrentWindow: number;
    lastAlertTime: Date;
    recentFingerprints: Map<string, {
        count: number;
        firstSeen: Date;
        lastSeen: Date;
        representativeAlertId: string;
    }>;
    escalationCount: number;
    lastEscalation: Date;
    adaptiveMetrics: {
        falsePositiveRate: number;
        resolutionTime: number;
        businessImpactAccuracy: number;
        userEngagement: number;
    };
    suppressedUntil?: Date;
    suppressionReason?: string;
    lastReset: Date;
}
export interface AlertMetrics {
    totalAlertsGenerated: number;
    alertsThrottled: number;
    alertsDeduplicated: number;
    alertsEscalated: number;
    alertsSuppressed: number;
    averageResolutionTime: number;
    autoResolutionRate: number;
    escalationRate: number;
    falsePositiveRate: number;
    throttlingEffectiveness: number;
    deduplicationAccuracy: number;
    notificationDeliveryRate: number;
    criticalAlertsCount: number;
    estimatedCostSavings: number;
    alertFatigue: number;
    periodStart: Date;
    periodEnd: Date;
}
export declare class AlertThrottlingService {
    private static instance;
    private alertDefinitions;
    private activeAlerts;
    private throttlingStates;
    private metrics;
    private adaptiveLearning;
    private constructor();
    static getInstance(): AlertThrottlingService;
    private initializeAlertThrottling;
    private initializeAdaptiveLearning;
    private setupSimilarityEngine;
    private initializeNotificationChannels;
    private loadAlertDefinitions;
    private initializeMetrics;
    processAlert(alertType: AlertType, data: Record<string, any>, options?: {
        sourceSystem?: string;
        sourceId?: string;
        storeId?: string;
        forceProcess?: boolean;
        bypassThrottling?: boolean;
    }): Promise<string | null>;
    private findAlertDefinition;
    private shouldTriggerAlert;
    private evaluateCondition;
    private generateAlertTitle;
    private generateAlertMessage;
    private generateFingerprint;
    private assessBusinessImpact;
    private calculateAffectedUsers;
    private calculateAffectedOrders;
    private calculateRevenueLoss;
    private isSecurityRelevant;
    private assessThreatLevel;
    private isInActiveWindow;
    private applyThrottling;
    private getThrottlingState;
    private findDuplicateAlert;
    private applyTimeBasedThrottling;
    private applyCountBasedThrottling;
    private applySimilarityBasedThrottling;
    private applyEscalationBasedThrottling;
    private applyAdaptiveThrottling;
    private calculateSimilarity;
    private calculateEditDistance;
    private findMostRecentAlert;
    private escalateAlert;
    private handleDeduplication;
    private sendNotifications;
    private sendNotificationToChannel;
    private sendEscalationNotifications;
    private checkAutoEscalation;
    private calculateAlertRiskScore;
    private startThrottlingEngine;
    private cleanupThrottlingStates;
    private checkAutoResolution;
    private updateAdaptiveMetrics;
    private resolveAlert;
    getStats(): AlertMetrics;
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const alertThrottlingService: AlertThrottlingService;
//# sourceMappingURL=AlertThrottlingService.d.ts.map
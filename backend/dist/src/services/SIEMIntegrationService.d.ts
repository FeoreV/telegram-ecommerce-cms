export interface SIEMConfig {
    enableSIEM: boolean;
    siemType: 'splunk' | 'elasticsearch' | 'azure_sentinel' | 'aws_security_hub' | 'google_chronicle' | 'custom';
    endpoint: string;
    apiKey?: string;
    username?: string;
    password?: string;
    tenantId?: string;
    authType: 'api_key' | 'oauth2' | 'basic' | 'certificate' | 'custom';
    oauth2Config?: {
        clientId: string;
        clientSecret: string;
        tokenEndpoint: string;
        scopes: string[];
    };
    dataFormat: 'json' | 'cef' | 'leef' | 'syslog' | 'custom';
    customFormat?: string;
    enableBatching: boolean;
    batchSize: number;
    batchTimeoutMs: number;
    maxRetries: number;
    retryDelayMs: number;
    enableFiltering: boolean;
    severityThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    eventTypeFilter: string[];
    maxRequestsPerSecond: number;
    burstLimit: number;
    enableHealthCheck: boolean;
    healthCheckIntervalMs: number;
    alertOnFailure: boolean;
}
export interface SIEMEvent {
    id: string;
    timestamp: Date;
    eventType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    category: string;
    source: string;
    title: string;
    description: string;
    rawEvent: any;
    user?: {
        id: string;
        username: string;
        role: string;
        email?: string;
    };
    network?: {
        sourceIP: string;
        destinationIP?: string;
        sourcePort?: number;
        destinationPort?: number;
        protocol?: string;
        userAgent?: string;
    };
    assets?: {
        hostName?: string;
        hostIP?: string;
        operatingSystem?: string;
        application?: string;
        service?: string;
    };
    threatIntel?: {
        indicators: string[];
        tactics: string[];
        techniques: string[];
        malwareFamily?: string;
        campaigns?: string[];
    };
    compliance?: {
        frameworks: string[];
        controls: string[];
        requirements: string[];
    };
    customFields: Record<string, any>;
}
export interface SIEMAlert {
    id: string;
    timestamp: Date;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'open' | 'investigating' | 'resolved' | 'false_positive';
    title: string;
    description: string;
    category: string;
    events: SIEMEvent[];
    eventCount: number;
    rule: {
        id: string;
        name: string;
        description: string;
        query: string;
    };
    assignee?: string;
    notes: string[];
    tags: string[];
    confidence: number;
    falsePositiveRisk: number;
    firstSeen: Date;
    lastSeen: Date;
    actions: {
        type: string;
        timestamp: Date;
        user: string;
        details: any;
    }[];
}
export interface AlertRule {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    query: string;
    conditions: AlertCondition[];
    timeWindow: number;
    threshold: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    category: string;
    tags: string[];
    suppressionRules?: {
        field: string;
        value: string;
        duration: number;
    }[];
    escalation?: {
        timeToEscalate: number;
        escalateTo: string;
        autoEscalate: boolean;
    };
}
export interface AlertCondition {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex' | 'in' | 'exists';
    value: any;
    logicalOperator?: 'AND' | 'OR';
}
export declare class SIEMIntegrationService {
    private static instance;
    private config;
    private eventBuffer;
    private alertRules;
    private activeAlerts;
    private rateLimiter;
    private healthStatus;
    private lastHealthCheck;
    private constructor();
    static getInstance(): SIEMIntegrationService;
    private initializeSIEM;
    private initializeAlertRules;
    sendEvent(event: Partial<SIEMEvent>): Promise<void>;
    sendAlert(alert: SIEMAlert): Promise<void>;
    private enrichEvent;
    private shouldSendEvent;
    private checkRateLimit;
    private sendSingleEvent;
    private flushEventBuffer;
    private formatEvent;
    private formatAsJSON;
    private formatAsCEF;
    private formatAsLEEF;
    private formatAsSyslog;
    private formatAsCustom;
    private makeRequest;
    private getAuthHeaders;
    private getOAuth2Token;
    private formatForElasticsearch;
    private evaluateAlertRules;
    private evaluateRule;
    private getFieldValue;
    private evaluateCondition;
    private triggerAlert;
    private getThreatIntelligence;
    private getComplianceContext;
    private mapSeverityToCEF;
    private mapSeverityToSyslog;
    private testConnection;
    private loadActiveAlerts;
    private delay;
    private startBackgroundTasks;
    private performHealthCheck;
    getStats(): {
        config: SIEMConfig;
        healthStatus: string;
        lastHealthCheck: Date;
        bufferSize: number;
        activeAlerts: number;
        rateLimitStatus: Record<string, number>;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const siemIntegrationService: SIEMIntegrationService;
//# sourceMappingURL=SIEMIntegrationService.d.ts.map
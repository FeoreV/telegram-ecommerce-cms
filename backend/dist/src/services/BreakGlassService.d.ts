export declare enum BreakGlassType {
    SYSTEM_OUTAGE = "system_outage",
    SECURITY_INCIDENT = "security_incident",
    DATA_BREACH = "data_breach",
    REGULATORY_INVESTIGATION = "regulatory_investigation",
    BUSINESS_CRITICAL = "business_critical",
    DISASTER_RECOVERY = "disaster_recovery",
    COMPLIANCE_AUDIT = "compliance_audit",
    EMERGENCY_MAINTENANCE = "emergency_maintenance"
}
export declare enum BreakGlassSeverity {
    MINOR = "minor",
    MODERATE = "moderate",
    MAJOR = "major",
    CRITICAL = "critical",
    CATASTROPHIC = "catastrophic"
}
export declare enum BreakGlassStatus {
    REQUESTED = "requested",
    AUTHORIZED = "authorized",
    ACTIVE = "active",
    EXPIRED = "expired",
    REVOKED = "revoked",
    COMPLETED = "completed",
    UNDER_REVIEW = "under_review"
}
export interface BreakGlassAccount {
    id: string;
    name: string;
    description: string;
    username: string;
    passwordHash: string;
    lastPasswordChange: Date;
    allowedScenarios: BreakGlassType[];
    maximumDuration: number;
    defaultDuration: number;
    systemAccess: {
        databases: string[];
        services: string[];
        networks: string[];
        files: string[];
        commands: string[];
    };
    requiresAuthorization: boolean;
    authorizationLevel: 'single' | 'dual' | 'triple';
    authorizedBy: string[];
    mfaRequired: boolean;
    mfaMethods: string[];
    mfaBypass: boolean;
    auditLevel: 'basic' | 'enhanced' | 'forensic';
    sessionRecording: boolean;
    keystrokeLogging: boolean;
    screenCapture: boolean;
    realTimeMonitoring: boolean;
    activationNotifications: string[];
    deactivationNotifications: string[];
    activityNotifications: string[];
    autoExpiration: boolean;
    autoRevocation: {
        enabled: boolean;
        conditions: {
            maxCommands: number;
            suspiciousActivity: boolean;
            timeLimit: number;
        };
    };
    complianceRelevant: boolean;
    regulations: string[];
    retentionPeriod: number;
    lastUsed?: Date;
    usageCount: number;
    maxUsages?: number;
    active: boolean;
    createdBy: string;
    createdAt: Date;
    lastModified: Date;
}
export interface BreakGlassActivation {
    id: string;
    accountId: string;
    accountName: string;
    scenario: BreakGlassType;
    severity: BreakGlassSeverity;
    description: string;
    businessJustification: string;
    requestedAt: Date;
    authorizedAt?: Date;
    activatedAt?: Date;
    deactivatedAt?: Date;
    expiresAt?: Date;
    duration: number;
    status: BreakGlassStatus;
    authorizers: {
        userId: string;
        username: string;
        role: string;
        authorizedAt: Date;
        method: 'manual' | 'automated' | 'emergency';
        signature?: string;
    }[];
    activatedBy: string;
    activatedFromIp: string;
    activatedFromLocation?: {
        country: string;
        region: string;
        city: string;
    };
    deviceFingerprint: string;
    sessionId?: string;
    activities: BreakGlassActivity[];
    riskScore: number;
    riskFactors: string[];
    riskMitigation: string[];
    alertsGenerated: number;
    suspiciousActivities: number;
    complianceViolations: number;
    evidenceCollected: {
        sessionRecording?: string;
        keystrokeLogs?: string;
        screenCaptures?: string[];
        commandHistory?: string;
        systemLogs?: string[];
    };
    relatedIncidents: string[];
    relatedTickets: string[];
    postActivationReview: {
        required: boolean;
        completed: boolean;
        reviewedBy?: string;
        reviewedAt?: Date;
        findings?: string;
        recommendations?: string[];
    };
    auditTrail: {
        timestamp: Date;
        action: string;
        actor: string;
        details: Record<string, any>;
        complianceRelevant: boolean;
    }[];
    createdAt: Date;
    lastUpdated: Date;
}
export interface BreakGlassActivity {
    id: string;
    activationId: string;
    timestamp: Date;
    action: string;
    command?: string;
    resource: string;
    method: 'cli' | 'api' | 'gui' | 'database' | 'file_system';
    result: 'success' | 'failure' | 'blocked' | 'warning';
    output?: string;
    errorMessage?: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    automaticBlock: boolean;
    requiresApproval: boolean;
    sourceIp: string;
    userAgent?: string;
    sessionId: string;
    evidenceId?: string;
    recordingSegment?: string;
    category: 'system_admin' | 'data_access' | 'security_config' | 'emergency_action' | 'investigation';
    sensitive: boolean;
    complianceRelevant: boolean;
    approvalRequired: boolean;
    approvedBy?: string;
    approvedAt?: Date;
    approvalReason?: string;
}
export interface BreakGlassMetrics {
    totalActivations: number;
    authorizedActivations: number;
    deniedActivations: number;
    emergencyActivations: number;
    averageActivationDuration: number;
    activationsPerScenario: Record<BreakGlassType, number>;
    activationsPerSeverity: Record<BreakGlassSeverity, number>;
    suspiciousActivations: number;
    blockedActivities: number;
    complianceViolations: number;
    forensicInvestigations: number;
    averageAuthorizationTime: number;
    authorizationTimeouts: number;
    systemAvailability: number;
    auditCompliance: number;
    reviewCompliance: number;
    retentionCompliance: number;
    periodStart: Date;
    periodEnd: Date;
}
export declare class BreakGlassService {
    private static instance;
    private breakGlassAccounts;
    private activeActivations;
    private activationHistory;
    private metrics;
    private authorizerPool;
    private constructor();
    static getInstance(): BreakGlassService;
    private initializeBreakGlass;
    private initializeAuthorizationSystem;
    private setupEnhancedMonitoring;
    private initializeEvidenceCollection;
    private loadBreakGlassAccounts;
    private initializeMetrics;
    requestBreakGlassActivation(accountId: string, scenario: BreakGlassType, severity: BreakGlassSeverity, options?: {
        description?: string;
        businessJustification?: string;
        duration?: number;
        activatedBy?: string;
        sourceIp?: string;
        emergencyBypass?: boolean;
        relatedIncidents?: string[];
    }): Promise<string>;
    private generateDeviceFingerprint;
    private performBreakGlassRiskAssessment;
    private initiateBreakGlassAuthorization;
    private generateAuthorizationSignature;
    private sendAuthorizationRequests;
    private completeAuthorization;
    private activateBreakGlass;
    private startBreakGlassSessionMonitoring;
    private startRealTimeActivityMonitoring;
    private checkForSuspiciousActivity;
    private expireBreakGlassActivation;
    private sendBreakGlassNotifications;
    private startBreakGlassMonitoring;
    private monitorActiveBreakGlassSessions;
    private checkAutoRevocationConditions;
    private revokeBreakGlassActivation;
    private cleanupOldActivations;
    private archiveActivation;
    private generateComplianceReport;
    getStats(): BreakGlassMetrics;
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const breakGlassService: BreakGlassService;
//# sourceMappingURL=BreakGlassService.d.ts.map
export declare enum PrivilegeLevel {
    STANDARD = "standard",
    ELEVATED = "elevated",
    PRIVILEGED = "privileged",
    SUPER_ADMIN = "super_admin",
    EMERGENCY = "emergency"
}
export declare enum AccessRequestType {
    TEMPORARY_ELEVATION = "temporary_elevation",
    EMERGENCY_ACCESS = "emergency_access",
    ROLE_ASSUMPTION = "role_assumption",
    RESOURCE_ACCESS = "resource_access",
    SYSTEM_MAINTENANCE = "system_maintenance",
    DATA_ACCESS = "data_access",
    SECURITY_INVESTIGATION = "security_investigation"
}
export declare enum MFAMethod {
    TOTP = "totp",
    PUSH = "push",
    SMS = "sms",
    EMAIL = "email",
    HARDWARE_TOKEN = "hardware_token",
    BIOMETRIC = "biometric",
    BACKUP_CODES = "backup_codes"
}
export declare enum AccessStatus {
    REQUESTED = "requested",
    PENDING_APPROVAL = "pending_approval",
    PENDING_MFA = "pending_mfa",
    APPROVED = "approved",
    ACTIVE = "active",
    EXPIRED = "expired",
    REVOKED = "revoked",
    DENIED = "denied",
    EMERGENCY_ACTIVATED = "emergency_activated"
}
export interface PrivilegedRole {
    id: string;
    name: string;
    description: string;
    privilegeLevel: PrivilegeLevel;
    permissions: string[];
    resourceAccess: {
        databases: string[];
        services: string[];
        networks: string[];
        files: string[];
    };
    requiresApproval: boolean;
    approverRoles: string[];
    minimumApprovers: number;
    mfaRequired: boolean;
    allowedMfaMethods: MFAMethod[];
    mfaValidityMinutes: number;
    maxSessionDuration: number;
    allowedTimeWindows: {
        start: string;
        end: string;
        timezone: string;
        days: number[];
    }[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    ipWhitelist?: string[];
    deviceRestrictions: boolean;
    geolocationRestrictions?: string[];
    auditLevel: 'standard' | 'enhanced' | 'comprehensive';
    sessionRecording: boolean;
    keystrokeLogging: boolean;
    screenCapture: boolean;
    emergencyAccess: boolean;
    emergencyApprovers: string[];
    emergencyNotifications: string[];
    complianceRelevant: boolean;
    regulations: string[];
    retentionPeriod: number;
    active: boolean;
    createdBy: string;
    createdAt: Date;
    lastModified: Date;
}
export interface AccessRequest {
    id: string;
    userId: string;
    username: string;
    requestType: AccessRequestType;
    requestedRole: string;
    targetResources: string[];
    justification: string;
    businessNeed: string;
    urgency: 'low' | 'medium' | 'high' | 'emergency';
    requestedStartTime: Date;
    requestedDuration: number;
    requestedEndTime: Date;
    status: AccessStatus;
    approvers: {
        userId: string;
        username: string;
        role: string;
        decision: 'approved' | 'denied' | 'pending';
        approvedAt?: Date;
        comments?: string;
        riskAssessment?: string;
    }[];
    mfaRequired: boolean;
    mfaCompleted: boolean;
    mfaMethod?: MFAMethod;
    mfaVerifiedAt?: Date;
    mfaAttempts: number;
    riskScore: number;
    riskFactors: string[];
    automaticApproval: boolean;
    sessionId?: string;
    sessionStarted?: Date;
    sessionEnded?: Date;
    lastActivity?: Date;
    sourceIp: string;
    userAgent: string;
    deviceFingerprint: string;
    geolocation?: {
        country: string;
        region: string;
        city: string;
        latitude: number;
        longitude: number;
    };
    auditTrail: {
        timestamp: Date;
        action: string;
        actor: string;
        details: Record<string, any>;
        riskImpact?: string;
    }[];
    emergencyAccess: boolean;
    emergencyReason?: string;
    emergencyApprovedBy?: string;
    emergencyNotificationsSent: boolean;
    complianceValidated: boolean;
    complianceIssues: string[];
    createdAt: Date;
    lastUpdated: Date;
}
export interface PrivilegedSession {
    id: string;
    accessRequestId: string;
    userId: string;
    username: string;
    role: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: 'active' | 'expired' | 'terminated' | 'suspended';
    activities: {
        timestamp: Date;
        action: string;
        resource: string;
        command?: string;
        result: 'success' | 'failure' | 'blocked';
        riskLevel: 'low' | 'medium' | 'high';
    }[];
    recordingEnabled: boolean;
    recordingPath?: string;
    keystrokesLogged: boolean;
    keystrokeLogPath?: string;
    screenCaptured: boolean;
    screenCapturePath?: string;
    realTimeMonitoring: boolean;
    suspiciousActivity: boolean;
    alertsGenerated: number;
    extensionRequests: {
        requestedAt: Date;
        additionalMinutes: number;
        justification: string;
        approved: boolean;
        approvedBy?: string;
    }[];
    currentRiskScore: number;
    riskEvents: {
        timestamp: Date;
        event: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        automated: boolean;
    }[];
    auditEvents: {
        timestamp: Date;
        event: string;
        compliance: string[];
        details: Record<string, any>;
    }[];
    lastActivity: Date;
}
export interface MFAChallenge {
    id: string;
    userId: string;
    accessRequestId: string;
    method: MFAMethod;
    challengeCode?: string;
    qrCode?: string;
    pushToken?: string;
    status: 'pending' | 'verified' | 'failed' | 'expired';
    attempts: number;
    maxAttempts: number;
    createdAt: Date;
    expiresAt: Date;
    verifiedAt?: Date;
    challengeHash: string;
    ipAddress: string;
    userAgent: string;
    backupMethodsAvailable: MFAMethod[];
    backupMethodUsed?: MFAMethod;
}
export interface AccessControlMetrics {
    totalRequests: number;
    approvedRequests: number;
    deniedRequests: number;
    emergencyRequests: number;
    averageApprovalTime: number;
    automaticApprovals: number;
    manualApprovals: number;
    activeSessions: number;
    averageSessionDuration: number;
    sessionsExtended: number;
    sessionsTerminated: number;
    mfaFailures: number;
    suspiciousActivities: number;
    riskEventsDetected: number;
    complianceViolations: number;
    systemAvailability: number;
    responseTime: number;
    periodStart: Date;
    periodEnd: Date;
}
export declare class PrivilegedAccessService {
    private static instance;
    private privilegedRoles;
    private accessRequests;
    private activeSessions;
    private mfaChallenges;
    private metrics;
    private riskEngine;
    private constructor();
    static getInstance(): PrivilegedAccessService;
    private initializePrivilegedAccess;
    private initializeMFAProviders;
    private setupRiskAssessmentEngine;
    private initializeSessionMonitoring;
    private loadPrivilegedRoles;
    private initializeMetrics;
    requestPrivilegedAccess(userId: string, username: string, requestedRole: string, options?: {
        requestType?: AccessRequestType;
        targetResources?: string[];
        justification?: string;
        businessNeed?: string;
        urgency?: 'low' | 'medium' | 'high' | 'emergency';
        requestedDuration?: number;
        sourceIp?: string;
        userAgent?: string;
        emergencyAccess?: boolean;
    }): Promise<string>;
    private generateDeviceFingerprint;
    private performRiskAssessment;
    private isInAllowedTimeWindow;
    private checkRecentFailures;
    private handleEmergencyAccess;
    private sendEmergencyNotifications;
    private initiateApprovalWorkflow;
    private sendApprovalNotifications;
    private initiateMFAChallenge;
    private generateMFAChallenge;
    verifyMFAChallenge(challengeId: string, userResponse: string, options?: {
        backupMethod?: MFAMethod;
        backupCode?: string;
    }): Promise<boolean>;
    private verifyPrimaryMethod;
    private verifyBackupMethod;
    private startPrivilegedSession;
    private expireSession;
    private startAccessMonitoring;
    private monitorActiveSessions;
    private cleanupExpiredItems;
    private updateMetrics;
    getStats(): AccessControlMetrics;
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const privilegedAccessService: PrivilegedAccessService;
//# sourceMappingURL=PrivilegedAccessService.d.ts.map
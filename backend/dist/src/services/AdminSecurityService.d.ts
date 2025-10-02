export interface AdminSecurityConfig {
    enableIPAllowlist: boolean;
    enableMFA: boolean;
    enableSessionTracking: boolean;
    enableAuditLogging: boolean;
    enableDeviceBinding: boolean;
    allowedIPs: string[];
    allowedCIDRs: string[];
    emergencyBypassEnabled: boolean;
    mfaRequired: boolean;
    mfaBackupCodesCount: number;
    mfaTokenWindow: number;
    maxConcurrentSessions: number;
    sessionTimeout: number;
    adminSessionTimeout: number;
    maxFailedAttempts: number;
    lockoutDuration: number;
    requirePasswordChange: number;
    minPasswordStrength: number;
}
export interface AdminSession {
    sessionId: string;
    userId: string;
    role: string;
    ipAddress: string;
    userAgent: string;
    deviceFingerprint: string;
    createdAt: Date;
    lastActivity: Date;
    expiresAt: Date;
    isActive: boolean;
    mfaVerified: boolean;
    permissions: string[];
    metadata: Record<string, any>;
}
export interface MFASetup {
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
    verified: boolean;
}
export interface SecurityAuditEvent {
    id: string;
    eventType: string;
    userId: string;
    sessionId?: string;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    success: boolean;
    details: Record<string, any>;
    riskScore: number;
    action: string;
}
export declare class AdminSecurityService {
    private static instance;
    private config;
    private activeSessions;
    private failedAttempts;
    private auditEvents;
    private constructor();
    static getInstance(): AdminSecurityService;
    private parseIPList;
    checkIPAllowlist(ipAddress: string): Promise<{
        allowed: boolean;
        reason: string;
        bypassUsed: boolean;
    }>;
    private isIPInCIDR;
    private ipToInt;
    private checkEmergencyBypass;
    generateEmergencyBypass(ipAddress: string, requestedBy: string, reason: string, duration?: number): Promise<string>;
    setupMFA(userId: string, serviceName?: string): Promise<MFASetup>;
    verifyMFA(userId: string, token: string, isBackupCode?: boolean): Promise<{
        verified: boolean;
        backupCodeUsed?: boolean;
        remainingBackupCodes?: number;
    }>;
    completeMFASetup(userId: string, verificationToken: string): Promise<boolean>;
    createAdminSession(userId: string, role: string, ipAddress: string, userAgent: string, deviceFingerprint: string, mfaVerified?: boolean): Promise<AdminSession>;
    validateAdminSession(sessionId: string, ipAddress: string, userAgent: string): Promise<{
        valid: boolean;
        session?: AdminSession;
        reason?: string;
    }>;
    terminateSession(sessionId: string, reason: string): Promise<void>;
    private recordFailedAttempt;
    private isUserLockedOut;
    private enforceSessionLimits;
    private generateDeviceFingerprint;
    private generateSessionId;
    private getUserPermissions;
    private storeAdminSession;
    private getAdminSession;
    private storeMFASetup;
    private getMFASetup;
    private auditSecurityEvent;
    private startCleanupTimer;
    private cleanupExpiredData;
    getStats(): {
        config: AdminSecurityConfig;
        activeSessions: number;
        lockedUsers: number;
        recentAuditEvents: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const adminSecurityService: AdminSecurityService;
//# sourceMappingURL=AdminSecurityService.d.ts.map
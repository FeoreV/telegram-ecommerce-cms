export interface SecurityAlert {
    type: 'SUSPICIOUS_ACTIVITY' | 'UNAUTHORIZED_ACCESS' | 'PERMISSION_ESCALATION' | 'BULK_CHANGES' | 'LOGIN_ANOMALY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    userId: string;
    storeId: string;
    description: string;
    details: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}
export interface AuditLog {
    userId: string;
    storeId: string;
    action: string;
    resource: string;
    resourceId?: string;
    previousValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    reason?: string;
}
export declare class EmployeeSecurityService {
    static createSecurityAlert(alert: SecurityAlert): Promise<void>;
    static auditAction(auditLog: AuditLog): Promise<void>;
    private static analyzeSuspiciousActivity;
    private static notifyAdmins;
    static getSecurityStats(storeId: string, days?: number): Promise<{
        totalAlerts: number;
        alertsByType: Record<string, number>;
        alertsBySeverity: Record<string, number>;
        topRiskUsers: Array<{
            userId: string;
            userName: string;
            riskScore: number;
        }>;
        recentIncidents: SecurityAlert[];
    }>;
    static blockUser(userId: string, storeId: string, reason: string): Promise<void>;
    static cleanupOldLogs(days?: number): Promise<void>;
    private static generateId;
}
//# sourceMappingURL=employeeSecurityService.d.ts.map
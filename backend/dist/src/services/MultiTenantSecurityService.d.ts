export interface UserContext {
    userId: string;
    role: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOMER';
    storeId?: string;
    permissions?: string[];
}
export interface TenantSecurityConfig {
    enableRLS: boolean;
    enableAuditLogging: boolean;
    strictTenantIsolation: boolean;
    allowCrossStoreAccess: boolean;
    defaultRole: string;
}
export interface RLSValidationResult {
    tableName: string;
    hasRls: boolean;
    policyCount: number;
    status: 'PROTECTED' | 'RLS_ENABLED_NO_POLICIES' | 'NOT_PROTECTED';
    securityStatus: string;
}
export interface TenantStats {
    totalStores: number;
    activeStores: number;
    totalUsers: number;
    usersByRole: Record<string, number>;
    violationCount: number;
    lastViolation: Date | null;
}
export declare class MultiTenantSecurityService {
    private static instance;
    private config;
    private currentContext;
    private constructor();
    static getInstance(): MultiTenantSecurityService;
    initialize(): Promise<void>;
    setUserContext(sessionId: string, context: UserContext, connectionId?: string): Promise<void>;
    clearUserContext(sessionId: string): Promise<void>;
    validateStoreAccess(userId: string, storeId: string, operation?: 'read' | 'write'): Promise<boolean>;
    getUserAccessibleStores(userId: string, role: string): Promise<string[]>;
    assignUserToStore(storeId: string, userId: string, role: 'ADMIN' | 'VENDOR', assignedBy: string, permissions?: Record<string, unknown>): Promise<void>;
    removeUserFromStore(storeId: string, userId: string): Promise<void>;
    validateRLSPolicies(): Promise<RLSValidationResult[]>;
    testRLSIsolation(testUserId: string, testUserRole: string, testStoreId: string): Promise<unknown[]>;
    getRLSViolations(limit?: number, storeId?: string, userId?: string): Promise<any[]>;
    getTenantStats(): Promise<TenantStats>;
    healthCheck(): Promise<{
        status: string;
        rlsEnabled: boolean;
        protectedTables: number;
        totalTables: number;
        violations: number;
        stats: TenantStats;
    }>;
    getCurrentContext(sessionId: string): UserContext | null;
    getConfiguration(): TenantSecurityConfig;
}
export declare const multiTenantSecurityService: MultiTenantSecurityService;
//# sourceMappingURL=MultiTenantSecurityService.d.ts.map
export declare enum DutyCategory {
    DEPLOYMENT = "deployment",
    PAYMENT_PROCESSING = "payment_processing",
    KEY_MANAGEMENT = "key_management",
    USER_MANAGEMENT = "user_management",
    DATA_MANAGEMENT = "data_management",
    SECURITY_ADMINISTRATION = "security_administration",
    SYSTEM_ADMINISTRATION = "system_administration",
    AUDIT_MANAGEMENT = "audit_management",
    COMPLIANCE_MANAGEMENT = "compliance_management"
}
export declare enum OperationType {
    CREATE = "create",
    READ = "read",
    UPDATE = "update",
    DELETE = "delete",
    EXECUTE = "execute",
    APPROVE = "approve",
    REVIEW = "review",
    AUTHORIZE = "authorize"
}
export declare enum ConflictType {
    ROLE_CONFLICT = "role_conflict",
    DUTY_CONFLICT = "duty_conflict",
    TEMPORAL_CONFLICT = "temporal_conflict",
    HIERARCHY_CONFLICT = "hierarchy_conflict",
    VENDOR_CONFLICT = "vendor_conflict"
}
export declare enum SeparationLevel {
    WEAK = "weak",
    STRONG = "strong",
    ABSOLUTE = "absolute"
}
export interface DutyRole {
    id: string;
    name: string;
    description: string;
    category: DutyCategory;
    permissions: string[];
    operationTypes: OperationType[];
    resourceAccess: string[];
    incompatibleRoles: string[];
    requiredSeparationLevel: SeparationLevel;
    requiresApproval: boolean;
    approverRoles: string[];
    multiPersonApproval: boolean;
    cooldownPeriod: number;
    timeWindowRestrictions: {
        start: string;
        end: string;
        timezone: string;
        days: number[];
    }[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    maxOperationsPerDay: number;
    requiresSecondPerson: boolean;
    auditLevel: 'standard' | 'enhanced' | 'comprehensive';
    realTimeMonitoring: boolean;
    complianceRelevant: boolean;
    regulations: string[];
    active: boolean;
    createdAt: Date;
    lastModified: Date;
}
export interface SeparationRule {
    id: string;
    name: string;
    description: string;
    primaryDuty: DutyCategory;
    conflictingDuties: DutyCategory[];
    conflictType: ConflictType;
    separationLevel: SeparationLevel;
    temporalSeparation: {
        enabled: boolean;
        minimumHours: number;
        maximumDays: number;
    };
    allowedExceptions: {
        emergencyOverride: boolean;
        seniorApproval: boolean;
        businessJustification: boolean;
        timeboxed: boolean;
    };
    enforcementLevel: 'advisory' | 'blocking' | 'fatal';
    automaticEnforcement: boolean;
    violationAlerts: boolean;
    alertRecipients: string[];
    complianceReasons: string[];
    regulatoryRequirements: string[];
    priority: number;
    enabled: boolean;
    createdBy: string;
    createdAt: Date;
    lastReviewed: Date;
}
export interface DutyAssignment {
    id: string;
    userId: string;
    username: string;
    roleId: string;
    roleName: string;
    dutyCategory: DutyCategory;
    assignedAt: Date;
    expiresAt?: Date;
    lastActivity?: Date;
    assignedBy: string;
    businessJustification: string;
    temporaryAssignment: boolean;
    approved: boolean;
    approvedBy?: string;
    approvedAt?: Date;
    approvalReason?: string;
    operationCount: number;
    lastOperation?: Date;
    violationCount: number;
    status: 'pending' | 'active' | 'suspended' | 'expired' | 'revoked';
    auditTrail: {
        timestamp: Date;
        action: string;
        actor: string;
        details: Record<string, any>;
    }[];
    createdAt: Date;
    lastModified: Date;
}
export interface DutyOperation {
    id: string;
    userId: string;
    username: string;
    dutyCategory: DutyCategory;
    operationType: OperationType;
    resource: string;
    action: string;
    timestamp: Date;
    sourceIp: string;
    userAgent?: string;
    sessionId?: string;
    requiresApproval: boolean;
    approved: boolean;
    approvedBy?: string;
    approvedAt?: Date;
    separationChecked: boolean;
    violationsDetected: ViolationResult[];
    proceededWithViolation: boolean;
    overrideReason?: string;
    overrideApprovedBy?: string;
    status: 'pending' | 'approved' | 'executed' | 'failed' | 'blocked';
    result?: 'success' | 'failure' | 'blocked';
    errorMessage?: string;
    complianceRelevant: boolean;
    auditRequired: boolean;
    createdAt: Date;
    completedAt?: Date;
}
export interface ViolationResult {
    violationType: ConflictType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    ruleId: string;
    ruleName: string;
    description: string;
    conflictingOperations: string[];
    recommendedAction: 'block' | 'require_approval' | 'warn' | 'allow';
    canOverride: boolean;
    overrideRequirements: string[];
}
export interface SeparationMetrics {
    totalOperations: number;
    approvedOperations: number;
    blockedOperations: number;
    overriddenOperations: number;
    totalViolations: number;
    violationsByType: Record<ConflictType, number>;
    violationsBySeverity: Record<string, number>;
    complianceScore: number;
    auditFindings: number;
    regulatoryViolations: number;
    activeAssignments: number;
    temporaryAssignments: number;
    expiredAssignments: number;
    averageApprovalTime: number;
    systemAvailability: number;
    periodStart: Date;
    periodEnd: Date;
}
export declare class SeparationOfDutiesService {
    private static instance;
    private dutyRoles;
    private separationRules;
    private dutyAssignments;
    private recentOperations;
    private userRoleCache;
    private metrics;
    private constructor();
    static getInstance(): SeparationOfDutiesService;
    private initializeSeparationOfDuties;
    private initializeCompatibilityMatrix;
    private setupViolationDetection;
    private initializeComplianceTracking;
    private loadDutyRoles;
    private loadSeparationRules;
    private initializeMetrics;
    checkSeparationOfDuties(userId: string, username: string, dutyCategory: DutyCategory, operationType: OperationType, resource: string, action: string, options?: {
        sourceIp?: string;
        sessionId?: string;
        userAgent?: string;
        emergencyOverride?: boolean;
        businessJustification?: string;
    }): Promise<{
        allowed: boolean;
        violations: ViolationResult[];
        requiresApproval: boolean;
        approverRoles: string[];
        operationId: string;
    }>;
    private getUserRoleAssignments;
    private detectSeparationViolations;
    private checkRule;
    private checkTemporalConflicts;
    private getOverrideRequirements;
    private findDutyRole;
    private getApproversForViolations;
    private calculateOperationRiskScore;
    private sendViolationAlerts;
    private startSeparationMonitoring;
    private monitorRoleAssignments;
    private cleanupOldOperations;
    private generateComplianceReport;
    getStats(): SeparationMetrics;
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const separationOfDutiesService: SeparationOfDutiesService;
//# sourceMappingURL=SeparationOfDutiesService.d.ts.map
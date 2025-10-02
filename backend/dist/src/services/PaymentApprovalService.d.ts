export interface ApprovalConfig {
    enableFourEyesApproval: boolean;
    requiredApprovers: number;
    maxApprovalTime: number;
    enableSeparationOfDuties: boolean;
    enableApprovalHierarchy: boolean;
    criticalAmountThreshold: number;
    enableNotifications: boolean;
    enableApprovalAudit: boolean;
}
export interface ApprovalRequest {
    id: string;
    type: 'payment_status_change' | 'refund' | 'void' | 'manual_adjustment';
    resourceId: string;
    resourceType: 'order' | 'payment' | 'refund';
    requestedBy: string;
    requestedAt: Date;
    expiresAt: Date;
    status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'critical';
    currentState: unknown;
    proposedState: unknown;
    reason: string;
    justification: string;
    riskAssessment: {
        riskScore: number;
        riskFactors: string[];
        requiresAdditionalApproval: boolean;
    };
    requiredApprovers: number;
    approvals: ApprovalAction[];
    rejections: ApprovalAction[];
    storeId: string;
    amount?: number;
    currency?: string;
    metadata: Record<string, unknown>;
}
export interface ApprovalAction {
    id: string;
    approverId: string;
    approverRole: string;
    action: 'approve' | 'reject';
    timestamp: Date;
    reason: string;
    ipAddress: string;
    userAgent: string;
    signature?: string;
    mfaVerified: boolean;
}
export interface ApprovalRule {
    id: string;
    name: string;
    description: string;
    conditions: ApprovalCondition[];
    requiredApprovers: number;
    allowedApproverRoles: string[];
    excludedApproverRoles: string[];
    maxApprovalTime: number;
    priority: number;
    isActive: boolean;
}
export interface ApprovalCondition {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
    value: unknown;
    logicalOperator?: 'AND' | 'OR';
}
export declare class PaymentApprovalService {
    private static instance;
    private config;
    private approvalRules;
    private pendingApprovals;
    private constructor();
    static getInstance(): PaymentApprovalService;
    private initializeDefaultRules;
    requestApproval(type: ApprovalRequest['type'], resourceId: string, resourceType: ApprovalRequest['resourceType'], requestedBy: string, storeId: string, currentState: unknown, proposedState: unknown, reason: string, justification: string, amount?: number, currency?: string, metadata?: Record<string, unknown>): Promise<ApprovalRequest>;
    submitApproval(approvalId: string, approverId: string, action: 'approve' | 'reject', reason: string, ipAddress: string, userAgent: string, mfaToken?: string): Promise<{
        approved: boolean;
        completed: boolean;
        approvalRequest: ApprovalRequest;
    }>;
    private getApplicableRules;
    private evaluateCondition;
    private assessRisk;
    private analyzeStateChanges;
    private determinePriority;
    private validateRequesterPermissions;
    private validateApproverPermissions;
    private getApproverRole;
    private generateApprovalSignature;
    private executeApprovedAction;
    private storeApprovalRequest;
    private getApprovalRequest;
    private generateApprovalId;
    private sendApprovalNotifications;
    private sendApprovalUpdateNotifications;
    private auditApprovalEvent;
    private startExpirationTimer;
    private expirePendingApprovals;
    getStats(): {
        config: ApprovalConfig;
        pendingApprovals: number;
        approvalRules: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: {
            config: ApprovalConfig;
            pendingApprovals: number;
            approvalRules: number;
        };
    }>;
}
export declare const paymentApprovalService: PaymentApprovalService;
//# sourceMappingURL=PaymentApprovalService.d.ts.map
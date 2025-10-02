export declare enum InventoryOperationType {
    STOCK_INCREASE = "stock_increase",
    STOCK_DECREASE = "stock_decrease",
    STOCK_TRANSFER = "stock_transfer",
    STOCK_ADJUSTMENT = "stock_adjustment",
    STOCK_RESERVATION = "stock_reservation",
    STOCK_RELEASE = "stock_release",
    PRICE_UPDATE = "price_update",
    PRODUCT_ACTIVATION = "product_activation",
    PRODUCT_DEACTIVATION = "product_deactivation"
}
export declare enum ConcurrencyControl {
    OPTIMISTIC_LOCKING = "optimistic_locking",
    PESSIMISTIC_LOCKING = "pessimistic_locking",
    DISTRIBUTED_LOCKING = "distributed_locking"
}
export declare enum InventoryAuditLevel {
    MINIMAL = "minimal",
    STANDARD = "standard",
    COMPREHENSIVE = "comprehensive",
    FORENSIC = "forensic"
}
export interface OptimisticLockConfig {
    id: string;
    tableName: string;
    versionColumn: string;
    maxRetryAttempts: number;
    retryDelayMs: number;
    lockTimeoutMs: number;
    conflictResolution: 'fail' | 'retry' | 'merge' | 'override';
    mergeStrategy?: 'sum' | 'max' | 'min' | 'last_writer_wins';
    auditLevel: InventoryAuditLevel;
    requireApproval: boolean;
    approverRoles: string[];
    allowNegativeStock: boolean;
    enforceReservationLimit: boolean;
    validateBusinessRules: boolean;
    trackPerformance: boolean;
    alertOnConflicts: boolean;
    conflictThreshold: number;
    enabled: boolean;
}
export interface InventoryOperation {
    id: string;
    operationType: InventoryOperationType;
    productId: string;
    storeId: string;
    variantId?: string;
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    priceChange?: {
        previousPrice: number;
        newPrice: number;
        currency: string;
    };
    version: number;
    expectedVersion: number;
    lockAcquiredAt: Date;
    lockReleasedAt?: Date;
    reason: string;
    reference?: string;
    userId: string;
    userRole: string;
    approved: boolean;
    approvedBy?: string;
    approvedAt?: Date;
    digitalSignature?: string;
    status: 'pending' | 'locked' | 'executing' | 'completed' | 'failed' | 'rolled_back';
    startTime: Date;
    endTime?: Date;
    duration?: number;
    businessRulesValidated: boolean;
    validationErrors: string[];
    auditTrail: {
        timestamp: Date;
        action: string;
        user: string;
        details: Record<string, unknown>;
        signature?: string;
    }[];
    conflictDetected: boolean;
    conflictResolution?: string;
    retryCount: number;
    maxRetries: number;
}
export interface InventoryConflict {
    id: string;
    productId: string;
    storeId: string;
    detectedAt: Date;
    conflictType: 'version_mismatch' | 'concurrent_access' | 'data_integrity' | 'business_rule_violation';
    operationA: {
        id: string;
        userId: string;
        expectedVersion: number;
        operation: InventoryOperationType;
    };
    operationB: {
        id: string;
        userId: string;
        expectedVersion: number;
        operation: InventoryOperationType;
    };
    resolved: boolean;
    resolutionStrategy?: string;
    resolvedBy?: string;
    resolvedAt?: Date;
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
    affectedOrders: string[];
    businessImpact: string;
    securityRelevant: boolean;
    potentialFraud: boolean;
    investigationRequired: boolean;
}
export interface InventorySecurityMetrics {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    lockAcquisitions: number;
    lockTimeouts: number;
    lockConflicts: number;
    averageLockDuration: number;
    conflictCount: number;
    conflictResolutionTime: number;
    unresolvedConflicts: number;
    unauthorizedAttempts: number;
    suspiciousOperations: number;
    fraudAlerts: number;
    averageOperationTime: number;
    throughputPerSecond: number;
    auditCompliance: number;
    approvalCompliance: number;
    periodStart: Date;
    periodEnd: Date;
    activeLocks: number;
    activeOperations: number;
}
export declare class InventorySecurityService {
    private static instance;
    private lockConfigs;
    private activeOperations;
    private activeLocks;
    private conflicts;
    private metrics;
    private distributedLocks;
    private constructor();
    static getInstance(): InventorySecurityService;
    private initializeInventorySecurity;
    private initializeDistributedLocking;
    private setupConflictDetection;
    private initializeBusinessRuleValidation;
    private loadOptimisticLockConfigs;
    private initializeMetrics;
    executeSecureInventoryOperation(operationType: InventoryOperationType, productId: string, storeId: string, quantity: number, options?: {
        variantId?: string;
        reason?: string;
        reference?: string;
        userId?: string;
        userRole?: string;
        priceChange?: {
            previousPrice: number;
            newPrice: number;
            currency: string;
        };
        bypassLocking?: boolean;
        forceApproval?: boolean;
    }): Promise<string>;
    private getTableName;
    private getCurrentRecord;
    private calculateNewQuantity;
    private validateBusinessRules;
    private requestApproval;
    private acquireOptimisticLock;
    private handleLockConflict;
    private attemptMergeConflict;
    private acquireDistributedLock;
    private executeOperation;
    private performInventoryUpdate;
    private generateOperationSignature;
    private releaseOptimisticLock;
    private calculateOperationRiskScore;
    private updateMetrics;
    private delay;
    private startSecurityMonitoring;
    private monitorConflicts;
    private cleanupExpiredOperations;
    private updateThroughputMetrics;
    getStats(): InventorySecurityMetrics;
    healthCheck(): Promise<{
        status: string;
        stats: InventorySecurityMetrics;
    }>;
}
export declare const inventorySecurityService: InventorySecurityService;
//# sourceMappingURL=InventorySecurityService.d.ts.map
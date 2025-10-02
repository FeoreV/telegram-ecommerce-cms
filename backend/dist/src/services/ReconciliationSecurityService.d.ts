export declare enum ReconciliationType {
    INVENTORY_RECONCILIATION = "inventory_reconciliation",
    FINANCIAL_RECONCILIATION = "financial_reconciliation",
    ORDER_RECONCILIATION = "order_reconciliation",
    PAYMENT_RECONCILIATION = "payment_reconciliation",
    USER_DATA_RECONCILIATION = "user_data_reconciliation",
    SYSTEM_STATE_RECONCILIATION = "system_state_reconciliation",
    AUDIT_LOG_RECONCILIATION = "audit_log_reconciliation",
    BACKUP_RECONCILIATION = "backup_reconciliation"
}
export declare enum ReconciliationPriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    CRITICAL = "critical",
    EMERGENCY = "emergency"
}
export declare enum DiscrepancySeverity {
    INFORMATIONAL = "informational",
    MINOR = "minor",
    MAJOR = "major",
    CRITICAL = "critical",
    SECURITY_INCIDENT = "security_incident"
}
export interface ReconciliationJob {
    id: string;
    name: string;
    type: ReconciliationType;
    schedule: string;
    priority: ReconciliationPriority;
    enabled: boolean;
    sourceA: {
        type: 'database' | 'external_api' | 'file' | 'cache';
        connection: string;
        query?: string;
        endpoint?: string;
        filePath?: string;
    };
    sourceB: {
        type: 'database' | 'external_api' | 'file' | 'cache';
        connection: string;
        query?: string;
        endpoint?: string;
        filePath?: string;
    };
    reconciliationRules: {
        keyFields: string[];
        compareFields: string[];
        toleranceRules: {
            field: string;
            tolerance: number;
            toleranceType: 'absolute' | 'percentage';
        }[];
        ignoreFields: string[];
    };
    encryptLogs: boolean;
    signLogs: boolean;
    auditLevel: 'minimal' | 'standard' | 'comprehensive';
    retentionPeriod: number;
    alertOnDiscrepancies: boolean;
    alertThreshold: number;
    alertRecipients: string[];
    autoCorrect: boolean;
    correctionRules: {
        condition: string;
        action: 'use_source_a' | 'use_source_b' | 'manual_review' | 'calculate_average';
        approvalRequired: boolean;
    }[];
    complianceRequired: boolean;
    regulations: string[];
    lastExecuted?: Date;
    nextScheduled?: Date;
    executionCount: number;
    successCount: number;
    failureCount: number;
    createdBy: string;
    createdAt: Date;
    modifiedBy?: string;
    modifiedAt?: Date;
}
export interface ReconciliationExecution {
    id: string;
    jobId: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    sourceARecords: number;
    sourceBRecords: number;
    matchedRecords: number;
    unmatchedRecords: number;
    discrepancies: ReconciliationDiscrepancy[];
    summary: {
        totalDiscrepancies: number;
        criticalDiscrepancies: number;
        autoCorrections: number;
        manualReviewRequired: number;
    };
    dataHash: string;
    executionSignature: string;
    signingKeyId: string;
    performanceMetrics: {
        dataRetrievalTime: number;
        comparisonTime: number;
        signatureTime: number;
        totalMemoryUsed: number;
        peakMemoryUsed: number;
    };
    auditTrail: {
        timestamp: Date;
        action: string;
        user: string;
        details: Record<string, unknown>;
        signature?: string;
    }[];
    errors: string[];
    warnings: string[];
    complianceValidated: boolean;
    complianceIssues: string[];
    executedBy: string;
}
export interface ReconciliationDiscrepancy {
    id: string;
    executionId: string;
    keyValues: Record<string, unknown>;
    field: string;
    sourceAValue: unknown;
    sourceBValue: unknown;
    difference: unknown;
    differenceType: 'missing_in_a' | 'missing_in_b' | 'value_mismatch' | 'type_mismatch';
    severity: DiscrepancySeverity;
    riskScore: number;
    businessImpact: string;
    status: 'new' | 'investigating' | 'resolved' | 'accepted' | 'escalated';
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: Date;
    autoCorrectionApplied: boolean;
    correctionAction?: string;
    correctionResult?: string;
    securityRelevant: boolean;
    potentialFraud: boolean;
    investigationRequired: boolean;
    detectedAt: Date;
    lastUpdated: Date;
    evidenceHash: string;
    digitalSignature: string;
}
export interface ReconciliationAlert {
    id: string;
    executionId: string;
    jobId: string;
    alertType: 'discrepancy_threshold' | 'critical_discrepancy' | 'system_error' | 'security_incident';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    description: string;
    affectedRecords: number;
    criticalDiscrepancies: number;
    securityImplications: boolean;
    recipients: string[];
    notificationChannels: string[];
    sent: boolean;
    sentAt?: Date;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
    resolved: boolean;
    resolvedBy?: string;
    resolvedAt?: Date;
    resolution?: string;
    createdAt: Date;
}
export declare class ReconciliationSecurityService {
    private static instance;
    private reconciliationJobs;
    private activeExecutions;
    private discrepancies;
    private alerts;
    private signingKeys;
    private scheduler;
    private constructor();
    static getInstance(): ReconciliationSecurityService;
    private initializeReconciliationSecurity;
    private initializeCryptographicComponents;
    private setupAuditTrailEncryption;
    private initializeComplianceValidation;
    private loadReconciliationJobs;
    private initializeSigningKeys;
    executeReconciliationJob(jobId: string, options?: {
        manualTrigger?: boolean;
        triggeredBy?: string;
        forceExecution?: boolean;
    }): Promise<string>;
    private retrieveSourceData;
    private retrieveDatabaseData;
    private retrieveApiData;
    private retrieveFileData;
    private retrieveCacheData;
    private performReconciliation;
    private extractKeyValues;
    private compareRecords;
    private valuesMatch;
    private calculateDifference;
    private createDiscrepancy;
    private assessDiscrepancySeverity;
    private calculateDiscrepancyRiskScore;
    private assessBusinessImpact;
    private isSecurityRelevant;
    private isPotentialFraud;
    private generateEvidenceHash;
    private signDiscrepancy;
    private generateDigitalSignature;
    private processDiscrepancies;
    private evaluateCorrectionsCondition;
    private applyCorrection;
    private validateCompliance;
    private generateAlerts;
    private sendAlert;
    private calculateExecutionRiskScore;
    private calculateNextExecution;
    private startScheduler;
    private checkScheduledJobs;
    private cleanupOldExecutions;
    getStats(): {
        jobs: number;
        activeExecutions: number;
        totalDiscrepancies: number;
        criticalDiscrepancies: number;
        alertsGenerated: number;
        complianceIssues: number;
        autoCorrections: number;
        successRate: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: {
            jobs: number;
            activeExecutions: number;
            totalDiscrepancies: number;
            criticalDiscrepancies: number;
            alertsGenerated: number;
            complianceIssues: number;
            autoCorrections: number;
            successRate: number;
        };
    }>;
}
export declare const reconciliationSecurityService: ReconciliationSecurityService;
//# sourceMappingURL=ReconciliationSecurityService.d.ts.map
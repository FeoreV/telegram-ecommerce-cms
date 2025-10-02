import { DataCategory, PrivacyRegulation } from './DataClassificationService';
export interface RetentionPolicy {
    id: string;
    name: string;
    description: string;
    version: string;
    dataCategory: DataCategory[];
    tableName?: string;
    fieldName?: string;
    conditions: {
        age?: number;
        lastAccess?: number;
        userStatus?: 'active' | 'inactive' | 'deleted';
        purpose?: string[];
        legalBasis?: string[];
    };
    retentionPeriod: number;
    gracePeriod: number;
    hardDelete: boolean;
    preDeleteActions: RetentionAction[];
    postDeleteActions: RetentionAction[];
    regulations: PrivacyRegulation[];
    legalRequirement: boolean;
    auditRequired: boolean;
    enabled: boolean;
    schedule?: string;
    priority: number;
    approvalRequired: boolean;
    approvedBy?: string;
    approvedAt?: Date;
    lastExecuted?: Date;
    executionCount: number;
    deletionCount: number;
    errorCount: number;
}
export interface RetentionAction {
    type: 'backup' | 'archive' | 'notify' | 'audit' | 'anonymize' | 'export';
    description: string;
    configuration: Record<string, any>;
    required: boolean;
    order: number;
}
export interface RetentionJob {
    id: string;
    policyId: string;
    status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: Date;
    endTime?: Date;
    duration?: number;
    recordsEvaluated: number;
    recordsDeleted: number;
    recordsArchived: number;
    recordsSkipped: number;
    errors: string[];
    notificationsSent: number;
    notificationErrors: string[];
    executedBy: string;
    approvalReference?: string;
    complianceChecked: boolean;
    complianceIssues: string[];
}
export interface DataSubjectDeletionRequest {
    id: string;
    subjectId: string;
    subjectEmail: string;
    requestType: 'full_deletion' | 'partial_deletion' | 'anonymization';
    requestedAt: Date;
    deadline: Date;
    urgency: 'normal' | 'urgent' | 'court_order';
    legalBasis: string;
    regulation: PrivacyRegulation;
    dataCategories: DataCategory[];
    excludedData: string[];
    retainForLegal: boolean;
    status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
    approvedBy?: string;
    approvedAt?: Date;
    processedBy?: string;
    processedAt?: Date;
    verificationRequired: boolean;
    verifiedBy?: string;
    verifiedAt?: Date;
    affectedRecords: number;
    deletionSummary: {
        tables: string[];
        recordCount: number;
        backupsCreated: boolean;
        anonymizationApplied: boolean;
    };
    auditTrail: {
        timestamp: Date;
        action: string;
        user: string;
        details: Record<string, any>;
    }[];
}
export interface ComplianceReport {
    id: string;
    generatedAt: Date;
    period: {
        start: Date;
        end: Date;
    };
    policiesExecuted: number;
    recordsDeleted: number;
    dataSubjectRequests: number;
    complianceScore: number;
    gdprCompliance: {
        rightToErasure: number;
        dataPortability: number;
        retentionCompliance: number;
        breachNotifications: number;
    };
    ccpaCompliance: {
        deletionRequests: number;
        doNotSell: number;
        accessRequests: number;
        dataMinimization: number;
    };
    issues: {
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        description: string;
        count: number;
        recommendation: string;
    }[];
    recommendations: string[];
    auditor: string;
    nextReviewDate: Date;
}
export declare class DataRetentionService {
    private static instance;
    private retentionPolicies;
    private activeJobs;
    private deletionRequests;
    private complianceReports;
    private executionScheduler;
    private constructor();
    static getInstance(): DataRetentionService;
    private initializeDataRetention;
    private loadRetentionPolicies;
    private loadExistingJobs;
    private validateRetentionCompliance;
    private setupRetentionMonitoring;
    executeRetentionPolicy(policyId: string, dryRun?: boolean): Promise<string>;
    private performComplianceCheck;
    private policiesConflict;
    private executePreActions;
    private executePostActions;
    private executeAction;
    private createRetentionBackup;
    private archiveRetentionData;
    private sendRetentionNotifications;
    private createRetentionAudit;
    private anonymizeRetentionData;
    private exportRetentionData;
    private identifyRetentionCandidates;
    private shouldRetainRecord;
    private hasLegalHold;
    private hasActiveBusinessNeed;
    private hasPendingDataSubjectRequest;
    private deleteRecord;
    private archiveRecord;
    handleDataSubjectDeletion(request: Omit<DataSubjectDeletionRequest, 'id' | 'requestedAt' | 'status' | 'auditTrail'>): Promise<string>;
    private approveDataSubjectDeletion;
    generateComplianceReport(startDate: Date, endDate: Date): Promise<string>;
    private calculateComplianceScore;
    private calculateRetentionCompliance;
    private calculateDataMinimizationScore;
    private identifyComplianceIssues;
    private generateComplianceRecommendations;
    private startScheduledExecution;
    private parseCronToInterval;
    getStats(): {
        retentionPolicies: number;
        activeJobs: number;
        pendingDeletionRequests: number;
        complianceReports: number;
        totalRecordsDeleted: number;
        complianceScore: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const dataRetentionService: DataRetentionService;
//# sourceMappingURL=DataRetentionService.d.ts.map
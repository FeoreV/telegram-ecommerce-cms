export interface DisasterRecoveryConfig {
    enableDisasterRecovery: boolean;
    enableAutomatedRecovery: boolean;
    enableRecoveryTesting: boolean;
    enableFailover: boolean;
    recoveryTimeObjective: number;
    recoveryPointObjective: number;
    recoveryTestIntervalDays: number;
    enableFullSystemTests: boolean;
    enablePartialTests: boolean;
    testRetentionDays: number;
    primaryRegion: string;
    secondaryRegion: string;
    enableCrossRegionFailover: boolean;
    failoverThresholdMinutes: number;
    enableRecoveryNotifications: boolean;
    recoveryNotificationWebhook?: string;
    emergencyContacts: string[];
    enableSOXCompliance: boolean;
    enableGDPRCompliance: boolean;
    enableHIPAACompliance: boolean;
    enableDataIntegrityChecks: boolean;
    enablePerformanceValidation: boolean;
    enableSecurityValidation: boolean;
    maxAutomatedRecoveryAttempts: number;
    automatedRecoveryDelayMinutes: number;
    enableProgressTracking: boolean;
}
export interface RecoveryTest {
    id: string;
    timestamp: Date;
    type: 'full_system' | 'database' | 'application' | 'infrastructure' | 'security';
    status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
    testScope: string[];
    testEnvironment: 'production' | 'staging' | 'test' | 'isolated';
    backupId?: string;
    rtoTarget: number;
    rpoTarget: number;
    startTime: Date;
    endTime?: Date;
    actualRTO?: number;
    actualRPO?: number;
    success: boolean;
    issues: RecoveryIssue[];
    validationResults: ValidationResult[];
    recoveryDuration: number;
    dataRecovered: number;
    systemsRecovered: number;
    testPlan: string;
    executionNotes: string[];
    recommendations: string[];
    complianceValidated: boolean;
    auditTrail: RecoveryAuditEvent[];
}
export interface RecoveryIssue {
    id: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    category: 'data' | 'system' | 'network' | 'security' | 'performance';
    description: string;
    impact: string;
    resolution: string;
    status: 'open' | 'resolved' | 'deferred';
    assignee?: string;
}
export interface ValidationResult {
    component: string;
    test: string;
    result: 'pass' | 'fail' | 'warning';
    expected: any;
    actual: any;
    details: string;
}
export interface RecoveryAuditEvent {
    timestamp: Date;
    action: 'test_started' | 'test_completed' | 'issue_found' | 'recovery_executed' | 'validation_performed';
    user: string;
    details: Record<string, any>;
    outcome: 'success' | 'failure' | 'warning';
}
export interface DisasterRecoveryPlan {
    id: string;
    name: string;
    version: string;
    lastUpdated: Date;
    scope: string[];
    triggers: string[];
    responsibilities: {
        role: string;
        contact: string;
        actions: string[];
    }[];
    procedures: RecoveryProcedure[];
    dependencies: string[];
    prerequisites: string[];
    successCriteria: string[];
    rollbackProcedure: string;
    lastTested: Date;
    testResults: RecoveryTest[];
    complianceRequirements: string[];
    auditHistory: RecoveryAuditEvent[];
}
export interface RecoveryProcedure {
    id: string;
    name: string;
    order: number;
    description: string;
    steps: RecoveryStep[];
    estimatedDuration: number;
    criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dependencies: string[];
    rollbackSteps?: RecoveryStep[];
}
export interface RecoveryStep {
    id: string;
    order: number;
    description: string;
    command?: string;
    automatable: boolean;
    estimatedDuration: number;
    validationCriteria: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}
export declare class DisasterRecoveryService {
    private static instance;
    private config;
    private recoveryPlans;
    private activeTests;
    private testScheduler;
    private lastHealthCheck;
    private constructor();
    static getInstance(): DisasterRecoveryService;
    private initializeDisasterRecovery;
    private initializeRecoveryPlans;
    private createDatabaseRecoveryProcedures;
    private createApplicationRecoveryProcedures;
    private loadTestHistory;
    private validateBackupReadiness;
    private setupRecoveryMonitoring;
    executeRecoveryTest(planId: string, testType?: RecoveryTest['type'], options?: {
        testEnvironment?: RecoveryTest['testEnvironment'];
        backupId?: string;
        scope?: string[];
    }): Promise<string>;
    private executeTestProcedures;
    private simulateStepExecution;
    private simulateManualStep;
    private validateStep;
    private validateRecoveryResults;
    private validateDataIntegrity;
    private validatePerformance;
    private validateSecurity;
    private validateCompliance;
    private validateComplianceRequirement;
    private generateTestReport;
    private logRecoveryEvent;
    private startRecoveryTesting;
    private performScheduledTests;
    getStats(): {
        config: DisasterRecoveryConfig;
        recoveryPlans: number;
        activeTests: number;
        lastTestDate?: Date;
        rtoCompliance: number;
        rpoCompliance: number;
        backupReadiness: boolean;
        timeSinceLastBackup: number | null;
        recentTests: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: {
            config: DisasterRecoveryConfig;
            recoveryPlans: number;
            activeTests: number;
            lastTestDate?: Date;
            rtoCompliance: number;
            rpoCompliance: number;
            backupReadiness: boolean;
            timeSinceLastBackup: number | null;
        };
    }>;
}
export declare const disasterRecoveryService: DisasterRecoveryService;
//# sourceMappingURL=DisasterRecoveryService.d.ts.map
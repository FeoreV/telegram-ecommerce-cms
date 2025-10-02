export declare enum Environment {
    PRODUCTION = "production",
    STAGING = "staging",
    TEST = "test",
    DEVELOPMENT = "development"
}
export declare enum MaskingStrategy {
    FULL_MASKING = "full_masking",
    PARTIAL_MASKING = "partial_masking",
    FORMAT_PRESERVING = "format_preserving",
    TOKENIZATION = "tokenization",
    SYNTHETIC_DATA = "synthetic_data",
    NULLIFICATION = "nullification",
    RANDOMIZATION = "randomization",
    HASHING = "hashing"
}
export interface MaskingRule {
    id: string;
    name: string;
    description: string;
    sourceEnvironment: Environment;
    targetEnvironments: Environment[];
    tablePattern?: RegExp;
    fieldPattern: RegExp;
    dataTypes: string[];
    strategy: MaskingStrategy;
    preserveFormat: boolean;
    preserveLength: boolean;
    preserveNulls: boolean;
    maskingCharacter?: string;
    visiblePrefix?: number;
    visibleSuffix?: number;
    tokenFormat?: string;
    syntheticDataType?: string;
    hashAlgorithm?: string;
    saltLength?: number;
    conditions: {
        minLength?: number;
        maxLength?: number;
        dataPattern?: RegExp;
        sensitivity?: 'low' | 'medium' | 'high' | 'critical';
        cascadeToRelated?: boolean;
    };
    compliance: {
        gdprRequired: boolean;
        ccpaRequired: boolean;
        hipaaRequired: boolean;
        soxRequired: boolean;
        pciRequired: boolean;
    };
    referentialIntegrity: boolean;
    consistency: boolean;
    reversibility: boolean;
    enabled: boolean;
    priority: number;
    validateAfterMasking: boolean;
    batchSize: number;
    parallelProcessing: boolean;
    auditRequired: boolean;
    retainOriginalHash: boolean;
}
export interface MaskingJob {
    id: string;
    name: string;
    type: 'full_refresh' | 'incremental' | 'selective' | 'validation';
    sourceEnvironment: Environment;
    targetEnvironment: Environment;
    scope: {
        databases: string[];
        tables: string[];
        excludeTables: string[];
        includeSystemTables: boolean;
    };
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
    startTime: Date;
    endTime?: Date;
    duration?: number;
    progress: {
        totalTables: number;
        processedTables: number;
        currentTable?: string;
        totalRecords: number;
        processedRecords: number;
        maskedFields: number;
        estimatedCompletion?: Date;
    };
    results: {
        tablesProcessed: number;
        recordsProcessed: number;
        fieldsMasked: number;
        rulesApplied: number;
        validationErrors: string[];
        performanceMetrics: {
            recordsPerSecond: number;
            fieldsPerSecond: number;
            memoryUsageMB: number;
            cpuUsagePercent: number;
        };
    };
    configuration: {
        preserveReferentialIntegrity: boolean;
        validateConsistency: boolean;
        createBackup: boolean;
        parallelWorkers: number;
        batchSize: number;
        retryFailedRecords: boolean;
    };
    complianceValidation: {
        gdprCompliant: boolean;
        ccpaCompliant: boolean;
        hipaaCompliant: boolean;
        dataMinimized: boolean;
        auditTrailGenerated: boolean;
    };
    executedBy: string;
    approvedBy?: string;
    approvalRequired: boolean;
}
export interface SyntheticDataGenerator {
    dataType: string;
    generator: (originalValue: any, context?: any) => any;
    preserveDistribution: boolean;
    description: string;
}
export interface MaskingValidationResult {
    valid: boolean;
    issues: {
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        category: 'data_quality' | 'referential_integrity' | 'compliance' | 'performance';
        description: string;
        affectedRecords: number;
        recommendation: string;
    }[];
    qualityScore: number;
    complianceScore: number;
}
export declare class DataMaskingService {
    private static instance;
    private maskingRules;
    private activeJobs;
    private syntheticGenerators;
    private consistencyMappings;
    private environmentConnections;
    private constructor();
    static getInstance(): DataMaskingService;
    private initializeDataMasking;
    private initializeConsistencyMappings;
    private validateEnvironmentConfigurations;
    private setupPerformanceMonitoring;
    private loadMaskingRules;
    private setupSyntheticDataGenerators;
    private initializeEnvironmentConnections;
    executeMaskingJob(sourceEnvironment: Environment, targetEnvironment: Environment, scope: {
        databases?: string[];
        tables?: string[];
        excludeTables?: string[];
    }, configuration?: {
        preserveReferentialIntegrity?: boolean;
        validateConsistency?: boolean;
        createBackup?: boolean;
        parallelWorkers?: number;
        batchSize?: number;
    }): Promise<string>;
    private identifyTablesToProcess;
    private getDefaultTables;
    private createEnvironmentBackup;
    private processTable;
    private getApplicableRules;
    private getTableRecordCount;
    private getTableBatch;
    private maskRecord;
    private applyMaskingRule;
    private applyFullMasking;
    private applyPartialMasking;
    private applyFormatPreservingMasking;
    private generateFormattedToken;
    private applyTokenization;
    private applySyntheticData;
    private applyRandomization;
    private applyHashing;
    private recordHasField;
    private storeConsistencyMapping;
    private getConsistentMapping;
    private updateRecord;
    private validateReferentialIntegrity;
    private performComplianceValidation;
    private calculatePerformanceMetrics;
    validateMaskingResults(jobId: string): Promise<MaskingValidationResult>;
    getStats(): {
        rules: number;
        activeJobs: number;
        completedJobs: number;
        totalRecordsProcessed: number;
        totalFieldsMasked: number;
        averagePerformance: number;
        complianceScore: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const dataMaskingService: DataMaskingService;
//# sourceMappingURL=DataMaskingService.d.ts.map
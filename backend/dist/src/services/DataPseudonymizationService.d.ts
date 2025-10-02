export declare enum PseudonymizationMethod {
    HASH = "hash",
    TOKENIZATION = "tokenization",
    ENCRYPTION = "encryption",
    SYNTHETIC = "synthetic",
    MASKING = "masking",
    GENERALIZATION = "generalization",
    SUPPRESSION = "suppression"
}
export declare enum ReversibilityLevel {
    IRREVERSIBLE = "irreversible",
    RESTRICTED = "restricted",
    CONDITIONAL = "conditional",
    REVERSIBLE = "reversible"
}
export interface PseudonymizationRule {
    id: string;
    name: string;
    description: string;
    fieldPattern: RegExp;
    tablePattern?: RegExp;
    dataTypes: string[];
    method: PseudonymizationMethod;
    reversibility: ReversibilityLevel;
    preserveFormat: boolean;
    preserveDistribution: boolean;
    hashAlgorithm?: string;
    saltLength?: number;
    encryptionKeyId?: string;
    tokenizationFormat?: string;
    conditions: {
        minLength?: number;
        maxLength?: number;
        dataPattern?: RegExp;
        purpose?: string[];
        environment?: ('production' | 'staging' | 'test' | 'development')[];
    };
    consistencyRequired: boolean;
    uniquenessRequired: boolean;
    regulations: string[];
    legalBasis: string[];
    retentionPeriod: number;
    enabled: boolean;
    priority: number;
    validateBeforeTransform: boolean;
    validateAfterTransform: boolean;
}
export interface PseudonymizationKey {
    id: string;
    keyId: string;
    algorithm: string;
    purpose: string;
    createdAt: Date;
    expiresAt?: Date;
    rotationSchedule?: string;
    usageCount: number;
    maxUsage?: number;
}
export interface TransformationResult {
    id: string;
    originalValue: string;
    transformedValue: string;
    method: PseudonymizationMethod;
    ruleId: string;
    keyId?: string;
    transformedAt: Date;
    transformedBy: string;
    reversible: boolean;
    formatPreserved: boolean;
    lengthPreserved: boolean;
    typePreserved: boolean;
    distributionPreserved: boolean;
    purposes: string[];
    legalBasis: string[];
    retentionPeriod: number;
    validated: boolean;
    validationErrors: string[];
}
export interface PseudonymizationJob {
    id: string;
    type: 'transform' | 'reverse' | 'validate' | 'rotate';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    scope: {
        tables: string[];
        fields: string[];
        conditions: Record<string, any>;
    };
    startTime: Date;
    endTime?: Date;
    duration?: number;
    recordsProcessed: number;
    transformationsApplied: number;
    validationErrors: string[];
    qualityScore: number;
    consistencyScore: number;
    uniquenessScore: number;
    executedBy: string;
    approvalRequired: boolean;
    approvedBy?: string;
    progress: number;
    currentTable?: string;
    estimatedCompletion?: Date;
}
export interface TokenMapping {
    originalHash: string;
    tokenValue: string;
    format: string;
    createdAt: Date;
    lastUsed: Date;
    usageCount: number;
    keyVersion: string;
    expiresAt?: Date;
}
export declare class DataPseudonymizationService {
    private static instance;
    private pseudonymizationRules;
    private pseudonymizationKeys;
    private transformationResults;
    private activeJobs;
    private tokenMappings;
    private formatPreservers;
    private constructor();
    private initialize;
    static getInstance(): Promise<DataPseudonymizationService>;
    private initializeDataPseudonymization;
    private initializePseudonymizationKeys;
    private loadExistingTransformations;
    private validateServiceHealth;
    private loadPseudonymizationRules;
    private setupFormatPreservers;
    transformData(data: Record<string, any>, tableName: string, _environment?: string): Promise<{
        transformedData: Record<string, any>;
        transformations: TransformationResult[];
        qualityScore: number;
    }>;
    private findApplicableRules;
    private applyTransformation;
    private applyHashTransformation;
    private applyTokenization;
    private generateFormatPreservingToken;
    private generateRandomToken;
    private generateToken;
    private applyEncryption;
    private applyMasking;
    private applyGeneralization;
    private applySyntheticGeneration;
    private applySuppression;
    private validateInput;
    private validateTransformation;
    private isFormatPreserved;
    private isTypePreserved;
    private calculateTransformationQuality;
    reverseTransformation(transformedValue: string, transformationId: string, authorizedUser: string, justification: string): Promise<string>;
    executePseudonymizationJob(tables: string[], environment: string, dryRun?: boolean): Promise<string>;
    private generateSimulatedRecords;
    private calculateConsistencyScore;
    private calculateUniquenessScore;
    getStats(): {
        rules: number;
        keys: number;
        transformations: number;
        activeJobs: number;
        tokenMappings: number;
        averageQualityScore: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const dataPseudonymizationService: Promise<DataPseudonymizationService>;
//# sourceMappingURL=DataPseudonymizationService.d.ts.map
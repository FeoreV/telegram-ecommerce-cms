export declare enum DataClassification {
    PUBLIC = "PUBLIC",
    INTERNAL = "INTERNAL",
    CONFIDENTIAL = "CONFIDENTIAL",
    RESTRICTED = "RESTRICTED",
    TOP_SECRET = "TOP_SECRET"
}
export declare enum DataCategory {
    PII_DIRECT = "PII_DIRECT",
    PII_INDIRECT = "PII_INDIRECT",
    PII_SENSITIVE = "PII_SENSITIVE",
    FINANCIAL_ACCOUNT = "FINANCIAL_ACCOUNT",
    FINANCIAL_TRANSACTION = "FINANCIAL_TRANSACTION",
    FINANCIAL_CREDIT = "FINANCIAL_CREDIT",
    BUSINESS_CONFIDENTIAL = "BUSINESS_CONFIDENTIAL",
    BUSINESS_PROPRIETARY = "BUSINESS_PROPRIETARY",
    BUSINESS_OPERATIONAL = "BUSINESS_OPERATIONAL",
    SYSTEM_CREDENTIALS = "SYSTEM_CREDENTIALS",
    SYSTEM_LOGS = "SYSTEM_LOGS",
    SYSTEM_METRICS = "SYSTEM_METRICS",
    HEALTH_RECORD = "HEALTH_RECORD",
    HEALTH_BIOMETRIC = "HEALTH_BIOMETRIC",
    LEGAL_CONTRACT = "LEGAL_CONTRACT",
    LEGAL_COMPLIANCE = "LEGAL_COMPLIANCE",
    PUBLIC_CONTENT = "PUBLIC_CONTENT",
    PUBLIC_METADATA = "PUBLIC_METADATA"
}
export declare enum PrivacyRegulation {
    GDPR = "GDPR",
    CCPA = "CCPA",
    PIPEDA = "PIPEDA",
    LGPD = "LGPD",
    PDPA_SG = "PDPA_SG",
    PDPA_TH = "PDPA_TH",
    POPIA = "POPIA",
    HIPAA = "HIPAA"
}
export interface DataElement {
    id: string;
    fieldName: string;
    tableName?: string;
    classification: DataClassification;
    category: DataCategory;
    isPII: boolean;
    isSensitive: boolean;
    isEncrypted: boolean;
    regulations: PrivacyRegulation[];
    retentionPeriod: number;
    minimumAge: number;
    purpose: string[];
    legalBasis: string[];
    dataSubject: 'customer' | 'employee' | 'vendor' | 'visitor';
    encryptionRequired: boolean;
    accessControls: string[];
    auditRequired: boolean;
    discoveredAt: Date;
    lastScanned: Date;
    confidence: number;
    canBeMinimized: boolean;
    minimizationStrategy?: 'hash' | 'tokenize' | 'pseudonymize' | 'remove';
    minimizationApplied: boolean;
    allowCrossBorderTransfer: boolean;
    approvedCountries: string[];
    adequacyDecisions: string[];
}
export interface DataInventory {
    id: string;
    timestamp: Date;
    version: string;
    scope: string[];
    coverage: number;
    elements: DataElement[];
    summary: {
        totalElements: number;
        byClassification: Record<DataClassification, number>;
        byCategory: Record<DataCategory, number>;
        byRegulation: Record<PrivacyRegulation, number>;
    };
    privacyRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    complianceGaps: string[];
    recommendations: string[];
    validated: boolean;
    validatedBy?: string;
    validatedAt?: Date;
}
export interface PIIMinimizationRule {
    id: string;
    name: string;
    description: string;
    fieldPattern: RegExp;
    dataCategory: DataCategory[];
    classification: DataClassification[];
    strategy: 'remove' | 'hash' | 'tokenize' | 'pseudonymize' | 'encrypt';
    preserveFormat: boolean;
    reversible: boolean;
    conditions: {
        age?: number;
        lastAccess?: number;
        purpose?: string[];
        userConsent?: boolean;
    };
    enabled: boolean;
    priority: number;
    schedule?: string;
    regulations: PrivacyRegulation[];
    legalBasis: string;
    retentionPeriod: number;
}
export interface DataSubjectRequest {
    id: string;
    type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
    requestedAt: Date;
    subjectId: string;
    subjectEmail: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    description: string;
    scope: string[];
    urgency: 'normal' | 'urgent';
    status: 'pending' | 'processing' | 'completed' | 'rejected';
    assignedTo?: string;
    processedAt?: Date;
    responseTime: number;
    actions: string[];
    affectedSystems: string[];
    dataExported?: string;
    regulation: PrivacyRegulation;
    legalBasis: string;
    deadline: Date;
    auditTrail: {
        timestamp: Date;
        action: string;
        user: string;
        details: Record<string, any>;
    }[];
}
export declare class DataClassificationService {
    private static instance;
    private dataInventory;
    private minimizationRules;
    private dataSubjectRequests;
    private classificationRules;
    private scanScheduler;
    private constructor();
    static getInstance(): DataClassificationService;
    private initializeDataClassification;
    private initializeClassificationPatterns;
    private loadExistingInventory;
    private validateComplianceStatus;
    private loadClassificationRules;
    private loadMinimizationRules;
    classifyData(data: string): DataClassification;
    performDataDiscovery(scope?: string[]): Promise<string>;
    private getDefaultScanScope;
    private scanSystem;
    private scanDatabaseTable;
    private scanLogFiles;
    private scanCache;
    private scanFiles;
    private classifyField;
    private createDataElement;
    private getDefaultRetentionPeriod;
    private getMinimumAge;
    private getDefaultPurposes;
    private getDefaultLegalBasis;
    private getDefaultAccessControls;
    private getDefaultMinimizationStrategy;
    private calculateCoverage;
    private generateSummary;
    private assessPrivacyRisk;
    private identifyComplianceGaps;
    private generateRecommendations;
    applyPIIMinimization(inventoryId?: string): Promise<{
        applied: number;
        failed: number;
        details: string[];
    }>;
    private isRuleApplicable;
    private applyMinimizationRule;
    private hashData;
    private tokenizeData;
    private pseudonymizeData;
    private encryptData;
    private removeData;
    handleDataSubjectRequest(request: Omit<DataSubjectRequest, 'id' | 'requestedAt' | 'status' | 'auditTrail'>): Promise<string>;
    private assignRequest;
    private startAutomatedScanning;
    private getEnabledRegulations;
    getStats(): {
        inventoryCount: number;
        totalElements: number;
        piiElements: number;
        sensitiveElements: number;
        minimizationRules: number;
        pendingRequests: number;
        complianceScore: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const dataClassificationService: DataClassificationService;
//# sourceMappingURL=DataClassificationService.d.ts.map
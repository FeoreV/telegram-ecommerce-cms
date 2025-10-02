export interface IdempotencyConfig {
    enableIdempotency: boolean;
    keyTTL: number;
    keyPrefix: string;
    maxRetries: number;
    retryDelay: number;
    enableDistributedLocking: boolean;
    lockTimeout: number;
}
export interface PaymentSecurityConfig {
    enableFraudDetection: boolean;
    maxDailyAmount: number;
    maxTransactionAmount: number;
    maxTransactionsPerHour: number;
    enableVelocityChecks: boolean;
    enableGeolocationChecks: boolean;
    enableDeviceFingerprinting: boolean;
    suspiciousAmountThreshold: number;
    requireManualReview: boolean;
    enableRiskScoring: boolean;
    maxRiskScore: number;
}
export interface IdempotencyKey {
    key: string;
    userId: string;
    endpoint: string;
    requestHash: string;
    response?: unknown;
    status: 'processing' | 'completed' | 'failed';
    createdAt: Date;
    expiresAt: Date;
    attempts: number;
    lockId?: string;
}
export interface TransactionContext {
    userId: string;
    storeId: string;
    orderId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    ipAddress: string;
    userAgent: string;
    deviceFingerprint?: string;
    geolocation?: {
        country: string;
        region: string;
        city: string;
        lat: number;
        lon: number;
    };
    metadata: Record<string, unknown>;
}
export interface FraudAnalysisResult {
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    flags: string[];
    requiresManualReview: boolean;
    blockedReasons: string[];
    recommendations: string[];
    analysis: {
        velocityCheck: {
            passed: boolean;
            details: unknown;
        };
        amountCheck: {
            passed: boolean;
            details: unknown;
        };
        geolocationCheck: {
            passed: boolean;
            details: unknown;
        };
        deviceCheck: {
            passed: boolean;
            details: unknown;
        };
        patternAnalysis: {
            passed: boolean;
            details: unknown;
        };
    };
}
export declare class PaymentSecurityService {
    private static instance;
    private idempotencyConfig;
    private securityConfig;
    private activeKeys;
    private distributedLocks;
    private constructor();
    static getInstance(): PaymentSecurityService;
    generateIdempotencyKey(userId: string, endpoint: string, requestData: unknown): string;
    processIdempotentRequest<T>(idempotencyKey: string, userId: string, endpoint: string, requestData: unknown, processor: () => Promise<T>): Promise<{
        result: T;
        isRetry: boolean;
        attempts: number;
    }>;
    private acquireDistributedLock;
    private releaseDistributedLock;
    private waitForProcessing;
    private storeIdempotencyKey;
    private getIdempotencyKey;
    analyzeFraud(context: TransactionContext): Promise<FraudAnalysisResult>;
    private performAmountChecks;
    private performVelocityChecks;
    private performGeolocationChecks;
    private performDeviceChecks;
    private performPatternAnalysis;
    private calculateRiskScore;
    private determineRiskLevel;
    private isSuspiciousUserAgent;
    private startCleanupTimer;
    private cleanupExpiredKeys;
    private cleanupExpiredLocks;
    getStats(): {
        idempotencyConfig: IdempotencyConfig;
        securityConfig: PaymentSecurityConfig;
        activeKeys: number;
        activeLocks: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: {
            idempotencyConfig: IdempotencyConfig;
            securityConfig: PaymentSecurityConfig;
            activeKeys: number;
            activeLocks: number;
        };
    }>;
}
export declare const paymentSecurityService: PaymentSecurityService;
//# sourceMappingURL=PaymentSecurityService.d.ts.map
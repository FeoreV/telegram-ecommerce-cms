export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export declare class EnvValidator {
    static validate(): ValidationResult;
    private static validateDatabaseConfig;
    private static validateJWTConfig;
    private static validateSecurityConfig;
    private static validateTelegramConfig;
    private static validateLoggingConfig;
    private static validateFileUploadConfig;
    private static isValidExpiryFormat;
    private static isValidIPOrCIDR;
    private static validateNetworkConfig;
    private static validateRedisConfig;
    private static validateSSLConfig;
    private static validateRateLimitConfig;
    private static validateNotificationConfig;
    static printEnvironmentSummary(): {
        nodeEnv: "development" | "production" | "test";
        port: number;
        databaseProvider: string;
        databaseConnected: boolean;
        redisConfigured: boolean;
        telegramConfigured: boolean;
        frontendUrl: string;
        logLevel: string;
        adminJsEnabled: boolean;
        superAdminSet: boolean;
        httpsEnabled: boolean;
        securityHeadersEnabled: boolean;
        bruteForceProtection: boolean;
        corsWhitelistSet: boolean;
        adminIpWhitelistSet: boolean;
        rateLimiting: {
            global: string;
            auth: string;
            upload: string;
        };
        emailConfigured: boolean;
        webhookConfigured: boolean;
    };
    private static calculateSecurityScore;
    static validateOrExit(): void;
    static getHealthStatus(): {
        status: 'healthy' | 'warning' | 'critical';
        timestamp: string;
        environment: string;
        checks: Record<string, {
            status: string;
            message?: string;
        }>;
    };
}
export default EnvValidator;
//# sourceMappingURL=envValidator.d.ts.map
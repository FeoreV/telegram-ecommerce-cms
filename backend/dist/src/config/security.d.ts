export interface SecurityConfig {
    jwt: {
        secret: string;
        refreshSecret: string;
        accessExpiry: string;
        refreshExpiry: string;
        clockSkew: number;
        issuer: string;
        audience: string;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
        authMaxRequests: number;
        uploadMaxRequests: number;
    };
    cors: {
        allowedOrigins: string[];
        credentials: boolean;
    };
    security: {
        enableBruteForceProtection: boolean;
        enableSecurityHeaders: boolean;
        enableRequestSanitization: boolean;
        adminIPWhitelist?: string[];
        maxRequestSize: string;
        enableSecurityMonitoring: boolean;
    };
    redis: {
        url?: string;
        enabled: boolean;
    };
}
export declare const loadSecurityConfig: () => Promise<SecurityConfig>;
export declare const performSecurityHealthCheck: () => {
    status: "healthy" | "warning" | "critical";
    checks: Array<{
        name: string;
        status: "pass" | "warn" | "fail";
        message: string;
    }>;
};
export interface SecurityMetrics {
    rateLimitHits: number;
    bruteForceAttempts: number;
    invalidTokenAttempts: number;
    suspiciousRequests: number;
    blacklistedTokens: number;
    activeSessionsCount: number;
}
declare class SecurityMetricsCollector {
    private metrics;
    incrementRateLimitHits(): void;
    incrementBruteForceAttempts(): void;
    incrementInvalidTokenAttempts(): void;
    incrementSuspiciousRequests(): void;
    incrementBlacklistedTokens(): void;
    setActiveSessionsCount(count: number): void;
    getMetrics(): SecurityMetrics;
    resetMetrics(): void;
}
export declare const securityMetrics: SecurityMetricsCollector;
declare const _default: Promise<SecurityConfig>;
export default _default;
//# sourceMappingURL=security.d.ts.map
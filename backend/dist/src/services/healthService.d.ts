export interface HealthCheck {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    responseTime?: number;
    metadata?: Record<string, unknown>;
}
export interface SystemMetrics {
    cpu: {
        usage: number;
        loadAverage: number[];
    };
    memory: {
        total: number;
        free: number;
        used: number;
        usagePercentage: number;
    };
    disk: {
        total: number;
        free: number;
        used: number;
        usagePercentage: number;
    };
    network: {
        bytesReceived: number;
        bytesSent: number;
    };
    uptime: number;
}
export interface PerformanceMetrics {
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    activeConnections: number;
    databaseConnections: number;
    cacheHitRate?: number;
}
export interface ApplicationHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    uptime: number;
    timestamp: Date;
    checks: HealthCheck[];
    metrics: {
        system: SystemMetrics;
        performance: PerformanceMetrics;
    };
    recommendations: string[];
}
export declare class HealthService {
    private static startTime;
    private static performanceData;
    static recordRequest(responseTime: number, hasError?: boolean): void;
    static getHealthReport(): Promise<ApplicationHealth>;
    private static runHealthChecks;
    private static checkDatabase;
    private static checkRedis;
    private static checkFileSystem;
    private static checkExternalServices;
    private static checkMemoryUsage;
    private static checkCPUUsage;
    private static getSystemMetrics;
    private static getPerformanceMetrics;
    private static getDatabaseConnectionCount;
    private static getCPUUsage;
    private static getDiskSpace;
    private static getDefaultSystemMetrics;
    private static determineOverallStatus;
    private static generateRecommendations;
    static resetPerformanceCounters(): void;
}
export default HealthService;
//# sourceMappingURL=healthService.d.ts.map
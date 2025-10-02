import { Request, Response, NextFunction } from 'express';
export interface PerformanceData {
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    timestamp: Date;
    userAgent?: string;
    ip?: string;
    userId?: string;
    error?: boolean;
}
declare global {
    let performanceHistory: PerformanceData[] | undefined;
}
export declare const performanceTracker: (req: Request, res: Response, next: NextFunction) => void;
export declare function getPerformanceAnalytics(timeWindow?: number): {
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    slowestRequests: PerformanceData[];
    topEndpoints: {
        path: string;
        count: number;
        avgResponseTime: number;
    }[];
    statusCodeDistribution: Record<string, number>;
};
export declare function clearPerformanceHistory(): void;
export default performanceTracker;
//# sourceMappingURL=performanceTracker.d.ts.map
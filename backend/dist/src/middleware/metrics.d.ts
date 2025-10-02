import { Request, Response, NextFunction } from 'express';
export declare const metricsMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const getMetrics: () => {
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    timestamp: string;
    totalRequests: number;
    requestsByMethod: {
        [key: string]: number;
    };
    requestsByPath: {
        [key: string]: number;
    };
    responseTimeSum: number;
    errorCount: number;
    statusCodes: {
        [key: string]: number;
    };
};
export declare const resetMetrics: () => void;
//# sourceMappingURL=metrics.d.ts.map
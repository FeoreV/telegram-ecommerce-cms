import cors from 'cors';
import { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response, NextFunction, RequestHandler } from 'express';
declare module 'express-serve-static-core' {
    interface Request {
        bruteForceKey?: string;
    }
}
export declare const globalRateLimit: RateLimitRequestHandler;
export declare const authRateLimit: RateLimitRequestHandler;
export declare const uploadRateLimit: RateLimitRequestHandler;
export declare const apiRateLimit: RateLimitRequestHandler;
export declare const adminRateLimit: RateLimitRequestHandler;
export declare const slowDownMiddleware: RequestHandler;
export declare const bruteForce: {
    prevent: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    reset: (key: string) => void;
};
export declare const securityMonitoring: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
export declare const adminIPWhitelist: (req: Request, res: Response, next: NextFunction) => void;
export declare const getSecurityStatus: () => {
    suspiciousIPs: number;
    blockedIPs: number;
    redisConnected: boolean;
    environment: string;
    corsOriginsConfigured: boolean;
    adminIPWhitelistConfigured: boolean;
    httpsEnabled: boolean;
};
export declare const corsMiddleware: (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
export declare const helmetMiddleware: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare const ipReputationCheck: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const markSuspiciousIP: (ip: string) => void;
export declare const securityMiddlewareBundle: (RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>> | ((req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void))[];
export declare const apiSecurityBundle: (((req: Request, res: Response, next: NextFunction) => void) | ((req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void))[];
export declare const adminSecurityBundle: (RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>> | ((req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void))[];
export declare const cleanupSecurityData: () => void;
export default securityMiddlewareBundle;
//# sourceMappingURL=security.d.ts.map
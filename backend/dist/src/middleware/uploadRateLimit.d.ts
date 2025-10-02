import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
export declare const globalUploadRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const userUploadRateLimit: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const orderUploadRateLimit: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const ipUploadRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const uploadRateLimitMiddleware: ((req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>)[];
export declare const getUploadStats: (req: AuthenticatedRequest, res: Response) => Response<any, Record<string, any>>;
export declare const cleanupUploadRateLimit: () => void;
//# sourceMappingURL=uploadRateLimit.d.ts.map
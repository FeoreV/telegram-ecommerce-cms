import express, { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from './SecureAuthSystem';
import { Permission } from '../middleware/permissions';
export declare const authRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const loginSlowDown: express.RequestHandler;
export declare const generalRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const secureAuthMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<express.Response<any, Record<string, any>>>;
export declare const optionalAuthMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (allowedRoles: UserRole[] | UserRole) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => express.Response<any, Record<string, any>>;
export declare const requirePermission: (permission: Permission) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<express.Response<any, Record<string, any>>>;
export declare const requireStoreAccess: (storeIdParam?: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | express.Response<any, Record<string, any>>>;
export declare const securityLoggingMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const securityMiddlewareStack: ((req: Request, res: Response, next: NextFunction) => void)[];
export declare const authMiddlewareStack: (((req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<express.Response<any, Record<string, any>>>) | ((req: Request, res: Response, next: NextFunction) => void))[];
export declare const adminAuthMiddlewareStack: (((req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<express.Response<any, Record<string, any>>>) | ((req: Request, res: Response, next: NextFunction) => void) | ((req: AuthenticatedRequest, res: Response, next: NextFunction) => express.Response<any, Record<string, any>>))[];
export declare const ownerAuthMiddlewareStack: (((req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<express.Response<any, Record<string, any>>>) | ((req: Request, res: Response, next: NextFunction) => void) | ((req: AuthenticatedRequest, res: Response, next: NextFunction) => express.Response<any, Record<string, any>>))[];
//# sourceMappingURL=SecureAuthMiddleware.d.ts.map
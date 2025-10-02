import { Request, Response, NextFunction } from 'express';
import { UserContext } from '../services/MultiTenantSecurityService';
import { UserRole } from '../utils/jwt';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        telegramId: string;
        role: UserRole;
        storeId?: string;
        permissions?: string[];
        sessionId: string;
    };
    storeId?: string;
    tenantContext?: UserContext;
}
export interface RBACOptions {
    roles?: string[];
    permissions?: string[];
    requireStoreAccess?: boolean;
    operation?: 'read' | 'write';
    allowSelfAccess?: boolean;
}
export declare const authenticateJWT: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (allowedRoles: string | string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireStoreAccess: (operation?: "read" | "write") => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requirePermission: (requiredPermissions: string | string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireOwnerAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireSelfAccess: (userIdParam?: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const rbac: (options: RBACOptions) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const cleanupContext: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=rbacMiddleware.d.ts.map
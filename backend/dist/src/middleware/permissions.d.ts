import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { UserRole } from '../utils/jwt';
export declare enum Permission {
    STORE_CREATE = "STORE_CREATE",
    STORE_UPDATE = "STORE_UPDATE",
    STORE_DELETE = "STORE_DELETE",
    STORE_VIEW = "STORE_VIEW",
    STORE_MANAGE = "STORE_MANAGE",
    PRODUCT_CREATE = "PRODUCT_CREATE",
    PRODUCT_UPDATE = "PRODUCT_UPDATE",
    PRODUCT_DELETE = "PRODUCT_DELETE",
    PRODUCT_VIEW = "PRODUCT_VIEW",
    ORDER_VIEW = "ORDER_VIEW",
    ORDER_UPDATE = "ORDER_UPDATE",
    ORDER_CONFIRM = "ORDER_CONFIRM",
    ORDER_REJECT = "ORDER_REJECT",
    ORDER_DELETE = "ORDER_DELETE",
    USER_CREATE = "USER_CREATE",
    USER_UPDATE = "USER_UPDATE",
    USER_DELETE = "USER_DELETE",
    USER_VIEW = "USER_VIEW",
    USER_PROMOTE = "USER_PROMOTE",
    ANALYTICS_VIEW = "ANALYTICS_VIEW",
    ANALYTICS_EXPORT = "ANALYTICS_EXPORT",
    SYSTEM_BACKUP = "SYSTEM_BACKUP",
    SYSTEM_RESTORE = "SYSTEM_RESTORE",
    SYSTEM_LOGS = "SYSTEM_LOGS",
    ADMINJS_ACCESS = "ADMINJS_ACCESS"
}
export declare const ROLE_PERMISSIONS: Record<UserRole, Permission[]>;
export interface PermissionContext {
    storeId?: string;
    userId?: string;
    resourceOwnerId?: string;
}
export declare class PermissionChecker {
    private user;
    private context;
    constructor(user: AuthenticatedRequest['user'], context?: PermissionContext);
    hasPermission(permission: Permission): Promise<boolean>;
    private checkContextualPermission;
    private checkStorePermission;
    private checkUserPermission;
}
export declare const requirePermission: (permission: Permission, getContext?: (req: AuthenticatedRequest) => PermissionContext) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const requireStorePermission: (permission: Permission) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const requireUserPermission: (permission: Permission) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const requireStoreAccessAsync: (permission: Permission) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    Permission: typeof Permission;
    PermissionChecker: typeof PermissionChecker;
    requirePermission: (permission: Permission, getContext?: (req: AuthenticatedRequest) => PermissionContext) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    requireStorePermission: (permission: Permission) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    requireUserPermission: (permission: Permission) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    requireStoreAccessAsync: (permission: Permission) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
};
export default _default;
//# sourceMappingURL=permissions.d.ts.map
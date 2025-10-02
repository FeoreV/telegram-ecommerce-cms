import { UserRole } from './SecureAuthSystem';
import { AuthenticatedRequest } from '../middleware/auth';
import { Response, NextFunction } from 'express';
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
    PRODUCT_MANAGE = "PRODUCT_MANAGE",
    ORDER_VIEW = "ORDER_VIEW",
    ORDER_UPDATE = "ORDER_UPDATE",
    ORDER_CONFIRM = "ORDER_CONFIRM",
    ORDER_REJECT = "ORDER_REJECT",
    ORDER_DELETE = "ORDER_DELETE",
    ORDER_MANAGE = "ORDER_MANAGE",
    USER_CREATE = "USER_CREATE",
    USER_UPDATE = "USER_UPDATE",
    USER_DELETE = "USER_DELETE",
    USER_VIEW = "USER_VIEW",
    USER_PROMOTE = "USER_PROMOTE",
    USER_MANAGE = "USER_MANAGE",
    ANALYTICS_VIEW = "ANALYTICS_VIEW",
    ANALYTICS_EXPORT = "ANALYTICS_EXPORT",
    ANALYTICS_MANAGE = "ANALYTICS_MANAGE",
    SYSTEM_BACKUP = "SYSTEM_BACKUP",
    SYSTEM_RESTORE = "SYSTEM_RESTORE",
    SYSTEM_LOGS = "SYSTEM_LOGS",
    SYSTEM_CONFIG = "SYSTEM_CONFIG",
    SYSTEM_MANAGE = "SYSTEM_MANAGE",
    ADMINJS_ACCESS = "ADMINJS_ACCESS",
    ADMIN_PANEL_ACCESS = "ADMIN_PANEL_ACCESS",
    BOT_MANAGE = "BOT_MANAGE",
    BOT_CONFIG = "BOT_CONFIG",
    NOTIFICATION_SEND = "NOTIFICATION_SEND",
    NOTIFICATION_MANAGE = "NOTIFICATION_MANAGE",
    INVENTORY_VIEW = "INVENTORY_VIEW",
    INVENTORY_UPDATE = "INVENTORY_UPDATE",
    INVENTORY_MANAGE = "INVENTORY_MANAGE"
}
export declare const ROLE_PERMISSIONS: Record<UserRole, Permission[]>;
export declare const PERMISSION_GROUPS: {
    STORE_MANAGEMENT: Permission[];
    PRODUCT_MANAGEMENT: Permission[];
    ORDER_MANAGEMENT: Permission[];
    USER_MANAGEMENT: Permission[];
    SYSTEM_ADMIN: Permission[];
};
export interface PermissionContext {
    storeId?: string;
    userId?: string;
    targetUserId?: string;
    resourceOwnerId?: string;
}
export declare class RolePermissionManager {
    private user;
    private context;
    constructor(user: AuthenticatedRequest['user'], context?: PermissionContext);
    hasPermission(permission: Permission): boolean;
    hasAnyPermission(permissions: Permission[]): boolean;
    hasAllPermissions(permissions: Permission[]): boolean;
    hasStoreAccess(storeId: string): Promise<boolean>;
    canAccessResource(permission: Permission, resourceType: 'store' | 'user' | 'order' | 'product', resourceId?: string): Promise<boolean>;
    private canManageUser;
    private isOrderOwner;
    getAllPermissions(): Permission[];
    getGroupedPermissions(): Record<string, Permission[]>;
    isElevatedUser(): boolean;
    isOwner(): boolean;
    canCreate(resourceType: 'store' | 'user' | 'product'): boolean;
    static createPermissionMiddleware(permission: Permission): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    static createStoreAccessMiddleware(storeIdParam?: string): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
}
export declare class RoleManager {
    static promoteUser(adminUserId: string, targetUserId: string, newRole: UserRole, storeAssignments?: {
        storeId: string;
        role: 'ADMIN' | 'VENDOR';
    }[]): Promise<void>;
    static getRoleLevel(role: UserRole): number;
    static canManageRole(managerRole: UserRole, targetRole: UserRole): boolean;
}
export declare const PermissionChecker: typeof RolePermissionManager;
//# sourceMappingURL=RolePermissionManager.d.ts.map
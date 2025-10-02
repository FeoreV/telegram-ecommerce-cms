import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
export declare enum AuditAction {
    USER_CREATED = "USER_CREATED",
    USER_UPDATED = "USER_UPDATED",
    USER_DELETED = "USER_DELETED",
    USER_PROMOTED = "USER_PROMOTED",
    USER_DEACTIVATED = "USER_DEACTIVATED",
    USER_ACTIVATED = "USER_ACTIVATED",
    STORE_CREATED = "STORE_CREATED",
    STORE_UPDATED = "STORE_UPDATED",
    STORE_DELETED = "STORE_DELETED",
    STORE_STATUS_CHANGED = "STORE_STATUS_CHANGED",
    PRODUCT_CREATED = "PRODUCT_CREATED",
    PRODUCT_UPDATED = "PRODUCT_UPDATED",
    PRODUCT_DELETED = "PRODUCT_DELETED",
    PRODUCT_ACTIVATED = "PRODUCT_ACTIVATED",
    PRODUCT_DEACTIVATED = "PRODUCT_DEACTIVATED",
    PRODUCT_STOCK_UPDATED = "PRODUCT_STOCK_UPDATED",
    ORDER_CONFIRMED = "ORDER_CONFIRMED",
    ORDER_REJECTED = "ORDER_REJECTED",
    ORDER_UPDATED = "ORDER_UPDATED",
    ORDER_DELETED = "ORDER_DELETED",
    ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED",
    ADMIN_LOGIN = "ADMIN_LOGIN",
    ADMIN_LOGOUT = "ADMIN_LOGOUT",
    ADMINJS_ACCESS = "ADMINJS_ACCESS",
    SYSTEM_BACKUP = "SYSTEM_BACKUP",
    SYSTEM_RESTORE = "SYSTEM_RESTORE",
    SYSTEM_MAINTENANCE = "SYSTEM_MAINTENANCE",
    BULK_IMPORT = "BULK_IMPORT",
    BULK_EXPORT = "BULK_EXPORT",
    BULK_UPDATE = "BULK_UPDATE",
    BULK_DELETE = "BULK_DELETE"
}
interface AuditLogData {
    action: AuditAction;
    details?: string | object;
    resourceId?: string;
    resourceType?: string;
    orderId?: string;
    storeId?: string;
    metadata?: Record<string, any>;
}
export declare class AuditLogService {
    static log(adminId: string, data: AuditLogData, req?: AuthenticatedRequest): Promise<void>;
}
export declare const auditLogger: (action: AuditAction, getDetails?: (req: AuthenticatedRequest, res?: Response) => AuditLogData) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const auditUserAction: (action: AuditAction) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const auditStoreAction: (action: AuditAction) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const auditProductAction: (action: AuditAction) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const auditOrderAction: (action: AuditAction) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const auditAuthAction: (adminId: string, action: AuditAction.ADMIN_LOGIN | AuditAction.ADMIN_LOGOUT | AuditAction.ADMINJS_ACCESS, req: AuthenticatedRequest, details?: any) => Promise<void>;
export declare const auditBulkAction: (adminId: string, action: AuditAction, req: AuthenticatedRequest, details: {
    affected: number;
    resourceType: string;
    operation: string;
    metadata?: any;
}) => Promise<void>;
declare const _default: {
    AuditLogService: typeof AuditLogService;
    auditLogger: (action: AuditAction, getDetails?: (req: AuthenticatedRequest, res?: Response) => AuditLogData) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    auditUserAction: (action: AuditAction) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    auditStoreAction: (action: AuditAction) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    auditProductAction: (action: AuditAction) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    auditOrderAction: (action: AuditAction) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    auditAuthAction: (adminId: string, action: AuditAction.ADMIN_LOGIN | AuditAction.ADMIN_LOGOUT | AuditAction.ADMINJS_ACCESS, req: AuthenticatedRequest, details?: any) => Promise<void>;
    auditBulkAction: (adminId: string, action: AuditAction, req: AuthenticatedRequest, details: {
        affected: number;
        resourceType: string;
        operation: string;
        metadata?: any;
    }) => Promise<void>;
    AuditAction: typeof AuditAction;
};
export default _default;
//# sourceMappingURL=auditLog.d.ts.map
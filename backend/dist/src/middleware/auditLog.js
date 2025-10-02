"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditBulkAction = exports.auditAuthAction = exports.auditOrderAction = exports.auditProductAction = exports.auditStoreAction = exports.auditUserAction = exports.auditLogger = exports.AuditLogService = exports.AuditAction = void 0;
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
var AuditAction;
(function (AuditAction) {
    AuditAction["USER_CREATED"] = "USER_CREATED";
    AuditAction["USER_UPDATED"] = "USER_UPDATED";
    AuditAction["USER_DELETED"] = "USER_DELETED";
    AuditAction["USER_PROMOTED"] = "USER_PROMOTED";
    AuditAction["USER_DEACTIVATED"] = "USER_DEACTIVATED";
    AuditAction["USER_ACTIVATED"] = "USER_ACTIVATED";
    AuditAction["STORE_CREATED"] = "STORE_CREATED";
    AuditAction["STORE_UPDATED"] = "STORE_UPDATED";
    AuditAction["STORE_DELETED"] = "STORE_DELETED";
    AuditAction["STORE_STATUS_CHANGED"] = "STORE_STATUS_CHANGED";
    AuditAction["PRODUCT_CREATED"] = "PRODUCT_CREATED";
    AuditAction["PRODUCT_UPDATED"] = "PRODUCT_UPDATED";
    AuditAction["PRODUCT_DELETED"] = "PRODUCT_DELETED";
    AuditAction["PRODUCT_ACTIVATED"] = "PRODUCT_ACTIVATED";
    AuditAction["PRODUCT_DEACTIVATED"] = "PRODUCT_DEACTIVATED";
    AuditAction["PRODUCT_STOCK_UPDATED"] = "PRODUCT_STOCK_UPDATED";
    AuditAction["ORDER_CONFIRMED"] = "ORDER_CONFIRMED";
    AuditAction["ORDER_REJECTED"] = "ORDER_REJECTED";
    AuditAction["ORDER_UPDATED"] = "ORDER_UPDATED";
    AuditAction["ORDER_DELETED"] = "ORDER_DELETED";
    AuditAction["ORDER_STATUS_CHANGED"] = "ORDER_STATUS_CHANGED";
    AuditAction["ADMIN_LOGIN"] = "ADMIN_LOGIN";
    AuditAction["ADMIN_LOGOUT"] = "ADMIN_LOGOUT";
    AuditAction["ADMINJS_ACCESS"] = "ADMINJS_ACCESS";
    AuditAction["SYSTEM_BACKUP"] = "SYSTEM_BACKUP";
    AuditAction["SYSTEM_RESTORE"] = "SYSTEM_RESTORE";
    AuditAction["SYSTEM_MAINTENANCE"] = "SYSTEM_MAINTENANCE";
    AuditAction["BULK_IMPORT"] = "BULK_IMPORT";
    AuditAction["BULK_EXPORT"] = "BULK_EXPORT";
    AuditAction["BULK_UPDATE"] = "BULK_UPDATE";
    AuditAction["BULK_DELETE"] = "BULK_DELETE";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
class AuditLogService {
    static async log(adminId, data, req) {
        try {
            const details = typeof data.details === 'object'
                ? JSON.stringify(data.details)
                : data.details;
            const auditEntry = await prisma_1.prisma.adminLog.create({
                data: {
                    adminId,
                    action: data.action,
                    details: details || null,
                    orderId: data.orderId || null,
                    ...(data.metadata && {
                        details: JSON.stringify({
                            ...(typeof data.details === 'object' ? data.details : {}),
                            metadata: data.metadata,
                            resourceId: data.resourceId,
                            resourceType: data.resourceType,
                            storeId: data.storeId,
                            userAgent: req?.headers['user-agent'],
                            ip: req?.ip,
                            timestamp: new Date().toISOString(),
                        })
                    })
                }
            });
            logger_1.logger.info('Audit log created', {
                id: auditEntry.id,
                adminId,
                action: data.action,
                resourceId: data.resourceId,
                resourceType: data.resourceType,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to create audit log', {
                error: {
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    name: error instanceof Error ? error.name : undefined,
                },
                adminId,
                action: data.action,
            });
        }
    }
}
exports.AuditLogService = AuditLogService;
const auditLogger = (action, getDetails) => {
    return async (req, res, next) => {
        const originalJson = res.json;
        res.json = function (body) {
            if (req.user && res.statusCode >= 200 && res.statusCode < 300) {
                const logData = getDetails ? getDetails(req, res) : { action };
                setImmediate(() => {
                    if (req.user) {
                        AuditLogService.log(req.user.id, logData, req);
                    }
                });
            }
            return originalJson.call(this, body);
        };
        next();
    };
};
exports.auditLogger = auditLogger;
const auditUserAction = (action) => {
    return (0, exports.auditLogger)(action, (req) => ({
        action,
        resourceId: req.params.userId || req.body.userId,
        resourceType: 'User',
        details: {
            targetUserId: req.params.userId || req.body.userId,
            changes: req.body,
            route: req.route?.path,
        }
    }));
};
exports.auditUserAction = auditUserAction;
const auditStoreAction = (action) => {
    return (0, exports.auditLogger)(action, (req) => ({
        action,
        resourceId: req.params.storeId || req.body.storeId,
        resourceType: 'Store',
        storeId: req.params.storeId || req.body.storeId,
        details: {
            changes: req.body,
            route: req.route?.path,
        }
    }));
};
exports.auditStoreAction = auditStoreAction;
const auditProductAction = (action) => {
    return (0, exports.auditLogger)(action, (req) => ({
        action,
        resourceId: req.params.productId || req.body.productId,
        resourceType: 'Product',
        storeId: req.body.storeId,
        details: {
            changes: req.body,
            route: req.route?.path,
        }
    }));
};
exports.auditProductAction = auditProductAction;
const auditOrderAction = (action) => {
    return (0, exports.auditLogger)(action, (req) => ({
        action,
        resourceId: req.params.orderId || req.body.orderId,
        resourceType: 'Order',
        orderId: req.params.orderId || req.body.orderId,
        storeId: req.body.storeId,
        details: {
            changes: req.body,
            route: req.route?.path,
        }
    }));
};
exports.auditOrderAction = auditOrderAction;
const auditAuthAction = async (adminId, action, req, details) => {
    await AuditLogService.log(adminId, {
        action,
        details: {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            timestamp: new Date().toISOString(),
            ...details
        }
    }, req);
};
exports.auditAuthAction = auditAuthAction;
const auditBulkAction = async (adminId, action, req, details) => {
    await AuditLogService.log(adminId, {
        action,
        details: {
            affected: details.affected,
            resourceType: details.resourceType,
            operation: details.operation,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            timestamp: new Date().toISOString(),
            ...details.metadata
        }
    }, req);
};
exports.auditBulkAction = auditBulkAction;
exports.default = {
    AuditLogService,
    auditLogger: exports.auditLogger,
    auditUserAction: exports.auditUserAction,
    auditStoreAction: exports.auditStoreAction,
    auditProductAction: exports.auditProductAction,
    auditOrderAction: exports.auditOrderAction,
    auditAuthAction: exports.auditAuthAction,
    auditBulkAction: exports.auditBulkAction,
    AuditAction,
};
//# sourceMappingURL=auditLog.js.map
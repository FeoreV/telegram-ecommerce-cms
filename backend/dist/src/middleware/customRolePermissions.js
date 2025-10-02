"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichUserWithPermissions = exports.requireCustomPermission = void 0;
exports.checkUserPermission = checkUserPermission;
exports.getUserPermissions = getUserPermissions;
exports.getUserRole = getUserRole;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("./errorHandler");
const logger_1 = require("../utils/logger");
const requireCustomPermission = (permission) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                throw new errorHandler_1.AppError('Пользователь не аутентифицирован', 401);
            }
            if (user.role === 'OWNER') {
                return next();
            }
            const storeId = req.params.storeId || req.body.storeId || req.query.storeId;
            if (!storeId) {
                throw new errorHandler_1.AppError('Не указан ID магазина', 400);
            }
            const hasPermission = await checkUserPermission(user.id, storeId, permission);
            if (!hasPermission) {
                logger_1.logger.warn('Permission denied', {
                    userId: user.id,
                    storeId,
                    permission,
                    userRole: user.role
                });
                throw new errorHandler_1.AppError('Недостаточно прав для выполнения этого действия', 403);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireCustomPermission = requireCustomPermission;
async function checkUserPermission(userId, storeId, permission) {
    try {
        const store = await prisma_1.prisma.store.findFirst({
            where: {
                id: storeId,
                ownerId: userId
            }
        });
        if (store) {
            return true;
        }
        const adminRole = await prisma_1.prisma.storeAdmin.findFirst({
            where: {
                storeId,
                userId,
            }
        });
        if (adminRole) {
            const adminPermissions = [
                'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW',
                'ORDER_VIEW', 'ORDER_UPDATE', 'ORDER_CONFIRM', 'ORDER_REJECT',
                'INVENTORY_VIEW', 'INVENTORY_UPDATE',
                'ANALYTICS_VIEW', 'ANALYTICS_EXPORT',
                'USER_VIEW', 'USER_UPDATE', 'USER_CREATE',
                'NOTIFICATION_SEND'
            ];
            return adminPermissions.includes(permission);
        }
        const vendorRole = await prisma_1.prisma.storeVendor.findFirst({
            where: {
                storeId,
                userId,
            },
            include: {
                customRole: true
            }
        });
        if (vendorRole) {
            if (vendorRole.customRole) {
                const rolePermissions = JSON.parse(vendorRole.customRole.permissions);
                return rolePermissions.includes(permission);
            }
            if (vendorRole.permissions) {
                const legacyPermissions = JSON.parse(vendorRole.permissions);
                return legacyPermissions.includes(permission);
            }
        }
        return false;
    }
    catch (error) {
        logger_1.logger.error('Error checking user permission:', error);
        return false;
    }
}
async function getUserPermissions(userId, storeId) {
    try {
        const store = await prisma_1.prisma.store.findFirst({
            where: {
                id: storeId,
                ownerId: userId
            }
        });
        if (store) {
            return [
                'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW',
                'ORDER_VIEW', 'ORDER_UPDATE', 'ORDER_CONFIRM', 'ORDER_REJECT', 'ORDER_DELETE',
                'INVENTORY_VIEW', 'INVENTORY_UPDATE',
                'ANALYTICS_VIEW', 'ANALYTICS_EXPORT',
                'USER_VIEW', 'USER_UPDATE', 'USER_CREATE', 'USER_DELETE',
                'STORE_VIEW', 'STORE_UPDATE',
                'NOTIFICATION_SEND',
                'BOT_MANAGE', 'BOT_CONFIG'
            ];
        }
        const adminRole = await prisma_1.prisma.storeAdmin.findFirst({
            where: {
                storeId,
                userId,
            }
        });
        if (adminRole) {
            return [
                'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW',
                'ORDER_VIEW', 'ORDER_UPDATE', 'ORDER_CONFIRM', 'ORDER_REJECT',
                'INVENTORY_VIEW', 'INVENTORY_UPDATE',
                'ANALYTICS_VIEW', 'ANALYTICS_EXPORT',
                'USER_VIEW', 'USER_UPDATE', 'USER_CREATE',
                'NOTIFICATION_SEND',
                'BOT_MANAGE'
            ];
        }
        const vendorRole = await prisma_1.prisma.storeVendor.findFirst({
            where: {
                storeId,
                userId,
            },
            include: {
                customRole: true
            }
        });
        if (vendorRole) {
            if (vendorRole.customRole) {
                return JSON.parse(vendorRole.customRole.permissions);
            }
            if (vendorRole.permissions) {
                return JSON.parse(vendorRole.permissions);
            }
        }
        return [];
    }
    catch (error) {
        logger_1.logger.error('Error getting user permissions:', error);
        return [];
    }
}
async function getUserRole(userId, storeId) {
    try {
        const store = await prisma_1.prisma.store.findFirst({
            where: {
                id: storeId,
                ownerId: userId
            }
        });
        if (store) {
            return { type: 'OWNER' };
        }
        const adminRole = await prisma_1.prisma.storeAdmin.findFirst({
            where: {
                storeId,
                userId,
            }
        });
        if (adminRole) {
            return { type: 'ADMIN' };
        }
        const vendorRole = await prisma_1.prisma.storeVendor.findFirst({
            where: {
                storeId,
                userId,
            },
            include: {
                customRole: {
                    select: {
                        id: true,
                        name: true,
                        color: true,
                        icon: true
                    }
                }
            }
        });
        if (vendorRole) {
            if (vendorRole.customRole) {
                return {
                    type: 'CUSTOM',
                    customRole: vendorRole.customRole
                };
            }
            return { type: 'VENDOR' };
        }
        return { type: null };
    }
    catch (error) {
        logger_1.logger.error('Error getting user role:', error);
        return { type: null };
    }
}
const enrichUserWithPermissions = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return next();
        }
        const storeId = req.params.storeId || req.body.storeId || req.query.storeId;
        if (storeId) {
            const [permissions, role] = await Promise.all([
                getUserPermissions(user.id, storeId),
                getUserRole(user.id, storeId)
            ]);
            req.userPermissions = permissions;
            req.userRole = role;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Error enriching user with permissions:', error);
        next();
    }
};
exports.enrichUserWithPermissions = enrichUserWithPermissions;
//# sourceMappingURL=customRolePermissions.js.map
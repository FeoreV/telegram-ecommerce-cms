"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireStoreAccessAsync = exports.requireUserPermission = exports.requireStorePermission = exports.requirePermission = exports.PermissionChecker = exports.ROLE_PERMISSIONS = exports.Permission = void 0;
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
var Permission;
(function (Permission) {
    Permission["STORE_CREATE"] = "STORE_CREATE";
    Permission["STORE_UPDATE"] = "STORE_UPDATE";
    Permission["STORE_DELETE"] = "STORE_DELETE";
    Permission["STORE_VIEW"] = "STORE_VIEW";
    Permission["STORE_MANAGE"] = "STORE_MANAGE";
    Permission["PRODUCT_CREATE"] = "PRODUCT_CREATE";
    Permission["PRODUCT_UPDATE"] = "PRODUCT_UPDATE";
    Permission["PRODUCT_DELETE"] = "PRODUCT_DELETE";
    Permission["PRODUCT_VIEW"] = "PRODUCT_VIEW";
    Permission["ORDER_VIEW"] = "ORDER_VIEW";
    Permission["ORDER_UPDATE"] = "ORDER_UPDATE";
    Permission["ORDER_CONFIRM"] = "ORDER_CONFIRM";
    Permission["ORDER_REJECT"] = "ORDER_REJECT";
    Permission["ORDER_DELETE"] = "ORDER_DELETE";
    Permission["USER_CREATE"] = "USER_CREATE";
    Permission["USER_UPDATE"] = "USER_UPDATE";
    Permission["USER_DELETE"] = "USER_DELETE";
    Permission["USER_VIEW"] = "USER_VIEW";
    Permission["USER_PROMOTE"] = "USER_PROMOTE";
    Permission["ANALYTICS_VIEW"] = "ANALYTICS_VIEW";
    Permission["ANALYTICS_EXPORT"] = "ANALYTICS_EXPORT";
    Permission["SYSTEM_BACKUP"] = "SYSTEM_BACKUP";
    Permission["SYSTEM_RESTORE"] = "SYSTEM_RESTORE";
    Permission["SYSTEM_LOGS"] = "SYSTEM_LOGS";
    Permission["ADMINJS_ACCESS"] = "ADMINJS_ACCESS";
})(Permission || (exports.Permission = Permission = {}));
exports.ROLE_PERMISSIONS = {
    OWNER: [
        Permission.STORE_CREATE,
        Permission.STORE_UPDATE,
        Permission.STORE_DELETE,
        Permission.STORE_VIEW,
        Permission.STORE_MANAGE,
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_UPDATE,
        Permission.PRODUCT_DELETE,
        Permission.PRODUCT_VIEW,
        Permission.ORDER_VIEW,
        Permission.ORDER_UPDATE,
        Permission.ORDER_CONFIRM,
        Permission.ORDER_REJECT,
        Permission.ORDER_DELETE,
        Permission.USER_CREATE,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        Permission.USER_VIEW,
        Permission.USER_PROMOTE,
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
        Permission.SYSTEM_BACKUP,
        Permission.SYSTEM_RESTORE,
        Permission.SYSTEM_LOGS,
        Permission.ADMINJS_ACCESS,
    ],
    ADMIN: [
        Permission.STORE_VIEW,
        Permission.STORE_UPDATE,
        Permission.STORE_MANAGE,
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_UPDATE,
        Permission.PRODUCT_DELETE,
        Permission.PRODUCT_VIEW,
        Permission.ORDER_VIEW,
        Permission.ORDER_UPDATE,
        Permission.ORDER_CONFIRM,
        Permission.ORDER_REJECT,
        Permission.USER_VIEW,
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
        Permission.ADMINJS_ACCESS,
    ],
    VENDOR: [
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_UPDATE,
        Permission.PRODUCT_VIEW,
        Permission.ORDER_VIEW,
        Permission.ORDER_UPDATE,
        Permission.ANALYTICS_VIEW,
    ],
    CUSTOMER: [
        Permission.ORDER_VIEW,
    ],
};
class PermissionChecker {
    constructor(user, context = {}) {
        this.user = user;
        this.context = context;
    }
    async hasPermission(permission) {
        if (!this.user)
            return false;
        const userRole = this.user.role;
        const rolePermissions = exports.ROLE_PERMISSIONS[userRole] || [];
        if (!rolePermissions.includes(permission)) {
            return false;
        }
        return this.checkContextualPermission(permission);
    }
    async checkContextualPermission(permission) {
        if (!this.user)
            return false;
        const userRole = this.user.role;
        if (userRole === 'OWNER') {
            return true;
        }
        if (this.context.storeId) {
            return this.checkStorePermission(permission);
        }
        if (this.context.userId) {
            return this.checkUserPermission(permission);
        }
        const rolePermissions = exports.ROLE_PERMISSIONS[userRole] || [];
        return rolePermissions.includes(permission);
    }
    async checkStorePermission(_permission) {
        if (!this.user)
            return false;
        const userRole = this.user.role;
        const storeId = this.context.storeId;
        if (!storeId)
            return true;
        if (userRole === 'OWNER')
            return true;
        const ownedStore = await prisma_1.prisma.store.findFirst({
            where: {
                id: storeId,
                ownerId: this.user.id
            }
        });
        if (ownedStore)
            return true;
        const adminRelation = await prisma_1.prisma.storeAdmin.findFirst({
            where: {
                storeId: storeId,
                userId: this.user.id
            }
        });
        return !!adminRelation;
    }
    checkUserPermission(_permission) {
        if (!this.user)
            return false;
        const userRole = this.user.role;
        if (this.context.userId === this.user.id) {
            return true;
        }
        return ['OWNER', 'ADMIN'].includes(userRole);
    }
}
exports.PermissionChecker = PermissionChecker;
const requirePermission = (permission, getContext) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const context = getContext ? getContext(req) : {};
        const checker = new PermissionChecker(req.user, context);
        const hasPermission = await checker.hasPermission(permission);
        if (!hasPermission) {
            logger_1.logger.warn('Permission denied', {
                userId: req.user.id,
                role: req.user.role,
                permission,
                context,
            });
            return res.status(403).json({
                error: 'Permission denied',
                required: permission,
                userRole: req.user.role
            });
        }
        next();
    };
};
exports.requirePermission = requirePermission;
const requireStorePermission = (permission) => {
    return (0, exports.requirePermission)(permission, (req) => {
        const storeId = req.params.storeId || req.body.storeId;
        return { storeId };
    });
};
exports.requireStorePermission = requireStorePermission;
const requireUserPermission = (permission) => {
    return (0, exports.requirePermission)(permission, (req) => ({
        userId: req.params.userId || req.body.userId
    }));
};
exports.requireUserPermission = requireUserPermission;
const requireStoreAccessAsync = (permission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const storeId = req.params.storeId || req.body.storeId;
            const userId = req.user.id;
            if (!storeId) {
                return res.status(400).json({ error: 'Store ID required' });
            }
            const checker = new PermissionChecker(req.user, { storeId });
            if (!checker.hasPermission(permission)) {
                return res.status(403).json({ error: 'Permission denied' });
            }
            if (req.user.role === 'OWNER') {
                return next();
            }
            const hasAccess = await checkStoreAccess(userId, storeId, req.user.role);
            if (!hasAccess) {
                logger_1.logger.warn('Store access denied', {
                    userId,
                    storeId,
                    role: req.user.role,
                    permission,
                });
                return res.status(403).json({ error: 'No access to this store' });
            }
            next();
        }
        catch (error) {
            logger_1.logger.error('Store permission middleware error:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    };
};
exports.requireStoreAccessAsync = requireStoreAccessAsync;
async function checkStoreAccess(userId, storeId, _role) {
    const store = await prisma_1.prisma.store.findFirst({
        where: {
            id: storeId,
            OR: [
                { ownerId: userId },
                {
                    admins: {
                        some: {
                            userId,
                        }
                    }
                }
            ]
        }
    });
    return !!store;
}
exports.default = {
    Permission,
    PermissionChecker,
    requirePermission: exports.requirePermission,
    requireStorePermission: exports.requireStorePermission,
    requireUserPermission: exports.requireUserPermission,
    requireStoreAccessAsync: exports.requireStoreAccessAsync,
};
//# sourceMappingURL=permissions.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionChecker = exports.RoleManager = exports.RolePermissionManager = exports.PERMISSION_GROUPS = exports.ROLE_PERMISSIONS = exports.Permission = void 0;
const SecureAuthSystem_1 = require("./SecureAuthSystem");
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
    Permission["PRODUCT_MANAGE"] = "PRODUCT_MANAGE";
    Permission["ORDER_VIEW"] = "ORDER_VIEW";
    Permission["ORDER_UPDATE"] = "ORDER_UPDATE";
    Permission["ORDER_CONFIRM"] = "ORDER_CONFIRM";
    Permission["ORDER_REJECT"] = "ORDER_REJECT";
    Permission["ORDER_DELETE"] = "ORDER_DELETE";
    Permission["ORDER_MANAGE"] = "ORDER_MANAGE";
    Permission["USER_CREATE"] = "USER_CREATE";
    Permission["USER_UPDATE"] = "USER_UPDATE";
    Permission["USER_DELETE"] = "USER_DELETE";
    Permission["USER_VIEW"] = "USER_VIEW";
    Permission["USER_PROMOTE"] = "USER_PROMOTE";
    Permission["USER_MANAGE"] = "USER_MANAGE";
    Permission["ANALYTICS_VIEW"] = "ANALYTICS_VIEW";
    Permission["ANALYTICS_EXPORT"] = "ANALYTICS_EXPORT";
    Permission["ANALYTICS_MANAGE"] = "ANALYTICS_MANAGE";
    Permission["SYSTEM_BACKUP"] = "SYSTEM_BACKUP";
    Permission["SYSTEM_RESTORE"] = "SYSTEM_RESTORE";
    Permission["SYSTEM_LOGS"] = "SYSTEM_LOGS";
    Permission["SYSTEM_CONFIG"] = "SYSTEM_CONFIG";
    Permission["SYSTEM_MANAGE"] = "SYSTEM_MANAGE";
    Permission["ADMINJS_ACCESS"] = "ADMINJS_ACCESS";
    Permission["ADMIN_PANEL_ACCESS"] = "ADMIN_PANEL_ACCESS";
    Permission["BOT_MANAGE"] = "BOT_MANAGE";
    Permission["BOT_CONFIG"] = "BOT_CONFIG";
    Permission["NOTIFICATION_SEND"] = "NOTIFICATION_SEND";
    Permission["NOTIFICATION_MANAGE"] = "NOTIFICATION_MANAGE";
    Permission["INVENTORY_VIEW"] = "INVENTORY_VIEW";
    Permission["INVENTORY_UPDATE"] = "INVENTORY_UPDATE";
    Permission["INVENTORY_MANAGE"] = "INVENTORY_MANAGE";
})(Permission || (exports.Permission = Permission = {}));
exports.ROLE_PERMISSIONS = {
    [SecureAuthSystem_1.UserRole.OWNER]: [
        ...Object.values(Permission)
    ],
    [SecureAuthSystem_1.UserRole.ADMIN]: [
        Permission.STORE_VIEW,
        Permission.STORE_UPDATE,
        Permission.STORE_MANAGE,
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_UPDATE,
        Permission.PRODUCT_DELETE,
        Permission.PRODUCT_VIEW,
        Permission.PRODUCT_MANAGE,
        Permission.ORDER_VIEW,
        Permission.ORDER_UPDATE,
        Permission.ORDER_CONFIRM,
        Permission.ORDER_REJECT,
        Permission.ORDER_MANAGE,
        Permission.USER_VIEW,
        Permission.USER_UPDATE,
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
        Permission.INVENTORY_VIEW,
        Permission.INVENTORY_UPDATE,
        Permission.INVENTORY_MANAGE,
        Permission.NOTIFICATION_SEND,
        Permission.ADMINJS_ACCESS,
        Permission.ADMIN_PANEL_ACCESS
    ],
    [SecureAuthSystem_1.UserRole.VENDOR]: [
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_UPDATE,
        Permission.PRODUCT_VIEW,
        Permission.ORDER_VIEW,
        Permission.ORDER_UPDATE,
        Permission.ANALYTICS_VIEW,
        Permission.INVENTORY_VIEW,
        Permission.INVENTORY_UPDATE,
        Permission.STORE_VIEW
    ],
    [SecureAuthSystem_1.UserRole.CUSTOMER]: [
        Permission.ORDER_VIEW,
    ]
};
exports.PERMISSION_GROUPS = {
    STORE_MANAGEMENT: [
        Permission.STORE_CREATE,
        Permission.STORE_UPDATE,
        Permission.STORE_DELETE,
        Permission.STORE_VIEW,
        Permission.STORE_MANAGE
    ],
    PRODUCT_MANAGEMENT: [
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_UPDATE,
        Permission.PRODUCT_DELETE,
        Permission.PRODUCT_VIEW,
        Permission.PRODUCT_MANAGE
    ],
    ORDER_MANAGEMENT: [
        Permission.ORDER_VIEW,
        Permission.ORDER_UPDATE,
        Permission.ORDER_CONFIRM,
        Permission.ORDER_REJECT,
        Permission.ORDER_DELETE,
        Permission.ORDER_MANAGE
    ],
    USER_MANAGEMENT: [
        Permission.USER_CREATE,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        Permission.USER_VIEW,
        Permission.USER_PROMOTE,
        Permission.USER_MANAGE
    ],
    SYSTEM_ADMIN: [
        Permission.SYSTEM_BACKUP,
        Permission.SYSTEM_RESTORE,
        Permission.SYSTEM_LOGS,
        Permission.SYSTEM_CONFIG,
        Permission.SYSTEM_MANAGE
    ]
};
class RolePermissionManager {
    constructor(user, context = {}) {
        this.user = {
            id: user.id,
            role: user.role,
            telegramId: user.telegramId || undefined,
            email: user.email || undefined
        };
        this.context = context;
    }
    hasPermission(permission) {
        const rolePermissions = exports.ROLE_PERMISSIONS[this.user.role] || [];
        return rolePermissions.includes(permission);
    }
    hasAnyPermission(permissions) {
        return permissions.some(permission => this.hasPermission(permission));
    }
    hasAllPermissions(permissions) {
        return permissions.every(permission => this.hasPermission(permission));
    }
    async hasStoreAccess(storeId) {
        if (this.user.role === SecureAuthSystem_1.UserRole.OWNER) {
            return true;
        }
        try {
            const userWithStores = await prisma_1.prisma.user.findUnique({
                where: { id: this.user.id },
                select: {
                    ownedStores: {
                        where: { id: storeId },
                        select: { id: true }
                    },
                    managedStores: {
                        where: { storeId },
                        select: { storeId: true }
                    }
                }
            });
            return !!(userWithStores?.ownedStores.length ||
                userWithStores?.managedStores.length);
        }
        catch (error) {
            logger_1.logger.error('Store access check failed', {
                error,
                userId: this.user.id,
                storeId
            });
            return false;
        }
    }
    async canAccessResource(permission, resourceType, resourceId) {
        if (!this.hasPermission(permission)) {
            return false;
        }
        if (this.user.role === SecureAuthSystem_1.UserRole.OWNER) {
            return true;
        }
        switch (resourceType) {
            case 'store':
                if (resourceId) {
                    return await this.hasStoreAccess(resourceId);
                }
                return true;
            case 'user':
                if (resourceId === this.user.id) {
                    return true;
                }
                if (this.user.role === SecureAuthSystem_1.UserRole.ADMIN && resourceId) {
                    return await this.canManageUser(resourceId);
                }
                return this.user.role === SecureAuthSystem_1.UserRole.OWNER;
            case 'order':
                if (resourceId && this.user.role === SecureAuthSystem_1.UserRole.CUSTOMER) {
                    return await this.isOrderOwner(resourceId);
                }
                return true;
            case 'product':
                return true;
            default:
                return false;
        }
    }
    async canManageUser(targetUserId) {
        if (this.user.role === SecureAuthSystem_1.UserRole.OWNER) {
            return true;
        }
        if (this.user.role !== SecureAuthSystem_1.UserRole.ADMIN) {
            return false;
        }
        try {
            const adminStores = await prisma_1.prisma.storeAdmin.findMany({
                where: { userId: this.user.id },
                select: { storeId: true }
            });
            const targetUserStores = await prisma_1.prisma.storeAdmin.findMany({
                where: { userId: targetUserId },
                select: { storeId: true }
            });
            const adminStoreIds = adminStores.map(s => s.storeId);
            const targetStoreIds = targetUserStores.map(s => s.storeId);
            return adminStoreIds.some(id => targetStoreIds.includes(id));
        }
        catch (error) {
            logger_1.logger.error('User management check failed', { error });
            return false;
        }
    }
    async isOrderOwner(orderId) {
        try {
            const order = await prisma_1.prisma.order.findUnique({
                where: { id: orderId },
                select: { customerId: true }
            });
            return order?.customerId === this.user.id;
        }
        catch (error) {
            logger_1.logger.error('Order ownership check failed', { error });
            return false;
        }
    }
    getAllPermissions() {
        return exports.ROLE_PERMISSIONS[this.user.role] || [];
    }
    getGroupedPermissions() {
        const userPermissions = this.getAllPermissions();
        const grouped = {};
        for (const [groupName, groupPermissions] of Object.entries(exports.PERMISSION_GROUPS)) {
            grouped[groupName] = groupPermissions.filter(permission => userPermissions.includes(permission));
        }
        return grouped;
    }
    isElevatedUser() {
        return [SecureAuthSystem_1.UserRole.OWNER, SecureAuthSystem_1.UserRole.ADMIN].includes(this.user.role);
    }
    isOwner() {
        return this.user.role === SecureAuthSystem_1.UserRole.OWNER;
    }
    canCreate(resourceType) {
        switch (resourceType) {
            case 'store':
                return this.hasPermission(Permission.STORE_CREATE);
            case 'user':
                return this.hasPermission(Permission.USER_CREATE);
            case 'product':
                return this.hasPermission(Permission.PRODUCT_CREATE);
            default:
                return false;
        }
    }
    static createPermissionMiddleware(permission) {
        return async (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }
            const permissionChecker = new RolePermissionManager(req.user);
            if (!permissionChecker.hasPermission(permission)) {
                logger_1.logger.warn('Permission denied', {
                    userId: req.user.id,
                    role: req.user.role,
                    requiredPermission: permission,
                    endpoint: req.originalUrl
                });
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    required: permission,
                    userRole: req.user.role
                });
            }
            next();
        };
    }
    static createStoreAccessMiddleware(storeIdParam = 'storeId') {
        return async (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }
            const storeId = req.params[storeIdParam] || req.body.storeId;
            if (!storeId) {
                return res.status(400).json({
                    error: 'Store ID required',
                    code: 'STORE_ID_REQUIRED'
                });
            }
            const permissionChecker = new RolePermissionManager(req.user);
            if (!(await permissionChecker.hasStoreAccess(storeId))) {
                logger_1.logger.warn('Store access denied', {
                    userId: req.user.id,
                    role: req.user.role,
                    storeId,
                    endpoint: req.originalUrl
                });
                return res.status(403).json({
                    error: 'No access to this store',
                    code: 'NO_STORE_ACCESS',
                    storeId
                });
            }
            next();
        };
    }
}
exports.RolePermissionManager = RolePermissionManager;
class RoleManager {
    static async promoteUser(adminUserId, targetUserId, newRole, storeAssignments) {
        const admin = await prisma_1.prisma.user.findUnique({
            where: { id: adminUserId },
            select: { role: true }
        });
        if (!admin || admin.role !== SecureAuthSystem_1.UserRole.OWNER) {
            throw new Error('Only owners can promote users');
        }
        const targetUser = await prisma_1.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, role: true }
        });
        if (!targetUser) {
            throw new Error('Target user not found');
        }
        if (targetUser.role === SecureAuthSystem_1.UserRole.OWNER && newRole !== SecureAuthSystem_1.UserRole.OWNER) {
            throw new Error('Cannot demote owner users');
        }
        try {
            await prisma_1.prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { id: targetUserId },
                    data: { role: newRole }
                });
                await tx.storeAdmin.deleteMany({
                    where: { userId: targetUserId }
                });
                if (storeAssignments && newRole === SecureAuthSystem_1.UserRole.ADMIN) {
                    for (const assignment of storeAssignments) {
                        await tx.storeAdmin.create({
                            data: {
                                userId: targetUserId,
                                storeId: assignment.storeId
                            }
                        });
                    }
                }
            });
            logger_1.logger.info('User role updated', {
                adminId: adminUserId,
                targetUserId,
                oldRole: targetUser.role,
                newRole,
                storeAssignments: storeAssignments?.length || 0
            });
        }
        catch (error) {
            logger_1.logger.error('User promotion failed', { error });
            throw new Error('Role update failed');
        }
    }
    static getRoleLevel(role) {
        switch (role) {
            case SecureAuthSystem_1.UserRole.OWNER: return 4;
            case SecureAuthSystem_1.UserRole.ADMIN: return 3;
            case SecureAuthSystem_1.UserRole.VENDOR: return 2;
            case SecureAuthSystem_1.UserRole.CUSTOMER: return 1;
            default: return 0;
        }
    }
    static canManageRole(managerRole, targetRole) {
        return this.getRoleLevel(managerRole) > this.getRoleLevel(targetRole);
    }
}
exports.RoleManager = RoleManager;
exports.PermissionChecker = RolePermissionManager;
//# sourceMappingURL=RolePermissionManager.js.map
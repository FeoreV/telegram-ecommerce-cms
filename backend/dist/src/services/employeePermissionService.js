"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeePermissionService = void 0;
const prisma_1 = require("../lib/prisma");
const RolePermissionManager_1 = require("../auth/RolePermissionManager");
const logger_1 = require("../utils/logger");
class EmployeePermissionService {
    static async getUserStoreRole(userId, storeId) {
        try {
            const store = await prisma_1.prisma.store.findFirst({
                where: {
                    id: storeId,
                    ownerId: userId
                }
            });
            if (store) {
                return {
                    userId,
                    storeId,
                    role: 'OWNER',
                    permissions: Object.values(RolePermissionManager_1.Permission),
                    isActive: true
                };
            }
            const adminAssignment = await prisma_1.prisma.storeAdmin.findFirst({
                where: {
                    userId,
                    storeId
                },
                include: {
                    user: {
                        select: {
                            isActive: true
                        }
                    }
                }
            });
            if (adminAssignment) {
                return {
                    userId,
                    storeId,
                    role: 'ADMIN',
                    permissions: [
                        RolePermissionManager_1.Permission.STORE_VIEW,
                        RolePermissionManager_1.Permission.STORE_UPDATE,
                        RolePermissionManager_1.Permission.STORE_MANAGE,
                        RolePermissionManager_1.Permission.PRODUCT_CREATE,
                        RolePermissionManager_1.Permission.PRODUCT_UPDATE,
                        RolePermissionManager_1.Permission.PRODUCT_DELETE,
                        RolePermissionManager_1.Permission.PRODUCT_VIEW,
                        RolePermissionManager_1.Permission.PRODUCT_MANAGE,
                        RolePermissionManager_1.Permission.ORDER_VIEW,
                        RolePermissionManager_1.Permission.ORDER_UPDATE,
                        RolePermissionManager_1.Permission.ORDER_CONFIRM,
                        RolePermissionManager_1.Permission.ORDER_REJECT,
                        RolePermissionManager_1.Permission.ORDER_MANAGE,
                        RolePermissionManager_1.Permission.USER_VIEW,
                        RolePermissionManager_1.Permission.USER_UPDATE,
                        RolePermissionManager_1.Permission.ANALYTICS_VIEW,
                        RolePermissionManager_1.Permission.ANALYTICS_EXPORT,
                        RolePermissionManager_1.Permission.INVENTORY_VIEW,
                        RolePermissionManager_1.Permission.INVENTORY_UPDATE,
                        RolePermissionManager_1.Permission.NOTIFICATION_SEND,
                        RolePermissionManager_1.Permission.ADMINJS_ACCESS,
                        RolePermissionManager_1.Permission.ADMIN_PANEL_ACCESS
                    ],
                    isActive: adminAssignment.user.isActive
                };
            }
            const vendorAssignment = await prisma_1.prisma.storeVendor.findFirst({
                where: {
                    userId,
                    storeId
                },
                include: {
                    user: {
                        select: {
                            isActive: true
                        }
                    }
                }
            });
            if (vendorAssignment) {
                const customPermissions = vendorAssignment.permissions
                    ? JSON.parse(vendorAssignment.permissions)
                    : [];
                const baseVendorPermissions = [
                    RolePermissionManager_1.Permission.PRODUCT_CREATE,
                    RolePermissionManager_1.Permission.PRODUCT_UPDATE,
                    RolePermissionManager_1.Permission.PRODUCT_VIEW,
                    RolePermissionManager_1.Permission.ORDER_VIEW,
                    RolePermissionManager_1.Permission.ORDER_UPDATE,
                    RolePermissionManager_1.Permission.ANALYTICS_VIEW,
                    RolePermissionManager_1.Permission.INVENTORY_VIEW,
                    RolePermissionManager_1.Permission.INVENTORY_UPDATE,
                    RolePermissionManager_1.Permission.STORE_VIEW
                ];
                const allPermissions = [...new Set([
                        ...baseVendorPermissions,
                        ...customPermissions.filter(p => Object.values(RolePermissionManager_1.Permission).includes(p))
                    ])];
                return {
                    userId,
                    storeId,
                    role: 'VENDOR',
                    permissions: allPermissions,
                    isActive: vendorAssignment.isActive && vendorAssignment.user.isActive
                };
            }
            return {
                userId,
                storeId,
                role: 'CUSTOMER',
                permissions: [RolePermissionManager_1.Permission.ORDER_VIEW],
                isActive: true
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting user store role:', { userId, storeId, error });
            return null;
        }
    }
    static async checkPermission(check) {
        try {
            const storeRole = await this.getUserStoreRole(check.userId, check.storeId);
            if (!storeRole || !storeRole.isActive) {
                return false;
            }
            return storeRole.permissions.includes(check.permission);
        }
        catch (error) {
            logger_1.logger.error('Error checking permission:', { check, error });
            return false;
        }
    }
    static async getUserStores(userId) {
        try {
            const stores = [];
            const ownedStores = await prisma_1.prisma.store.findMany({
                where: {
                    ownerId: userId
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    status: true,
                    createdAt: true
                }
            });
            for (const store of ownedStores) {
                stores.push({
                    store,
                    role: 'OWNER',
                    permissions: Object.values(RolePermissionManager_1.Permission),
                    isActive: true
                });
            }
            const adminStores = await prisma_1.prisma.storeAdmin.findMany({
                where: {
                    userId
                },
                include: {
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            status: true,
                            createdAt: true
                        }
                    },
                    user: {
                        select: {
                            isActive: true
                        }
                    }
                }
            });
            for (const assignment of adminStores) {
                stores.push({
                    store: assignment.store,
                    role: 'ADMIN',
                    permissions: [
                        RolePermissionManager_1.Permission.STORE_VIEW,
                        RolePermissionManager_1.Permission.STORE_UPDATE,
                        RolePermissionManager_1.Permission.PRODUCT_CREATE,
                        RolePermissionManager_1.Permission.PRODUCT_UPDATE,
                        RolePermissionManager_1.Permission.PRODUCT_DELETE,
                        RolePermissionManager_1.Permission.PRODUCT_VIEW,
                        RolePermissionManager_1.Permission.ORDER_VIEW,
                        RolePermissionManager_1.Permission.ORDER_UPDATE,
                        RolePermissionManager_1.Permission.ORDER_CONFIRM,
                        RolePermissionManager_1.Permission.ORDER_REJECT,
                        RolePermissionManager_1.Permission.USER_VIEW,
                        RolePermissionManager_1.Permission.USER_UPDATE,
                        RolePermissionManager_1.Permission.ANALYTICS_VIEW,
                        RolePermissionManager_1.Permission.INVENTORY_VIEW,
                        RolePermissionManager_1.Permission.INVENTORY_UPDATE,
                        RolePermissionManager_1.Permission.ADMINJS_ACCESS
                    ],
                    isActive: assignment.user.isActive
                });
            }
            const vendorStores = await prisma_1.prisma.storeVendor.findMany({
                where: {
                    userId
                },
                include: {
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            status: true,
                            createdAt: true
                        }
                    },
                    user: {
                        select: {
                            isActive: true
                        }
                    }
                }
            });
            for (const assignment of vendorStores) {
                const customPermissions = assignment.permissions
                    ? JSON.parse(assignment.permissions)
                    : [];
                const permissions = [
                    RolePermissionManager_1.Permission.PRODUCT_CREATE,
                    RolePermissionManager_1.Permission.PRODUCT_UPDATE,
                    RolePermissionManager_1.Permission.PRODUCT_VIEW,
                    RolePermissionManager_1.Permission.ORDER_VIEW,
                    RolePermissionManager_1.Permission.ORDER_UPDATE,
                    RolePermissionManager_1.Permission.ANALYTICS_VIEW,
                    RolePermissionManager_1.Permission.INVENTORY_VIEW,
                    RolePermissionManager_1.Permission.INVENTORY_UPDATE,
                    RolePermissionManager_1.Permission.STORE_VIEW,
                    ...customPermissions.filter(p => Object.values(RolePermissionManager_1.Permission).includes(p))
                ];
                stores.push({
                    store: assignment.store,
                    role: 'VENDOR',
                    permissions: [...new Set(permissions)],
                    isActive: assignment.isActive && assignment.user.isActive
                });
            }
            return stores;
        }
        catch (error) {
            logger_1.logger.error('Error getting user stores:', { userId, error });
            return [];
        }
    }
    static async updateVendorPermissions(userId, storeId, permissions) {
        try {
            await prisma_1.prisma.storeVendor.updateMany({
                where: {
                    userId,
                    storeId
                },
                data: {
                    permissions: JSON.stringify(permissions)
                }
            });
            logger_1.logger.info('Vendor permissions updated', {
                userId,
                storeId,
                permissions
            });
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error updating vendor permissions:', { userId, storeId, permissions, error });
            return false;
        }
    }
    static async canManageUser(managerId, targetUserId, storeId) {
        try {
            const managerRole = await this.getUserStoreRole(managerId, storeId);
            const targetRole = await this.getUserStoreRole(targetUserId, storeId);
            if (!managerRole || !targetRole) {
                return false;
            }
            const roleHierarchy = {
                'OWNER': 4,
                'ADMIN': 3,
                'VENDOR': 2,
                'CUSTOMER': 1
            };
            return roleHierarchy[managerRole.role] > roleHierarchy[targetRole.role];
        }
        catch (error) {
            logger_1.logger.error('Error checking user management permission:', {
                managerId,
                targetUserId,
                storeId,
                error
            });
            return false;
        }
    }
    static async getStorePermissionStats(storeId) {
        try {
            const [adminCount, vendorCount, recentActivityCount] = await Promise.all([
                prisma_1.prisma.storeAdmin.count({
                    where: {
                        storeId,
                        user: { isActive: true }
                    }
                }),
                prisma_1.prisma.storeVendor.count({
                    where: {
                        storeId,
                        isActive: true,
                        user: { isActive: true }
                    }
                }),
                prisma_1.prisma.employeeActivity.count({
                    where: {
                        storeId,
                        createdAt: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                        }
                    }
                })
            ]);
            const totalEmployees = adminCount + vendorCount;
            return {
                totalEmployees,
                activeEmployees: totalEmployees,
                adminCount,
                vendorCount,
                recentActivity: recentActivityCount
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting store permission stats:', { storeId, error });
            return {
                totalEmployees: 0,
                activeEmployees: 0,
                adminCount: 0,
                vendorCount: 0,
                recentActivity: 0
            };
        }
    }
}
exports.EmployeePermissionService = EmployeePermissionService;
//# sourceMappingURL=employeePermissionService.js.map
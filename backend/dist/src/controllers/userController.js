"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkUserActions = exports.unbanUser = exports.banUser = exports.getUserDetailed = exports.getUserActivity = exports.deleteUser = exports.getRoleStatistics = exports.removeUserFromStore = exports.assignUserToStore = exports.toggleUserStatus = exports.updateUserRole = exports.getUser = exports.getUsers = void 0;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const notificationService_1 = require("../services/notificationService");
const jwt_1 = require("../utils/jwt");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
exports.getUsers = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20, role, search, storeId } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const whereClause = {};
    if (role && role !== 'all') {
        whereClause.role = role;
    }
    if (search) {
        whereClause.OR = [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { username: { contains: search } },
            { telegramId: { contains: search } }
        ];
    }
    if (req.user.role !== 'OWNER' && storeId) {
        const hasAccess = await prisma_1.prisma.store.findFirst({
            where: {
                id: storeId,
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            }
        });
        if (!hasAccess) {
            throw new errorHandler_1.AppError('No access to this store', 403);
        }
    }
    try {
        const total = await prisma_1.prisma.user.count({ where: whereClause });
        const users = await prisma_1.prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                telegramId: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        orders: true,
                        ownedStores: true,
                        managedStores: true
                    }
                },
                ownedStores: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                },
                managedStores: {
                    select: {
                        store: {
                            select: {
                                id: true,
                                name: true,
                                slug: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: Number(limit),
        });
        const formattedUsers = users.map(user => ({
            ...user,
            stores: {
                owned: user.ownedStores,
                managed: user.managedStores.map(a => a.store)
            },
            _count: {
                orders: user._count.orders,
                stores: user._count.ownedStores + user._count.managedStores
            }
        }));
        res.json({
            users: formattedUsers,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching users:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to fetch users', 500);
    }
});
exports.getUser = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (req.user.id !== id && !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id },
        include: {
            ownedStores: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    currency: true,
                    createdAt: true
                }
            },
            managedStores: {
                include: {
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            currency: true
                        }
                    }
                }
            },
            orders: {
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    totalAmount: true,
                    currency: true,
                    createdAt: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 10
            }
        }
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    const formattedUser = {
        ...user,
        stores: {
            owned: user.ownedStores,
            managed: user.managedStores.map(a => a.store)
        }
    };
    res.json({ user: formattedUser });
});
exports.updateUserRole = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { role, storeAssignments } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can change user roles', 403);
    }
    if (!Object.values(jwt_1.UserRole).includes(role)) {
        throw new errorHandler_1.AppError('Invalid role', 400);
    }
    if (req.user.id === id) {
        throw new errorHandler_1.AppError('Cannot change your own role', 400);
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id }
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    try {
        const updatedUser = await prisma_1.prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id },
                data: { role },
                include: {
                    ownedStores: true,
                    managedStores: { include: { store: true } },
                    vendorStores: { include: { store: true } }
                }
            });
            if (role !== 'OWNER') {
                await tx.storeAdmin.deleteMany({
                    where: { userId: id }
                });
                await tx.storeVendor.deleteMany({
                    where: { userId: id }
                });
            }
            if (storeAssignments && Array.isArray(storeAssignments)) {
                for (const assignment of storeAssignments) {
                    const { storeId, role: assignmentRole } = assignment;
                    const store = await tx.store.findUnique({
                        where: { id: storeId }
                    });
                    if (!store) {
                        throw new errorHandler_1.AppError(`Store ${storeId} not found`, 400);
                    }
                    if (assignmentRole === 'ADMIN') {
                        await tx.storeAdmin.create({
                            data: {
                                userId: id,
                                storeId,
                                assignedBy: req.user.id
                            }
                        });
                    }
                    else if (assignmentRole === 'VENDOR') {
                        await tx.storeVendor.create({
                            data: {
                                userId: id,
                                storeId,
                                assignedBy: req.user.id,
                                isActive: true,
                                permissions: JSON.stringify(['read_products', 'update_inventory'])
                            }
                        });
                    }
                }
            }
            return updated;
        });
        logger_1.logger.info(`User role updated: ${(0, sanitizer_1.sanitizeForLog)(id)} changed from ${(0, sanitizer_1.sanitizeForLog)(user.role)} to ${(0, sanitizer_1.sanitizeForLog)(role)} by ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
        notificationService_1.NotificationService.send({
            title: 'Роль изменена',
            message: `Ваша роль в системе изменена на ${role}`,
            type: notificationService_1.NotificationType.USER_REGISTERED,
            priority: notificationService_1.NotificationPriority.HIGH,
            recipients: [id],
            channels: [notificationService_1.NotificationChannel.TELEGRAM, notificationService_1.NotificationChannel.SOCKET],
            data: {
                newRole: role,
                changedBy: req.user.id,
                storeAssignments
            }
        });
        res.json({
            user: updatedUser,
            message: 'User role updated successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating user role:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to update user role', 500);
    }
});
exports.toggleUserStatus = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    if (req.user.id === id) {
        throw new errorHandler_1.AppError('Cannot deactivate your own account', 400);
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id }
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    if (req.user.role === 'ADMIN' && user.role === 'OWNER') {
        throw new errorHandler_1.AppError('Admins cannot deactivate owners', 403);
    }
    const updatedUser = await prisma_1.prisma.user.update({
        where: { id },
        data: {
            isActive: !user.isActive
        }
    });
    logger_1.logger.info(`User status toggled: ${(0, sanitizer_1.sanitizeForLog)(id)} ${user.isActive ? 'deactivated' : 'activated'} by ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
    if (updatedUser.isActive) {
        notificationService_1.NotificationService.send({
            title: 'Аккаунт активирован',
            message: 'Ваш аккаунт был активирован администратором',
            type: notificationService_1.NotificationType.USER_REGISTERED,
            priority: notificationService_1.NotificationPriority.MEDIUM,
            recipients: [id],
            channels: [notificationService_1.NotificationChannel.TELEGRAM, notificationService_1.NotificationChannel.SOCKET],
            data: {
                activatedBy: req.user.id
            }
        });
    }
    res.json({
        user: updatedUser,
        message: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`
    });
});
exports.assignUserToStore = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId, storeId, role } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can assign users to stores', 403);
    }
    if (!['ADMIN', 'VENDOR'].includes(role)) {
        throw new errorHandler_1.AppError('Invalid assignment role. Must be ADMIN or VENDOR', 400);
    }
    const [user, store] = await Promise.all([
        prisma_1.prisma.user.findUnique({ where: { id: userId } }),
        prisma_1.prisma.store.findUnique({ where: { id: storeId } })
    ]);
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    if (!store) {
        throw new errorHandler_1.AppError('Store not found', 404);
    }
    try {
        let assignment;
        if (role === 'ADMIN') {
            const existing = await prisma_1.prisma.storeAdmin.findFirst({
                where: {
                    userId,
                    storeId
                }
            });
            if (existing) {
                throw new errorHandler_1.AppError('User is already an admin of this store', 400);
            }
            assignment = await prisma_1.prisma.storeAdmin.create({
                data: {
                    userId,
                    storeId
                },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            username: true
                        }
                    },
                    store: {
                        select: {
                            name: true,
                            slug: true
                        }
                    }
                }
            });
        }
        else {
            assignment = await prisma_1.prisma.storeVendor.create({
                data: {
                    userId,
                    storeId,
                    assignedBy: req.user.id,
                    isActive: true,
                    permissions: JSON.stringify(['read_products', 'update_inventory'])
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            username: true,
                            role: true
                        }
                    },
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true
                        }
                    }
                }
            });
        }
        logger_1.logger.info(`User ${(0, sanitizer_1.sanitizeForLog)(userId)} assigned as ${(0, sanitizer_1.sanitizeForLog)(role)} to store ${(0, sanitizer_1.sanitizeForLog)(storeId)} by ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
        notificationService_1.NotificationService.send({
            title: 'Новое назначение',
            message: `Вы назначены как ${role === 'ADMIN' ? 'администратор' : 'продавец'} магазина "${store.name}"`,
            type: notificationService_1.NotificationType.USER_REGISTERED,
            priority: notificationService_1.NotificationPriority.HIGH,
            recipients: [userId],
            channels: [notificationService_1.NotificationChannel.TELEGRAM, notificationService_1.NotificationChannel.SOCKET],
            data: {
                storeId,
                storeName: store.name,
                role,
                assignedBy: req.user.id
            }
        });
        res.json({
            assignment,
            message: 'User assigned to store successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error assigning user to store:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to assign user to store', 500);
    }
});
exports.removeUserFromStore = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId, storeId, role } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can remove users from stores', 403);
    }
    try {
        let removed = false;
        if (role === 'ADMIN') {
            const result = await prisma_1.prisma.storeAdmin.deleteMany({
                where: {
                    userId,
                    storeId
                }
            });
            removed = result.count > 0;
        }
        else if (role === 'VENDOR') {
            const result = await prisma_1.prisma.storeVendor.deleteMany({
                where: {
                    userId,
                    storeId
                }
            });
            removed = result.count > 0;
        }
        if (!removed) {
            throw new errorHandler_1.AppError('Assignment not found', 404);
        }
        logger_1.logger.info(`User ${(0, sanitizer_1.sanitizeForLog)(userId)} removed as ${(0, sanitizer_1.sanitizeForLog)(role)} from store ${(0, sanitizer_1.sanitizeForLog)(storeId)} by ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
        const store = await prisma_1.prisma.store.findUnique({
            where: { id: storeId },
            select: { name: true }
        });
        if (store) {
            const safeStoreName = (0, sanitizer_1.sanitizeHtml)(store.name);
            const safeRole = role === 'ADMIN' ? 'администратор' : 'продавец';
            notificationService_1.NotificationService.send({
                title: 'Доступ к магазину отозван',
                message: `Ваш доступ к магазину "${safeStoreName}" как ${safeRole} был отозван`,
                type: notificationService_1.NotificationType.USER_REGISTERED,
                priority: notificationService_1.NotificationPriority.MEDIUM,
                recipients: [userId],
                channels: [notificationService_1.NotificationChannel.TELEGRAM, notificationService_1.NotificationChannel.SOCKET],
                data: {
                    storeId,
                    storeName: safeStoreName,
                    role,
                    removedBy: req.user.id
                }
            });
        }
        res.json({ message: 'User removed from store successfully' });
    }
    catch (error) {
        logger_1.logger.error('Error removing user from store:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to remove user from store', 500);
    }
});
exports.getRoleStatistics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    try {
        const stats = await prisma_1.prisma.user.groupBy({
            by: ['role'],
            where: {
                isActive: true
            },
            _count: {
                id: true
            }
        });
        const totalUsers = await prisma_1.prisma.user.count({
            where: { isActive: true }
        });
        const inactiveUsers = await prisma_1.prisma.user.count({
            where: { isActive: false }
        });
        const recentRegistrations = await prisma_1.prisma.user.count({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
            }
        });
        const roleStats = stats.map(stat => ({
            role: stat.role,
            count: stat._count.id,
            percentage: (stat._count.id / totalUsers) * 100
        }));
        res.json({
            roleDistribution: roleStats,
            summary: {
                totalUsers,
                activeUsers: totalUsers,
                inactiveUsers,
                recentRegistrations
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching role statistics:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to fetch role statistics', 500);
    }
});
exports.deleteUser = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can delete users', 403);
    }
    if (req.user.id === id) {
        throw new errorHandler_1.AppError('Cannot delete your own account', 400);
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    ownedStores: true,
                    orders: true
                }
            }
        }
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    if (user._count.ownedStores > 0) {
        throw new errorHandler_1.AppError('Cannot delete user who owns stores. Transfer store ownership first.', 400);
    }
    try {
        await prisma_1.prisma.user.delete({
            where: { id }
        });
        logger_1.logger.info(`User deleted: ${(0, sanitizer_1.sanitizeForLog)(id)} by ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        logger_1.logger.error('Error deleting user:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to delete user', 500);
    }
});
exports.getUserActivity = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (req.user.id !== id && !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    const skip = (Number(page) - 1) * Number(limit);
    try {
        const [activities, total] = await Promise.all([
            prisma_1.prisma.employeeActivity.findMany({
                where: { userId: id },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit),
                include: {
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true
                        }
                    }
                }
            }),
            prisma_1.prisma.employeeActivity.count({
                where: { userId: id }
            })
        ]);
        res.json({
            activities,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching user activity:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to fetch user activity', 500);
    }
});
exports.getUserDetailed = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (req.user.id !== id && !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    orders: true,
                    ownedStores: true,
                    managedStores: true,
                    vendorStores: true,
                    sessions: true,
                    notifications: true,
                    adminLogs: true
                }
            },
            ownedStores: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    currency: true,
                    status: true,
                    botStatus: true,
                    createdAt: true,
                    _count: {
                        select: {
                            products: true,
                            orders: true
                        }
                    }
                }
            },
            managedStores: {
                include: {
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            currency: true,
                            status: true
                        }
                    }
                }
            },
            vendorStores: {
                where: {
                    isActive: true
                },
                include: {
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            currency: true
                        }
                    },
                    customRole: {
                        select: {
                            id: true,
                            name: true,
                            color: true,
                            permissions: true
                        }
                    }
                }
            },
            orders: {
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    totalAmount: true,
                    currency: true,
                    createdAt: true,
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 10
            },
            sessions: {
                where: {
                    isRevoked: false,
                    expiresAt: {
                        gte: new Date()
                    }
                },
                select: {
                    id: true,
                    createdAt: true,
                    expiresAt: true,
                    ipAddress: true,
                    userAgent: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 5
            }
        }
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    const orderStats = await prisma_1.prisma.order.groupBy({
        by: ['status'],
        where: {
            customerId: id
        },
        _count: {
            id: true
        },
        _sum: {
            totalAmount: true
        }
    });
    const recentActivityCount = await prisma_1.prisma.employeeActivity.count({
        where: {
            userId: id,
            createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
        }
    });
    const formattedUser = {
        ...user,
        stores: {
            owned: user.ownedStores,
            admin: user.managedStores.map(a => a.store),
            vendor: user.vendorStores.map(v => ({
                ...v.store,
                customRole: v.customRole,
                permissions: v.permissions
            }))
        },
        statistics: {
            orders: orderStats.map(stat => ({
                status: stat.status,
                count: stat._count.id,
                totalAmount: stat._sum.totalAmount || 0
            })),
            totalOrders: user._count.orders,
            totalStores: user._count.ownedStores + user._count.managedStores + user._count.vendorStores,
            activeSessions: user._count.sessions,
            notifications: user._count.notifications,
            adminActions: user._count.adminLogs,
            recentActivity: recentActivityCount
        }
    };
    res.json({ user: formattedUser });
});
exports.banUser = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    if (req.user.id === id) {
        throw new errorHandler_1.AppError('Cannot ban your own account', 400);
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id }
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    if (req.user.role === 'ADMIN' && user.role === 'OWNER') {
        throw new errorHandler_1.AppError('Admins cannot ban owners', 403);
    }
    if (!user.isActive) {
        throw new errorHandler_1.AppError('User is already banned', 400);
    }
    try {
        const updatedUser = await prisma_1.prisma.$transaction(async (tx) => {
            const banned = await tx.user.update({
                where: { id },
                data: { isActive: false }
            });
            await tx.userSession.updateMany({
                where: {
                    userId: id,
                    isRevoked: false
                },
                data: {
                    isRevoked: true,
                    revokedAt: new Date()
                }
            });
            await tx.adminLog.create({
                data: {
                    action: 'USER_BANNED',
                    details: JSON.stringify({
                        userId: id,
                        reason: reason || 'No reason provided',
                        bannedBy: req.user.id
                    }),
                    adminId: req.user.id
                }
            });
            return banned;
        });
        logger_1.logger.info(`User banned: ${(0, sanitizer_1.sanitizeForLog)(id)} by ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}, reason: ${(0, sanitizer_1.sanitizeForLog)(reason || 'No reason')}`);
        notificationService_1.NotificationService.send({
            title: 'Аккаунт заблокирован',
            message: `Ваш аккаунт был заблокирован администратором. ${reason ? `Причина: ${reason}` : ''}`,
            type: notificationService_1.NotificationType.USER_REGISTERED,
            priority: notificationService_1.NotificationPriority.HIGH,
            recipients: [id],
            channels: [notificationService_1.NotificationChannel.TELEGRAM],
            data: {
                bannedBy: req.user.id,
                reason: reason || 'No reason provided'
            }
        });
        res.json({
            user: updatedUser,
            message: 'User banned successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error banning user:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to ban user', 500);
    }
});
exports.unbanUser = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id }
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    if (user.isActive) {
        throw new errorHandler_1.AppError('User is not banned', 400);
    }
    try {
        const updatedUser = await prisma_1.prisma.$transaction(async (tx) => {
            const unbanned = await tx.user.update({
                where: { id },
                data: { isActive: true }
            });
            await tx.adminLog.create({
                data: {
                    action: 'USER_UNBANNED',
                    details: JSON.stringify({
                        userId: id,
                        unbannedBy: req.user.id
                    }),
                    adminId: req.user.id
                }
            });
            return unbanned;
        });
        logger_1.logger.info(`User unbanned: ${(0, sanitizer_1.sanitizeForLog)(id)} by ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
        notificationService_1.NotificationService.send({
            title: 'Аккаунт разблокирован',
            message: 'Ваш аккаунт был разблокирован администратором. Теперь вы можете снова пользоваться системой.',
            type: notificationService_1.NotificationType.USER_REGISTERED,
            priority: notificationService_1.NotificationPriority.HIGH,
            recipients: [id],
            channels: [notificationService_1.NotificationChannel.TELEGRAM, notificationService_1.NotificationChannel.SOCKET],
            data: {
                unbannedBy: req.user.id
            }
        });
        res.json({
            user: updatedUser,
            message: 'User unbanned successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error unbanning user:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to unban user', 500);
    }
});
exports.bulkUserActions = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { action, userIds, data } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can perform bulk actions', 403);
    }
    if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new errorHandler_1.AppError('User IDs array is required', 400);
    }
    if (userIds.includes(req.user.id)) {
        throw new errorHandler_1.AppError('Cannot perform bulk actions on your own account', 400);
    }
    try {
        let result;
        switch (action) {
            case 'ban':
                result = await prisma_1.prisma.user.updateMany({
                    where: {
                        id: { in: userIds },
                        role: { not: 'OWNER' }
                    },
                    data: { isActive: false }
                });
                await prisma_1.prisma.userSession.updateMany({
                    where: {
                        userId: { in: userIds },
                        isRevoked: false
                    },
                    data: {
                        isRevoked: true,
                        revokedAt: new Date()
                    }
                });
                break;
            case 'unban':
                result = await prisma_1.prisma.user.updateMany({
                    where: {
                        id: { in: userIds }
                    },
                    data: { isActive: true }
                });
                break;
            case 'changeRole':
                if (!data?.role) {
                    throw new errorHandler_1.AppError('Role is required for changeRole action', 400);
                }
                result = await prisma_1.prisma.user.updateMany({
                    where: {
                        id: { in: userIds },
                        role: { not: 'OWNER' }
                    },
                    data: { role: data.role }
                });
                break;
            case 'delete': {
                const usersWithStores = await prisma_1.prisma.user.findMany({
                    where: {
                        id: { in: userIds },
                        ownedStores: {
                            some: {}
                        }
                    },
                    select: { id: true }
                });
                if (usersWithStores.length > 0) {
                    throw new errorHandler_1.AppError('Cannot delete users who own stores', 400);
                }
                result = await prisma_1.prisma.user.deleteMany({
                    where: {
                        id: { in: userIds },
                        role: { not: 'OWNER' }
                    }
                });
                break;
            }
            default:
                throw new errorHandler_1.AppError('Invalid action', 400);
        }
        logger_1.logger.info(`Bulk action ${(0, sanitizer_1.sanitizeForLog)(action)} performed on ${userIds.length} users by ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
        res.json({
            message: `Bulk action ${(0, sanitizer_1.sanitizeHtml)(action)} completed successfully`,
            affectedCount: result.count
        });
    }
    catch (error) {
        logger_1.logger.error('Error performing bulk action:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to perform bulk action', 500);
    }
});
//# sourceMappingURL=userController.js.map
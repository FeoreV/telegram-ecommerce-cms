"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEmployee = exports.updateEmployeeRole = exports.inviteEmployee = exports.getStoreEmployees = void 0;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const employeeSchemas_1 = require("../schemas/employeeSchemas");
const notificationService_1 = require("../services/notificationService");
const crypto_1 = require("crypto");
exports.getStoreEmployees = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    const searchParams = employeeSchemas_1.EmployeeSearchSchema.parse(req.query);
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этому магазину', 403);
    }
    const { page, limit, search, role, status } = searchParams;
    const skip = (page - 1) * limit;
    const employeeWhere = {};
    if (search) {
        employeeWhere.user = {
            OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { username: { contains: search } },
                { email: { contains: search } }
            ]
        };
    }
    const [admins, vendors, totalAdmins, totalVendors] = await Promise.all([
        role === 'ALL' || role === 'ADMIN'
            ? prisma_1.prisma.storeAdmin.findMany({
                where: {
                    storeId,
                    ...employeeWhere
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            username: true,
                            email: true,
                            isActive: true,
                            lastLoginAt: true,
                            createdAt: true,
                            profilePhoto: true
                        }
                    },
                    assignedByUser: {
                        select: {
                            firstName: true,
                            lastName: true,
                            username: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip: role === 'ADMIN' ? skip : 0,
                take: role === 'ADMIN' ? limit : undefined
            })
            : [],
        role === 'ALL' || role === 'VENDOR'
            ? prisma_1.prisma.storeVendor.findMany({
                where: {
                    storeId,
                    ...(status !== 'ALL' && { isActive: status === 'ACTIVE' }),
                    ...employeeWhere
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            username: true,
                            email: true,
                            isActive: true,
                            lastLoginAt: true,
                            createdAt: true,
                            profilePhoto: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip: role === 'VENDOR' ? skip : 0,
                take: role === 'VENDOR' ? limit : undefined
            })
            : [],
        role === 'ALL' || role === 'ADMIN'
            ? prisma_1.prisma.storeAdmin.count({ where: { storeId, ...employeeWhere } })
            : 0,
        role === 'ALL' || role === 'VENDOR'
            ? prisma_1.prisma.storeVendor.count({
                where: {
                    storeId,
                    ...(status !== 'ALL' && { isActive: status === 'ACTIVE' }),
                    ...employeeWhere
                }
            })
            : 0
    ]);
    const employees = [
        ...admins.map(admin => ({
            id: admin.user.id,
            role: 'ADMIN',
            assignmentId: admin.id,
            user: admin.user,
            assignedBy: admin.assignedByUser,
            assignedAt: admin.createdAt,
            isActive: admin.user.isActive,
            permissions: []
        })),
        ...vendors.map(vendor => ({
            id: vendor.user.id,
            role: 'VENDOR',
            assignmentId: vendor.id,
            user: vendor.user,
            assignedAt: vendor.createdAt,
            isActive: vendor.isActive && vendor.user.isActive,
            permissions: vendor.permissions ? JSON.parse(vendor.permissions) : []
        }))
    ];
    const total = totalAdmins + totalVendors;
    res.json({
        employees,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        },
        stats: {
            totalAdmins,
            totalVendors,
            activeEmployees: employees.filter(e => e.isActive).length
        }
    });
});
exports.inviteEmployee = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const inviteData = employeeSchemas_1.EmployeeInviteSchema.parse(req.body);
    const { email, firstName, lastName, role, customRoleId, storeId, permissions, message } = inviteData;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этому магазину', 403);
    }
    let user = await prisma_1.prisma.user.findUnique({
        where: { email }
    });
    const inviteToken = (0, crypto_1.randomBytes)(32).toString('hex');
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma_1.prisma.$transaction(async (tx) => {
        if (!user) {
            user = await tx.user.create({
                data: {
                    telegramId: `temp_${(0, crypto_1.randomBytes)(8).toString('hex')}`,
                    firstName,
                    lastName,
                    email,
                    role: 'CUSTOMER',
                    isActive: false
                }
            });
        }
        await tx.employeeInvitation.create({
            data: {
                id: (0, crypto_1.randomBytes)(12).toString('hex'),
                storeId,
                userId: user.id,
                invitedBy: req.user.id,
                role: customRoleId ? undefined : role,
                customRoleId,
                permissions: JSON.stringify(permissions || []),
                token: inviteToken,
                expiresAt: inviteExpiry,
                message: message || ''
            }
        });
        await notificationService_1.NotificationService.sendNotification({
            type: notificationService_1.NotificationType.EMPLOYEE_INVITATION,
            priority: notificationService_1.NotificationPriority.HIGH,
            title: 'Приглашение в команду',
            message: customRoleId
                ? `Вас пригласили работать в роли ${await getCustomRoleName(customRoleId)}`
                : `Вас пригласили работать в роли ${role === 'ADMIN' ? 'администратора' : 'продавца'}`,
            channels: [notificationService_1.NotificationChannel.EMAIL],
            recipients: [user.id],
            storeId,
            data: {
                inviteToken,
                inviterName: `${req.user.firstName} ${req.user.lastName}`,
                role: customRoleId ? 'CUSTOM' : role,
                customRoleId,
                storeName: await getStoreName(storeId)
            }
        });
    });
    logger_1.logger.info(`Employee invited: ${email} as ${role} to store ${storeId} by ${req.user.id}`);
    res.status(201).json({
        success: true,
        message: 'Приглашение отправлено',
        inviteToken
    });
});
exports.updateEmployeeRole = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const updateData = employeeSchemas_1.UpdateEmployeeRoleSchema.parse(req.body);
    const { userId, storeId, role, permissions, isActive } = updateData;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этому магазину', 403);
    }
    if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
        throw new errorHandler_1.AppError('Недостаточно прав для изменения ролей', 403);
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.storeAdmin.deleteMany({
            where: { userId, storeId }
        });
        await tx.storeVendor.deleteMany({
            where: { userId, storeId }
        });
        if (role === 'ADMIN') {
            await tx.storeAdmin.create({
                data: {
                    userId,
                    storeId,
                    assignedBy: req.user.id
                }
            });
        }
        else {
            await tx.storeVendor.create({
                data: {
                    userId,
                    storeId,
                    assignedBy: req.user.id,
                    isActive: isActive ?? true,
                    permissions: JSON.stringify(permissions || [])
                }
            });
        }
        if (isActive !== undefined) {
            await tx.user.update({
                where: { id: userId },
                data: { isActive }
            });
        }
        await tx.adminLog.create({
            data: {
                action: 'EMPLOYEE_ROLE_UPDATED',
                details: JSON.stringify({ userId, storeId, role, permissions, isActive }),
                adminId: req.user.id
            }
        });
    });
    logger_1.logger.info(`Employee role updated: user ${userId} -> ${role} in store ${storeId} by ${req.user.id}`);
    res.json({
        success: true,
        message: 'Роль сотрудника обновлена'
    });
});
exports.removeEmployee = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId, userId } = req.params;
    const { reason } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этому магазину', 403);
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.storeAdmin.deleteMany({
            where: { userId, storeId }
        });
        await tx.storeVendor.deleteMany({
            where: { userId, storeId }
        });
        await tx.adminLog.create({
            data: {
                action: 'EMPLOYEE_REMOVED',
                details: JSON.stringify({ userId, storeId, reason }),
                adminId: req.user.id
            }
        });
    });
    await notificationService_1.NotificationService.sendNotification({
        type: notificationService_1.NotificationType.EMPLOYEE_REMOVED,
        priority: notificationService_1.NotificationPriority.MEDIUM,
        title: 'Изменение в команде',
        message: 'Ваш доступ к магазину был отозван',
        channels: [notificationService_1.NotificationChannel.TELEGRAM, notificationService_1.NotificationChannel.EMAIL],
        recipients: [userId],
        storeId,
        data: { reason }
    });
    res.json({
        success: true,
        message: 'Сотрудник удален из команды'
    });
});
async function checkStoreAccess(userId, storeId, role) {
    if (role === 'OWNER')
        return true;
    const store = await prisma_1.prisma.store.findFirst({
        where: {
            id: storeId,
            OR: [
                { ownerId: userId },
                { admins: { some: { userId } } }
            ]
        }
    });
    return !!store;
}
async function getStoreName(storeId) {
    const store = await prisma_1.prisma.store.findUnique({
        where: { id: storeId },
        select: { name: true }
    });
    return store?.name || 'Магазин';
}
async function getCustomRoleName(customRoleId) {
    const customRole = await prisma_1.prisma.customRole.findUnique({
        where: { id: customRoleId },
        select: { name: true }
    });
    return customRole?.name || 'Кастомная роль';
}
//# sourceMappingURL=employeeController.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailablePermissions = exports.assignCustomRole = exports.deleteCustomRole = exports.updateCustomRole = exports.getCustomRole = exports.getCustomRoles = exports.createCustomRole = void 0;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const loggerEnhanced_1 = require("../utils/loggerEnhanced");
const customRoleSchemas_1 = require("../schemas/customRoleSchemas");
exports.createCustomRole = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const data = customRoleSchemas_1.CreateCustomRoleSchema.parse(req.body);
    const { storeId, name, description, permissions, color, icon } = data;
    const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этому магазину', 403);
    }
    const existingRole = await prisma_1.prisma.customRole.findFirst({
        where: {
            storeId,
            name,
            isActive: true
        }
    });
    if (existingRole) {
        throw new errorHandler_1.AppError('Роль с таким именем уже существует', 400);
    }
    const validPermissions = customRoleSchemas_1.AVAILABLE_PERMISSIONS.map(p => p.value);
    const invalidPermissions = permissions.filter((p) => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
        throw new errorHandler_1.AppError(`Недопустимые разрешения: ${invalidPermissions.join(', ')}`, 400);
    }
    const customRole = await prisma_1.prisma.customRole.create({
        data: {
            storeId,
            name,
            description,
            permissions: JSON.stringify(permissions),
            color,
            icon,
            createdBy: req.user.id
        },
        include: {
            store: {
                select: {
                    id: true,
                    name: true
                }
            },
            creator: {
                select: {
                    firstName: true,
                    lastName: true,
                    username: true
                }
            },
            _count: {
                select: {
                    vendors: true
                }
            }
        }
    });
    loggerEnhanced_1.logger.info('Custom role created', {
        customRoleId: customRole.id,
        storeId,
        name,
        createdBy: req.user.id,
        permissions
    });
    res.status(201).json({
        success: true,
        customRole: {
            ...customRole,
            permissions: JSON.parse(customRole.permissions),
            usersCount: customRole._count.vendors
        }
    });
});
exports.getCustomRoles = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const searchParams = customRoleSchemas_1.CustomRoleSearchSchema.parse(req.query);
    const { storeId, search, isActive, page, limit } = searchParams;
    const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этому магазину', 403);
    }
    const whereClause = { storeId };
    if (search) {
        whereClause.OR = [
            { name: { contains: search } },
            { description: { contains: search } }
        ];
    }
    if (isActive !== undefined) {
        whereClause.isActive = isActive;
    }
    const skip = (page - 1) * limit;
    const [customRoles, total] = await Promise.all([
        prisma_1.prisma.customRole.findMany({
            where: whereClause,
            include: {
                creator: {
                    select: {
                        firstName: true,
                        lastName: true,
                        username: true
                    }
                },
                _count: {
                    select: {
                        vendors: {
                            where: { isActive: true }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: limit
        }),
        prisma_1.prisma.customRole.count({ where: whereClause })
    ]);
    const formattedRoles = customRoles.map(role => ({
        ...role,
        permissions: JSON.parse(role.permissions),
        usersCount: role._count.vendors
    }));
    res.json({
        customRoles: formattedRoles,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});
exports.getCustomRole = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const customRole = await prisma_1.prisma.customRole.findUnique({
        where: { id },
        include: {
            store: {
                select: {
                    id: true,
                    name: true
                }
            },
            creator: {
                select: {
                    firstName: true,
                    lastName: true,
                    username: true
                }
            },
            vendors: {
                where: { isActive: true },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            username: true,
                            email: true
                        }
                    }
                }
            },
            _count: {
                select: {
                    vendors: {
                        where: { isActive: true }
                    }
                }
            }
        }
    });
    if (!customRole) {
        throw new errorHandler_1.AppError('Кастомная роль не найдена', 404);
    }
    const hasAccess = await checkStoreAccess(req.user.id, customRole.storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этой роли', 403);
    }
    res.json({
        customRole: {
            ...customRole,
            permissions: JSON.parse(customRole.permissions),
            usersCount: customRole._count.vendors,
            users: customRole.vendors.map(vendor => vendor.user)
        }
    });
});
exports.updateCustomRole = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const data = customRoleSchemas_1.UpdateCustomRoleSchema.parse(req.body);
    const { id, name, description, permissions, color, icon, isActive } = data;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const customRole = await prisma_1.prisma.customRole.findUnique({
        where: { id }
    });
    if (!customRole) {
        throw new errorHandler_1.AppError('Кастомная роль не найдена', 404);
    }
    const hasAccess = await checkStoreAccess(req.user.id, customRole.storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этой роли', 403);
    }
    if (name && name !== customRole.name) {
        const existingRole = await prisma_1.prisma.customRole.findFirst({
            where: {
                storeId: customRole.storeId,
                name,
                isActive: true,
                id: { not: id }
            }
        });
        if (existingRole) {
            throw new errorHandler_1.AppError('Роль с таким именем уже существует', 400);
        }
    }
    if (permissions) {
        const validPermissions = customRoleSchemas_1.AVAILABLE_PERMISSIONS.map(p => p.value);
        const invalidPermissions = permissions.filter((p) => !validPermissions.includes(p));
        if (invalidPermissions.length > 0) {
            throw new errorHandler_1.AppError(`Недопустимые разрешения: ${invalidPermissions.join(', ')}`, 400);
        }
    }
    const updateData = {};
    if (name !== undefined)
        updateData.name = name;
    if (description !== undefined)
        updateData.description = description;
    if (permissions !== undefined)
        updateData.permissions = JSON.stringify(permissions);
    if (color !== undefined)
        updateData.color = color;
    if (icon !== undefined)
        updateData.icon = icon;
    if (isActive !== undefined)
        updateData.isActive = isActive;
    const updatedRole = await prisma_1.prisma.customRole.update({
        where: { id },
        data: updateData,
        include: {
            _count: {
                select: {
                    vendors: {
                        where: { isActive: true }
                    }
                }
            }
        }
    });
    loggerEnhanced_1.logger.info('Custom role updated', {
        customRoleId: id,
        updatedBy: req.user.id,
        changes: updateData
    });
    res.json({
        success: true,
        customRole: {
            ...updatedRole,
            permissions: JSON.parse(updatedRole.permissions),
            usersCount: updatedRole._count.vendors
        }
    });
});
exports.deleteCustomRole = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const customRole = await prisma_1.prisma.customRole.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    vendors: { where: { isActive: true } }
                }
            }
        }
    });
    if (!customRole) {
        throw new errorHandler_1.AppError('Кастомная роль не найдена', 404);
    }
    const hasAccess = await checkStoreAccess(req.user.id, customRole.storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этой роли', 403);
    }
    if (customRole._count.vendors > 0) {
        throw new errorHandler_1.AppError('Нельзя удалить роль, которая используется сотрудниками', 400);
    }
    await prisma_1.prisma.customRole.delete({
        where: { id }
    });
    loggerEnhanced_1.logger.info('Custom role deleted', {
        customRoleId: id,
        deletedBy: req.user.id
    });
    res.json({
        success: true,
        message: 'Кастомная роль удалена'
    });
});
exports.assignCustomRole = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const data = customRoleSchemas_1.AssignCustomRoleSchema.parse(req.body);
    const { userId, storeId, customRoleId } = data;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этому магазину', 403);
    }
    const customRole = await prisma_1.prisma.customRole.findFirst({
        where: {
            id: customRoleId,
            storeId,
            isActive: true
        }
    });
    if (!customRole) {
        throw new errorHandler_1.AppError('Кастомная роль не найдена', 404);
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId }
    });
    if (!user) {
        throw new errorHandler_1.AppError('Пользователь не найден', 404);
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.storeVendor.upsert({
            where: {
                storeId_userId: {
                    storeId,
                    userId
                }
            },
            create: {
                userId,
                storeId,
                assignedBy: req.user.id,
                isActive: true,
                customRoleId
            },
            update: {
                customRoleId,
                isActive: true,
                permissions: null
            }
        });
        await tx.employeeActivity.create({
            data: {
                userId,
                storeId,
                action: 'CUSTOM_ROLE_ASSIGNED',
                details: JSON.stringify({
                    customRoleId,
                    roleName: customRole.name,
                    assignedBy: req.user.id
                })
            }
        });
    });
    loggerEnhanced_1.logger.info('Custom role assigned', {
        userId,
        storeId,
        customRoleId,
        assignedBy: req.user.id
    });
    res.json({
        success: true,
        message: `Роль "${customRole.name}" назначена пользователю`
    });
});
exports.getAvailablePermissions = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json({
        permissions: customRoleSchemas_1.AVAILABLE_PERMISSIONS,
        categories: [
            { key: 'products', label: 'Товары', icon: '📦', color: '#3b82f6' },
            { key: 'orders', label: 'Заказы', icon: '📋', color: '#10b981' },
            { key: 'inventory', label: 'Склад', icon: '📊', color: '#f59e0b' },
            { key: 'analytics', label: 'Аналитика', icon: '📈', color: '#8b5cf6' },
            { key: 'users', label: 'Пользователи', icon: '👥', color: '#ef4444' },
            { key: 'store', label: 'Магазин', icon: '🏪', color: '#06b6d4' },
            { key: 'notifications', label: 'Уведомления', icon: '🔔', color: '#84cc16' },
            { key: 'bots', label: 'Боты', icon: '🤖', color: '#ec4899' }
        ]
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
//# sourceMappingURL=customRoleController.js.map
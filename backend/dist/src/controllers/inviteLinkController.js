"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useInviteLink = exports.getInviteLinkInfo = exports.deleteInviteLink = exports.updateInviteLink = exports.getInviteLinks = exports.createInviteLink = void 0;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const inviteLinkSchemas_1 = require("../schemas/inviteLinkSchemas");
const crypto_1 = require("crypto");
exports.createInviteLink = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const data = inviteLinkSchemas_1.CreateInviteLinkSchema.parse(req.body);
    const { storeId, role, customRoleId, permissions, maxUses, expiresAt, description } = data;
    const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этому магазину', 403);
    }
    if (customRoleId) {
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
    }
    const token = (0, crypto_1.randomBytes)(32).toString('hex');
    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
    const inviteLink = await prisma_1.prisma.inviteLink.create({
        data: {
            storeId,
            createdBy: req.user.id,
            token,
            role,
            customRoleId,
            permissions: permissions ? JSON.stringify(permissions) : null,
            maxUses,
            expiresAt: expiresAtDate,
            description
        },
        include: {
            store: {
                select: {
                    id: true,
                    name: true
                }
            },
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
    logger_1.logger.info('Invite link created', {
        inviteLinkId: inviteLink.id,
        storeId,
        createdBy: req.user.id,
        role: role || 'CUSTOM',
        customRoleId
    });
    res.status(201).json({
        success: true,
        inviteLink: {
            ...inviteLink,
            url: `${process.env.FRONTEND_URL}/invite/${token}`
        }
    });
});
exports.getInviteLinks = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const searchParams = inviteLinkSchemas_1.InviteLinkSearchSchema.parse(req.query);
    const { storeId, isActive, page, limit } = searchParams;
    const whereClause = {};
    if (storeId) {
        const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
        if (!hasAccess) {
            throw new errorHandler_1.AppError('Нет доступа к этому магазину', 403);
        }
        whereClause.storeId = storeId;
    }
    else {
        if (req.user.role !== 'OWNER') {
            const accessibleStores = await getAccessibleStores(req.user.id, req.user.role);
            whereClause.storeId = { in: accessibleStores };
        }
    }
    if (isActive !== undefined) {
        whereClause.isActive = isActive;
    }
    const skip = (page - 1) * limit;
    const [inviteLinks, total] = await Promise.all([
        prisma_1.prisma.inviteLink.findMany({
            where: whereClause,
            include: {
                store: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                customRole: {
                    select: {
                        id: true,
                        name: true,
                        color: true,
                        icon: true
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
                        invitations: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: limit
        }),
        prisma_1.prisma.inviteLink.count({ where: whereClause })
    ]);
    const formattedLinks = inviteLinks.map(link => ({
        ...link,
        url: `${process.env.FRONTEND_URL}/invite/${link.token}`,
        usageStats: {
            used: link.usedCount,
            max: link.maxUses,
            remaining: link.maxUses - link.usedCount
        },
        isExpired: link.expiresAt ? link.expiresAt < new Date() : false,
        invitationsCount: link._count.invitations
    }));
    res.json({
        inviteLinks: formattedLinks,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});
exports.updateInviteLink = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const data = inviteLinkSchemas_1.UpdateInviteLinkSchema.parse(req.body);
    const { id, isActive, maxUses, expiresAt, description } = data;
    const inviteLink = await prisma_1.prisma.inviteLink.findUnique({
        where: { id },
        include: { store: true }
    });
    if (!inviteLink) {
        throw new errorHandler_1.AppError('Инвайт ссылка не найдена', 404);
    }
    const hasAccess = await checkStoreAccess(req.user.id, inviteLink.storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этой ссылке', 403);
    }
    const updateData = {};
    if (isActive !== undefined)
        updateData.isActive = isActive;
    if (maxUses !== undefined)
        updateData.maxUses = maxUses;
    if (expiresAt !== undefined)
        updateData.expiresAt = new Date(expiresAt);
    if (description !== undefined)
        updateData.description = description;
    const updatedLink = await prisma_1.prisma.inviteLink.update({
        where: { id },
        data: updateData,
        include: {
            store: {
                select: {
                    id: true,
                    name: true
                }
            },
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
    logger_1.logger.info('Invite link updated', {
        inviteLinkId: id,
        updatedBy: req.user.id,
        changes: updateData
    });
    res.json({
        success: true,
        inviteLink: {
            ...updatedLink,
            url: `${process.env.FRONTEND_URL}/invite/${updatedLink.token}`
        }
    });
});
exports.deleteInviteLink = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const inviteLink = await prisma_1.prisma.inviteLink.findUnique({
        where: { id }
    });
    if (!inviteLink) {
        throw new errorHandler_1.AppError('Инвайт ссылка не найдена', 404);
    }
    const hasAccess = await checkStoreAccess(req.user.id, inviteLink.storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этой ссылке', 403);
    }
    await prisma_1.prisma.inviteLink.delete({
        where: { id }
    });
    logger_1.logger.info('Invite link deleted', {
        inviteLinkId: id,
        deletedBy: req.user.id
    });
    res.json({
        success: true,
        message: 'Инвайт ссылка удалена'
    });
});
exports.getInviteLinkInfo = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { token } = req.params;
    const inviteLink = await prisma_1.prisma.inviteLink.findUnique({
        where: { token },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    logoUrl: true
                }
            },
            customRole: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    permissions: true,
                    color: true,
                    icon: true
                }
            },
            creator: {
                select: {
                    firstName: true,
                    lastName: true,
                    username: true
                }
            }
        }
    });
    if (!inviteLink) {
        throw new errorHandler_1.AppError('Инвайт ссылка не найдена', 404);
    }
    if (!inviteLink.isActive) {
        throw new errorHandler_1.AppError('Инвайт ссылка деактивирована', 400);
    }
    if (inviteLink.expiresAt && inviteLink.expiresAt < new Date()) {
        throw new errorHandler_1.AppError('Срок действия инвайт ссылки истек', 400);
    }
    if (inviteLink.usedCount >= inviteLink.maxUses) {
        throw new errorHandler_1.AppError('Лимит использований инвайт ссылки исчерпан', 400);
    }
    let permissions = [];
    if (inviteLink.customRole) {
        permissions = JSON.parse(inviteLink.customRole.permissions);
    }
    else if (inviteLink.permissions) {
        permissions = JSON.parse(inviteLink.permissions);
    }
    res.json({
        inviteLink: {
            id: inviteLink.id,
            role: inviteLink.role,
            customRole: inviteLink.customRole,
            permissions,
            description: inviteLink.description,
            expiresAt: inviteLink.expiresAt,
            store: inviteLink.store,
            creator: inviteLink.creator,
            usageStats: {
                used: inviteLink.usedCount,
                max: inviteLink.maxUses,
                remaining: inviteLink.maxUses - inviteLink.usedCount
            }
        }
    });
});
exports.useInviteLink = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const data = inviteLinkSchemas_1.UseInviteLinkSchema.parse(req.body);
    const { token, firstName, lastName, email, telegramId } = data;
    const inviteLink = await prisma_1.prisma.inviteLink.findUnique({
        where: { token },
        include: {
            store: true,
            customRole: true
        }
    });
    if (!inviteLink) {
        throw new errorHandler_1.AppError('Инвайт ссылка не найдена', 404);
    }
    if (!inviteLink.isActive) {
        throw new errorHandler_1.AppError('Инвайт ссылка деактивирована', 400);
    }
    if (inviteLink.expiresAt && inviteLink.expiresAt < new Date()) {
        throw new errorHandler_1.AppError('Срок действия инвайт ссылки истек', 400);
    }
    if (inviteLink.usedCount >= inviteLink.maxUses) {
        throw new errorHandler_1.AppError('Лимит использований инвайт ссылки исчерпан', 400);
    }
    let user = await prisma_1.prisma.user.findUnique({
        where: { email }
    });
    await prisma_1.prisma.$transaction(async (tx) => {
        if (!user) {
            user = await tx.user.create({
                data: {
                    telegramId: telegramId || `invite_${(0, crypto_1.randomBytes)(8).toString('hex')}`,
                    firstName,
                    lastName,
                    email,
                    role: 'CUSTOMER',
                    isActive: true
                }
            });
        }
        else {
            user = await tx.user.update({
                where: { id: user.id },
                data: {
                    firstName,
                    lastName,
                    ...(telegramId && { telegramId }),
                    isActive: true
                }
            });
        }
        if (inviteLink.role === 'ADMIN') {
            await tx.storeAdmin.upsert({
                where: {
                    storeId_userId: {
                        storeId: inviteLink.storeId,
                        userId: user.id
                    }
                },
                create: {
                    userId: user.id,
                    storeId: inviteLink.storeId,
                    assignedBy: inviteLink.createdBy
                },
                update: {}
            });
        }
        else {
            await tx.storeVendor.upsert({
                where: {
                    storeId_userId: {
                        storeId: inviteLink.storeId,
                        userId: user.id
                    }
                },
                create: {
                    userId: user.id,
                    storeId: inviteLink.storeId,
                    assignedBy: inviteLink.createdBy,
                    isActive: true,
                    customRoleId: inviteLink.customRoleId,
                    permissions: inviteLink.permissions
                },
                update: {
                    customRoleId: inviteLink.customRoleId,
                    permissions: inviteLink.permissions,
                    isActive: true
                }
            });
        }
        await tx.inviteLink.update({
            where: { id: inviteLink.id },
            data: {
                usedCount: { increment: 1 }
            }
        });
        await tx.employeeActivity.create({
            data: {
                userId: user.id,
                storeId: inviteLink.storeId,
                action: 'INVITE_LINK_USED',
                details: JSON.stringify({
                    inviteLinkId: inviteLink.id,
                    role: inviteLink.role || 'CUSTOM',
                    customRoleId: inviteLink.customRoleId
                })
            }
        });
    });
    logger_1.logger.info('Invite link used', {
        inviteLinkId: inviteLink.id,
        userId: user.id,
        email,
        storeId: inviteLink.storeId
    });
    res.json({
        success: true,
        message: 'Добро пожаловать в команду!',
        user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
        },
        store: {
            id: inviteLink.store.id,
            name: inviteLink.store.name
        },
        role: inviteLink.customRole ? inviteLink.customRole.name : inviteLink.role
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
async function getAccessibleStores(userId, role) {
    if (role === 'OWNER') {
        const stores = await prisma_1.prisma.store.findMany({
            select: { id: true }
        });
        return stores.map(store => store.id);
    }
    const stores = await prisma_1.prisma.store.findMany({
        where: {
            OR: [
                { ownerId: userId },
                { admins: { some: { userId } } }
            ]
        },
        select: { id: true }
    });
    return stores.map(store => store.id);
}
//# sourceMappingURL=inviteLinkController.js.map
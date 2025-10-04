"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeeActivity = exports.getInvitationInfo = exports.rejectInvitation = exports.acceptInvitation = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const employeeService_1 = require("../services/employeeService");
const logger_1 = require("../utils/logger");
const AcceptInvitationSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Токен приглашения обязателен'),
    telegramId: zod_1.z.string().optional()
});
const RejectInvitationSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Токен приглашения обязателен'),
    reason: zod_1.z.string().max(500, 'Причина не должна превышать 500 символов').optional()
});
exports.acceptInvitation = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { token, telegramId } = AcceptInvitationSchema.parse(req.body);
    try {
        await employeeService_1.EmployeeService.acceptInvitation(token, telegramId);
        res.json({
            success: true,
            message: 'Приглашение принято! Добро пожаловать в команду!'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to accept invitation:', error);
        throw error;
    }
});
exports.rejectInvitation = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { token, reason } = RejectInvitationSchema.parse(req.body);
    try {
        await employeeService_1.EmployeeService.rejectInvitation(token, reason);
        res.json({
            success: true,
            message: 'Приглашение отклонено'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to reject invitation:', error);
        throw error;
    }
});
exports.getInvitationInfo = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { token } = req.params;
    const invitation = await prisma_1.prisma.employeeInvitation.findUnique({
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
            inviter: {
                select: {
                    firstName: true,
                    lastName: true,
                    username: true
                }
            }
        }
    });
    if (!invitation) {
        throw new errorHandler_1.AppError('Приглашение не найдено', 404);
    }
    if (invitation.status !== 'PENDING') {
        throw new errorHandler_1.AppError('Приглашение уже обработано', 400);
    }
    if (invitation.expiresAt < new Date()) {
        throw new errorHandler_1.AppError('Срок действия приглашения истек', 400);
    }
    let permissions = [];
    try {
        if (invitation.permissions) {
            const parsed = JSON.parse(invitation.permissions);
            if (Array.isArray(parsed)) {
                permissions = parsed.filter((p) => typeof p === 'string');
            }
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to parse invitation permissions', {
            invitationId: invitation.id,
            error
        });
    }
    res.json({
        invitation: {
            id: invitation.id,
            role: invitation.role,
            message: invitation.message,
            expiresAt: invitation.expiresAt,
            store: invitation.store,
            inviter: invitation.inviter,
            permissions
        }
    });
});
exports.getEmployeeActivity = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    const { userId, limit = 50, offset = 0 } = req.query;
    const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
    if (!hasAccess) {
        throw new errorHandler_1.AppError('Нет доступа к этому магазину', 403);
    }
    const activities = await employeeService_1.EmployeeService.getEmployeeActivity(storeId, userId, Number(limit), Number(offset));
    res.json({
        activities,
        pagination: {
            limit: Number(limit),
            offset: Number(offset),
            hasMore: activities.length === Number(limit)
        }
    });
});
async function checkStoreAccess(userId, storeId, role) {
    if (role === 'OWNER')
        return true;
    const { prisma } = await import('../lib/prisma');
    const store = await prisma.store.findFirst({
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
//# sourceMappingURL=invitationController.js.map
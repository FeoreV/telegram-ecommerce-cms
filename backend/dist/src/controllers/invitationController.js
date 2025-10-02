"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeeActivity = exports.getInvitationInfo = exports.rejectInvitation = exports.acceptInvitation = void 0;
const employeeService_1 = require("../services/employeeService");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
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
    res.json({
        invitation: {
            id: invitation.id,
            role: invitation.role,
            message: invitation.message,
            expiresAt: invitation.expiresAt,
            store: invitation.store,
            inviter: invitation.inviter,
            permissions: invitation.permissions ? JSON.parse(invitation.permissions) : []
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
    const { prisma } = await Promise.resolve().then(() => __importStar(require('../lib/prisma')));
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
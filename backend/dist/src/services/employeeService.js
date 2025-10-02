"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
const notificationService_1 = require("./notificationService");
const crypto_1 = require("crypto");
const errorHandler_1 = require("../middleware/errorHandler");
class EmployeeService {
    static async sendInvitation(data) {
        const { storeId, email, firstName, lastName, role, permissions, message, invitedBy } = data;
        const existingInvitation = await prisma_1.prisma.employeeInvitation.findFirst({
            where: {
                storeId,
                user: { email },
                status: 'PENDING',
                expiresAt: {
                    gt: new Date()
                }
            }
        });
        if (existingInvitation) {
            throw new errorHandler_1.AppError('Активное приглашение уже существует для этого пользователя', 400);
        }
        let user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma_1.prisma.user.create({
                data: {
                    telegramId: `invite_${(0, crypto_1.randomBytes)(8).toString('hex')}`,
                    firstName,
                    lastName,
                    email,
                    role: 'CUSTOMER',
                    isActive: false
                }
            });
        }
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const invitation = await prisma_1.prisma.employeeInvitation.create({
            data: {
                storeId,
                userId: user.id,
                invitedBy,
                role,
                permissions: permissions ? JSON.stringify(permissions) : null,
                token,
                expiresAt,
                message: message || '',
                status: 'PENDING'
            },
            include: {
                store: {
                    select: {
                        name: true,
                        description: true
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
        await notificationService_1.NotificationService.sendNotification({
            type: notificationService_1.NotificationType.EMPLOYEE_INVITATION,
            priority: notificationService_1.NotificationPriority.HIGH,
            title: 'Приглашение в команду магазина',
            message: `Вас пригласили присоединиться к команде магазина "${invitation.store.name}" в роли ${role === 'ADMIN' ? 'администратора' : 'продавца'}`,
            channels: [notificationService_1.NotificationChannel.EMAIL],
            recipients: [user.id],
            storeId,
            data: {
                inviteToken: token,
                inviterName: `${invitation.inviter.firstName} ${invitation.inviter.lastName}`,
                storeName: invitation.store.name,
                role,
                message: message || '',
                acceptUrl: `${process.env.FRONTEND_URL}/invite/accept/${token}`,
                rejectUrl: `${process.env.FRONTEND_URL}/invite/reject/${token}`,
                expiresAt: expiresAt.toISOString()
            }
        });
        logger_1.logger.info('Employee invitation sent', {
            invitationId: invitation.id,
            email,
            role,
            storeId,
            invitedBy
        });
        return token;
    }
    static async acceptInvitation(token, telegramId) {
        const invitation = await prisma_1.prisma.employeeInvitation.findUnique({
            where: { token },
            include: {
                user: true,
                store: true,
                inviter: {
                    select: {
                        firstName: true,
                        lastName: true
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
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.employeeInvitation.update({
                where: { id: invitation.id },
                data: {
                    status: 'ACCEPTED',
                    acceptedAt: new Date()
                }
            });
            const updateData = {
                isActive: true,
                role: invitation.role
            };
            if (telegramId && invitation.user.telegramId.startsWith('invite_')) {
                updateData.telegramId = telegramId;
            }
            await tx.user.update({
                where: { id: invitation.userId },
                data: updateData
            });
            if (invitation.role === 'ADMIN') {
                await tx.storeAdmin.create({
                    data: {
                        userId: invitation.userId,
                        storeId: invitation.storeId,
                        assignedBy: invitation.invitedBy
                    }
                });
            }
            else if (invitation.role === 'VENDOR') {
                await tx.storeVendor.create({
                    data: {
                        userId: invitation.userId,
                        storeId: invitation.storeId,
                        assignedBy: invitation.invitedBy,
                        isActive: true,
                        permissions: invitation.permissions || JSON.stringify([])
                    }
                });
            }
            await tx.employeeActivity.create({
                data: {
                    userId: invitation.userId,
                    storeId: invitation.storeId,
                    action: 'INVITATION_ACCEPTED',
                    details: JSON.stringify({
                        invitationId: invitation.id,
                        role: invitation.role
                    })
                }
            });
        });
        await notificationService_1.NotificationService.sendNotification({
            type: notificationService_1.NotificationType.EMPLOYEE_JOINED,
            priority: notificationService_1.NotificationPriority.MEDIUM,
            title: 'Новый сотрудник присоединился',
            message: `${invitation.user.firstName} ${invitation.user.lastName} принял(а) приглашение и присоединился к команде`,
            channels: [notificationService_1.NotificationChannel.TELEGRAM, notificationService_1.NotificationChannel.EMAIL],
            recipients: [invitation.invitedBy],
            storeId: invitation.storeId,
            data: {
                employeeName: `${invitation.user.firstName} ${invitation.user.lastName}`,
                role: invitation.role
            }
        });
        logger_1.logger.info('Employee invitation accepted', {
            invitationId: invitation.id,
            userId: invitation.userId,
            storeId: invitation.storeId,
            role: invitation.role
        });
    }
    static async rejectInvitation(token, reason) {
        const invitation = await prisma_1.prisma.employeeInvitation.findUnique({
            where: { token },
            include: {
                user: true,
                store: true,
                inviter: {
                    select: {
                        firstName: true,
                        lastName: true
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
        await prisma_1.prisma.employeeInvitation.update({
            where: { id: invitation.id },
            data: {
                status: 'REJECTED',
                rejectedAt: new Date(),
                message: reason || invitation.message
            }
        });
        await notificationService_1.NotificationService.sendNotification({
            type: notificationService_1.NotificationType.EMPLOYEE_INVITATION_REJECTED,
            priority: notificationService_1.NotificationPriority.LOW,
            title: 'Приглашение отклонено',
            message: `${invitation.user.firstName} ${invitation.user.lastName} отклонил(а) приглашение присоединиться к команде`,
            channels: [notificationService_1.NotificationChannel.TELEGRAM, notificationService_1.NotificationChannel.EMAIL],
            recipients: [invitation.invitedBy],
            storeId: invitation.storeId,
            data: {
                employeeName: `${invitation.user.firstName} ${invitation.user.lastName}`,
                reason: reason || 'Не указана'
            }
        });
        logger_1.logger.info('Employee invitation rejected', {
            invitationId: invitation.id,
            userId: invitation.userId,
            storeId: invitation.storeId,
            reason
        });
    }
    static async getEmployeeActivity(storeId, userId, limit = 50, offset = 0) {
        const whereClause = { storeId };
        if (userId) {
            whereClause.userId = userId;
        }
        return await prisma_1.prisma.employeeActivity.findMany({
            where: whereClause,
            include: {
                user: {
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
            skip: offset,
            take: limit
        });
    }
    static async logActivity(userId, storeId, action, details, ipAddress, userAgent) {
        await prisma_1.prisma.employeeActivity.create({
            data: {
                userId,
                storeId,
                action,
                details: details ? JSON.stringify(details) : null,
                ipAddress,
                userAgent
            }
        });
    }
    static async cleanupExpiredInvitations() {
        const result = await prisma_1.prisma.employeeInvitation.updateMany({
            where: {
                status: 'PENDING',
                expiresAt: {
                    lt: new Date()
                }
            },
            data: {
                status: 'EXPIRED'
            }
        });
        if (result.count > 0) {
            logger_1.logger.info(`Cleaned up ${result.count} expired employee invitations`);
        }
        return result.count;
    }
}
exports.EmployeeService = EmployeeService;
//# sourceMappingURL=employeeService.js.map
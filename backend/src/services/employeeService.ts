import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { NotificationService, NotificationPriority, NotificationType, NotificationChannel } from './notificationService';
import { randomBytes } from 'crypto';
import { AppError } from '../middleware/errorHandler';

export interface InvitationData {
  storeId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'VENDOR';
  permissions?: string[];
  message?: string;
  invitedBy: string;
}

export class EmployeeService {
  
  /**
   * Отправка приглашения сотруднику
   */
  static async sendInvitation(data: InvitationData): Promise<string> {
    const { storeId, email, firstName, lastName, role, permissions, message, invitedBy } = data;
    
    // Проверяем, не существует ли уже активное приглашение
    const existingInvitation = await prisma.employeeInvitation.findFirst({
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
      throw new AppError('Активное приглашение уже существует для этого пользователя', 400);
    }

    // Получаем или создаем пользователя
    let user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      // Создаем временного пользователя
      user = await prisma.user.create({
        data: {
          telegramId: `invite_${randomBytes(8).toString('hex')}`,
          firstName,
          lastName,
          email,
          role: 'CUSTOMER', // Временная роль
          isActive: false
        }
      });
    }

    // Создаем токен приглашения
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней

    // Создаем приглашение
    const invitation = await prisma.employeeInvitation.create({
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

    // Отправляем email с приглашением
    await NotificationService.sendNotification({
      type: NotificationType.EMPLOYEE_INVITATION,
      priority: NotificationPriority.HIGH,
      title: 'Приглашение в команду магазина',
      message: `Вас пригласили присоединиться к команде магазина "${invitation.store.name}" в роли ${role === 'ADMIN' ? 'администратора' : 'продавца'}`,
      channels: [NotificationChannel.EMAIL],
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

    logger.info('Employee invitation sent', {
      invitationId: invitation.id,
      email,
      role,
      storeId,
      invitedBy
    });

    return token;
  }

  /**
   * Принятие приглашения
   */
  static async acceptInvitation(token: string, telegramId?: string): Promise<void> {
    const invitation = await prisma.employeeInvitation.findUnique({
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
      throw new AppError('Приглашение не найдено', 404);
    }

    if (invitation.status !== 'PENDING') {
      throw new AppError('Приглашение уже обработано', 400);
    }

    if (invitation.expiresAt < new Date()) {
      throw new AppError('Срок действия приглашения истек', 400);
    }

    await prisma.$transaction(async (tx) => {
      // Обновляем статус приглашения
      await tx.employeeInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date()
        }
      });

      // Активируем пользователя и обновляем Telegram ID
      const updateData: { isActive: boolean; role: string; telegramId?: string } = {
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

      // Создаем назначение в магазин
      if (invitation.role === 'ADMIN') {
        await tx.storeAdmin.create({
          data: {
            userId: invitation.userId,
            storeId: invitation.storeId,
            assignedBy: invitation.invitedBy
          }
        });
      } else if (invitation.role === 'VENDOR') {
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

      // Логируем действие
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

    // Уведомляем пригласившего
    await NotificationService.sendNotification({
      type: NotificationType.EMPLOYEE_JOINED,
      priority: NotificationPriority.MEDIUM,
      title: 'Новый сотрудник присоединился',
      message: `${invitation.user.firstName} ${invitation.user.lastName} принял(а) приглашение и присоединился к команде`,
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL],
      recipients: [invitation.invitedBy],
      storeId: invitation.storeId,
      data: {
        employeeName: `${invitation.user.firstName} ${invitation.user.lastName}`,
        role: invitation.role
      }
    });

    logger.info('Employee invitation accepted', {
      invitationId: invitation.id,
      userId: invitation.userId,
      storeId: invitation.storeId,
      role: invitation.role
    });
  }

  /**
   * Отклонение приглашения
   */
  static async rejectInvitation(token: string, reason?: string): Promise<void> {
    const invitation = await prisma.employeeInvitation.findUnique({
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
      throw new AppError('Приглашение не найдено', 404);
    }

    if (invitation.status !== 'PENDING') {
      throw new AppError('Приглашение уже обработано', 400);
    }

    await prisma.employeeInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        message: reason || invitation.message
      }
    });

    // Уведомляем пригласившего
    await NotificationService.sendNotification({
      type: NotificationType.EMPLOYEE_INVITATION_REJECTED,
      priority: NotificationPriority.LOW,
      title: 'Приглашение отклонено',
      message: `${invitation.user.firstName} ${invitation.user.lastName} отклонил(а) приглашение присоединиться к команде`,
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL],
      recipients: [invitation.invitedBy],
      storeId: invitation.storeId,
      data: {
        employeeName: `${invitation.user.firstName} ${invitation.user.lastName}`,
        reason: reason || 'Не указана'
      }
    });

    logger.info('Employee invitation rejected', {
      invitationId: invitation.id,
      userId: invitation.userId,
      storeId: invitation.storeId,
      reason
    });
  }

  /**
   * Получение активности сотрудника
   */
  static async getEmployeeActivity(
    storeId: string,
    userId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<unknown[]> {
    const whereClause: { storeId: string; userId?: string } = { storeId };
    
    if (userId) {
      whereClause.userId = userId;
    }

    return await prisma.employeeActivity.findMany({
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

  /**
   * Логирование активности сотрудника
   */
  static async logActivity(
    userId: string,
    storeId: string,
    action: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await prisma.employeeActivity.create({
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

  /**
   * Очистка истекших приглашений
   */
  static async cleanupExpiredInvitations(): Promise<number> {
    const result = await prisma.employeeInvitation.updateMany({
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
      logger.info(`Cleaned up ${result.count} expired employee invitations`);
    }

    return result.count;
  }
}

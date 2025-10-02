import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { EmployeeService } from '../services/employeeService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const AcceptInvitationSchema = z.object({
  token: z.string().min(1, 'Токен приглашения обязателен'),
  telegramId: z.string().optional()
});

const RejectInvitationSchema = z.object({
  token: z.string().min(1, 'Токен приглашения обязателен'),
  reason: z.string().max(500, 'Причина не должна превышать 500 символов').optional()
});

/**
 * Принять приглашение
 */
export const acceptInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { token, telegramId } = AcceptInvitationSchema.parse(req.body);

  try {
    await EmployeeService.acceptInvitation(token, telegramId);
    
    res.json({
      success: true,
      message: 'Приглашение принято! Добро пожаловать в команду!'
    });
  } catch (error) {
    logger.error('Failed to accept invitation:', error);
    throw error;
  }
});

/**
 * Отклонить приглашение
 */
export const rejectInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { token, reason } = RejectInvitationSchema.parse(req.body);

  try {
    await EmployeeService.rejectInvitation(token, reason);
    
    res.json({
      success: true,
      message: 'Приглашение отклонено'
    });
  } catch (error) {
    logger.error('Failed to reject invitation:', error);
    throw error;
  }
});

/**
 * Получить информацию о приглашении по токену
 */
export const getInvitationInfo = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { token } = req.params;

  const invitation = await prisma.employeeInvitation.findUnique({
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
    throw new AppError('Приглашение не найдено', 404);
  }

  if (invitation.status !== 'PENDING') {
    throw new AppError('Приглашение уже обработано', 400);
  }

  if (invitation.expiresAt < new Date()) {
    throw new AppError('Срок действия приглашения истек', 400);
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

/**
 * Получить активность сотрудников
 */
export const getEmployeeActivity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;
  const { userId, limit = 50, offset = 0 } = req.query;

  // Проверка доступа к магазину
  const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этому магазину', 403);
  }

  const activities = await EmployeeService.getEmployeeActivity(
    storeId,
    userId as string | undefined,
    Number(limit),
    Number(offset)
  );

  res.json({
    activities,
    pagination: {
      limit: Number(limit),
      offset: Number(offset),
      hasMore: activities.length === Number(limit)
    }
  });
});

// Вспомогательная функция для проверки доступа к магазину
async function checkStoreAccess(userId: string, storeId: string, role: string): Promise<boolean> {
  if (role === 'OWNER') return true;

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

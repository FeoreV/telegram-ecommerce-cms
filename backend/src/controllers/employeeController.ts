import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  EmployeeInviteSchema,
  UpdateEmployeeRoleSchema,
  EmployeeSearchSchema
} from '../schemas/employeeSchemas';
import { NotificationService, NotificationPriority, NotificationType, NotificationChannel } from '../services/notificationService';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';

/**
 * Получить список сотрудников магазина
 */
export const getStoreEmployees = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;
  const searchParams = EmployeeSearchSchema.parse(req.query);

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Проверка прав доступа к магазину
  const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этому магазину', 403);
  }

  const { page, limit, search, role, status } = searchParams;
  const skip = (page - 1) * limit;

  // Построение условий поиска
  const employeeWhere: Prisma.StoreAdminWhereInput & Prisma.StoreVendorWhereInput = {};
  
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

  // Получение администраторов и продавцов
  const [admins, vendors, totalAdmins, totalVendors] = await Promise.all([
    // Администраторы
    role === 'ALL' || role === 'ADMIN' 
      ? prisma.storeAdmin.findMany({
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

    // Продавцы
    role === 'ALL' || role === 'VENDOR'
      ? prisma.storeVendor.findMany({
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

    // Счетчики
    role === 'ALL' || role === 'ADMIN'
      ? prisma.storeAdmin.count({ where: { storeId, ...employeeWhere } })
      : 0,
    
    role === 'ALL' || role === 'VENDOR'
      ? prisma.storeVendor.count({ 
          where: { 
            storeId, 
            ...(status !== 'ALL' && { isActive: status === 'ACTIVE' }),
            ...employeeWhere 
          } 
        })
      : 0
  ]);

  // Форматирование данных
  const employees = [
    ...admins.map(admin => ({
      id: admin.user.id,
      role: 'ADMIN' as const,
      assignmentId: admin.id,
      user: admin.user,
      assignedBy: admin.assignedByUser,
      assignedAt: admin.createdAt,
      isActive: admin.user.isActive,
      permissions: [] // Админы имеют все права
    })),
    ...vendors.map(vendor => ({
      id: vendor.user.id,
      role: 'VENDOR' as const,
      assignmentId: vendor.id,
      user: vendor.user,
      assignedAt: vendor.createdAt,
      isActive: vendor.isActive && vendor.user.isActive,
      permissions: vendor.permissions ? JSON.parse(vendor.permissions) as string[] : []
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

/**
 * Пригласить нового сотрудника
 */
export const inviteEmployee = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const inviteData = EmployeeInviteSchema.parse(req.body);
  const { email, firstName, lastName, role, customRoleId, storeId, permissions, message } = inviteData;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Проверка доступа к магазину
  const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этому магазину', 403);
  }

  // Проверяем, существует ли пользователь
  let user = await prisma.user.findUnique({
    where: { email }
  });

  const inviteToken = randomBytes(32).toString('hex');
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней

  await prisma.$transaction(async (tx) => {
    // Если пользователь не существует, создаем его
    if (!user) {
      user = await tx.user.create({
        data: {
          telegramId: `temp_${randomBytes(8).toString('hex')}`, // Временный ID
          firstName,
          lastName,
          email,
          role: 'CUSTOMER', // Временная роль до принятия приглашения
          isActive: false
        }
      });
    }

        // Создаем приглашение
        await tx.employeeInvitation.create({
          data: {
            id: randomBytes(12).toString('hex'),
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

    // Отправляем уведомление
    await NotificationService.sendNotification({
      type: NotificationType.EMPLOYEE_INVITATION,
      priority: NotificationPriority.HIGH,
          title: 'Приглашение в команду',
          message: customRoleId 
            ? `Вас пригласили работать в роли ${await getCustomRoleName(customRoleId)}` 
            : `Вас пригласили работать в роли ${role === 'ADMIN' ? 'администратора' : 'продавца'}`,
      channels: [NotificationChannel.EMAIL],
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

  logger.info(`Employee invited: ${email} as ${role} to store ${storeId} by ${req.user.id}`);

  res.status(201).json({
    success: true,
    message: 'Приглашение отправлено',
    inviteToken // Для тестирования, в продакшене не отдаем
  });
});

/**
 * Обновить роль сотрудника
 */
export const updateEmployeeRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const updateData = UpdateEmployeeRoleSchema.parse(req.body);
  const { userId, storeId, role, permissions, isActive } = updateData;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этому магазину', 403);
  }

  // Только владелец и администраторы могут менять роли
  if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
    throw new AppError('Недостаточно прав для изменения ролей', 403);
  }

  await prisma.$transaction(async (tx) => {
    // Удаляем старые назначения
    await tx.storeAdmin.deleteMany({
      where: { userId, storeId }
    });
    await tx.storeVendor.deleteMany({
      where: { userId, storeId }
    });

    // Создаем новое назначение
    if (role === 'ADMIN') {
      await tx.storeAdmin.create({
        data: {
          userId,
          storeId,
          assignedBy: req.user.id
        }
      });
    } else {
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

    // Обновляем статус пользователя если необходимо
    if (isActive !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: { isActive }
      });
    }

    // Логируем действие
    await tx.adminLog.create({
      data: {
        action: 'EMPLOYEE_ROLE_UPDATED',
        details: JSON.stringify({ userId, storeId, role, permissions, isActive }),
        adminId: req.user.id
      }
    });
  });

  logger.info(`Employee role updated: user ${userId} -> ${role} in store ${storeId} by ${req.user.id}`);

  res.json({
    success: true,
    message: 'Роль сотрудника обновлена'
  });
});

/**
 * Удалить сотрудника из магазина
 */
export const removeEmployee = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId, userId } = req.params;
  const { reason } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этому магазину', 403);
  }

  await prisma.$transaction(async (tx) => {
    // Удаляем назначения
    await tx.storeAdmin.deleteMany({
      where: { userId, storeId }
    });
    await tx.storeVendor.deleteMany({
      where: { userId, storeId }
    });

    // Логируем действие
    await tx.adminLog.create({
      data: {
        action: 'EMPLOYEE_REMOVED',
        details: JSON.stringify({ userId, storeId, reason }),
        adminId: req.user.id
      }
    });
  });

  // Уведомляем сотрудника
  await NotificationService.sendNotification({
    type: NotificationType.EMPLOYEE_REMOVED,
    priority: NotificationPriority.MEDIUM,
    title: 'Изменение в команде',
    message: 'Ваш доступ к магазину был отозван',
    channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL],
    recipients: [userId],
    storeId,
    data: { reason }
  });

  res.json({
    success: true,
    message: 'Сотрудник удален из команды'
  });
});

// Вспомогательные функции
async function checkStoreAccess(userId: string, storeId: string, role: string): Promise<boolean> {
  if (role === 'OWNER') return true;

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

async function getStoreName(storeId: string): Promise<string> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true }
  });
  return store?.name || 'Магазин';
}

async function getCustomRoleName(customRoleId: string): Promise<string> {
  const customRole = await prisma.customRole.findUnique({
    where: { id: customRoleId },
    select: { name: true }
  });
  return customRole?.name || 'Кастомная роль';
}

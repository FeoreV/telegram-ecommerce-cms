import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/loggerEnhanced';
import {
  CreateCustomRoleSchema,
  UpdateCustomRoleSchema,
  CustomRoleSearchSchema,
  AssignCustomRoleSchema,
  AVAILABLE_PERMISSIONS
} from '../schemas/customRoleSchemas';
import { Prisma } from '@prisma/client';

/**
 * Создать кастомную роль
 */
export const createCustomRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  const data = CreateCustomRoleSchema.parse(req.body);
  const { storeId, name, description, permissions, color, icon } = data;

  // Проверка доступа к магазину
  const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этому магазину', 403);
  }

  // Проверяем, что роль с таким именем не существует
  const existingRole = await prisma.customRole.findFirst({
    where: {
      storeId,
      name,
      isActive: true
    }
  });

  if (existingRole) {
    throw new AppError('Роль с таким именем уже существует', 400);
  }

  // Валидируем разрешения
  const validPermissions = AVAILABLE_PERMISSIONS.map(p => p.value);
  const invalidPermissions: string[] = permissions.filter((p): p is typeof validPermissions[number] => !validPermissions.includes(p as any));
  
  if (invalidPermissions.length > 0) {
    throw new AppError(`Недопустимые разрешения: ${invalidPermissions.join(', ')}`, 400);
  }

  const customRole = await prisma.customRole.create({
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

  logger.info('Custom role created', {
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

/**
 * Получить список кастомных ролей
 */
export const getCustomRoles = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  const searchParams = CustomRoleSearchSchema.parse(req.query);
  const { storeId, search, isActive, page, limit } = searchParams;

  // Проверка доступа к магазину
  const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этому магазину', 403);
  }

  const whereClause: Prisma.CustomRoleWhereInput = { storeId };

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
    prisma.customRole.findMany({
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
    prisma.customRole.count({ where: whereClause })
  ]);

  // Форматируем данные
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

/**
 * Получить кастомную роль по ID
 */
export const getCustomRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const customRole = await prisma.customRole.findUnique({
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
    throw new AppError('Кастомная роль не найдена', 404);
  }

  // Проверка доступа
  const hasAccess = await checkStoreAccess(req.user.id, customRole.storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этой роли', 403);
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

/**
 * Обновить кастомную роль
 */
export const updateCustomRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = UpdateCustomRoleSchema.parse(req.body);
  const { id, name, description, permissions, color, icon, isActive } = data;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const customRole = await prisma.customRole.findUnique({
    where: { id }
  });

  if (!customRole) {
    throw new AppError('Кастомная роль не найдена', 404);
  }

  // Проверка доступа
  const hasAccess = await checkStoreAccess(req.user.id, customRole.storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этой роли', 403);
  }

  // Проверяем уникальность имени (если оно изменяется)
  if (name && name !== customRole.name) {
    const existingRole = await prisma.customRole.findFirst({
      where: {
        storeId: customRole.storeId,
        name,
        isActive: true,
        id: { not: id }
      }
    });

    if (existingRole) {
      throw new AppError('Роль с таким именем уже существует', 400);
    }
  }

  // Валидируем разрешения
  if (permissions) {
    const validPermissions = AVAILABLE_PERMISSIONS.map(p => p.value);
    const invalidPermissions: string[] = permissions.filter((p): p is typeof validPermissions[number] => !validPermissions.includes(p as any));
    
    if (invalidPermissions.length > 0) {
      throw new AppError(`Недопустимые разрешения: ${invalidPermissions.join(', ')}`, 400);
    }
  }

  const updateData: Prisma.CustomRoleUpdateInput = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (permissions !== undefined) updateData.permissions = JSON.stringify(permissions);
  if (color !== undefined) updateData.color = color;
  if (icon !== undefined) updateData.icon = icon;
  if (isActive !== undefined) updateData.isActive = isActive;

  const updatedRole = await prisma.customRole.update({
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

  logger.info('Custom role updated', {
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

/**
 * Удалить кастомную роль
 */
export const deleteCustomRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const customRole = await prisma.customRole.findUnique({
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
    throw new AppError('Кастомная роль не найдена', 404);
  }

  // Проверка доступа
  const hasAccess = await checkStoreAccess(req.user.id, customRole.storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этой роли', 403);
  }

  // Проверяем, что роль не используется
  if (customRole._count.vendors > 0) {
    throw new AppError('Нельзя удалить роль, которая используется сотрудниками', 400);
  }

  await prisma.customRole.delete({
    where: { id }
  });

  logger.info('Custom role deleted', {
    customRoleId: id,
    deletedBy: req.user.id
  });

  res.json({
    success: true,
    message: 'Кастомная роль удалена'
  });
});

/**
 * Назначить кастомную роль пользователю
 */
export const assignCustomRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = AssignCustomRoleSchema.parse(req.body);
  const { userId, storeId, customRoleId } = data;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Проверка доступа к магазину
  const hasAccess = await checkStoreAccess(req.user.id, storeId, req.user.role);
  if (!hasAccess) {
    throw new AppError('Нет доступа к этому магазину', 403);
  }

  // Проверяем, что роль существует и принадлежит магазину
  const customRole = await prisma.customRole.findFirst({
    where: {
      id: customRoleId,
      storeId,
      isActive: true
    }
  });

  if (!customRole) {
    throw new AppError('Кастомная роль не найдена', 404);
  }

  // Проверяем, что пользователь существует
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new AppError('Пользователь не найден', 404);
  }

  await prisma.$transaction(async (tx) => {
    // Обновляем или создаем назначение продавца
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
        permissions: null // Очищаем legacy permissions
      }
    });

    // Логируем действие
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

  logger.info('Custom role assigned', {
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

/**
 * Получить доступные разрешения
 */
export const getAvailablePermissions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    permissions: AVAILABLE_PERMISSIONS,
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

// Вспомогательная функция
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

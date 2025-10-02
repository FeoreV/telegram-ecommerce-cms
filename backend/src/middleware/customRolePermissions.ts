import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from './auth';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * Middleware для проверки разрешений с учетом кастомных ролей
 */
export const requireCustomPermission = (permission: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError('Пользователь не аутентифицирован', 401);
      }

      // Владелец имеет все разрешения
      if (user.role === 'OWNER') {
        return next();
      }

      // Получаем storeId из параметров запроса или тела
      const storeId = req.params.storeId || req.body.storeId || req.query.storeId;
      
      if (!storeId) {
        throw new AppError('Не указан ID магазина', 400);
      }

      // Проверяем разрешения пользователя в данном магазине
      const hasPermission = await checkUserPermission(user.id, storeId, permission);
      
      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId: user.id,
          storeId,
          permission,
          userRole: user.role
        });
        throw new AppError('Недостаточно прав для выполнения этого действия', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Проверяет есть ли у пользователя определенное разрешение в магазине
 */
export async function checkUserPermission(
  userId: string, 
  storeId: string, 
  permission: string
): Promise<boolean> {
  try {
    // Проверяем, является ли пользователь владельцем магазина
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        ownerId: userId
      }
    });

    if (store) {
      return true; // Владелец имеет все разрешения
    }

    // Проверяем роль администратора
    const adminRole = await prisma.storeAdmin.findFirst({
      where: {
        storeId,
        userId,
      }
    });

    if (adminRole) {
      // Администраторы имеют большинство разрешений
      const adminPermissions = [
        'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW',
        'ORDER_VIEW', 'ORDER_UPDATE', 'ORDER_CONFIRM', 'ORDER_REJECT',
        'INVENTORY_VIEW', 'INVENTORY_UPDATE',
        'ANALYTICS_VIEW', 'ANALYTICS_EXPORT',
        'USER_VIEW', 'USER_UPDATE', 'USER_CREATE',
        'NOTIFICATION_SEND'
      ];
      
      return adminPermissions.includes(permission);
    }

    // Проверяем роль продавца с кастомной ролью
    const vendorRole = await prisma.storeVendor.findFirst({
      where: {
        storeId,
        userId,
      },
      include: {
        customRole: true
      }
    });

    if (vendorRole) {
      // Если есть кастомная роль, проверяем её разрешения
      if (vendorRole.customRole) {
        const rolePermissions = JSON.parse(vendorRole.customRole.permissions) as string[];
        return rolePermissions.includes(permission);
      }

      // Если нет кастомной роли, проверяем legacy разрешения
      if (vendorRole.permissions) {
        const legacyPermissions = JSON.parse(vendorRole.permissions) as string[];
        return legacyPermissions.includes(permission);
      }
    }

    return false;
  } catch (error) {
    logger.error('Error checking user permission:', error);
    return false;
  }
}

/**
 * Получить все разрешения пользователя в магазине
 */
export async function getUserPermissions(
  userId: string, 
  storeId: string
): Promise<string[]> {
  try {
    // Проверяем, является ли пользователь владельцем магазина
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        ownerId: userId
      }
    });

    if (store) {
      // Владелец имеет все разрешения
      return [
        'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW',
        'ORDER_VIEW', 'ORDER_UPDATE', 'ORDER_CONFIRM', 'ORDER_REJECT', 'ORDER_DELETE',
        'INVENTORY_VIEW', 'INVENTORY_UPDATE',
        'ANALYTICS_VIEW', 'ANALYTICS_EXPORT',
        'USER_VIEW', 'USER_UPDATE', 'USER_CREATE', 'USER_DELETE',
        'STORE_VIEW', 'STORE_UPDATE',
        'NOTIFICATION_SEND',
        'BOT_MANAGE', 'BOT_CONFIG'
      ];
    }

    // Проверяем роль администратора
    const adminRole = await prisma.storeAdmin.findFirst({
      where: {
        storeId,
        userId,
      }
    });

    if (adminRole) {
      return [
        'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW',
        'ORDER_VIEW', 'ORDER_UPDATE', 'ORDER_CONFIRM', 'ORDER_REJECT',
        'INVENTORY_VIEW', 'INVENTORY_UPDATE',
        'ANALYTICS_VIEW', 'ANALYTICS_EXPORT',
        'USER_VIEW', 'USER_UPDATE', 'USER_CREATE',
        'NOTIFICATION_SEND',
        'BOT_MANAGE'
      ];
    }

    // Проверяем роль продавца
    const vendorRole = await prisma.storeVendor.findFirst({
      where: {
        storeId,
        userId,
      },
      include: {
        customRole: true
      }
    });

    if (vendorRole) {
      // Если есть кастомная роль, возвращаем её разрешения
      if (vendorRole.customRole) {
        return JSON.parse(vendorRole.customRole.permissions) as string[];
      }

      // Если нет кастомной роли, возвращаем legacy разрешения
      if (vendorRole.permissions) {
        return JSON.parse(vendorRole.permissions) as string[];
      }
    }

    return [];
  } catch (error) {
    logger.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Получить роль пользователя в магазине
 */
export async function getUserRole(
  userId: string, 
  storeId: string
): Promise<{
  type: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOM' | null;
  customRole?: {
    id: string;
    name: string;
    color: string;
    icon?: string;
  };
}> {
  try {
    // Проверяем, является ли пользователь владельцем магазина
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        ownerId: userId
      }
    });

    if (store) {
      return { type: 'OWNER' };
    }

    // Проверяем роль администратора
    const adminRole = await prisma.storeAdmin.findFirst({
      where: {
        storeId,
        userId,
      }
    });

    if (adminRole) {
      return { type: 'ADMIN' };
    }

    // Проверяем роль продавца
    const vendorRole = await prisma.storeVendor.findFirst({
      where: {
        storeId,
        userId,
      },
      include: {
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

    if (vendorRole) {
      if (vendorRole.customRole) {
        return { 
          type: 'CUSTOM', 
          customRole: vendorRole.customRole 
        };
      }
      return { type: 'VENDOR' };
    }

    return { type: null };
  } catch (error) {
    logger.error('Error getting user role:', error);
    return { type: null };
  }
}

/**
 * Middleware для получения информации о пользователе с разрешениями
 */
export const enrichUserWithPermissions = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const user = req.user;
    if (!user) {
      return next();
    }

    const storeId = req.params.storeId || req.body.storeId || req.query.storeId;
    
    if (storeId) {
      const [permissions, role] = await Promise.all([
        getUserPermissions(user.id, storeId),
        getUserRole(user.id, storeId)
      ]);

      req.userPermissions = permissions;
      req.userRole = role;
    }

    next();
  } catch (error) {
    logger.error('Error enriching user with permissions:', error);
    next();
  }
};

// Расширяем типы для TypeScript
declare module 'express-serve-static-core' {
    interface Request {
      userPermissions?: string[];
      userRole?: {
        type: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOM' | null;
        customRole?: {
          id: string;
          name: string;
          color: string;
          icon?: string;
        };
      };
    }
}

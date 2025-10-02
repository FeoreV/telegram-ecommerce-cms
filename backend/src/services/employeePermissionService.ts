import { prisma } from '../lib/prisma';
import { Permission } from '../auth/RolePermissionManager';
import { logger } from '../utils/logger';

export interface EmployeePermissionCheck {
  userId: string;
  storeId: string;
  permission: Permission;
}

export interface EmployeeStoreRole {
  userId: string;
  storeId: string;
  role: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOMER';
  permissions: Permission[];
  isActive: boolean;
}

/**
 * Сервис для управления правами доступа сотрудников в контексте магазинов
 */
export class EmployeePermissionService {
  
  /**
   * Получить роль и права пользователя в конкретном магазине
   */
  static async getUserStoreRole(userId: string, storeId: string): Promise<EmployeeStoreRole | null> {
    try {
      // Проверяем, является ли пользователь владельцем магазина
      const store = await prisma.store.findFirst({
        where: {
          id: storeId,
          ownerId: userId
        }
      });

      if (store) {
        return {
          userId,
          storeId,
          role: 'OWNER',
          permissions: Object.values(Permission), // Владелец имеет все права
          isActive: true
        };
      }

      // Проверяем, является ли пользователь администратором магазина
      const adminAssignment = await prisma.storeAdmin.findFirst({
        where: {
          userId,
          storeId
        },
        include: {
          user: {
            select: {
              isActive: true
            }
          }
        }
      });

      if (adminAssignment) {
        return {
          userId,
          storeId,
          role: 'ADMIN',
          permissions: [
            Permission.STORE_VIEW,
            Permission.STORE_UPDATE,
            Permission.STORE_MANAGE,
            Permission.PRODUCT_CREATE,
            Permission.PRODUCT_UPDATE,
            Permission.PRODUCT_DELETE,
            Permission.PRODUCT_VIEW,
            Permission.PRODUCT_MANAGE,
            Permission.ORDER_VIEW,
            Permission.ORDER_UPDATE,
            Permission.ORDER_CONFIRM,
            Permission.ORDER_REJECT,
            Permission.ORDER_MANAGE,
            Permission.USER_VIEW,
            Permission.USER_UPDATE,
            Permission.ANALYTICS_VIEW,
            Permission.ANALYTICS_EXPORT,
            Permission.INVENTORY_VIEW,
            Permission.INVENTORY_UPDATE,
            Permission.NOTIFICATION_SEND,
            Permission.ADMINJS_ACCESS,
            Permission.ADMIN_PANEL_ACCESS
          ],
          isActive: adminAssignment.user.isActive
        };
      }

      // Проверяем, является ли пользователь продавцом в магазине
      const vendorAssignment = await prisma.storeVendor.findFirst({
        where: {
          userId,
          storeId
        },
        include: {
          user: {
            select: {
              isActive: true
            }
          }
        }
      });

      if (vendorAssignment) {
        const customPermissions = vendorAssignment.permissions 
          ? JSON.parse(vendorAssignment.permissions) as string[]
          : [];

        // Базовые права продавца + кастомные права
        const baseVendorPermissions = [
          Permission.PRODUCT_CREATE,
          Permission.PRODUCT_UPDATE,
          Permission.PRODUCT_VIEW,
          Permission.ORDER_VIEW,
          Permission.ORDER_UPDATE,
          Permission.ANALYTICS_VIEW,
          Permission.INVENTORY_VIEW,
          Permission.INVENTORY_UPDATE,
          Permission.STORE_VIEW
        ];

        const allPermissions = [...new Set([
          ...baseVendorPermissions,
          ...customPermissions.filter(p => Object.values(Permission).includes(p as Permission))
        ])];

        return {
          userId,
          storeId,
          role: 'VENDOR',
          permissions: allPermissions as Permission[],
          isActive: vendorAssignment.isActive && vendorAssignment.user.isActive
        };
      }

      // Обычный клиент или нет доступа к магазину
      return {
        userId,
        storeId,
        role: 'CUSTOMER',
        permissions: [Permission.ORDER_VIEW], // Только просмотр своих заказов
        isActive: true
      };

    } catch (error) {
      logger.error('Error getting user store role:', { userId, storeId, error });
      return null;
    }
  }

  /**
   * Проверить, есть ли у пользователя определенное право в магазине
   */
  static async checkPermission(check: EmployeePermissionCheck): Promise<boolean> {
    try {
      const storeRole = await this.getUserStoreRole(check.userId, check.storeId);
      
      if (!storeRole || !storeRole.isActive) {
        return false;
      }

      return storeRole.permissions.includes(check.permission);
    } catch (error) {
      logger.error('Error checking permission:', { check, error });
      return false;
    }
  }

  /**
   * Получить все магазины пользователя с его ролями
   */
  static async getUserStores(userId: string): Promise<Array<{
    store: { id: string; name: string; description?: string };
    role: string;
    permissions: Permission[];
    isActive: boolean;
  }>> {
    try {
      const stores = [];

      // Собственные магазины
      const ownedStores = await prisma.store.findMany({
        where: {
          ownerId: userId
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true
        }
      });

      for (const store of ownedStores) {
        stores.push({
          store,
          role: 'OWNER',
          permissions: Object.values(Permission),
          isActive: true
        });
      }

      // Магазины где пользователь админ
      const adminStores = await prisma.storeAdmin.findMany({
        where: {
          userId
        },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              createdAt: true
            }
          },
          user: {
            select: {
              isActive: true
            }
          }
        }
      });

      for (const assignment of adminStores) {
        stores.push({
          store: assignment.store,
          role: 'ADMIN',
          permissions: [
            Permission.STORE_VIEW,
            Permission.STORE_UPDATE,
            Permission.PRODUCT_CREATE,
            Permission.PRODUCT_UPDATE,
            Permission.PRODUCT_DELETE,
            Permission.PRODUCT_VIEW,
            Permission.ORDER_VIEW,
            Permission.ORDER_UPDATE,
            Permission.ORDER_CONFIRM,
            Permission.ORDER_REJECT,
            Permission.USER_VIEW,
            Permission.USER_UPDATE,
            Permission.ANALYTICS_VIEW,
            Permission.INVENTORY_VIEW,
            Permission.INVENTORY_UPDATE,
            Permission.ADMINJS_ACCESS
          ],
          isActive: assignment.user.isActive
        });
      }

      // Магазины где пользователь продавец
      const vendorStores = await prisma.storeVendor.findMany({
        where: {
          userId
        },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              createdAt: true
            }
          },
          user: {
            select: {
              isActive: true
            }
          }
        }
      });

      for (const assignment of vendorStores) {
        const customPermissions = assignment.permissions 
          ? JSON.parse(assignment.permissions) as string[]
          : [];

        const permissions = [
          Permission.PRODUCT_CREATE,
          Permission.PRODUCT_UPDATE,
          Permission.PRODUCT_VIEW,
          Permission.ORDER_VIEW,
          Permission.ORDER_UPDATE,
          Permission.ANALYTICS_VIEW,
          Permission.INVENTORY_VIEW,
          Permission.INVENTORY_UPDATE,
          Permission.STORE_VIEW,
          ...customPermissions.filter(p => Object.values(Permission).includes(p as Permission))
        ];

        stores.push({
          store: assignment.store,
          role: 'VENDOR',
          permissions: [...new Set(permissions)] as Permission[],
          isActive: assignment.isActive && assignment.user.isActive
        });
      }

      return stores;

    } catch (error) {
      logger.error('Error getting user stores:', { userId, error });
      return [];
    }
  }

  /**
   * Обновить права продавца в магазине
   */
  static async updateVendorPermissions(
    userId: string, 
    storeId: string, 
    permissions: Permission[]
  ): Promise<boolean> {
    try {
      await prisma.storeVendor.updateMany({
        where: {
          userId,
          storeId
        },
        data: {
          permissions: JSON.stringify(permissions)
        }
      });

      logger.info('Vendor permissions updated', {
        userId,
        storeId,
        permissions
      });

      return true;
    } catch (error) {
      logger.error('Error updating vendor permissions:', { userId, storeId, permissions, error });
      return false;
    }
  }

  /**
   * Проверить, может ли пользователь управлять другим пользователем в магазине
   */
  static async canManageUser(
    managerId: string, 
    targetUserId: string, 
    storeId: string
  ): Promise<boolean> {
    try {
      const managerRole = await this.getUserStoreRole(managerId, storeId);
      const targetRole = await this.getUserStoreRole(targetUserId, storeId);

      if (!managerRole || !targetRole) {
        return false;
      }

      // Иерархия: OWNER > ADMIN > VENDOR > CUSTOMER
      const roleHierarchy = {
        'OWNER': 4,
        'ADMIN': 3,
        'VENDOR': 2,
        'CUSTOMER': 1
      };

      return roleHierarchy[managerRole.role] > roleHierarchy[targetRole.role];
    } catch (error) {
      logger.error('Error checking user management permission:', { 
        managerId, 
        targetUserId, 
        storeId, 
        error 
      });
      return false;
    }
  }

  /**
   * Получить статистику прав доступа по магазину
   */
  static async getStorePermissionStats(storeId: string): Promise<{
    totalEmployees: number;
    activeEmployees: number;
    adminCount: number;
    vendorCount: number;
    recentActivity: number;
  }> {
    try {
      const [adminCount, vendorCount, recentActivityCount] = await Promise.all([
        prisma.storeAdmin.count({
          where: {
            storeId,
            user: { isActive: true }
          }
        }),
        
        prisma.storeVendor.count({
          where: {
            storeId,
            isActive: true,
            user: { isActive: true }
          }
        }),

        prisma.employeeActivity.count({
          where: {
            storeId,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Последние 24 часа
            }
          }
        })
      ]);

      const totalEmployees = adminCount + vendorCount;
      
      return {
        totalEmployees,
        activeEmployees: totalEmployees, // Уже учли isActive в запросах
        adminCount,
        vendorCount,
        recentActivity: recentActivityCount
      };
    } catch (error) {
      logger.error('Error getting store permission stats:', { storeId, error });
      return {
        totalEmployees: 0,
        activeEmployees: 0,
        adminCount: 0,
        vendorCount: 0,
        recentActivity: 0
      };
    }
  }
}

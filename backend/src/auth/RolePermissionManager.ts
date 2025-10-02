import { UserRole } from './SecureAuthSystem';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';
import { Response, NextFunction } from 'express';

/**
 * Centralized Role and Permission Management System
 */

export enum Permission {
  // Store Management
  STORE_CREATE = 'STORE_CREATE',
  STORE_UPDATE = 'STORE_UPDATE',
  STORE_DELETE = 'STORE_DELETE',
  STORE_VIEW = 'STORE_VIEW',
  STORE_MANAGE = 'STORE_MANAGE',
  
  // Product Management  
  PRODUCT_CREATE = 'PRODUCT_CREATE',
  PRODUCT_UPDATE = 'PRODUCT_UPDATE',
  PRODUCT_DELETE = 'PRODUCT_DELETE',
  PRODUCT_VIEW = 'PRODUCT_VIEW',
  PRODUCT_MANAGE = 'PRODUCT_MANAGE',
  
  // Order Management
  ORDER_VIEW = 'ORDER_VIEW',
  ORDER_UPDATE = 'ORDER_UPDATE',
  ORDER_CONFIRM = 'ORDER_CONFIRM',
  ORDER_REJECT = 'ORDER_REJECT',
  ORDER_DELETE = 'ORDER_DELETE',
  ORDER_MANAGE = 'ORDER_MANAGE',
  
  // User Management
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_VIEW = 'USER_VIEW',
  USER_PROMOTE = 'USER_PROMOTE',
  USER_MANAGE = 'USER_MANAGE',
  
  // Analytics & Reports
  ANALYTICS_VIEW = 'ANALYTICS_VIEW',
  ANALYTICS_EXPORT = 'ANALYTICS_EXPORT',
  ANALYTICS_MANAGE = 'ANALYTICS_MANAGE',
  
  // System Administration
  SYSTEM_BACKUP = 'SYSTEM_BACKUP',
  SYSTEM_RESTORE = 'SYSTEM_RESTORE',
  SYSTEM_LOGS = 'SYSTEM_LOGS',
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
  SYSTEM_MANAGE = 'SYSTEM_MANAGE',
  
  // Admin Panel Access
  ADMINJS_ACCESS = 'ADMINJS_ACCESS',
  ADMIN_PANEL_ACCESS = 'ADMIN_PANEL_ACCESS',
  
  // Telegram Bot Management
  BOT_MANAGE = 'BOT_MANAGE',
  BOT_CONFIG = 'BOT_CONFIG',
  
  // Notification Management
  NOTIFICATION_SEND = 'NOTIFICATION_SEND',
  NOTIFICATION_MANAGE = 'NOTIFICATION_MANAGE',
  
  // Inventory Management
  INVENTORY_VIEW = 'INVENTORY_VIEW',
  INVENTORY_UPDATE = 'INVENTORY_UPDATE',
  INVENTORY_MANAGE = 'INVENTORY_MANAGE'
}

// Role-based permission mapping with hierarchical inheritance
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    // Full system access - all permissions
    ...Object.values(Permission)
  ],
  
  [UserRole.ADMIN]: [
    // Store Management (for assigned stores)
    Permission.STORE_VIEW,
    Permission.STORE_UPDATE,
    Permission.STORE_MANAGE,
    
    // Product Management
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.PRODUCT_VIEW,
    Permission.PRODUCT_MANAGE,
    
    // Order Management
    Permission.ORDER_VIEW,
    Permission.ORDER_UPDATE,
    Permission.ORDER_CONFIRM,
    Permission.ORDER_REJECT,
    Permission.ORDER_MANAGE,
    
    // User Management (limited)
    Permission.USER_VIEW,
    Permission.USER_UPDATE,
    
    // Analytics
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT,
    
    // Inventory
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_UPDATE,
    Permission.INVENTORY_MANAGE,
    
    // Notifications
    Permission.NOTIFICATION_SEND,
    
    // Admin Panel
    Permission.ADMINJS_ACCESS,
    Permission.ADMIN_PANEL_ACCESS
  ],
  
  [UserRole.VENDOR]: [
    // Limited product and inventory management
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_VIEW,
    
    // Order viewing and updates
    Permission.ORDER_VIEW,
    Permission.ORDER_UPDATE,
    
    // Analytics (limited)
    Permission.ANALYTICS_VIEW,
    
    // Inventory
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_UPDATE,
    
    // Store viewing (for assigned stores)
    Permission.STORE_VIEW
  ],
  
  [UserRole.CUSTOMER]: [
    // Very limited access - mainly for viewing own data
    Permission.ORDER_VIEW, // Only their own orders
  ]
};

// Permission groups for easier management
export const PERMISSION_GROUPS = {
  STORE_MANAGEMENT: [
    Permission.STORE_CREATE,
    Permission.STORE_UPDATE,
    Permission.STORE_DELETE,
    Permission.STORE_VIEW,
    Permission.STORE_MANAGE
  ],
  PRODUCT_MANAGEMENT: [
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.PRODUCT_VIEW,
    Permission.PRODUCT_MANAGE
  ],
  ORDER_MANAGEMENT: [
    Permission.ORDER_VIEW,
    Permission.ORDER_UPDATE,
    Permission.ORDER_CONFIRM,
    Permission.ORDER_REJECT,
    Permission.ORDER_DELETE,
    Permission.ORDER_MANAGE
  ],
  USER_MANAGEMENT: [
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.USER_VIEW,
    Permission.USER_PROMOTE,
    Permission.USER_MANAGE
  ],
  SYSTEM_ADMIN: [
    Permission.SYSTEM_BACKUP,
    Permission.SYSTEM_RESTORE,
    Permission.SYSTEM_LOGS,
    Permission.SYSTEM_CONFIG,
    Permission.SYSTEM_MANAGE
  ]
};

/**
 * Context for store-specific permissions
 */
export interface PermissionContext {
  storeId?: string;
  userId?: string;
  targetUserId?: string;
  resourceOwnerId?: string;
}

/**
 * Enhanced Permission Checker with context awareness
 */
export class RolePermissionManager {
  private user: {
    id: string;
    role: UserRole;
    telegramId?: string;
    email?: string;
  };

  private context: PermissionContext;

  constructor(user: AuthenticatedRequest['user'], context: PermissionContext = {}) {
    this.user = {
      id: user.id,
      role: user.role,
      telegramId: user.telegramId || undefined,
      email: user.email || undefined
    };
    this.context = context;
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[this.user.role] || [];
    return rolePermissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  /**
   * Check store-specific access
   */
  async hasStoreAccess(storeId: string): Promise<boolean> {
    // Owner has access to all stores
    if (this.user.role as string === UserRole.OWNER) {
      return true;
    }

    try {
      // Check if user owns or manages this store
      const userWithStores = await prisma.user.findUnique({
        where: { id: this.user.id },
        select: {
          ownedStores: {
            where: { id: storeId },
            select: { id: true }
          },
          managedStores: {
            where: { storeId },
            select: { storeId: true }
          }
        }
      });

      return !!(
        userWithStores?.ownedStores.length || 
        userWithStores?.managedStores.length
      );
    } catch (error) {
      logger.error('Store access check failed', { 
        error, 
        userId: this.user.id, 
        storeId 
      });
      return false;
    }
  }

  /**
   * Check if user can perform action on specific resource
   */
  async canAccessResource(
    permission: Permission, 
    resourceType: 'store' | 'user' | 'order' | 'product',
    resourceId?: string
  ): Promise<boolean> {
    // First check if user has the permission
    if (!this.hasPermission(permission)) {
      return false;
    }

    // Owner can access everything
    if (this.user.role as string === UserRole.OWNER) {
      return true;
    }

    // Context-specific checks
    switch (resourceType) {
      case 'store':
        if (resourceId) {
          return await this.hasStoreAccess(resourceId);
        }
        return true;

      case 'user':
        // Users can access their own data
        if (resourceId === this.user.id) {
          return true;
        }
        // Admins can access users in their stores
        if (this.user.role === UserRole.ADMIN && resourceId) {
          return await this.canManageUser(resourceId);
        }
        return this.user.role as string === UserRole.OWNER;

      case 'order':
        if (resourceId && this.user.role === UserRole.CUSTOMER) {
          // Customers can only access their own orders
          return await this.isOrderOwner(resourceId);
        }
        return true; // Admins and vendors handled by store access

      case 'product':
        // Products are managed at store level
        return true; // Store access will be checked separately

      default:
        return false;
    }
  }

  /**
   * Check if user can manage another user
   */
  private async canManageUser(targetUserId: string): Promise<boolean> {
    if (this.user.role as string === UserRole.OWNER) {
      return true;
    }

    if (this.user.role !== UserRole.ADMIN) {
      return false;
    }

    try {
      // Admin can manage users in stores they manage
      const adminStores = await prisma.storeAdmin.findMany({
        where: { userId: this.user.id },
        select: { storeId: true }
      });

      const targetUserStores = await prisma.storeAdmin.findMany({
        where: { userId: targetUserId },
        select: { storeId: true }
      });

      // Check if there's any overlap in managed stores
      const adminStoreIds = adminStores.map(s => s.storeId);
      const targetStoreIds = targetUserStores.map(s => s.storeId);
      
      return adminStoreIds.some(id => targetStoreIds.includes(id));
    } catch (error) {
      logger.error('User management check failed', { error });
      return false;
    }
  }

  /**
   * Check if user owns an order
   */
  private async isOrderOwner(orderId: string): Promise<boolean> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { customerId: true }
      });

      return order?.customerId === this.user.id;
    } catch (error) {
      logger.error('Order ownership check failed', { error });
      return false;
    }
  }

  /**
   * Get all permissions for the user
   */
  getAllPermissions(): Permission[] {
    return ROLE_PERMISSIONS[this.user.role] || [];
  }

  /**
   * Get permissions grouped by category
   */
  getGroupedPermissions(): Record<string, Permission[]> {
    const userPermissions = this.getAllPermissions();
    const grouped: Record<string, Permission[]> = {};

    for (const [groupName, groupPermissions] of Object.entries(PERMISSION_GROUPS)) {
      grouped[groupName] = groupPermissions.filter(permission =>
        userPermissions.includes(permission)
      );
    }

    return grouped;
  }

  /**
   * Check if user has elevated privileges (Admin or Owner)
   */
  isElevatedUser(): boolean {
    return [UserRole.OWNER, UserRole.ADMIN].includes(this.user.role);
  }

  /**
   * Check if user is owner
   */
  isOwner(): boolean {
    return this.user.role as string === UserRole.OWNER;
  }

  /**
   * Check if user can create resources of a specific type
   */
  canCreate(resourceType: 'store' | 'user' | 'product'): boolean {
    switch (resourceType) {
      case 'store':
        return this.hasPermission(Permission.STORE_CREATE);
      case 'user':
        return this.hasPermission(Permission.USER_CREATE);
      case 'product':
        return this.hasPermission(Permission.PRODUCT_CREATE);
      default:
        return false;
    }
  }

  /**
   * Create permission middleware function
   */
  static createPermissionMiddleware(permission: Permission) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const permissionChecker = new RolePermissionManager(req.user);
      
      if (!permissionChecker.hasPermission(permission)) {
        logger.warn('Permission denied', {
          userId: req.user.id,
          role: req.user.role,
          requiredPermission: permission,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: permission,
          userRole: req.user.role
        });
      }

      next();
    };
  }

  /**
   * Create store access middleware
   */
  static createStoreAccessMiddleware(storeIdParam: string = 'storeId') {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const storeId = req.params[storeIdParam] || req.body.storeId;
      
      if (!storeId) {
        return res.status(400).json({
          error: 'Store ID required',
          code: 'STORE_ID_REQUIRED'
        });
      }

      const permissionChecker = new RolePermissionManager(req.user);
      
      if (!(await permissionChecker.hasStoreAccess(storeId))) {
        logger.warn('Store access denied', {
          userId: req.user.id,
          role: req.user.role,
          storeId,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          error: 'No access to this store',
          code: 'NO_STORE_ACCESS',
          storeId
        });
      }

      next();
    };
  }
}

/**
 * Helper functions for role management
 */
export class RoleManager {
  /**
   * Promote user to a higher role (Owner only)
   */
  static async promoteUser(
    adminUserId: string,
    targetUserId: string, 
    newRole: UserRole,
    storeAssignments?: { storeId: string; role: 'ADMIN' | 'VENDOR' }[]
  ): Promise<void> {
    // Verify admin is owner
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { role: true }
    });

    if (!admin || admin.role !== UserRole.OWNER) {
      throw new Error('Only owners can promote users');
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true }
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Prevent demoting owners
    if (targetUser.role === UserRole.OWNER && newRole !== UserRole.OWNER) {
      throw new Error('Cannot demote owner users');
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Update user role
        await tx.user.update({
          where: { id: targetUserId },
          data: { role: newRole }
        });

        // Clear existing store assignments
        await tx.storeAdmin.deleteMany({
          where: { userId: targetUserId }
        });

        // Apply new store assignments
        if (storeAssignments && newRole === UserRole.ADMIN) {
          for (const assignment of storeAssignments) {
            await tx.storeAdmin.create({
              data: {
                userId: targetUserId,
                storeId: assignment.storeId
              }
            });
          }
        }
      });

      logger.info('User role updated', {
        adminId: adminUserId,
        targetUserId,
        oldRole: targetUser.role,
        newRole,
        storeAssignments: storeAssignments?.length || 0
      });
    } catch (error) {
      logger.error('User promotion failed', { error });
      throw new Error('Role update failed');
    }
  }

  /**
   * Get role hierarchy level (for comparison)
   */
  static getRoleLevel(role: UserRole): number {
    switch (role) {
      case UserRole.OWNER: return 4;
      case UserRole.ADMIN: return 3;
      case UserRole.VENDOR: return 2;
      case UserRole.CUSTOMER: return 1;
      default: return 0;
    }
  }

  /**
   * Check if role A can manage role B
   */
  static canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
    return this.getRoleLevel(managerRole) > this.getRoleLevel(targetRole);
  }
}

// Export permission checker for backward compatibility
export const PermissionChecker = RolePermissionManager;

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../auth/SecureAuthSystem';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

// Define all possible permissions in the system
export enum Permission {
  // Store management
  STORE_CREATE = 'STORE_CREATE',
  STORE_UPDATE = 'STORE_UPDATE', 
  STORE_DELETE = 'STORE_DELETE',
  STORE_VIEW = 'STORE_VIEW',
  STORE_MANAGE = 'STORE_MANAGE',
  
  // Product management
  PRODUCT_CREATE = 'PRODUCT_CREATE',
  PRODUCT_UPDATE = 'PRODUCT_UPDATE',
  PRODUCT_DELETE = 'PRODUCT_DELETE',
  PRODUCT_VIEW = 'PRODUCT_VIEW',
  
  // Order management
  ORDER_VIEW = 'ORDER_VIEW',
  ORDER_UPDATE = 'ORDER_UPDATE',
  ORDER_CONFIRM = 'ORDER_CONFIRM',
  ORDER_REJECT = 'ORDER_REJECT',
  ORDER_DELETE = 'ORDER_DELETE',
  
  // User management
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_VIEW = 'USER_VIEW',
  USER_PROMOTE = 'USER_PROMOTE',
  
  // Analytics and reports
  ANALYTICS_VIEW = 'ANALYTICS_VIEW',
  ANALYTICS_EXPORT = 'ANALYTICS_EXPORT',
  
  // System administration
  SYSTEM_BACKUP = 'SYSTEM_BACKUP',
  SYSTEM_RESTORE = 'SYSTEM_RESTORE',
  SYSTEM_LOGS = 'SYSTEM_LOGS',
  
  // AdminJS access
  ADMINJS_ACCESS = 'ADMINJS_ACCESS',
}

// Role-based permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [
    // Full system access
    Permission.STORE_CREATE,
    Permission.STORE_UPDATE,
    Permission.STORE_DELETE,
    Permission.STORE_VIEW,
    Permission.STORE_MANAGE,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.PRODUCT_VIEW,
    Permission.ORDER_VIEW,
    Permission.ORDER_UPDATE,
    Permission.ORDER_CONFIRM,
    Permission.ORDER_REJECT,
    Permission.ORDER_DELETE,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.USER_VIEW,
    Permission.USER_PROMOTE,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT,
    Permission.SYSTEM_BACKUP,
    Permission.SYSTEM_RESTORE,
    Permission.SYSTEM_LOGS,
    Permission.ADMINJS_ACCESS,
  ],
  
  ADMIN: [
    // Store and product management for assigned stores
    Permission.STORE_VIEW,
    Permission.STORE_UPDATE, // Can update stores they manage
    Permission.STORE_MANAGE,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.PRODUCT_VIEW,
    Permission.ORDER_VIEW,
    Permission.ORDER_UPDATE,
    Permission.ORDER_CONFIRM,
    Permission.ORDER_REJECT,
    Permission.USER_VIEW,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT,
    Permission.ADMINJS_ACCESS,
  ],
  
  VENDOR: [
    // Limited product and order management
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_VIEW,
    Permission.ORDER_VIEW,
    Permission.ORDER_UPDATE,
    Permission.ANALYTICS_VIEW,
  ],
  
  CUSTOMER: [
    // Very limited access - mainly for viewing their own data
    Permission.ORDER_VIEW, // Only their own orders
  ],
};

// Context-aware permissions (store-specific)
export interface PermissionContext {
  storeId?: string;
  userId?: string;
  resourceOwnerId?: string;
}

// Enhanced permission checker
export class PermissionChecker {
  constructor(
    private user: AuthenticatedRequest['user'], 
    private context: PermissionContext = {}
  ) {}

  async hasPermission(permission: Permission): Promise<boolean> {
    if (!this.user) return false;

    const userRole = this.user.role as UserRole;
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    
    // Basic role check
    if (!rolePermissions.includes(permission)) {
      return false;
    }

    // Context-specific checks
    return this.checkContextualPermission(permission);
  }

  private async checkContextualPermission(permission: Permission): Promise<boolean> {
    if (!this.user) return false; // Ensure user is defined
    const userRole = this.user.role as UserRole;

    // OWNER has full access to everything
    if (userRole === 'OWNER') {
      return true;
    }

    // Store-specific permissions for ADMIN and VENDOR
    if (this.context.storeId) {
      return this.checkStorePermission(permission);
    }

    // User-specific permissions
    if (this.context.userId) {
      return this.checkUserPermission(permission);
    }

    // Default: only allow if role has basic permission (no automatic approval)
    // This ensures that roles without permission don't get access by default
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    return rolePermissions.includes(permission);
  }

  private async checkStorePermission(_permission: Permission): Promise<boolean> {
    if (!this.user) return false; // Ensure user is defined
    const userRole = this.user.role as UserRole;
    const storeId = this.context.storeId;
    
    if (!storeId) return true; // No store context, allow
    
    // OWNER has access to all stores
    if (userRole === 'OWNER') return true;
    
    // Check if user is owner of the store
    const ownedStore = await prisma.store.findFirst({
      where: {
        id: storeId,
        ownerId: this.user.id
      }
    });
    
    if (ownedStore) return true;
    
    // Check if user is admin of the store
    const adminRelation = await prisma.storeAdmin.findFirst({
      where: {
        storeId: storeId,
        userId: this.user.id
      }
    });
    
    return !!adminRelation;
  }

  private checkUserPermission(_permission: Permission): boolean {
    if (!this.user) return false; // Ensure user is defined
    const userRole = this.user.role as UserRole;
    
    // Users can only manage their own data unless they're admin+
    if (this.context.userId === this.user.id) {
      return true;
    }

    // Admins and owners can manage other users
    return ['OWNER', 'ADMIN'].includes(userRole);
  }
}

// Middleware factory for permission checking
/*
export default {
  Permission,
  PermissionChecker,
  requirePermission,
  requireStorePermission,
  requireUserPermission,
  requireStoreAccessAsync,
};
*/

// Helper middleware for common permission patterns
export const requirePermission = (
  permission: Permission, 
  getContext?: (req: AuthenticatedRequest) => PermissionContext
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const context = getContext ? getContext(req) : {};
    const checker = new PermissionChecker(req.user, context);

    const hasPermission = await checker.hasPermission(permission);
    if (!hasPermission) {
      logger.warn('Permission denied', {
        userId: req.user.id,
        role: req.user.role,
        permission,
        context,
      });
      
      return res.status(403).json({ 
        error: 'Permission denied',
        required: permission,
        userRole: req.user.role 
      });
    }

    next();
  };
};

// Helper middleware for common permission patterns
export const requireStorePermission = (permission: Permission) => {
  return requirePermission(permission, (req: AuthenticatedRequest) => {
    const storeId = req.params.storeId || req.body.storeId;
    return { storeId };
  });
};

export const requireUserPermission = (permission: Permission) => {
  return requirePermission(permission, (req) => ({
    userId: req.params.userId || req.body.userId
  }));
};

// Async version for database-dependent checks
export const requireStoreAccessAsync = (permission: Permission) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const storeId = req.params.storeId || req.body.storeId;
      const userId = req.user.id;

      if (!storeId) {
        return res.status(400).json({ error: 'Store ID required' });
      }

      // Check basic permission first
      const checker = new PermissionChecker(req.user, { storeId });
      if (!checker.hasPermission(permission)) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // OWNER can access all stores
      if (req.user.role === 'OWNER') {
        return next();
      }

      // Check database for store access
      const hasAccess = await checkStoreAccess(userId, storeId, req.user.role as UserRole);
      
      if (!hasAccess) {
        logger.warn('Store access denied', {
          userId,
          storeId,
          role: req.user.role,
          permission,
        });
        
        return res.status(403).json({ error: 'No access to this store' });
      }

      next();
    } catch (error) {
      logger.error('Store permission middleware error:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  };
};

// Database helper functions
async function checkStoreAccess(userId: string, storeId: string, _role: UserRole): Promise<boolean> {
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      OR: [
        { ownerId: userId }, // User owns the store
        { 
          admins: { 
            some: { 
              userId,
              // Could add additional conditions like active status
            } 
          } 
        }
      ]
    }
  });

  return !!store;
}

export default {
  Permission,
  PermissionChecker,
  requirePermission,
  requireStorePermission,
  requireUserPermission,
  requireStoreAccessAsync,
};

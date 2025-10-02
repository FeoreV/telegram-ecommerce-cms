import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

// Audit action types
export enum AuditAction {
  // User management
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_PROMOTED = 'USER_PROMOTED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  
  // Store management
  STORE_CREATED = 'STORE_CREATED',
  STORE_UPDATED = 'STORE_UPDATED',
  STORE_DELETED = 'STORE_DELETED',
  STORE_STATUS_CHANGED = 'STORE_STATUS_CHANGED',
  
  // Product management
  PRODUCT_CREATED = 'PRODUCT_CREATED',
  PRODUCT_UPDATED = 'PRODUCT_UPDATED',
  PRODUCT_DELETED = 'PRODUCT_DELETED',
  PRODUCT_ACTIVATED = 'PRODUCT_ACTIVATED',
  PRODUCT_DEACTIVATED = 'PRODUCT_DEACTIVATED',
  PRODUCT_STOCK_UPDATED = 'PRODUCT_STOCK_UPDATED',
  
  // Order management
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_REJECTED = 'ORDER_REJECTED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  ORDER_DELETED = 'ORDER_DELETED',
  ORDER_STATUS_CHANGED = 'ORDER_STATUS_CHANGED',
  
  // Authentication
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_LOGOUT = 'ADMIN_LOGOUT',
  ADMINJS_ACCESS = 'ADMINJS_ACCESS',
  
  // System operations
  SYSTEM_BACKUP = 'SYSTEM_BACKUP',
  SYSTEM_RESTORE = 'SYSTEM_RESTORE',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  
  // Bulk operations
  BULK_IMPORT = 'BULK_IMPORT',
  BULK_EXPORT = 'BULK_EXPORT',
  BULK_UPDATE = 'BULK_UPDATE',
  BULK_DELETE = 'BULK_DELETE',
}

interface AuditLogData {
  action: AuditAction;
  details?: string | object;
  resourceId?: string;
  resourceType?: string;
  orderId?: string;
  storeId?: string;
  metadata?: Record<string, any>;
}

// Main audit logging service
export class AuditLogService {
  static async log(
    adminId: string, 
    data: AuditLogData, 
    req?: AuthenticatedRequest
  ): Promise<void> {
    try {
      const details = typeof data.details === 'object' 
        ? JSON.stringify(data.details)
        : data.details;

      const auditEntry = await prisma.adminLog.create({
        data: {
          adminId,
          action: data.action,
          details: details || null,
          orderId: data.orderId || null,
          ...(data.metadata && { 
            // Store additional metadata in details if needed
            details: JSON.stringify({
              ...(typeof data.details === 'object' ? data.details : {}),
              metadata: data.metadata,
              resourceId: data.resourceId,
              resourceType: data.resourceType,
              storeId: data.storeId,
              userAgent: req?.headers['user-agent'],
              ip: req?.ip,
              timestamp: new Date().toISOString(),
            })
          })
        }
      });

      logger.info('Audit log created', {
        id: auditEntry.id,
        adminId,
        action: data.action,
        resourceId: data.resourceId,
        resourceType: data.resourceType,
      });

    } catch (error) {
      logger.error('Failed to create audit log', {
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
        },
        adminId,
        action: data.action,
      });
      // Don't throw - audit logging should not break the main flow
    }
  }
}

// Middleware to automatically log administrative actions
export const auditLogger = (action: AuditAction, getDetails?: (req: AuthenticatedRequest, res?: Response) => AuditLogData) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Store original res.json to intercept responses
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // Log the action after successful response
      if (req.user && res.statusCode >= 200 && res.statusCode < 300) {
        const logData = getDetails ? getDetails(req, res) : { action };
        
        // Log asynchronously to avoid blocking the response
        setImmediate(() => {
          if (req.user) { // Additional check to satisfy TypeScript
            AuditLogService.log(req.user.id, logData, req);
          }
        });
      }
      
      return originalJson.call(this, body);
    };

    next();
  };
};

// Specific audit loggers for common actions
export const auditUserAction = (action: AuditAction) => {
  return auditLogger(action, (req) => ({
    action,
    resourceId: req.params.userId || req.body.userId,
    resourceType: 'User',
    details: {
      targetUserId: req.params.userId || req.body.userId,
      changes: req.body,
      route: req.route?.path,
    }
  }));
};

export const auditStoreAction = (action: AuditAction) => {
  return auditLogger(action, (req) => ({
    action,
    resourceId: req.params.storeId || req.body.storeId,
    resourceType: 'Store', 
    storeId: req.params.storeId || req.body.storeId,
    details: {
      changes: req.body,
      route: req.route?.path,
    }
  }));
};

export const auditProductAction = (action: AuditAction) => {
  return auditLogger(action, (req) => ({
    action,
    resourceId: req.params.productId || req.body.productId,
    resourceType: 'Product',
    storeId: req.body.storeId,
    details: {
      changes: req.body,
      route: req.route?.path,
    }
  }));
};

export const auditOrderAction = (action: AuditAction) => {
  return auditLogger(action, (req) => ({
    action,
    resourceId: req.params.orderId || req.body.orderId,
    resourceType: 'Order',
    orderId: req.params.orderId || req.body.orderId,
    storeId: req.body.storeId,
    details: {
      changes: req.body,
      route: req.route?.path,
    }
  }));
};

// Login/logout audit logging
export const auditAuthAction = async (
  adminId: string, 
  action: AuditAction.ADMIN_LOGIN | AuditAction.ADMIN_LOGOUT | AuditAction.ADMINJS_ACCESS,
  req: AuthenticatedRequest,
  details?: any
) => {
  await AuditLogService.log(adminId, {
    action,
    details: {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      timestamp: new Date().toISOString(),
      ...details
    }
  }, req);
};

// Bulk operations audit logging
export const auditBulkAction = async (
  adminId: string,
  action: AuditAction,
  req: AuthenticatedRequest,
  details: {
    affected: number;
    resourceType: string;
    operation: string;
    metadata?: any;
  }
) => {
  await AuditLogService.log(adminId, {
    action,
    details: {
      affected: details.affected,
      resourceType: details.resourceType,
      operation: details.operation,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      timestamp: new Date().toISOString(),
      ...details.metadata
    }
  }, req);
};

export default {
  AuditLogService,
  auditLogger,
  auditUserAction,
  auditStoreAction,
  auditProductAction,
  auditOrderAction,
  auditAuthAction,
  auditBulkAction,
  AuditAction,
};

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { multiTenantSecurityService, UserContext } from '../services/MultiTenantSecurityService';
import { secretManager } from '../utils/SecretManager';
import { logger } from '../utils/logger';
import { UserRole } from '../utils/jwt';
import type { UserWithPermissions } from '../types/express.d';

export interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user?: UserWithPermissions & {
    storeId?: string;
    sessionId?: string;
  };
  storeId?: string;
  tenantContext?: UserContext;
}

export interface RBACOptions {
  roles?: string[];
  permissions?: string[];
  requireStoreAccess?: boolean;
  operation?: 'read' | 'write';
  allowSelfAccess?: boolean;
}

/**
 * JWT Authentication middleware with multi-tenant support
 */
export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      
      res.status(401).json({
        error: 'Authentication required',
        message: 'Access token is required'
      });
      return;
    }

    try {
      // Verify JWT token
      const jwtSecrets = secretManager.getJWTSecrets();
      const decoded = jwt.verify(token, jwtSecrets.secret) as any;

      // Extract user information
      const user = {
        id: decoded.userId || decoded.id,
        telegramId: decoded.telegramId || '',
        role: decoded.role || 'CUSTOMER',
        storeId: decoded.storeId,
        permissions: decoded.permissions || [],
        sessionId: decoded.sessionId || `session-${Date.now()}-${Math.random()}`
      };

      // Validate required fields
      if (!user.id || !user.role) {
        throw new Error('Invalid token payload: missing user ID or role');
      }

      // Set user context in request
      req.user = user;
      req.storeId = user.storeId;

      // Create tenant context
      const tenantContext: UserContext = {
        userId: user.id,
        role: user.role,
        storeId: user.storeId,
        permissions: user.permissions
      };

      req.tenantContext = tenantContext;

      // Set database context for RLS
      await multiTenantSecurityService.setUserContext(
        user.sessionId,
        tenantContext,
        req.ip
      );

      logger.debug('User authenticated successfully', {
        userId: user.id,
        role: user.role,
        storeId: user.storeId,
        sessionId: user.sessionId,
        path: req.path
      });

      next();

    } catch (jwtError) {
      logger.warn('JWT verification failed', {
        error: jwtError instanceof Error ? jwtError.message : 'Unknown error',
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });

      res.status(401).json({
        error: 'Invalid token',
        message: 'Access token is invalid or expired'
      });
      return;
    }

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication service unavailable'
    });
  }
};

/**
 * Role-Based Access Control (RBAC) middleware
 */
export const requireRole = (allowedRoles: string | string[]) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'User must be authenticated'
        });
        return;
      }

      const userRole = req.user.role;
      
      if (!roles.includes(userRole)) {
        logger.warn('Access denied: insufficient role', {
          userId: req.user.id,
          userRole,
          requiredRoles: roles,
          path: req.path,
          ip: req.ip
        });

        res.status(403).json({
          error: 'Access denied',
          message: `Required role: ${roles.join(' or ')}. Current role: ${userRole}`
        });
        return;
      }

      logger.debug('Role check passed', {
        userId: req.user.id,
        userRole,
        requiredRoles: roles,
        path: req.path
      });

      next();

    } catch (error) {
      logger.error('Role middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Authorization service unavailable'
      });
    }
  };
};

/**
 * Store access control middleware
 */
export const requireStoreAccess = (operation: 'read' | 'write' = 'read') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'User must be authenticated'
        });
        return;
      }

      // Extract store ID from request (params, body, or query)
      const storeId = req.params.storeId || req.body.storeId || req.query.storeId as string;
      
      if (!storeId) {
        res.status(400).json({
          error: 'Bad request',
          message: 'Store ID is required'
        });
        return;
      }

      // Validate store access
      const hasAccess = await multiTenantSecurityService.validateStoreAccess(
        req.user.id,
        storeId,
        operation
      );

      if (!hasAccess) {
        logger.warn('Store access denied', {
          userId: req.user.id,
          userRole: req.user.role,
          storeId,
          operation,
          path: req.path,
          ip: req.ip
        });

        res.status(403).json({
          error: 'Access denied',
          message: `You don't have ${operation} access to this store`
        });
        return;
      }

      // Set store ID in request for downstream use
      req.storeId = storeId;

      logger.debug('Store access granted', {
        userId: req.user.id,
        userRole: req.user.role,
        storeId,
        operation,
        path: req.path
      });

      next();

    } catch (error) {
      logger.error('Store access middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Store access validation failed'
      });
    }
  };
};

/**
 * Permission-based access control middleware
 */
export const requirePermission = (requiredPermissions: string | string[]) => {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'User must be authenticated'
        });
        return;
      }

      const userPermissions = req.user.permissions || [];
      
      // Check if user has all required permissions
      const hasAllPermissions = permissions.every(permission => 
        userPermissions.includes(permission)
      );

      // OWNER role has all permissions by default
      if (req.user.role === 'OWNER' || hasAllPermissions) {
        logger.debug('Permission check passed', {
          userId: req.user.id,
          userRole: req.user.role,
          userPermissions,
          requiredPermissions: permissions,
          path: req.path
        });

        next();
        return;
      }

      logger.warn('Access denied: insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        userPermissions,
        requiredPermissions: permissions,
        path: req.path,
        ip: req.ip
      });

      res.status(403).json({
        error: 'Access denied',
        message: `Required permissions: ${permissions.join(', ')}`
      });

    } catch (error) {
      logger.error('Permission middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Permission validation failed'
      });
    }
  };
};

/**
 * Owner-only access middleware
 */
export const requireOwnerAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated'
      });
      return;
    }

    if (req.user.role !== 'OWNER') {
      logger.warn('Owner access denied', {
        userId: req.user.id,
        userRole: req.user.role,
        path: req.path,
        ip: req.ip
      });

      res.status(403).json({
        error: 'Access denied',
        message: 'Owner access required'
      });
      return;
    }

    next();

  } catch (error) {
    logger.error('Owner access middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Owner access validation failed'
    });
  }
};

/**
 * Self-access middleware (user can only access their own data)
 */
export const requireSelfAccess = (userIdParam: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'User must be authenticated'
        });
        return;
      }

      const targetUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam] as string;
      
      if (!targetUserId) {
        res.status(400).json({
          error: 'Bad request',
          message: 'User ID is required'
        });
        return;
      }

      // Allow access if user is accessing their own data or if they're an OWNER/ADMIN
      if (req.user.id === targetUserId || ['OWNER', 'ADMIN'].includes(req.user.role)) {
        next();
        return;
      }

      logger.warn('Self-access denied', {
        userId: req.user.id,
        targetUserId,
        userRole: req.user.role,
        path: req.path,
        ip: req.ip
      });

      res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own data'
      });

    } catch (error) {
      logger.error('Self-access middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Self-access validation failed'
      });
    }
  };
};

/**
 * Combined RBAC middleware with multiple options
 */
export const rbac = (options: RBACOptions) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // First, ensure user is authenticated
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'User must be authenticated'
        });
        return;
      }

      // Check role requirements
      if (options.roles && !options.roles.includes(req.user.role)) {
        logger.warn('RBAC access denied: insufficient role', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: options.roles,
          path: req.path,
          ip: req.ip
        });

        res.status(403).json({
          error: 'Access denied',
          message: `Required role: ${options.roles.join(' or ')}`
        });
        return;
      }

      // Check permission requirements
      if (options.permissions) {
        const userPermissions = req.user.permissions || [];
        const hasPermissions = req.user.role === 'OWNER' || 
          options.permissions.every(permission => userPermissions.includes(permission));

        if (!hasPermissions) {
          logger.warn('RBAC access denied: insufficient permissions', {
            userId: req.user.id,
            userPermissions,
            requiredPermissions: options.permissions,
            path: req.path,
            ip: req.ip
          });

          res.status(403).json({
            error: 'Access denied',
            message: `Required permissions: ${options.permissions.join(', ')}`
          });
          return;
        }
      }

      // Check store access requirements
      if (options.requireStoreAccess) {
        const storeId = req.params.storeId || req.body.storeId || req.query.storeId as string;
        
        if (!storeId) {
          res.status(400).json({
            error: 'Bad request',
            message: 'Store ID is required'
          });
          return;
        }

        const hasStoreAccess = await multiTenantSecurityService.validateStoreAccess(
          req.user.id,
          storeId,
          options.operation || 'read'
        );

        if (!hasStoreAccess) {
          logger.warn('RBAC access denied: insufficient store access', {
            userId: req.user.id,
            storeId,
            operation: options.operation,
            path: req.path,
            ip: req.ip
          });

          res.status(403).json({
            error: 'Access denied',
            message: 'You don\'t have access to this store'
          });
          return;
        }

        req.storeId = storeId;
      }

      logger.debug('RBAC check passed', {
        userId: req.user.id,
        userRole: req.user.role,
        options,
        path: req.path
      });

      next();

    } catch (error) {
      logger.error('RBAC middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Access control validation failed'
      });
    }
  };
};

/**
 * Cleanup middleware to clear database context
 */
export const cleanupContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Add cleanup logic to response finish event
  res.on('finish', async () => {
    if (req.user?.sessionId) {
      try {
        await multiTenantSecurityService.clearUserContext(req.user.sessionId);
      } catch (error) {
        logger.error('Failed to cleanup user context:', error);
      }
    }
  });

  next();
};

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { SecureAuthSystem, AuthenticatedRequest, UserRole } from './SecureAuthSystem';
import type { UserWithPermissions } from '../types/express.d';
import { logger } from '../utils/logger';
import { PermissionChecker, Permission } from '../middleware/permissions';

// Rate limiting configurations
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Authentication rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });
    
    res.status(429).json({
      error: 'Too many authentication attempts',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    });
  }
});

export const loginSlowDown: express.RequestHandler = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // Allow 2 requests per windowMs without delay
  delayMs: () => 500, // Fixed 500ms delay per request after delayAfter (per v2 behaviour)
  maxDelayMs: 5000, // Maximum delay of 5 seconds
  validate: { delayMs: false } // Silence deprecation warning while remaining compatible
}) as express.RequestHandler;

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Main authentication middleware using the new secure system
 */
export const secureAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = SecureAuthSystem.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify access token
    let tokenPayload;
    try {
      tokenPayload = await SecureAuthSystem.verifyAccessToken(token);
    } catch (error: unknown) {
      logger.warn('Token verification failed', {
        error: error instanceof Error ? error.message : String(error),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });

      let code = 'INVALID_TOKEN';
      if (error instanceof Error && error.message.includes('expired')) code = 'TOKEN_EXPIRED';
      else if (error instanceof Error && error.message.includes('revoked')) code = 'TOKEN_REVOKED';

      return res.status(401).json({
        error: 'Invalid or expired token',
        code,
        message: error instanceof Error ? error.message : String(error)
      });
    }

    // Validate session and update activity
    const sessionValid = await SecureAuthSystem.validateSession(
      tokenPayload.sessionId,
      tokenPayload.userId
    );

    if (!sessionValid) {
      logger.warn('Invalid session', {
        userId: tokenPayload.userId,
        sessionId: tokenPayload.sessionId,
        ip: req.ip
      });

      return res.status(401).json({
        error: 'Session expired or invalid',
        code: 'INVALID_SESSION'
      });
    }

    // Update session activity
    await SecureAuthSystem.updateSessionActivity(tokenPayload.sessionId, tokenPayload.userId);

    // Fetch current user data from database
    const { prisma } = await import('../lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.userId },
      select: {
        id: true,
        email: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      logger.warn('User not found or inactive', {
        userId: tokenPayload.userId,
        ip: req.ip
      });

      return res.status(401).json({
        error: 'User account not found or deactivated',
        code: 'USER_INACTIVE'
      });
    }

    // Check if user role has changed since token was issued
    if (user.role !== tokenPayload.role) {
      logger.warn('User role changed, invalidating token', {
        userId: user.id,
        oldRole: tokenPayload.role,
        newRole: user.role,
        ip: req.ip
      });

      // Blacklist the token since role changed
      await SecureAuthSystem.blacklistToken(token, 'role_changed');

      return res.status(401).json({
        error: 'User permissions have changed. Please log in again.',
        code: 'ROLE_CHANGED'
      });
    }

    // Attach authenticated user data to request
    req.user = {
      id: user.id,
      email: user.email || undefined,
      telegramId: user.telegramId || undefined,
      username: user.username || undefined,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      role: user.role as UserRole,
      permissions: await SecureAuthSystem.getUserPermissions(user.id)
    } as UserWithPermissions;
    req.sessionId = tokenPayload.sessionId;
    req.token = token;

    // Log successful authentication for security monitoring
    logger.debug('User authenticated successfully', {
      userId: user.id,
      role: user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(500).json({
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

/**
 * Optional authentication middleware (doesn't require token but populates user if present)
 */
export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = SecureAuthSystem.extractTokenFromHeader(authHeader);

    if (!token) {
      // No token provided, continue without authentication
      return next();
    }

    // Try to authenticate, but don't fail if it doesn't work
    try {
      const tokenPayload = await SecureAuthSystem.verifyAccessToken(token);
      
      const sessionValid = await SecureAuthSystem.validateSession(
        tokenPayload.sessionId,
        tokenPayload.userId
      );

      if (sessionValid) {
        const { prisma } = await import('../lib/prisma');
        const user = await prisma.user.findUnique({
          where: { id: tokenPayload.userId },
          select: {
            id: true,
            email: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true
          }
        });

        if (user && user.isActive && user.role === tokenPayload.role) {
          req.user = {
            id: user.id,
            email: user.email || undefined,
            telegramId: user.telegramId || undefined,
            username: user.username || undefined,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            role: user.role as UserRole,
            permissions: await SecureAuthSystem.getUserPermissions(user.id)
          } as UserWithPermissions;
          req.sessionId = tokenPayload.sessionId;
          req.token = token;
        }
      }
    } catch (error) {
      // Ignore authentication errors in optional mode
      logger.debug('Optional authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error', { error });
    next(); // Continue even on error
  }
};

/**
 * Role-based access control middleware
 */
export const requireRole = (allowedRoles: UserRole[] | UserRole) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role as UserRole)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl,
        ip: req.ip
      });

      return res.status(403).json({
        error: 'Access denied - insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Permission-based access control middleware
 */
export const requirePermission = (permission: Permission) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      const permissionChecker = new PermissionChecker(req.user);
      
      if (!permissionChecker.hasPermission(permission)) {
        logger.warn('Access denied - insufficient permission', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredPermission: permission,
          endpoint: req.originalUrl,
          ip: req.ip
        });

        return res.status(403).json({
          error: 'Access denied - insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: permission,
          userRole: req.user.role
        });
      }

      next();
    } catch (error: unknown) {
      logger.error('Permission check error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user.id,
        permission
      });

      res.status(500).json({
        error: 'Permission check failed',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

/**
 * Store-specific access control middleware
 */
export const requireStoreAccess = (storeIdParam: string = 'storeId') => {
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

    try {
      // OWNER has access to all stores
      if (req.user.role === UserRole.OWNER) {
        return next();
      }

      const { prisma } = await import('../lib/prisma');
      
      // Check if user has access to this specific store
      const hasAccess = await prisma.user.findFirst({
        where: {
          id: req.user.id,
          OR: [
            { ownedStores: { some: { id: storeId } } },
            { managedStores: { some: { storeId } } }
          ]
        }
      });

      if (!hasAccess) {
        logger.warn('Access denied - no store access', {
          userId: req.user.id,
          userRole: req.user.role,
          storeId,
          endpoint: req.originalUrl,
          ip: req.ip
        });

        return res.status(403).json({
          error: 'Access denied - no access to this store',
          code: 'NO_STORE_ACCESS',
          storeId
        });
      }

      next();
    } catch (error: unknown) {
      logger.error('Store access check error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user.id,
        storeId
      });

      res.status(500).json({
        error: 'Store access check failed',
        code: 'STORE_ACCESS_CHECK_ERROR'
      });
    }
  };
};

/**
 * Security logging middleware
 */
export const securityLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  const startTime = Date.now();

  // Log security-relevant requests
  const securityEndpoints = ['/auth', '/admin', '/api/users', '/api/stores'];
  const isSecurityEndpoint = securityEndpoints.some(endpoint => 
    req.originalUrl.startsWith(endpoint)
  );

  if (isSecurityEndpoint) {
    logger.info('Security endpoint accessed', {
      method: req.method,
      endpoint: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  }

  // Override res.send to log responses
  res.send = function(body: string | object | Buffer) {
    const responseTime = Date.now() - startTime;
    
    // Log authentication failures and security events
    if (res.statusCode === 401 || res.statusCode === 403) {
      logger.warn('Security event - access denied', {
        method: req.method,
        endpoint: req.originalUrl,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        responseTime,
        user: req.user?.id
      });
    }

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Comprehensive security middleware stack
 */
export const securityMiddlewareStack = [
  securityLoggingMiddleware,
  generalRateLimit,
  // Add helmet, cors, etc. here if not already applied globally
];

/**
 * Authentication middleware stack for protected routes
 */
export const authMiddlewareStack = [
  ...securityMiddlewareStack,
  secureAuthMiddleware
];

/**
 * Admin authentication middleware stack
 */
export const adminAuthMiddlewareStack = [
  ...securityMiddlewareStack,
  secureAuthMiddleware,
  requireRole([UserRole.OWNER, UserRole.ADMIN])
];

/**
 * Owner-only authentication middleware stack
 */
export const ownerAuthMiddlewareStack = [
  ...securityMiddlewareStack,
  secureAuthMiddleware,
  requireRole(UserRole.OWNER)
];

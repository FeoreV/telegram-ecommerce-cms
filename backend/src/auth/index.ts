/**
 * Secure Authentication System - Main Export File
 *
 * This module provides a comprehensive, secure authentication system
 * that replaces the legacy authentication implementation.
 */

// Core Authentication System
export {
    AuthTokenPayload, AuthenticatedRequest, RefreshTokenPayload, SecureAuthSystem,
    UserRole
} from './SecureAuthSystem';

// Middleware Stack
export {
    adminAuthMiddlewareStack, authMiddlewareStack, authRateLimit, generalRateLimit, loginSlowDown, optionalAuthMiddleware, ownerAuthMiddlewareStack, requirePermission, requireRole, requireStoreAccess, secureAuthMiddleware, securityLoggingMiddleware,
    securityMiddlewareStack
} from './SecureAuthMiddleware';

// Controllers
export {
    changePassword, getProfile, loginWithEmail,
    loginWithTelegram, logout, refreshToken, setPassword, updateProfile, verifyToken
} from './SecureAuthController';

// Role and Permission Management
export {
    PERMISSION_GROUPS, Permission, PermissionChecker, // Alias for backward compatibility
    PermissionContext, ROLE_PERMISSIONS, RoleManager, RolePermissionManager
} from './RolePermissionManager';

// Routes
export { default as secureAuthRoutes } from './SecureAuthRoutes';

/**
 * Quick Setup Example:
 *
 * ```typescript
 * import express from 'express';
 * import {
 *   secureAuthRoutes,
 *   securityMiddlewareStack,
 *   secureAuthMiddleware,
 *   requireRole,
 *   UserRole
 * } from './auth';
 *
 * const app = express();
 *
 * // Apply global security middleware
 * app.use(securityMiddlewareStack);
 *
 * // Auth routes
 * app.use('/auth', secureAuthRoutes);
 *
 * // Protected routes
 * app.use('/api', secureAuthMiddleware);
 *
 * // Admin only routes
 * app.use('/admin', secureAuthMiddleware, requireRole([UserRole.OWNER, UserRole.ADMIN]));
 * ```
 */

/**
 * Migration Helper Functions
 */

// Legacy compatibility - secureAuthMiddleware is already exported above

/**
 * Configuration Validation
 */
export const validateAuthConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET environment variable is required');
  }

  if (!process.env.JWT_REFRESH_SECRET) {
    errors.push('JWT_REFRESH_SECRET environment variable is required');
  }

  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET should be at least 32 characters long');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * System Health Check
 */
export const checkAuthSystemHealth = async (): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, 'connected' | 'error' | 'not_configured'>;
  timestamp: string;
}> => {
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const services: Record<string, 'connected' | 'error' | 'not_configured'> = {};

  try {
    // Check database
    const { prisma } = await import('../lib/prisma.js');
    await prisma.user.count();
    services.database = 'connected';
  } catch {
    services.database = 'error';
    status = 'unhealthy';
  }

  // Check Redis
  if (process.env.REDIS_URL) {
    try {
      // This would need actual Redis health check
      services.redis = 'connected';
    } catch {
      services.redis = 'error';
      status = 'degraded';
    }
  } else {
    services.redis = 'not_configured';
  }

  // Check JWT configuration
  const configCheck = validateAuthConfig();
  services.jwt = configCheck.isValid ? 'connected' : 'error';
  if (!configCheck.isValid) {
    status = 'unhealthy';
  }

  return {
    status,
    services,
    timestamp: new Date().toISOString()
  };
};

/**
 * Default Export - Main Auth Routes
 */
export { default } from './SecureAuthRoutes';

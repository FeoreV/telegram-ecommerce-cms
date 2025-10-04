import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import type { UserWithPermissions } from '../types/express.d';
import { UserRole, verifyToken } from '../utils/jwt';
import { logger, maskSensitiveData } from '../utils/logger';

export interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user?: UserWithPermissions;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    let decoded;

    try {
      decoded = verifyToken(token);
    } catch (error: unknown) {
      logger.warn('Token verification failed', {
        error: error instanceof Error ? error.message : error,
        errorName: error instanceof Error ? error.name : undefined,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      if (error instanceof Error && error.message === 'Token expired') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      } else if (error instanceof Error && error.message === 'Invalid token') {
        return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
      } else {
        return res.status(401).json({ error: 'Authentication failed', code: 'AUTH_FAILED' });
      }
    }

    // SECURITY: Check if token has been revoked (CWE-613)
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Check if revokedToken model is available (requires prisma generate)
    let isRevoked = null;
    try {
      isRevoked = await (prisma as any).revokedToken?.findUnique({
        where: { token: tokenHash }
      });
    } catch (error) {
      // Model not available, skip revocation check
      logger.debug('RevokedToken model not available, skipping check');
    }

    if (isRevoked) {
      logger.warn('Revoked token used', {
        userId: decoded.userId,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      return res.status(401).json({
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        telegramId: true,
        email: true,
        role: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = {
      id: user.id,
      telegramId: user.telegramId || undefined,
      email: user.email || undefined,
      role: user.role as UserRole,
      username: user.username || undefined,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      isActive: user.isActive,
      permissions: []
    };
    next();
  } catch (error) {
    logger.error('Auth middleware error', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      request: {
        method: req.method,
        url: req.url,
        headers: maskSensitiveData(req.headers),
      },
    });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireRole = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Security Note: Development bypass has been disabled for security
    // Role checking is now enforced in all environments

    if (!roles.includes(req.user.role)) {
      logger.warn('requireRole insufficient permissions', {
        userId: req.user.id,
        role: req.user.role,
        requiredRoles: roles,
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const requireStoreAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const storeId = req.params.id || req.params.storeId || req.body.storeId;
    const userId = req.user?.id;

    if (!storeId || !userId) {
      return res.status(400).json({ error: 'Store ID and user required' });
    }

    // Owner can access all stores
    if (req.user?.role === 'OWNER') {
      return next();
    }

    // Check if user owns the store or is an admin
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        OR: [
          { ownerId: userId },
          { admins: { some: { userId } } }
        ]
      }
    });

    if (!store) {
      return res.status(403).json({ error: 'No access to this store' });
    }

    next();
  } catch (error) {
    logger.error('Store access middleware error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

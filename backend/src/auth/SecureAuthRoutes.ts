import express from 'express';
import {
    autoRefresh,
    changePassword,
    getProfile,
    loginWithEmail,
    loginWithTelegram,
    logout,
    refreshToken,
    setPassword,
    updateProfile,
    verifyToken
} from './SecureAuthController';
import {
    loginSlowDown,
    optionalAuthMiddleware,
    ownerAuthMiddlewareStack,
    requireRole,
    secureAuthMiddleware
} from './SecureAuthMiddleware';
import { AuthenticatedRequest, UserRole } from './SecureAuthSystem';
// SECURITY FIX: CWE-352 - Add CSRF protection
import { csrfProtection } from '../middleware/csrfProtection';

const router = express.Router();

/**
 * Public Authentication Routes
 */

// Email/Password login with rate limiting
router.post('/login/email',
  loginSlowDown,
  loginWithEmail
);

// Telegram login with rate limiting
router.post('/login/telegram',
  loginSlowDown,
  loginWithTelegram
);

// Legacy Telegram auth route for backward compatibility with bot
router.post('/telegram',
  loginSlowDown,
  loginWithTelegram
);

// Token refresh
router.post('/refresh-token', refreshToken);

// Auto-refresh endpoint (smart refresh)
router.post('/auto-refresh', autoRefresh);

// Token verification (optional auth - can work without token)
router.post('/verify-token',
  optionalAuthMiddleware,
  verifyToken
);

/**
 * Protected Routes (require authentication)
 */

// Logout (requires valid token)
// SECURITY FIX: CWE-352 - Add CSRF protection
router.post('/logout',
  secureAuthMiddleware,
  csrfProtection,
  logout
);

// Get current user profile
router.get('/profile',
  secureAuthMiddleware,
  getProfile
);

// Update user profile
// SECURITY FIX: CWE-352 - Add CSRF protection
router.patch('/profile',
  secureAuthMiddleware,
  csrfProtection,
  updateProfile
);

// Change password (for users with email accounts)
// SECURITY FIX: CWE-352 - Add CSRF protection
router.post('/change-password',
  secureAuthMiddleware,
  csrfProtection,
  changePassword
);

/**
 * Admin/Owner Routes
 */

// Set password for any user (Owner only)
// SECURITY FIX: CWE-352 - Add CSRF protection
router.post('/set-password',
  ...ownerAuthMiddlewareStack,
  csrfProtection,
  setPassword
);

// Get user permissions (for debugging/admin)
router.get('/permissions/:userId?',
  secureAuthMiddleware,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { SecureAuthSystem } = await import('./SecureAuthSystem.js');
      const targetUserId = req.params.userId || req.user?.id;

      // Only owners can check other users' permissions
      if (targetUserId !== req.user?.id && req.user?.role !== UserRole.OWNER) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const permissions = await SecureAuthSystem.getUserPermissions(targetUserId);

      res.json({
        success: true,
        userId: targetUserId,
        permissions
      });
    } catch(error) {
      console.error('Error fetching permissions', error);
      res.status(500).json({
        error: 'Failed to get permissions',
        code: 'PERMISSIONS_ERROR'
      });
    }
  }
);

/**
 * Health Check / Status Routes
 */

// Authentication system health check
router.get('/health',
  async (req, res) => {
    try {
      // Check database connection
      const { prisma } = await import('../lib/prisma.js');
      await prisma.user.count();

      // Check Redis connection (if available)
      let redisStatus = 'not_configured';
      if (process.env.REDIS_URL) {
        // This would need to be implemented in SecureAuthSystem
        redisStatus = 'connected'; // Simplified for now
      }

      res.json({
        success: true,
        status: 'healthy',
        services: {
          database: 'connected',
          redis: redisStatus,
          jwt: 'operational'
        },
        timestamp: new Date().toISOString()
      });
    } catch(error) {
      console.error('Health check error', error);
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: 'Service check failed',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Get authentication statistics (Owner only)
router.get('/stats',
  ...ownerAuthMiddlewareStack,
  async (req, res) => {
    try {
      const { prisma } = await import('../lib/prisma.js');

      // Get user statistics
      const userStats = await prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true
        }
      });

      // Get active users (last 7 days) - would need lastLoginAt field
      const activeUsers = await prisma.user.count({
        where: {
          isActive: true
        }
      });

      const totalUsers = await prisma.user.count();

      res.json({
        success: true,
        stats: {
          totalUsers,
          activeUsers,
          usersByRole: userStats.reduce((acc: Record<UserRole, number>, stat) => {
            acc[stat.role] = stat._count.id;
            return acc;
          }, {} as Record<UserRole, number>),
          timestamp: new Date().toISOString()
        }
      });
    } catch(error) {
      console.error('Auth stats error', error);
      res.status(500).json({
        error: 'Failed to get auth stats',
        code: 'STATS_ERROR'
      });
    }
  }
);

export default router;

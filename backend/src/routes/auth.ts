import { Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { body } from 'express-validator';
import {
    checkQRAuth,
    generateQRAuth,
    getActiveSessions,
    getProfile,
    logout,
    promoteUser,
    refreshToken,
    revokeSession,
    telegramAuth,
    updateProfile
} from '../controllers/authController';
import { AuditAction, auditAuthAction } from '../middleware/auditLog';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { UserRole } from '../utils/jwt';
import { logger } from '../utils/logger';

const router = Router();

// SECURITY: Rate limiting for QR code generation (CWE-770)
const qrRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many QR code generation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// SECURITY: Rate limiting for Telegram authentication (CWE-770, CWE-307)
const telegramAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 authentication attempts per 15 minutes
  message: 'Too many Telegram authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => {
    // Rate limit by both IP and Telegram ID if available
    const telegramId = req.body?.telegramId;
    const ip = req.ip || 'unknown';
    return telegramId ? `telegram_auth:${ip}:${telegramId}` : `telegram_auth:${ip}`;
  }
});

// Telegram authentication - SECURITY: Enhanced with Zod validation and rate limiting (CWE-20, CWE-770)
router.post(
  '/telegram',
  telegramAuthRateLimit,
  telegramAuth
);

// Get current user profile
router.get('/profile', authMiddleware, getProfile);

// Update profile
router.put(
  '/profile',
  authMiddleware,
  [
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('phone').optional().isString(),
  ],
  validate,
  updateProfile
);

// Promote user (OWNER only)
router.post(
  '/promote',
  authMiddleware,
  requireRole([UserRole.OWNER]),
  [
    body('userId').isString().withMessage('User ID required'),
    body('role').isIn(['ADMIN', 'VENDOR']).withMessage('Invalid role'),
  ],
  validate,
  promoteUser
);

// QR Authentication endpoints with rate limiting
router.post('/qr-auth', qrRateLimit, generateQRAuth);
router.get('/qr-auth/:sessionId', qrRateLimit, checkQRAuth);

// Token refresh
router.post('/refresh', refreshToken);

// Logout
router.post('/logout', authMiddleware, logout);

// Session management
router.get('/sessions', authMiddleware, getActiveSessions);
router.delete('/sessions/:sessionId', authMiddleware, revokeSession);

// Get AdminJS access token for technical admin panel
router.get('/adminjs-token', authMiddleware, requireRole([UserRole.OWNER, UserRole.ADMIN]), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Generate a temporary token for AdminJS access
  const adminJsToken = req.headers.authorization?.replace('Bearer ', '');

  if (!adminJsToken) {
    throw new AppError('No token available', 400);
  }

  // SECURITY: Use structured logging to prevent log injection (CWE-117)
  logger.info('AdminJS token requested', {
    userId: req.user.id,
    role: req.user.role
  });

  // Audit log the AdminJS access request
  await auditAuthAction(req.user.id, AuditAction.ADMINJS_ACCESS, req, {
    action: 'token_requested',
    role: req.user.role
  });

  res.json({
    token: adminJsToken,
    email: req.user.telegramId, // Use telegram ID as login for AdminJS
    expiresIn: '7d',
    adminJsUrl: process.env.ADMIN_JS_URL || 'http://82.147.84.78:3001/admin',
    instructions: {
      ru: 'Используйте Telegram ID как логин и этот токен как пароль для входа в AdminJS',
      en: 'Use your Telegram ID as login and this token as password for AdminJS login'
    }
  });
}));

export default router;

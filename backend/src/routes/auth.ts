import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import { telegramAuth, getProfile, updateProfile, promoteUser } from '../controllers/authController';
import { validate } from '../middleware/validation';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { auditAuthAction, AuditAction } from '../middleware/auditLog';
import { UserRole } from '../utils/jwt';

const router = Router();


// Telegram authentication
router.post(
  '/telegram',
  [
    body('telegramId').isNumeric().withMessage('Valid Telegram ID required'),
    body('username').optional().isString(),
    body('firstName').optional().isString(),
    body('lastName').optional().isString(),
  ],
  validate,
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

  logger.info(`AdminJS token requested by user: ${req.user.id} (${req.user.role})`);

  // Audit log the AdminJS access request
  await auditAuthAction(req.user.id, AuditAction.ADMINJS_ACCESS, req, {
    action: 'token_requested',
    role: req.user.role
  });

  res.json({
    token: adminJsToken,
    email: req.user.telegramId, // Use telegram ID as login for AdminJS
    expiresIn: '7d',
    adminJsUrl: process.env.ADMIN_JS_URL || 'http://localhost:3001/admin',
    instructions: {
      ru: 'Используйте Telegram ID как логин и этот токен как пароль для входа в AdminJS',
      en: 'Use your Telegram ID as login and this token as password for AdminJS login'
    }
  });
}));

export default router;

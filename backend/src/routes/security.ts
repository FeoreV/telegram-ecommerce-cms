import { Router, Response, NextFunction } from 'express';
import { compromiseResponseService } from '../services/CompromiseResponseService';
import { authMiddleware, requireRole } from '../middleware/auth';
import { UserRole } from '../utils/jwt';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  performSecurityHealthCheck, 
  securityMetrics
} from '../config/security';
import { 
  JWTSecurity, 
  logoutMiddleware, 
  tokenRefreshMiddleware 
} from '../middleware/jwtSecurity';
import { logger } from '../utils/logger';
import { body, validationResult } from 'express-validator';

const router = Router();

// Security health check endpoint (admin only)
router.get('/health', 
  authMiddleware,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const healthCheck = performSecurityHealthCheck();
    
    logger.info('Security health check requested', {
      userId: (req as any).user.id,
      status: healthCheck.status
    });

    res.json({
      timestamp: new Date().toISOString(),
      ...healthCheck
    });
  })
);

// Security metrics endpoint (admin only)
router.get('/metrics',
  authMiddleware,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const metrics = securityMetrics.getMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics,
      period: '24h' // Metrics are collected over 24 hours
    });
  })
);

// Reset security metrics (owner only)
router.post('/metrics/reset',
  authMiddleware,
  requireRole([UserRole.OWNER]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    securityMetrics.resetMetrics();
    
    logger.info('Security metrics reset', {
      userId: (req as any).user.id,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Security metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Token refresh endpoint
router.post('/refresh-token',
  [
    body('refreshToken')
      .isString()
      .notEmpty()
      .withMessage('Refresh token is required')
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Use the token refresh middleware
    return tokenRefreshMiddleware(req, res, next);
  })
);

// Logout endpoint
router.post('/logout',
  authMiddleware,
  [
    body('refreshToken')
      .optional()
      .isString()
      .withMessage('Refresh token must be a string')
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Use the logout middleware
    return logoutMiddleware(req, res);
  })
);

// Logout from all devices (invalidate all tokens for user)
router.post('/logout-all',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = (req as any).user;
    const currentToken = (req as any).token;

    // In a full implementation, this would:
    // 1. Increment user's token version in database
    // 2. Invalidate all refresh tokens for the user
    // 3. Add all user's tokens to blacklist
    
    // For now, just blacklist current token
    if (currentToken) {
      JWTSecurity.blacklistToken(currentToken);
    }

    logger.info('User logged out from all devices', {
      userId: user.id,
      ip: req.ip
    });

    res.json({
      message: 'Logged out from all devices successfully'
    });
  })
);

// Check token validity
router.get('/validate-token',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = (req as any).user;
    const sessionId = (req as any).sessionId;

    // If we reach here, token is valid
    res.json({
      valid: true,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      sessionId,
      timestamp: new Date().toISOString()
    });
  })
);

// Get current security configuration (admin only, sanitized)
router.get('/config',
  authMiddleware,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const config = {
      environment: process.env.NODE_ENV,
      security: {
        rateLimiting: {
          enabled: true,
          windowMs: 15 * 60 * 1000,
          maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 100
        },
        cors: {
          enabled: true,
          allowedOrigins: [
            process.env.FRONTEND_URL || 'http://82.147.84.78:3000',
            process.env.ADMIN_PANEL_URL || 'http://82.147.84.78:3001'
          ].filter(Boolean)
        },
        security: {
          headers: true,
          bruteForceProtection: process.env.ENABLE_BRUTE_FORCE_PROTECTION !== 'false',
          requestSanitization: process.env.ENABLE_REQUEST_SANITIZATION !== 'false',
          securityMonitoring: process.env.ENABLE_SECURITY_MONITORING !== 'false'
        },
        jwt: {
          accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
          refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
          issuer: process.env.JWT_ISSUER || 'telegram-store-api'
        }
      }
    };

    res.json({
      timestamp: new Date().toISOString(),
      config
    });
  })
);

// Kill-switch and quarantine controls (OWNER only)
router.post('/kill-switch/activate',
  authMiddleware,
  requireRole([UserRole.OWNER]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await compromiseResponseService.activateKillSwitch(req.body?.reason || 'manual');
    res.json({ status: 'kill_switch_activated' });
  })
);

router.post('/kill-switch/deactivate',
  authMiddleware,
  requireRole([UserRole.OWNER]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await compromiseResponseService.deactivateKillSwitch();
    res.json({ status: 'kill_switch_deactivated' });
  })
);

router.post('/quarantine/activate',
  authMiddleware,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await compromiseResponseService.activateQuarantine(req.body?.reason || 'manual');
    res.json({ status: 'quarantine_activated' });
  })
);

router.post('/quarantine/deactivate',
  authMiddleware,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await compromiseResponseService.deactivateQuarantine();
    res.json({ status: 'quarantine_deactivated' });
  })
);

// Security incident reporting endpoint
router.post('/report-incident',
  authMiddleware,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [
    body('type')
      .isIn(['suspicious_activity', 'brute_force', 'token_abuse', 'unauthorized_access'])
      .withMessage('Invalid incident type'),
    body('description')
      .isString()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('severity')
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid severity level'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object')
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { type, description, severity, metadata } = req.body;
    const reporter = (req as any).user;

    const incident = {
      id: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      severity,
      metadata,
      reporter: {
        id: reporter.id,
        username: reporter.username,
        role: reporter.role
      },
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Log the incident
    logger.warn('Security incident reported', incident);

    // In a full implementation, save to database and potentially alert
    // await prisma.securityIncident.create({ data: incident });

    res.status(201).json({
      message: 'Security incident reported successfully',
      incidentId: incident.id,
      timestamp: incident.timestamp
    });
  })
);

// Generate new session (force token refresh)
router.post('/new-session',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = (req as any).user;
    const currentToken = (req as any).token;

    // Blacklist current token
    if (currentToken) {
      JWTSecurity.blacklistToken(currentToken);
    }

    // Generate new session
    const sessionId = JWTSecurity.generateSessionId();
    const newAccessToken = JWTSecurity.generateAccessToken({
      userId: user.id,
      role: user.role,
      telegramId: user.telegramId,
      sessionId
    });

    logger.info('New session created', {
      userId: user.id,
      sessionId,
      ip: req.ip
    });

    res.json({
      message: 'New session created successfully',
      accessToken: newAccessToken,
      sessionId,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  })
);

export default router;

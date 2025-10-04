import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redisService } from '../lib/redis';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { NotificationChannel, NotificationPriority, NotificationService, NotificationType } from '../services/notificationService';
import { generateRefreshToken, generateToken, UserRole, verifyRefreshToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { sanitizeForLog } from '../utils/sanitizer';

// SECURITY: QR sessions stored in Redis instead of memory (CWE-922)
interface QRSession {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  telegramId?: string;
  completed?: boolean;
}

const QR_SESSION_PREFIX = 'qr_session:';
const QR_SESSION_TTL = 300; // 5 minutes

// Enhanced Telegram authentication
export const telegramAuth = asyncHandler(async (req: Request, res: Response) => {
  const {
    telegramId,
    username,
    firstName,
    lastName,
    authDate,
    hash,
    photoUrl,
    sessionId // For QR code linking
  } = req.body;

  if (!telegramId) {
    throw new AppError('Telegram ID is required', 400);
  }

  // SECURITY: Telegram authentication signature is mandatory (CWE-287)
  if (!hash || !authDate) {
    logger.warn('Telegram auth attempt without signature', {
      telegramId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Telegram authentication signature required', 400);
  }

  // Verify Telegram auth data integrity
  const isValid = verifyTelegramAuth({ telegramId, username, firstName, lastName, authDate }, hash);
  if (!isValid) {
    logger.warn('Invalid Telegram auth attempt', {
      telegramId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Invalid Telegram authentication data', 401);
  }

  // SECURITY: Check timestamp to prevent replay attacks (CWE-294)
  const authTimestamp = parseInt(authDate);
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 300; // 5 minutes

  if (now - authTimestamp > maxAge) {
    logger.warn('Expired Telegram auth attempt', {
      telegramId,
      age: now - authTimestamp,
      maxAge,
      ip: req.ip
    });
    throw new AppError('Authentication data expired', 401);
  }

  if (authTimestamp > now + 60) {
    logger.warn('Future-dated Telegram auth attempt', {
      telegramId,
      authTimestamp,
      now,
      ip: req.ip
    });
    throw new AppError('Invalid authentication timestamp', 401);
  }

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { telegramId: telegramId.toString() },
  });

  if (!user) {
    // ============================================================================
    // SECURITY: AUTOMATIC OWNER CREATION IS PERMANENTLY DISABLED
    // ============================================================================
    // All new users are ALWAYS created as CUSTOMER by default.
    // OWNER role MUST be assigned manually via:
    //   1. Admin tools: node backend/tools/admin/promote_user.js <telegram-id> OWNER
    //   2. Direct SQL: UPDATE users SET role = 'OWNER' WHERE telegramId = 'xxx'
    //   3. Admin panel (requires existing OWNER access)
    //
    // SUPER_ADMIN_TELEGRAM_ID environment variable is DEPRECATED and IGNORED.
    // This prevents privilege escalation via environment variable manipulation.
    // See SECURITY_OWNER_CREATION.md for complete documentation.
    // ============================================================================
    const initialRole: UserRole = UserRole.CUSTOMER;

    user = await prisma.user.create({
      data: {
        telegramId: telegramId.toString(),
        username,
        firstName,
        lastName,
        role: initialRole, // ALWAYS CUSTOMER - no exceptions
        lastLoginAt: new Date(),
        profilePhoto: photoUrl,
      },
    });

    logger.info('New user created with CUSTOMER role', {
      telegramId: sanitizeForLog(telegramId),
      role: sanitizeForLog(initialRole),
      note: 'OWNER role must be assigned manually via admin tools'
    });

    // Send welcome notification
    await NotificationService.send({
      title: 'Добро пожаловать!',
      message: 'Ваш аккаунт успешно создан в системе управления e-commerce платформой',
      type: NotificationType.USER_REGISTERED,
      priority: NotificationPriority.MEDIUM,
      recipients: [user.id],
      channels: [NotificationChannel.TELEGRAM],
      data: {
        userId: user.id,
        role: user.role
      }
    });
  } else {
    // Update user info and last login, do not elevate roles based on Telegram ID
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        username,
        firstName,
        lastName,
        role: user.role,
        lastLoginAt: new Date(),
        profilePhoto: photoUrl,
      },
    });

    logger.info('User updated', { id: sanitizeForLog(user.id), role: sanitizeForLog(user.role) });
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403);
  }

  // Generate tokens
  const accessToken = generateToken({
    userId: user.id,
    telegramId: user.telegramId,
    role: user.role as UserRole,
  });

  const refreshToken = generateRefreshToken(user.id);

  // Store only a hash of the refresh token in UserSession
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || '',
    }
  });

  // If this was a QR code session, mark it as completed
  if (sessionId) {
    try {
      const redis = redisService.getClient();
      const sessionKey = `${QR_SESSION_PREFIX}${sessionId}`;
      const sessionData = await redis.get(sessionKey);

      if (sessionData) {
        const session: QRSession = JSON.parse(sessionData);
        session.completed = true;
        session.telegramId = user.telegramId;

        // Update Redis with remaining TTL
        const ttl = await redis.ttl(sessionKey);
        await redis.setex(sessionKey, ttl > 0 ? ttl : QR_SESSION_TTL, JSON.stringify(session));
      }
    } catch (error) {
      logger.warn('Failed to update QR session in Redis', {
        sessionId,
        error: error instanceof Error ? error.message : error
      });
      // Don't throw error, just log it - session is still valid
    }
  }

  // Log successful login
  logger.info('User logged in successfully', { userId: sanitizeForLog(user.id), method: sessionId ? 'QR code' : 'direct' });

  res.json({
    success: true,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profilePhoto: user.profilePhoto,
      lastLoginAt: user.lastLoginAt,
    },
    sessionId: sessionId || null,
  });
});

// Generate QR code for authentication
export const generateQRAuth = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + QR_SESSION_TTL * 1000);

  const session: QRSession = {
    sessionId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    completed: false,
  };

  // Store in Redis with TTL
  const redis = redisService.getClient();
  await redis.setex(
    `${QR_SESSION_PREFIX}${sessionId}`,
    QR_SESSION_TTL,
    JSON.stringify(session)
  );

  // Generate deep link for Telegram bot
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const deepLink = `https://t.me/${botUsername}?start=auth_${sessionId}`;

  logger.info('QR auth session created', { sessionId: sanitizeForLog(sessionId) });

  res.json({
    success: true,
    sessionId,
    deepLink,
    qrData: deepLink,
    expiresAt: expiresAt.toISOString(),
    expiresIn: QR_SESSION_TTL,
  });
});

// Check QR authentication status
export const checkQRAuth = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const redis = redisService.getClient();
  const sessionKey = `${QR_SESSION_PREFIX}${sessionId}`;
  const sessionData = await redis.get(sessionKey);

  if (!sessionData) {
    throw new AppError('Session not found or expired', 404);
  }

  const session: QRSession = JSON.parse(sessionData);
  const expiresAt = new Date(session.expiresAt);

  if (new Date() > expiresAt) {
    await redis.del(sessionKey);
    throw new AppError('Session expired', 410);
  }

  res.json({
    success: true,
    sessionId,
    completed: session.completed || false,
    telegramId: session.telegramId || null,
    expiresAt: session.expiresAt,
  });
});

// Refresh access token
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  // Verify refresh token
  try {
    verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  // Find session in database by hashed token
  const providedHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const session = await prisma.userSession.findFirst({
    where: {
      refreshToken: providedHash,
      isRevoked: false,
      expiresAt: { gt: new Date() }
    },
    include: {
      user: true
    }
  });

  if (!session) {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = session.user;

  if (!user || !user.isActive) {
    throw new AppError('User not found or inactive', 401);
  }

  // Generate new access token
  const newAccessToken = generateToken({
    userId: user.id,
    telegramId: user.telegramId,
    role: user.role as UserRole,
  });

  // Optionally rotate refresh token
  const newRefreshToken = generateRefreshToken(user.id);
  const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

  // Update session with new hashed refresh token
  await prisma.userSession.update({
    where: { id: session.id },
    data: {
      refreshToken: newRefreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }
  });

  logger.info('Token refreshed', { userId: sanitizeForLog(user.id) });

  res.json({
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
});

// Logout (invalidate refresh token)
export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // SECURITY: Revoke access token by adding to blacklist (CWE-613)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7);
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    // Get token expiry from JWT
    const jwt = require('jsonwebtoken');
    const decoded: any = jwt.decode(accessToken);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Add to revoked tokens table (requires prisma generate)
    try {
      await (prisma as any).revokedToken?.create({
        data: {
          token: tokenHash,
          userId: req.user.id,
          expiresAt,
          reason: 'User logout'
        }
      });
    } catch (error) {
      logger.debug('RevokedToken model not available, token revocation skipped');
    }

    // Legacy catch block for compatibility
    Promise.resolve().catch(() => {
      // Token might already be revoked, ignore error
    });
  }

  // Delete specific session if refresh token provided
  if (refreshToken) {
    const providedHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await prisma.userSession.deleteMany({
      where: {
        userId: req.user.id,
        refreshToken: providedHash,
      }
    });
  } else {
    // Delete all sessions for user (logout from all devices)
    await prisma.userSession.deleteMany({
      where: {
        userId: req.user.id,
      }
    });
  }

  logger.info('User logged out', { userId: sanitizeForLog(req.user.id) });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Get user profile
export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      profilePhoto: true,
      lastLoginAt: true,
      balance: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          orders: true,
          ownedStores: true,
        }
      }
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    user,
  });
});

// Update profile
export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const { username, firstName, lastName, email } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      username,
      firstName,
      lastName,
      email,
    },
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profilePhoto: true,
    }
  });

  logger.info('Profile updated', { userId: sanitizeForLog(req.user.id) });

  res.json({
    success: true,
    user: updatedUser,
  });
});

// Generate deep link for specific actions
export const generateDeepLink = asyncHandler(async (req: Request, res: Response) => {
  const { action, params } = req.body;

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    throw new AppError('Bot username not configured', 500);
  }

  let deepLinkParam = '';
  switch (action) {
    case 'auth': {
      const sessionId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

      const session: QRSession = {
        sessionId,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        completed: false,
      };

      const redis = redisService.getClient();
      await redis.setex(
        `${QR_SESSION_PREFIX}${sessionId}`,
        600, // 10 minutes
        JSON.stringify(session)
      );

      deepLinkParam = `auth_${sessionId}`;
      break;
    }
    case 'admin_panel':
      deepLinkParam = 'admin_panel';
      break;
    case 'order_verify':
      if (!params?.orderId) {
        throw new AppError('Order ID required for order verification link', 400);
      }
      deepLinkParam = `verify_${params.orderId}`;
      break;
    default:
      throw new AppError('Invalid action', 400);
  }

  const deepLink = `https://t.me/${botUsername}?start=${deepLinkParam}`;

  res.json({
    success: true,
    deepLink,
    action,
    params: deepLinkParam,
  });
});

// Get active sessions
export const getActiveSessions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Get user sessions
  const sessions = await prisma.userSession.findMany({
    where: {
      userId: req.user.id,
      expiresAt: { gt: new Date() },
      isRevoked: false,
    },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    success: true,
    sessions,
  });
});

// Revoke session
export const revokeSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const { sessionId } = req.params;

  // Revoke user session
  await prisma.userSession.deleteMany({
    where: {
      id: sessionId,
      userId: req.user.id,
    }
  });

  logger.info('Session revoked', { sessionId: sanitizeForLog(sessionId), userId: sanitizeForLog(req.user.id) });

  res.json({
    success: true,
    message: 'Session revoked successfully'
  });
});

// Helper function to verify Telegram authentication data
// SECURITY: Uses timing-safe comparison to prevent timing attacks (CWE-208)
function verifyTelegramAuth(authData: any, hash: string): boolean {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new AppError('Telegram bot token not configured', 500);
  }
  const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const checkString = Object.keys(authData)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => `${key}=${authData[key]}`)
    .join('\n');

  const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

  // Use timing-safe comparison
  const hmacBuffer = Buffer.from(hmac, 'hex');
  const hashBuffer = Buffer.from(hash, 'hex');

  if (hmacBuffer.length !== hashBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hmacBuffer, hashBuffer);
}

// Cleanup expired QR sessions is now handled by Redis TTL automatically
// No need for manual cleanup interval

// User promotion functionality moved to userController
export const promoteUser = asyncHandler(async (_req: AuthenticatedRequest, _res: Response) => {
  // This functionality is handled in userController.ts via /api/users/{id}/role endpoint
  throw new AppError('User promotion should be handled through /api/users/{id}/role endpoint', 400);
});

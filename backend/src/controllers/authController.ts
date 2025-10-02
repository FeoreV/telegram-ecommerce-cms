import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { generateToken, generateRefreshToken, verifyRefreshToken, UserRole } from '../utils/jwt';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { NotificationService, NotificationPriority, NotificationType, NotificationChannel } from '../services/notificationService';

// Store for QR code sessions (in production, use Redis)
const qrSessions = new Map<string, { 
  sessionId: string; 
  createdAt: Date; 
  expiresAt: Date; 
  telegramId?: string;
  completed?: boolean;
}>();

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

  // Verify Telegram auth data integrity if hash provided
  if (hash && authDate) {
    const isValid = verifyTelegramAuth({ telegramId, username, firstName, lastName, authDate }, hash);
    if (!isValid) {
      throw new AppError('Invalid Telegram authentication data', 400);
    }
  }

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { telegramId: telegramId.toString() },
  });

  if (!user) {
    // Create new user. If matches SUPER_ADMIN_TELEGRAM_ID, elevate to OWNER
    const isSuperAdmin = process.env.SUPER_ADMIN_TELEGRAM_ID && process.env.SUPER_ADMIN_TELEGRAM_ID === telegramId.toString();
    const initialRole: UserRole = isSuperAdmin ? UserRole.OWNER : UserRole.CUSTOMER;

    user = await prisma.user.create({
      data: {
        telegramId: telegramId.toString(),
        username,
        firstName,
        lastName,
        role: initialRole,
        lastLoginAt: new Date(),
        profilePhoto: photoUrl,
      },
    });

    logger.info(`New user created: ${telegramId} with role: ${initialRole}`);
    
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
    
    logger.info(`User updated: id=${user.id}, role=${user.role}`);
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
  if (sessionId && qrSessions.has(sessionId)) {
    const session = qrSessions.get(sessionId);
    if (!session) {
      throw new AppError('QR session not found', 404);
    }
    session.completed = true;
    session.telegramId = user.telegramId;
    qrSessions.set(sessionId, session);
  }

  // Log successful login
  logger.info(`User ${user.id} logged in successfully via ${sessionId ? 'QR code' : 'direct'} method`);

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
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  
  qrSessions.set(sessionId, {
    sessionId,
    createdAt: new Date(),
    expiresAt,
    completed: false,
  });

  // Generate deep link for Telegram bot
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const deepLink = `https://t.me/${botUsername}?start=auth_${sessionId}`;
  
  logger.info(`QR auth session created: ${sessionId}`);

  res.json({
    success: true,
    sessionId,
    deepLink,
    qrData: deepLink,
    expiresAt: expiresAt.toISOString(),
    expiresIn: 300, // 5 minutes in seconds
  });
});

// Check QR authentication status
export const checkQRAuth = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  const session = qrSessions.get(sessionId);
  
  if (!session) {
    throw new AppError('Session not found or expired', 404);
  }
  
  if (new Date() > session.expiresAt) {
    qrSessions.delete(sessionId);
    throw new AppError('Session expired', 410);
  }
  
  res.json({
    success: true,
    sessionId,
    completed: session.completed || false,
    telegramId: session.telegramId || null,
    expiresAt: session.expiresAt.toISOString(),
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
  } catch (error) {
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
  
  logger.info(`Token refreshed for user ${user.id}`);
  
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
  
  logger.info(`User ${req.user.id} logged out`);
  
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

  logger.info(`Profile updated for user ${req.user.id}`);

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
      qrSessions.set(sessionId, {
        sessionId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        completed: false,
      });
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
  
  logger.info(`Session ${sessionId} revoked by user ${req.user.id}`);
  
  res.json({
    success: true,
    message: 'Session revoked successfully'
  });
});

// Helper function to verify Telegram authentication data
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
  return hmac === hash;
}

// Cleanup expired QR sessions (call periodically)
export const cleanupExpiredSessions = () => {
  const now = new Date();
  for (const [sessionId, session] of qrSessions.entries()) {
    if (now > session.expiresAt) {
      qrSessions.delete(sessionId);
    }
  }
};

// Start cleanup interval
setInterval(cleanupExpiredSessions, 60 * 1000); // Every minute

// User promotion functionality moved to userController
export const promoteUser = asyncHandler(async (_req: AuthenticatedRequest, _res: Response) => {
  // This functionality is handled in userController.ts via /api/users/{id}/role endpoint
  throw new AppError('User promotion should be handled through /api/users/{id}/role endpoint', 400);
});
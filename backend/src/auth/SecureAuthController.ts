import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { AuthenticatedRequest, SecureAuthSystem, UserRole } from './SecureAuthSystem';

/**
 * Modern Authentication Controllers using SecureAuthSystem
 */

/**
 * Email/Password Authentication (for Admin Panel)
 */
export const loginWithEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required',
      code: 'MISSING_CREDENTIALS'
    });
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      error: 'Invalid credential format',
      // NOTE: Error code identifier, not a credential (CWE-798 false positive)
      code: 'INVALID_FORMAT'
    });
  }

  // Additional validation
  if (password.length < 6) {
    return res.status(400).json({
      error: 'Password must be at least 6 characters',
      code: 'PASSWORD_TOO_SHORT'
    });
  }

  try {
    const result = await SecureAuthSystem.authenticateWithEmail(email.toLowerCase().trim(), password);

    // Log successful login
    logger.info('User logged in successfully via email', {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Set secure HTTP-only cookies for tokens (optional, can also use headers only)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/'
    };

    // Access token cookie (short-lived)
    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Refresh token cookie (longer-lived)
    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Authentication successful',
      user: result.user,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: '15m'
      }
    });
  } catch (error: unknown) {
    logger.warn('Email login failed', {
      email,
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Don't reveal whether user exists or not
    res.status(401).json({
      error: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS'
    });
  }
});

/**
 * Telegram Authentication
 */
export const loginWithTelegram = asyncHandler(async (req: Request, res: Response) => {
  const { telegramId, username, firstName, lastName } = req.body;

  // Input validation
  if (!telegramId) {
    return res.status(400).json({
      error: 'Telegram ID is required',
      code: 'MISSING_TELEGRAM_ID'
    });
  }

  const telegramIdString = telegramId.toString();

  try {
    const result = await SecureAuthSystem.authenticateWithTelegram(
      telegramIdString,
      { username, firstName, lastName }
    );

    // Log successful login
    logger.info('User logged in successfully via Telegram', {
      userId: result.user.id,
      telegramId: telegramIdString,
      role: result.user.role,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      isNewUser: !result.user.username && username // Simple check for new user
    });

    // Set cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/'
    };

    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Authentication successful',
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      token: result.accessToken, // Fallback for legacy frontend code
      expiresIn: '15m'
    });
  } catch (error: unknown) {
    logger.error('Telegram login failed', {
      telegramId: telegramIdString,
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      error: 'Authentication failed',
      code: 'TELEGRAM_AUTH_ERROR',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Token Refresh
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.body.refreshToken || req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      error: 'Refresh token required',
      code: 'MISSING_REFRESH_TOKEN'
    });
  }

  try {
    const result = await SecureAuthSystem.refreshTokenPair(refreshToken);

    logger.info('Tokens refreshed successfully', {
      userId: result.user.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Update cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/'
    };

    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      user: result.user,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: '15m'
      }
    });
  } catch (error: unknown) {
    logger.warn('Token refresh failed', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Clear invalid cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(401).json({
      error: 'Invalid or expired refresh token',
      code: 'INVALID_REFRESH_TOKEN',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Logout
 */
export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken: bodyRefreshToken } = req.body;
  const accessToken = req.token;
  const refreshToken = bodyRefreshToken || req.cookies.refreshToken;
  const sessionId = req.sessionId;

  try {
    await SecureAuthSystem.logout(accessToken, refreshToken, sessionId);

    logger.info('User logged out successfully', {
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error: unknown) {
    logger.error('Logout error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
      ip: req.ip
    });

    // Still clear cookies even if logout partially failed
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get Current User Profile
 */
export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Fetch fresh user data with additional details
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      telegramId: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      balance: true,
      createdAt: true,
      updatedAt: true,
      // Include store relationships
      ownedStores: {
        select: {
          id: true,
          name: true,
          currency: true
        }
      },
      managedStores: {
        select: {
          storeId: true,
          store: {
            select: {
              id: true,
              name: true,
              currency: true
            }
          }
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }

  // Get user permissions
  let permissions: string[] = [];
  try {
    permissions = await SecureAuthSystem.getUserPermissions(user.id);
  } catch (error) {
    logger.warn('Failed to get user permissions, continuing without them', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  res.json({
    success: true,
    user: {
      ...user,
      managedStores: user.managedStores.map(ms => ms.store),
      permissions
    }
  });
});

/**
 * Update User Profile
 */
export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const { username, firstName, lastName, email } = req.body;
  type UserUpdatePayload = {
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
  const updates: UserUpdatePayload = {};

  // Validate and prepare updates
  if (username !== undefined) {
    if (typeof username === 'string' && username.length > 0) {
      updates.username = username.trim();
    } else if (username !== null) {
      return res.status(400).json({
        error: 'Invalid username format',
        code: 'INVALID_USERNAME'
      });
    } else {
      updates.username = null;
    }
  }

  if (firstName !== undefined) {
    if (typeof firstName === 'string' && firstName.length > 0) {
      updates.firstName = firstName.trim();
    } else if (firstName !== null) {
      return res.status(400).json({
        error: 'Invalid first name format',
        code: 'INVALID_FIRSTNAME'
      });
    } else {
      updates.firstName = null;
    }
  }

  if (lastName !== undefined) {
    if (typeof lastName === 'string' && lastName.length > 0) {
      updates.lastName = lastName.trim();
    } else if (lastName !== null) {
      return res.status(400).json({
        error: 'Invalid last name format',
        code: 'INVALID_LASTNAME'
      });
    } else {
      updates.lastName = null;
    }
  }

  if (email !== undefined) {
    if (typeof email === 'string' && email.includes('@')) {
      // Check if email is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          id: { not: req.user.id }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'Email already in use',
          code: 'EMAIL_EXISTS'
        });
      }

      updates.email = email.toLowerCase().trim();
    } else if (email !== null) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    } else {
      updates.email = null;
    }
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
      select: {
        id: true,
        email: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true
      }
    });

    logger.info('User profile updated', {
      userId: req.user.id,
      updatedFields: Object.keys(updates),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error: unknown) {
    logger.error('Profile update failed', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user.id,
      updates
    });

    res.status(500).json({
      error: 'Profile update failed',
      code: 'UPDATE_ERROR'
    });
  }
});

/**
 * Change Password (for users with email accounts)
 */
export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: 'Current password and new password are required',
      code: 'MISSING_PASSWORDS'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      error: 'New password must be at least 6 characters',
      code: 'PASSWORD_TOO_SHORT'
    });
  }

  try {
    await SecureAuthSystem.changePassword(req.user.id, currentPassword, newPassword);

    logger.info('Password changed successfully', {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error: unknown) {
    logger.warn('Password change failed', {
      userId: req.user.id,
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip
    });

    if (error instanceof Error && error.message.includes('Current password is incorrect')) {
      return res.status(400).json({
        error: 'Current password is incorrect',
        code: 'INCORRECT_CURRENT_PASSWORD'
      });
    } else if (error instanceof Error && error.message.includes('No password set')) {
      return res.status(400).json({
        error: 'No password set for this account. Contact administrator.',
        code: 'NO_PASSWORD_SET'
      });
    }

    res.status(500).json({
      error: 'Password change failed',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

/**
 * Set Password (for users without password, admin function)
 */
export const setPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.OWNER) {
    return res.status(403).json({
      error: 'Only owners can set passwords for users',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }

  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({
      error: 'User ID and password are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: 'Password must be at least 6 characters',
      code: 'PASSWORD_TOO_SHORT'
    });
  }

  try {
    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true }
    });

    if (!targetUser) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    await SecureAuthSystem.setPassword(userId, password);

    logger.info('Password set for user by owner', {
      adminId: req.user.id,
      targetUserId: userId,
      targetUserRole: targetUser.role,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Password set successfully for user'
    });
  } catch (error: unknown) {
    logger.error('Set password failed', {
      error: error instanceof Error ? error.message : String(error),
      adminId: req.user.id,
      targetUserId: userId
    });

    res.status(500).json({
      error: 'Failed to set password',
      code: 'SET_PASSWORD_ERROR'
    });
  }
});

/**
 * Verify Token (for frontend to check if token is still valid)
 */
export const verifyToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // If we reach here, the token is valid (middleware already verified it)
  const token = req.token;
  const needsRefresh = SecureAuthSystem.isTokenNearExpiry(token);

  res.json({
    success: true,
    valid: true,
    user: req.user,
    sessionId: req.sessionId,
    needsRefresh,
    expiresIn: needsRefresh ? 'soon' : 'valid'
  });
});

/**
 * Auto-refresh endpoint - checks if refresh is needed and returns new tokens
 */
export const autoRefresh = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken: currentAccessToken, refreshToken } = req.body;
  const cookieAccessToken = req.cookies?.accessToken;
  const cookieRefreshToken = req.cookies?.refreshToken;

  const accessToken = currentAccessToken || cookieAccessToken;
  const refreshTokenToUse = refreshToken || cookieRefreshToken;

  if (!accessToken || !refreshTokenToUse) {
    return res.status(400).json({
      success: false,
      error: 'Both access and refresh tokens required',
      code: 'MISSING_TOKENS'
    });
  }

  try {
    const refreshResult = await SecureAuthSystem.autoRefreshIfNeeded(accessToken, refreshTokenToUse);

    if (!refreshResult.needsRefresh) {
      return res.json({
        success: true,
        refreshed: false,
        message: 'Token still valid, no refresh needed'
      });
    }

    if (refreshResult.newTokens) {
      // Set new cookies
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        path: '/'
      };

      res.cookie('accessToken', refreshResult.newTokens.accessToken, {
        ...cookieOptions,
        maxAge: 2 * 60 * 60 * 1000 // 2 hours
      });

      res.cookie('refreshToken', refreshResult.newTokens.refreshToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      logger.info('Auto-refresh successful', {
        userId: refreshResult.newTokens.user.id,
        ip: req.ip
      });

      return res.json({
        success: true,
        refreshed: true,
        tokens: {
          accessToken: refreshResult.newTokens.accessToken,
          refreshToken: refreshResult.newTokens.refreshToken,
          expiresIn: '2h'
        },
        user: refreshResult.newTokens.user
      });
    }

    // Refresh needed but failed - user should re-authenticate
    return res.status(401).json({
      success: false,
      error: 'Token refresh required but failed',
      code: 'REFRESH_REQUIRED',
      action: 'reauth'
    });

  } catch (error: unknown) {
    logger.warn('Auto-refresh failed', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip
    });

    return res.status(401).json({
      success: false,
      error: 'Token refresh failed',
      code: 'REFRESH_FAILED',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

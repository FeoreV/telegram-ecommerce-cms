import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { logger } from './logger';

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  VENDOR = 'VENDOR',
  CUSTOMER = 'CUSTOMER'
}

export interface TokenPayload {
  userId: string;
  telegramId: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
}

// SECURITY FIX: CWE-798 - Remove hardcoded credentials, enforce environment variables
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  const error = 'JWT_SECRET environment variable must be set and at least 32 characters long';
  logger.error(error);
  throw new Error(error);
}

if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
  const error = 'JWT_REFRESH_SECRET environment variable must be set and at least 32 characters long';
  logger.error(error);
  throw new Error(error);
}

const JWT_SECRET: string = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN: StringValue | number = (process.env.JWT_EXPIRES_IN || '1h') as StringValue;
const JWT_REFRESH_EXPIRES_IN: StringValue | number = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as StringValue;

// Generate access token
export function generateToken(payload: TokenPayload): string {
  try {
    const options: jwt.SignOptions = {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'botrt-ecommerce',
      audience: 'botrt-admin-panel',
      subject: payload.userId,
    };
    return jwt.sign(payload, JWT_SECRET, options);
  } catch (error) {
    logger.error('Error generating JWT token:', error);
    throw new Error('Token generation failed');
  }
}

// Generate refresh token
export function generateRefreshToken(userId: string): string {
  try {
    const payload: RefreshTokenPayload = {
      userId,
      type: 'refresh'
    };

    const options: jwt.SignOptions = {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'botrt-ecommerce',
      audience: 'botrt-refresh',
      subject: userId,
    };
    return jwt.sign(payload, JWT_REFRESH_SECRET, options);
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Refresh token generation failed');
  }
}

// Verify access token
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'botrt-ecommerce',
      audience: 'botrt-admin-panel',
    }) as TokenPayload;

    return decoded;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // SECURITY FIX: CWE-522 - Don't log token data, even previews
    logger.debug('Token verification failed:', {
      error: errorMessage,
      // tokenPreview removed to prevent information exposure
    });

    const errorName = error instanceof Error ? error.name : '';
    if (errorName === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (errorName === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else if (errorName === 'NotBeforeError') {
      throw new Error('Token not active');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

// Verify refresh token
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'botrt-ecommerce',
      audience: 'botrt-refresh',
    }) as RefreshTokenPayload;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token type');
    }

    return decoded;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // SECURITY FIX: CWE-522 - Don't log token data, even previews
    logger.debug('Refresh token verification failed:', {
      error: errorMessage,
      // tokenPreview removed to prevent information exposure
    });

    const errorName = error instanceof Error ? error.name : '';
    if (errorName === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    } else if (errorName === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    } else {
      throw new Error('Refresh token verification failed');
    }
  }
}

// Get token info without verification (for debugging)
export function getTokenInfo(token: string): Record<string, unknown> | null {
  try {
    const decoded = jwt.decode(token, { complete: true });
    return decoded ? (decoded as unknown as Record<string, unknown>) : null;
  } catch (error) {
    logger.error('Error decoding token:', error);
    return null;
  }
}

// Check if token is expired (without throwing)
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
}

// Get time until token expires (in seconds)
export function getTokenTimeToExpiry(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded || !decoded.exp) {
      return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeToExpiry = decoded.exp - currentTime;

    return timeToExpiry > 0 ? timeToExpiry : 0;
  } catch (error) {
    return null;
  }
}

// Validate token format (basic check)
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // JWT tokens have three parts separated by dots
  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
}

// Create temporary token for specific actions (shorter expiry)
export function generateTemporaryToken(payload: TokenPayload, expiresIn: StringValue | number = '15m'): string {
  try {
    const options: jwt.SignOptions = {
      expiresIn: expiresIn as StringValue | number,
      issuer: 'botrt-ecommerce',
      audience: 'botrt-temp',
      subject: payload.userId,
    };
    return jwt.sign(
      { ...payload, temporary: true },
      JWT_SECRET,
      options
    );
  } catch (error) {
    logger.error('Error generating temporary token:', error);
    throw new Error('Temporary token generation failed');
  }
}

// Security: Check for suspicious token activity
export function validateTokenSecurity(token: string, _userAgent?: string, _ipAddress?: string): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let isValid = true;

  // Check token format
  if (!isValidTokenFormat(token)) {
    warnings.push('Invalid token format');
    isValid = false;
  }

  // Check if token is expired
  if (isTokenExpired(token)) {
    warnings.push('Token is expired');
    isValid = false;
  }

  // Get token info for additional checks
  const tokenInfo = getTokenInfo(token);
  if (tokenInfo) {
    const payload = tokenInfo.payload as any;

    // Check for reasonable expiry time (not too far in future)
    const maxExpiry = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now
    if (payload.exp && payload.exp > maxExpiry) {
      warnings.push('Token has suspiciously long expiry');
    }

    // Check issuer
    if (payload.iss !== 'botrt-ecommerce') {
      warnings.push('Invalid token issuer');
      isValid = false;
    }
  }

  return { isValid, warnings };
}

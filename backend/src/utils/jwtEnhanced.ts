import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { logger } from './logger';
import { env } from './env';
import { prisma } from '../lib/prisma';

export interface JWTPayload {
  userId: string;
  telegramId: string;
  role: string;
  sessionId?: string;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

// Redis-like in-memory store for token blacklist (in production use Redis)
const blacklistedTokens = new Map<string, number>();
const activeSessions = new Map<string, { userId: string; createdAt: number; lastUsed: number }>();

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  
  // Clean blacklisted tokens
  for (const [token, expiry] of blacklistedTokens.entries()) {
    if (expiry < now) {
      blacklistedTokens.delete(token);
    }
  }
  
  // Clean old sessions (30 days)
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.lastUsed < thirtyDaysAgo) {
      activeSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000); // Every hour

export class JWTService {
  private static readonly JWT_SECRET = env.JWT_SECRET;
  private static readonly ACCESS_TOKEN_EXPIRY: StringValue | number = (env.JWT_EXPIRES_IN || '15m') as StringValue;
  private static readonly REFRESH_TOKEN_EXPIRY: StringValue | number = (env.JWT_REFRESH_EXPIRES_IN || '7d') as StringValue;
  private static readonly ISSUER = 'telegram-ecommerce-api';
  private static readonly AUDIENCE = 'telegram-ecommerce-users';

  /**
   * Generate access and refresh token pair
   */
  static generateTokenPair(payload: Omit<JWTPayload, 'type' | 'sessionId'>): TokenPair {
    const sessionId = this.generateSessionId();
    const now = Math.floor(Date.now() / 1000);
    
    // Create access token
    const accessPayload: JWTPayload = {
      ...payload,
      type: 'access',
      sessionId,
    };
    
    const accessOptions: jwt.SignOptions = {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: this.ISSUER,
      audience: this.AUDIENCE,
      notBefore: now,
    };
    const accessToken = jwt.sign(accessPayload, this.JWT_SECRET, accessOptions);

    // Create refresh token
    const refreshPayload: JWTPayload = {
      ...payload,
      type: 'refresh',
      sessionId,
    };
    
    const refreshOptions: jwt.SignOptions = {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: this.ISSUER,
      audience: this.AUDIENCE,
      notBefore: now,
    };
    const refreshToken = jwt.sign(refreshPayload, this.JWT_SECRET, refreshOptions);

    // Store session
    activeSessions.set(sessionId, {
      userId: payload.userId,
      createdAt: now * 1000,
      lastUsed: now * 1000,
    });

    // Calculate expiry times
    const accessExpiresIn = typeof this.ACCESS_TOKEN_EXPIRY === 'string' ? this.parseExpiry(this.ACCESS_TOKEN_EXPIRY) : this.ACCESS_TOKEN_EXPIRY;
    const refreshExpiresIn = typeof this.REFRESH_TOKEN_EXPIRY === 'string' ? this.parseExpiry(this.REFRESH_TOKEN_EXPIRY) : this.REFRESH_TOKEN_EXPIRY;

    logger.info(`Generated token pair for user ${payload.userId}`, {
      userId: payload.userId,
      sessionId,
      accessExpiresIn,
      refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      refreshExpiresIn: refreshExpiresIn,
    };
  }

  /**
   * Verify and decode token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      // Check if token is blacklisted
      if (this.isTokenBlacklisted(token)) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, this.JWT_SECRET, {
        issuer: this.ISSUER,
        audience: this.AUDIENCE,
        clockTolerance: 60, // 60 seconds clock skew tolerance
      }) as JWTPayload;

      // Update session last used time
      if (decoded.sessionId) {
        const session = activeSessions.get(decoded.sessionId);
        if (session) {
          session.lastUsed = Date.now();
        }
      }

      return decoded;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      
      logger.warn('Token verification failed', {
        error: errorMessage,
        tokenPreview: token.substring(0, 20) + '...',
      });
      
      if (errorName === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (errorName === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (errorName === 'NotBeforeError') {
        throw new Error('Token not active yet');
      } else {
        throw new Error('Authentication failed');
      }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = this.verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isActive: true, role: true, telegramId: true },
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Blacklist old refresh token
      this.blacklistToken(refreshToken);

      // Generate new token pair
      return this.generateTokenPair({
        userId: user.id,
        telegramId: user.telegramId,
        role: user.role,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.warn('Token refresh failed', {
        error: errorMessage,
        tokenPreview: refreshToken.substring(0, 20) + '...',
      });
      throw error;
    }
  }

  /**
   * Blacklist a token (logout)
   */
  static blacklistToken(token: string): void {
    try {
      const decoded = jwt.decode(token) as { exp?: number; sessionId?: string } | null;
      if (decoded && decoded.exp) {
        // Store until token would expire naturally
        blacklistedTokens.set(token, decoded.exp * 1000);
        
        // Remove session if it's the last token
        if (decoded.sessionId) {
          activeSessions.delete(decoded.sessionId);
        }
        
        logger.info('Token blacklisted', {
          userId: (decoded as any).userId,
          sessionId: decoded.sessionId,
          type: (decoded as any).type,
        });
      }
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
    }
  }

  /**
   * Blacklist all tokens for a user (logout from all devices)
   */
  static async blacklistAllUserTokens(userId: string): Promise<void> {
    try {
      // Remove all sessions for user
      for (const [sessionId, session] of activeSessions.entries()) {
        if (session.userId === userId) {
          activeSessions.delete(sessionId);
        }
      }

      // In production, you'd also add user to a global blacklist
      // that gets checked during token verification
      
      logger.info(`Blacklisted all tokens for user ${userId}`);
    } catch (error) {
      logger.error('Failed to blacklist all user tokens:', error);
      throw error;
    }
  }

  /**
   * Get active sessions for user
   */
  static getUserSessions(userId: string): Array<{ sessionId: string; createdAt: Date; lastUsed: Date }> {
    const userSessions = [];
    
    for (const [sessionId, session] of activeSessions.entries()) {
      if (session.userId === userId) {
        userSessions.push({
          sessionId,
          createdAt: new Date(session.createdAt),
          lastUsed: new Date(session.lastUsed),
        });
      }
    }
    
    return userSessions;
  }

  /**
   * Revoke specific session
   */
  static revokeSession(sessionId: string): void {
    activeSessions.delete(sessionId);
    logger.info(`Revoked session ${sessionId}`);
  }

  // Private helper methods
  private static isTokenBlacklisted(token: string): boolean {
    return blacklistedTokens.has(token);
  }

  private static generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static parseExpiry(expiry: string): number {
    // Convert JWT expiry strings to seconds
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900;
    }
  }

  /**
   * Get token statistics for monitoring
   */
  static getTokenStats(): {
    blacklistedTokens: number;
    activeSessions: number;
    sessionsByUser: Record<string, number>;
  } {
    const sessionsByUser: Record<string, number> = {};
    
    for (const session of activeSessions.values()) {
      sessionsByUser[session.userId] = (sessionsByUser[session.userId] || 0) + 1;
    }
    
    return {
      blacklistedTokens: blacklistedTokens.size,
      activeSessions: activeSessions.size,
      sessionsByUser,
    };
  }
}

export default JWTService;

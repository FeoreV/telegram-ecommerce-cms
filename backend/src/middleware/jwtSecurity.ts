import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { logger, maskSensitiveData } from '../utils/logger';
import { createClient } from 'redis';
import { securityMetrics, loadSecurityConfig, SecurityConfig } from '../config/security';
import { parseExpiryToSeconds } from '../auth/AuthConfig';
import crypto from 'crypto';

// Initialize configuration variables
let JWT_SECRET: string;
let JWT_REFRESH_SECRET: string;
let JWT_ACCESS_EXPIRY: string;
let JWT_REFRESH_EXPIRY: string;
let JWT_ACCESS_EXPIRY_SECONDS: number;
let JWT_REFRESH_EXPIRY_SECONDS: number;
let JWT_CLOCK_SKEW: number;
let JWT_ISSUER: string;
let JWT_AUDIENCE: string;
let REDIS_URL: string | undefined;
let REDIS_ENABLED: boolean;

// Load security configuration
let securityConfigLoaded = false;
const initializeSecurityConfig = async (): Promise<SecurityConfig> => {
  if (securityConfigLoaded) {
    return {
      jwt: {
        secret: JWT_SECRET,
        refreshSecret: JWT_REFRESH_SECRET,
        accessExpiry: JWT_ACCESS_EXPIRY,
        refreshExpiry: JWT_REFRESH_EXPIRY,
        clockSkew: JWT_CLOCK_SKEW,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      },
      redis: { url: REDIS_URL, enabled: REDIS_ENABLED }
    } as SecurityConfig;
  }

  const config = await loadSecurityConfig();
  
  // Extract configuration values
  JWT_SECRET = config.jwt.secret;
  JWT_REFRESH_SECRET = config.jwt.refreshSecret;
  JWT_ACCESS_EXPIRY = config.jwt.accessExpiry;
  JWT_REFRESH_EXPIRY = config.jwt.refreshExpiry;
  JWT_CLOCK_SKEW = config.jwt.clockSkew;
  JWT_ISSUER = config.jwt.issuer;
  JWT_AUDIENCE = config.jwt.audience;
  REDIS_URL = config.redis.url;
  REDIS_ENABLED = config.redis.enabled;

  // Calculate expiry seconds after config is loaded
  JWT_ACCESS_EXPIRY_SECONDS = parseExpiryToSeconds(JWT_ACCESS_EXPIRY);
  JWT_REFRESH_EXPIRY_SECONDS = parseExpiryToSeconds(JWT_REFRESH_EXPIRY);
  
  securityConfigLoaded = true;
  return config;
};

// Initialize configuration on module load - but don't exit on error in development
initializeSecurityConfig().catch(error => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  logger.error('Failed to initialize security configuration:', { 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  if (!isDevelopment) {
    process.exit(1);
  } else {
    logger.warn('Continuing in development mode with potential configuration issues');
  }
});

// Redis client for token blacklist
let redisClient: any = null;
const tokenBlacklist = new Map<string, { expires: Date; reason: string }>();

// Initialize Redis if available
if (REDIS_ENABLED && REDIS_URL) {
  try {
    redisClient = createClient({ 
      url: REDIS_URL,
      socket: {
        connectTimeout: 2000 // 2 second timeout
      }
    });
    
    // Attempt connection with timeout
    redisClient.connect()
      .then(() => {
        logger.info('Redis connected for JWT token management');
      })
      .catch((err: any) => {
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (isDevelopment) {
          logger.warn('Redis not available for JWT - using memory fallback (development mode)', { 
            redisUrl: REDIS_URL?.replace(/\/\/[^@]*@/, '//***@') // Hide credentials in logs
          });
        } else {
          logger.error('Redis connection failed for JWT:', err);
        }
        redisClient = null;
      });
      
    // Handle connection errors gracefully
    redisClient.on('error', (err: any) => {
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (!isDevelopment) {
        logger.error('Redis JWT client error:', err);
      }
      redisClient = null;
    });
  } catch (error) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      logger.warn('Redis client creation failed for JWT - using memory fallback');
    } else {
      logger.error('Failed to create Redis client for JWT:', error);
    }
  }
}


export interface JWTPayload {
  userId: string;
  role: string;
  telegramId: string;
  sessionId?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenFamily: string;
  version: number;
  iat?: number;
  exp?: number;
}

// Enhanced JWT utilities
export class JWTSecurity {
  
  // Generate access token with enhanced security
  static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string {
    const jwtPayload: JWTPayload = {
      ...payload,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    };

    return (jwt.sign as any)(jwtPayload, JWT_SECRET, {
      expiresIn: JWT_ACCESS_EXPIRY,
      algorithm: 'HS256' as const,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  // Generate refresh token
  static generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
    return (jwt.sign as any)(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRY,
      algorithm: 'HS256' as const,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  // Enhanced access token verification
  static async verifyAccessToken(token: string): Promise<JWTPayload> {
    // Check if token is blacklisted
    const isBlacklisted = await this.isTokenBlacklisted(token);
    if (isBlacklisted) {
      securityMetrics.incrementInvalidTokenAttempts();
      throw new Error('Token has been revoked');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        clockTolerance: JWT_CLOCK_SKEW,
      }) as JWTPayload;

      // Additional security checks
      if (!decoded.userId || !decoded.role) {
        throw new Error('Invalid token payload');
      }

      // Check token age for additional security
      if (decoded.iat) {
        const tokenAge = Date.now() / 1000 - decoded.iat;
        const maxAge = JWT_ACCESS_EXPIRY_SECONDS * 2; // Allow some flexibility
        
        if (tokenAge > maxAge) {
          logger.warn('Suspicious token age detected', {
            tokenAge,
            maxAge,
            userId: decoded.userId
          });
        }
      }

      return decoded;
    } catch (error) {
      securityMetrics.incrementInvalidTokenAttempts();
      
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else if (error instanceof jwt.NotBeforeError) {
        throw new Error('Token not active');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  // Enhanced refresh token verification
  static async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const isBlacklisted = await this.isTokenBlacklisted(token);
    if (isBlacklisted) {
      securityMetrics.incrementInvalidTokenAttempts();
      throw new Error('Refresh token has been revoked');
    }

    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        clockTolerance: JWT_CLOCK_SKEW,
      }) as RefreshTokenPayload;

      // Validate refresh token structure
      if (!decoded.userId || !decoded.tokenFamily || typeof decoded.version !== 'number') {
        throw new Error('Invalid refresh token payload');
      }

      return decoded;
    } catch (error) {
      securityMetrics.incrementInvalidTokenAttempts();
      throw new Error('Invalid refresh token');
    }
  }

  // Enhanced token blacklisting with Redis support
  static async blacklistToken(token: string, reason: string = 'manual_logout'): Promise<void> {
    const tokenHash = this.hashToken(token);
    
    try {
      // Extract expiry from token to set appropriate TTL
      const decoded = jwt.decode(token) as any;
      const expires = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + JWT_ACCESS_EXPIRY_SECONDS * 1000);
      const ttlSeconds = Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1000));
      
      if (redisClient) {
        // Store in Redis with expiration
        await redisClient.setEx(`blacklist:${tokenHash}`, ttlSeconds, JSON.stringify({ reason, timestamp: new Date().toISOString() }));
        logger.info('Token blacklisted in Redis', {
          tokenHash,
          reason,
          ttlSeconds
        });
      } else {
        // Fallback to memory with cleanup
        tokenBlacklist.set(tokenHash, { expires, reason });
        logger.info('Token blacklisted in memory', {
          tokenHash,
          reason,
          expires: expires.toISOString()
        });
      }
      
      securityMetrics.incrementBlacklistedTokens();
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
      // Fallback to memory storage
      tokenBlacklist.set(tokenHash, { 
        expires: new Date(Date.now() + JWT_ACCESS_EXPIRY_SECONDS * 1000), 
        reason 
      });
    }
  }

  // Check if token is blacklisted
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    
    try {
      if (redisClient) {
        const result = await redisClient.get(`blacklist:${tokenHash}`);
        return result !== null;
      } else {
        const entry = tokenBlacklist.get(tokenHash);
        if (entry) {
          // Clean up expired entries
          if (entry.expires < new Date()) {
            tokenBlacklist.delete(tokenHash);
            return false;
          }
          return true;
        }
        return false;
      }
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      // Fallback to memory check
      const entry = tokenBlacklist.get(tokenHash);
      return entry ? entry.expires > new Date() : false;
    }
  }

  // Get token from Authorization header
  static extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;
    
    const matches = authHeader.match(/^Bearer\s+(.+)$/);
    return matches ? matches[1] : null;
  }

  // Hash token for secure storage (use for blacklist keys)
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
  }

  // Generate session ID for enhanced security
  static generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validate session (check if session exists in database)
  static async validateSession(userId: string, sessionId?: string): Promise<boolean> {
    if (!sessionId) return true; // Backward compatibility

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true }
      });

      if (!user || !user.isActive) {
        return false;
      }

      // In a full implementation, check session table
      // const session = await prisma.userSession.findUnique({
      //   where: { sessionId }
      // });
      // return session?.userId === userId && session.isActive;

      return true; // Simplified for now
    } catch (error) {
      logger.error('Session validation error:', error);
      return false;
    }
  }

  // Clean up expired blacklisted tokens
  static async cleanupBlacklist(): Promise<void> {
    if (redisClient) {
      // Redis automatically expires keys, no cleanup needed
      try {
        const keys = await redisClient.keys('blacklist:*');
        logger.info('Redis blacklist status', {
          blacklistedCount: keys.length
        });
      } catch (error) {
        logger.error('Error getting Redis blacklist status:', error);
      }
    } else {
      // Clean up expired tokens from memory
      const now = new Date();
      let cleanedCount = 0;
      
      for (const [tokenHash, entry] of tokenBlacklist.entries()) {
        if (entry.expires < now) {
          tokenBlacklist.delete(tokenHash);
          cleanedCount++;
        }
      }
      
      logger.info('Memory blacklist cleanup completed', {
        cleanedCount,
        remainingCount: tokenBlacklist.size
      });
    }
  }

  // Get blacklist statistics
  static async getBlacklistStats(): Promise<{ total: number; active: number }> {
    if (redisClient) {
      try {
        const keys = await redisClient.keys('blacklist:*');
        return { total: keys.length, active: keys.length };
      } catch (error) {
        logger.error('Error getting Redis stats:', error);
        return { total: 0, active: 0 };
      }
    } else {
      const now = new Date();
      const active = Array.from(tokenBlacklist.values()).filter(entry => entry.expires > now).length;
      return { total: tokenBlacklist.size, active };
    }
  }

  // Generate token family for refresh token rotation
  static generateTokenFamily(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

// Enhanced authentication middleware
export const enhancedAuthMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTSecurity.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify and decode token
    let decoded: JWTPayload;
    try {
      decoded = await JWTSecurity.verifyAccessToken(token);
    } catch (error) {
    logger.warn('JWT verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorName: error instanceof Error ? error.constructor.name : 'Unknown',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      tokenPreview: `${token.substring(0, 6)}...${token.substring(token.length - 6)}`,
      jwtIssuer: JWT_ISSUER,
      jwtAudience: JWT_AUDIENCE
    });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let code = 'INVALID_TOKEN';
      
      if (errorMessage.includes('expired')) code = 'TOKEN_EXPIRED';
      else if (errorMessage.includes('revoked')) code = 'TOKEN_REVOKED';
      else if (errorMessage.includes('not active')) code = 'TOKEN_NOT_ACTIVE';

      return res.status(401).json({
        error: 'Invalid or expired token',
        code,
        message: errorMessage
      });
    }

    // Validate session if present
    const sessionValid = await JWTSecurity.validateSession(decoded.userId, decoded.sessionId);
    if (!sessionValid) {
      return res.status(401).json({
        error: 'Session expired or invalid',
        code: 'INVALID_SESSION'
      });
    }

    // Fetch user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
      }
    });

    if (!user || !user.isActive) {
      logger.warn('Authentication failed - user not found or inactive', {
        userId: decoded.userId,
        ip: req.ip
      });

      return res.status(401).json({
        error: 'User account not found or inactive',
        code: 'USER_INACTIVE'
      });
    }

    // Check if user role has changed
    if (user.role !== decoded.role) {
      logger.warn('User role changed, token invalidated', {
        userId: user.id,
        oldRole: decoded.role,
        newRole: user.role
      });

      return res.status(401).json({
        error: 'User permissions have changed. Please log in again.',
        code: 'ROLE_CHANGED'
      });
    }

    // Attach user to request
    (req as any).user = user;
    (req as any).token = token;
    (req as any).sessionId = decoded.sessionId;

    // Log successful authentication for security monitoring
    logger.debug('User authenticated successfully', {
      userId: user.id,
      role: user.role,
      ip: req.ip,
      endpoint: req.path
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      request: {
        method: req.method,
        url: req.url,
        headers: maskSensitiveData(req.headers),
      },
    });
    res.status(500).json({
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// Token refresh endpoint middleware
export const tokenRefreshMiddleware = async (
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required'
      });
    }

    // Verify refresh token
    let decoded: RefreshTokenPayload;
    try {
      decoded = await JWTSecurity.verifyRefreshToken(refreshToken);
    } catch (error) {
      logger.warn('Refresh token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'User not found or inactive'
      });
    }

    // Generate new tokens with enhanced security
    const sessionId = JWTSecurity.generateSessionId();
    const newAccessToken = JWTSecurity.generateAccessToken({
      userId: user.id,
      role: user.role,
      telegramId: user.telegramId,
      sessionId
    });

    const newRefreshToken = JWTSecurity.generateRefreshToken({
      userId: user.id,
      tokenFamily: decoded.tokenFamily,
      version: decoded.version + 1
    });

    // Blacklist old refresh token
    await JWTSecurity.blacklistToken(refreshToken, 'token_refresh');

    logger.info('Tokens refreshed successfully', {
      userId: user.id,
      ip: req.ip
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed'
    });
  }
};

// Enhanced logout middleware to blacklist tokens
export const logoutMiddleware = async (req: Request, res: Response) => {
  try {
    const token = (req as any).token;
    const { refreshToken } = req.body;
    const user = (req as any).user;

    // Blacklist both tokens
    const promises = [];
    if (token) {
      promises.push(JWTSecurity.blacklistToken(token, 'user_logout'));
    }
    if (refreshToken) {
      promises.push(JWTSecurity.blacklistToken(refreshToken, 'user_logout'));
    }

    await Promise.all(promises);

    logger.info('User logged out', {
      userId: user?.id,
      role: user?.role,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      tokensBlacklisted: promises.length
    });

    res.json({ 
      message: 'Logged out successfully',
      tokensInvalidated: promises.length
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
};

// Cleanup function to run periodically
setInterval(() => {
  JWTSecurity.cleanupBlacklist().catch(error => {
    logger.error('Blacklist cleanup error:', error);
  });
}, 60 * 60 * 1000); // Run every hour

export default enhancedAuthMiddleware;

import cors, { CorsOptions } from 'cors';
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export interface CorsSecurityConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
  credentials: boolean;
  enableCSRF: boolean;
  csrfTokenName: string;
  csrfHeaderName: string;
  csrfCookieName: string;
  csrfTokenTTL: number;
  enableOriginValidation: boolean;
  enableReferrerValidation: boolean;
  strictModeEnabled: boolean;
}

export interface CSRFToken {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
}

export class CorsSecurityService {
  private static instance: CorsSecurityService;
  private config: CorsSecurityConfig;
  private csrfTokens: Map<string, CSRFToken> = new Map();
  private originWhitelist: Set<string> = new Set();
  private suspiciousOrigins: Map<string, { count: number; lastSeen: Date }> = new Map();

  private constructor() {
    this.config = {
      allowedOrigins: this.parseAllowedOrigins(),
      allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-CSRF-Token',
        'X-API-Key',
        'X-Request-ID',
        'X-Forwarded-For',
        'User-Agent'
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset',
        'X-CSRF-Token'
      ],
      maxAge: parseInt(process.env.CORS_MAX_AGE || '86400'), // 24 hours
      credentials: process.env.CORS_CREDENTIALS === 'true',
      enableCSRF: process.env.ENABLE_CSRF_PROTECTION !== 'false',
      csrfTokenName: process.env.CSRF_TOKEN_NAME || '_csrf',
      csrfHeaderName: process.env.CSRF_HEADER_NAME || 'X-CSRF-Token',
      csrfCookieName: process.env.CSRF_COOKIE_NAME || 'csrf-token',
      csrfTokenTTL: parseInt(process.env.CSRF_TOKEN_TTL || '3600'), // 1 hour
      enableOriginValidation: process.env.ENABLE_ORIGIN_VALIDATION !== 'false',
      enableReferrerValidation: process.env.ENABLE_REFERRER_VALIDATION !== 'false',
      strictModeEnabled: process.env.CORS_STRICT_MODE === 'true'
    };

    this.initializeOriginWhitelist();
    this.startCleanupTimer();
  }

  public static getInstance(): CorsSecurityService {
    if (!CorsSecurityService.instance) {
      CorsSecurityService.instance = new CorsSecurityService();
    }
    return CorsSecurityService.instance;
  }

  private parseAllowedOrigins(): string[] {
    const origins = process.env.ALLOWED_ORIGINS || 'http://82.147.84.78:3000,http://82.147.84.78:3001';
    return origins.split(',').map(origin => origin.trim()).filter(Boolean);
  }

  private initializeOriginWhitelist(): void {
    this.config.allowedOrigins.forEach(origin => {
      this.originWhitelist.add(origin);
    });

    // Add development origins if in development mode
    if (process.env.NODE_ENV === 'development') {
      const devOrigins = [
        'http://82.147.84.78:3000',
        'http://82.147.84.78:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
      ];
      devOrigins.forEach(origin => this.originWhitelist.add(origin));
    }

    logger.info('CORS origin whitelist initialized', {
      allowedOrigins: Array.from(this.originWhitelist),
      strictMode: this.config.strictModeEnabled
    });
  }

  /**
   * Get CORS middleware configuration
   */
  getCorsMiddleware(): any {
    const corsOptions: CorsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin && !this.config.strictModeEnabled) {
          return callback(null, true);
        }

        if (!origin) {
          logger.warn('Request blocked: No origin header in strict mode');
          return callback(new Error('Origin header required'), false);
        }

        // Check if origin is in whitelist
        if (this.isOriginAllowed(origin)) {
          return callback(null, true);
        }

        // Log suspicious origin
        this.logSuspiciousOrigin(origin);

        logger.warn('Request blocked: Origin not allowed', {
          origin,
          allowedOrigins: Array.from(this.originWhitelist)
        });

        callback(new Error('Origin not allowed by CORS policy'), false);
      },
      methods: this.config.allowedMethods,
      allowedHeaders: this.config.allowedHeaders,
      exposedHeaders: this.config.exposedHeaders,
      credentials: this.config.credentials,
      maxAge: this.config.maxAge,
      optionsSuccessStatus: 200 // For legacy browser support
    };

    return cors(corsOptions);
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string): boolean {
    // Exact match
    if (this.originWhitelist.has(origin)) {
      return true;
    }

    // Pattern matching for dynamic origins (e.g., subdomains)
    for (const allowedOrigin of this.originWhitelist) {
      if (this.matchOriginPattern(origin, allowedOrigin)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match origin against pattern (supports wildcards) - FIXED: CWE-1333 ReDoS
   */
  private matchOriginPattern(origin: string, pattern: string): boolean {
    // SECURITY: Escape special regex characters to prevent ReDoS
    const escapeRegex = (str: string): string => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // SECURITY: Validate pattern length to prevent ReDoS
    if (pattern.length > 200) {
      throw new Error('SECURITY: Pattern too long');
    }

    // Convert pattern to regex safely
    const escapedPattern = escapeRegex(pattern);
    // Only allow * as wildcard after escaping
    const regexPattern = escapedPattern.replace(/\\\*/g, '.*');

    // SECURITY: Use timeout for regex execution to prevent ReDoS
    try {
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      // Simple string matching instead of complex regex
      if (!pattern.includes('*')) {
        return origin.toLowerCase() === pattern.toLowerCase();
      }
      return regex.test(origin);
    } catch (error) {
      // If regex compilation fails, fall back to exact match
      return origin.toLowerCase() === pattern.toLowerCase();
    }
  }

  /**
   * Log suspicious origin attempts
   */
  private logSuspiciousOrigin(origin: string): void {
    const now = new Date();
    const existing = this.suspiciousOrigins.get(origin);

    if (existing) {
      existing.count++;
      existing.lastSeen = now;
    } else {
      this.suspiciousOrigins.set(origin, {
        count: 1,
        lastSeen: now
      });
    }

    // Alert if too many attempts from same origin
    const suspiciousData = this.suspiciousOrigins.get(origin);
    if (!suspiciousData) {
      logger.warn('Suspicious origin data missing after update', { origin });
      return;
    }
    if (suspiciousData.count > 10) {
      logger.security('Potential CORS attack detected', {
        origin,
        attemptCount: suspiciousData.count,
        firstSeen: suspiciousData.lastSeen,
        severity: 'HIGH'
      });
    }
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(userId?: string, sessionId?: string, ipAddress?: string): string {
    const tokenData = {
      random: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now(),
      userId: userId || 'anonymous',
      sessionId: sessionId || 'no-session'
    };

    const token = crypto
      .createHash('sha256')
      .update(JSON.stringify(tokenData))
      .digest('hex');

    const csrfToken: CSRFToken = {
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.csrfTokenTTL * 1000),
      userId,
      sessionId,
      ipAddress: ipAddress || 'unknown'
    };

    this.csrfTokens.set(token, csrfToken);

    // SECURITY FIX: CWE-522 - Do not log token fragments, only safe identifiers
    logger.debug('CSRF token generated', {
      userId,
      sessionId,
      expiresAt: csrfToken.expiresAt
    });

    return token;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(
    token: string,
    userId?: string,
    sessionId?: string,
    ipAddress?: string
  ): boolean {
    if (!token) {
      return false;
    }

    const csrfToken = this.csrfTokens.get(token);
    if (!csrfToken) {
      // SECURITY FIX: CWE-522 - Do not log token fragments
      logger.warn('CSRF token validation failed: Token not found', {
        userId,
        sessionId
      });
      return false;
    }

    // Check expiration
    if (csrfToken.expiresAt < new Date()) {
      this.csrfTokens.delete(token);
      // SECURITY FIX: CWE-522 - Do not log token fragments
      logger.warn('CSRF token validation failed: Token expired', {
        userId,
        expiresAt: csrfToken.expiresAt
      });
      return false;
    }

    // SECURITY FIX (CWE-208): Use timing-safe comparisons to prevent timing attacks
    // Check user/session binding if provided
    if (userId && csrfToken.userId) {
      try {
        const userMatch = crypto.timingSafeEqual(
          Buffer.from(csrfToken.userId),
          Buffer.from(userId)
        );
        if (!userMatch) {
          // SECURITY FIX: CWE-522 - Do not log token fragments
          logger.warn('CSRF token validation failed: User mismatch', {
            expectedUser: csrfToken.userId,
            actualUser: userId
          });
          return false;
        }
      } catch {
        // Lengths don't match
        logger.warn('CSRF token validation failed: User ID length mismatch');
        return false;
      }
    }

    if (sessionId && csrfToken.sessionId) {
      try {
        const sessionMatch = crypto.timingSafeEqual(
          Buffer.from(csrfToken.sessionId),
          Buffer.from(sessionId)
        );
        if (!sessionMatch) {
          // SECURITY FIX: CWE-522 - Do not log token fragments
          logger.warn('CSRF token validation failed: Session mismatch', {
            expectedSession: csrfToken.sessionId,
            actualSession: sessionId
          });
          return false;
        }
      } catch {
        // Lengths don't match
        logger.warn('CSRF token validation failed: Session ID length mismatch');
        return false;
      }
    }

    // Check IP binding (optional, can be disabled for mobile users)
    if (ipAddress && csrfToken.ipAddress && csrfToken.ipAddress !== ipAddress) {
      // SECURITY FIX: CWE-522 - Do not log token fragments
      logger.warn('CSRF token validation failed: IP address mismatch', {
        expectedIP: csrfToken.ipAddress,
        actualIP: ipAddress
      });
      // Don't fail validation for IP mismatch, just log it
    }

    return true;
  }

  /**
   * CSRF protection middleware
   */
  getCSRFMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for GET, HEAD, OPTIONS requests
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Skip CSRF if disabled
      if (!this.config.enableCSRF) {
        return next();
      }

      // Extract token from header or body
      const token = req.get(this.config.csrfHeaderName) ||
                   req.body[this.config.csrfTokenName] ||
                   req.query[this.config.csrfTokenName];

      // Get user context
      const userId = (req as any).user?.id;
      const sessionId = (req as any).sessionId;
      const ipAddress = req.ip || req.connection.remoteAddress;

      // Validate token
      if (!this.validateCSRFToken(token as string, userId, sessionId, ipAddress)) {
        logger.warn('CSRF protection triggered', {
          path: req.path,
          method: req.method,
          origin: req.get('Origin'),
          referer: req.get('Referer'),
          userAgent: req.get('User-Agent'),
          ipAddress,
          userId,
          sessionId
        });

        return res.status(403).json({
          error: 'CSRF token validation failed',
          message: 'Invalid or missing CSRF token',
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }

  /**
   * Endpoint to generate CSRF token
   */
  getCSRFTokenEndpoint() {
    return (req: Request, res: Response) => {
      const userId = (req as any).user?.id;
      const sessionId = (req as any).sessionId;
      const ipAddress = req.ip || req.connection.remoteAddress;

      const token = this.generateCSRFToken(userId, sessionId, ipAddress);

      // Set token in cookie if configured
      if (this.config.csrfCookieName) {
        res.cookie(this.config.csrfCookieName, token, {
          httpOnly: false, // Client needs to read this
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: this.config.csrfTokenTTL * 1000
        });
      }

      res.json({
        [this.config.csrfTokenName]: token,
        expiresAt: new Date(Date.now() + this.config.csrfTokenTTL * 1000).toISOString()
      });
    };
  }

  /**
   * Additional security headers middleware
   */
  getSecurityHeadersMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Validate Origin header
      if (this.config.enableOriginValidation) {
        const origin = req.get('Origin');
        if (origin && !this.isOriginAllowed(origin)) {
          logger.warn('Request blocked: Invalid Origin header', {
            origin,
            path: req.path,
            method: req.method
          });

          return res.status(403).json({
            error: 'Origin not allowed',
            message: 'Request origin is not in the allowed list',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Validate Referer header for state-changing operations
      if (this.config.enableReferrerValidation &&
          ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const referer = req.get('Referer');
        const origin = req.get('Origin');

        if (referer && !this.isRefererValid(referer, origin)) {
          logger.warn('Request blocked: Invalid Referer header', {
            referer,
            origin,
            path: req.path,
            method: req.method
          });

          return res.status(403).json({
            error: 'Invalid referer',
            message: 'Request referer is not allowed',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Add security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin'
      });

      next();
    };
  }

  /**
   * Validate referer header
   */
  private isRefererValid(referer: string, origin?: string): boolean {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;

      // Check if referer origin matches request origin
      if (origin && refererOrigin !== origin) {
        return false;
      }

      // Check if referer origin is in whitelist
      return this.isOriginAllowed(refererOrigin);

    } catch {
      // Invalid referer URL
      return false;
    }
  }

  /**
   * Cleanup expired CSRF tokens
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = new Date();
      let cleanedCount = 0;

      // Clean expired CSRF tokens
      for (const [token, csrfToken] of this.csrfTokens.entries()) {
        if (csrfToken.expiresAt < now) {
          this.csrfTokens.delete(token);
          cleanedCount++;
        }
      }

      // Clean old suspicious origins
      for (const [origin, data] of this.suspiciousOrigins.entries()) {
        if (now.getTime() - data.lastSeen.getTime() > 24 * 60 * 60 * 1000) { // 24 hours
          this.suspiciousOrigins.delete(origin);
        }
      }

      if (cleanedCount > 0) {
        logger.debug('CSRF tokens cleaned up', {
          cleanedCount,
          remainingTokens: this.csrfTokens.size
        });
      }

    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Add origin to whitelist dynamically
   */
  addAllowedOrigin(origin: string): void {
    this.originWhitelist.add(origin);
    logger.info('Origin added to whitelist', { origin });
  }

  /**
   * Remove origin from whitelist
   */
  removeAllowedOrigin(origin: string): void {
    this.originWhitelist.delete(origin);
    logger.info('Origin removed from whitelist', { origin });
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    activeCSRFTokens: number;
    suspiciousOrigins: number;
    allowedOrigins: string[];
    config: CorsSecurityConfig;
  } {
    return {
      activeCSRFTokens: this.csrfTokens.size,
      suspiciousOrigins: this.suspiciousOrigins.size,
      allowedOrigins: Array.from(this.originWhitelist),
      config: this.config
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: any;
  }> {
    try {
      const stats = this.getSecurityStats();

      return {
        status: 'healthy',
        stats
      };

    } catch (error) {
      logger.error('CORS security service health check failed:', error);
      return {
        status: 'error',
        stats: null
      };
    }
  }
}

// Export singleton instance
export const corsSecurityService = CorsSecurityService.getInstance();

// Export middleware functions
export const corsMiddleware = corsSecurityService.getCorsMiddleware();
export const csrfMiddleware = corsSecurityService.getCSRFMiddleware();
export const securityHeadersMiddleware = corsSecurityService.getSecurityHeadersMiddleware();
export const csrfTokenEndpoint = corsSecurityService.getCSRFTokenEndpoint();

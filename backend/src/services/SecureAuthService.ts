import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { databaseService } from '../lib/database';
import { logger } from '../utils/logger';
import { secretManager } from '../utils/SecretManager';
import { tenantCacheService } from './TenantCacheService';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
  sessionId: string;
}

export interface DeviceInfo {
  userAgent: string;
  ipAddress: string;
  deviceFingerprint: string;
  location?: string;
  platform?: string;
  browser?: string;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  role: string;
  storeId?: string;
  deviceInfo: DeviceInfo;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  refreshTokenHash: string;
  permissions: string[];
}

export interface AuthConfig {
  accessTokenTTL: number; // seconds
  refreshTokenTTL: number; // seconds
  maxSessionsPerUser: number;
  requireDeviceBinding: boolean;
  enableSessionTracking: boolean;
  rotateRefreshTokens: boolean;
  sessionInactivityTimeout: number; // seconds
}

export class SecureAuthService {
  private static instance: SecureAuthService;
  private config: AuthConfig;
  private revokedTokens: Set<string> = new Set(); // In-memory revocation list

  private static createConfig(): AuthConfig {
    const intFromEnv = (key: string, fallback: number) => {
      const raw = process.env[key];
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };

    return {
      accessTokenTTL: intFromEnv('ACCESS_TOKEN_TTL', 900),
      refreshTokenTTL: intFromEnv('REFRESH_TOKEN_TTL', 604800),
      maxSessionsPerUser: intFromEnv('MAX_SESSIONS_PER_USER', 5),
      requireDeviceBinding: process.env.REQUIRE_DEVICE_BINDING === 'true',
      enableSessionTracking: process.env.ENABLE_SESSION_TRACKING !== 'false',
      rotateRefreshTokens: process.env.ROTATE_REFRESH_TOKENS !== 'false',
      sessionInactivityTimeout: intFromEnv('SESSION_INACTIVITY_TIMEOUT', 3600),
    };
  }

  private constructor() {
    this.config = SecureAuthService.createConfig();
  }

  public static getInstance(): SecureAuthService {
    if (!SecureAuthService.instance) {
      SecureAuthService.instance = new SecureAuthService();
    }
    return SecureAuthService.instance;
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(userAgent: string, ipAddress: string, additionalData: any = {}): string {
    const fingerprintData = {
      userAgent: this.normalizeUserAgent(userAgent),
      ipAddress: this.hashIpAddress(ipAddress),
      ...additionalData
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');
  }

  /**
   * Normalize user agent for fingerprinting
   */
  private normalizeUserAgent(userAgent: string): string {
    // Remove version numbers for more stable fingerprinting
    return userAgent
      .replace(/\d+\.\d+\.\d+/g, 'X.X.X')
      .replace(/\d+\.\d+/g, 'X.X')
      .substring(0, 200);
  }

  /**
   * Hash IP address for privacy
   */
  private hashIpAddress(ipAddress: string): string {
    const salt = process.env.IP_HASH_SALT || 'default-salt';
    return crypto
      .createHash('sha256')
      .update(ipAddress + salt)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Create new authentication session
   */
  async createSession(
    userId: string,
    role: string,
    deviceInfo: DeviceInfo,
    storeId?: string,
    permissions: string[] = []
  ): Promise<TokenPair> {
    try {
      const sessionId = this.generateSessionId();
      const jwtSecrets = secretManager.getJWTSecrets();

      // Create access token (short-lived)
      const accessTokenPayload = {
        userId,
        role,
        storeId,
        permissions,
        sessionId,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.config.accessTokenTTL
      };

      const accessToken = jwt.sign(accessTokenPayload, jwtSecrets.secret, {
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER || 'botrt-ecommerce',
        audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel'
      });

      // Create refresh token (longer-lived)
      const refreshTokenPayload = {
        userId,
        sessionId,
        type: 'refresh',
        deviceFingerprint: deviceInfo.deviceFingerprint,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenTTL
      };

      const refreshToken = jwt.sign(refreshTokenPayload, jwtSecrets.refreshSecret, {
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER || 'botrt-ecommerce',
        audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel'
      });

      // Hash refresh token for storage
      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      // Create session data
      const sessionData: SessionData = {
        sessionId,
        userId,
        role,
        storeId,
        deviceInfo,
        createdAt: new Date(),
        lastActivity: new Date(),
        isActive: true,
        refreshTokenHash,
        permissions
      };

      // Store session in cache and database
      await this.storeSession(sessionData);

      // Cleanup old sessions if user has too many
      await this.cleanupUserSessions(userId);

      logger.info('New authentication session created', {
        userId,
        sessionId,
        role,
        storeId,
        deviceFingerprint: deviceInfo.deviceFingerprint,
        ipAddress: deviceInfo.ipAddress
      });

      return {
        accessToken,
        refreshToken,
        accessTokenExpiry: new Date(Date.now() + this.config.accessTokenTTL * 1000),
        refreshTokenExpiry: new Date(Date.now() + this.config.refreshTokenTTL * 1000),
        sessionId
      };

    } catch (error) {
      logger.error('Failed to create authentication session:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    refreshToken: string,
    deviceInfo: DeviceInfo
  ): Promise<TokenPair> {
    try {
      const jwtSecrets = secretManager.getJWTSecrets();

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, jwtSecrets.refreshSecret) as any;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if token is revoked
      if (this.revokedTokens.has(refreshToken)) {
        throw new Error('Refresh token has been revoked');
      }

      // Get session data
      const sessionData = await this.getSession(decoded.sessionId);
      if (!sessionData || !sessionData.isActive) {
        throw new Error('Session not found or inactive');
      }

      // Verify device binding if enabled
      if (this.config.requireDeviceBinding) {
        if (decoded.deviceFingerprint !== deviceInfo.deviceFingerprint) {
          logger.warn('Device fingerprint mismatch during token refresh', {
            sessionId: decoded.sessionId,
            expected: decoded.deviceFingerprint,
            actual: deviceInfo.deviceFingerprint,
            ipAddress: deviceInfo.ipAddress
          });

          // Revoke session on device mismatch
          await this.revokeSession(decoded.sessionId);
          throw new Error('Device binding verification failed');
        }
      }

      // Verify refresh token hash
      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      if (sessionData.refreshTokenHash !== refreshTokenHash) {
        // Check if this token is in grace period (old token after rotation)
        const { tokenRotationService } = await import('./TokenRotationService.js');
        const graceCheck = await tokenRotationService.validateTokenInGracePeriod(
          refreshTokenHash,
          sessionData.sessionId
        );

        if (graceCheck.valid && graceCheck.newTokenHash === sessionData.refreshTokenHash) {
          logger.info('Refresh token used during grace period', {
            sessionId: sessionData.sessionId,
            userId: sessionData.userId
          });
          // Allow the refresh during grace period
        } else {
          throw new Error('Invalid refresh token');
        }
      }

      // Create new access token
      const accessTokenPayload = {
        userId: sessionData.userId,
        role: sessionData.role,
        storeId: sessionData.storeId,
        permissions: sessionData.permissions,
        sessionId: sessionData.sessionId,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.config.accessTokenTTL
      };

      const newAccessToken = jwt.sign(accessTokenPayload, jwtSecrets.secret, {
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER || 'botrt-ecommerce',
        audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel'
      });

      let newRefreshToken = refreshToken;
      let newRefreshTokenExpiry = new Date(decoded.exp * 1000);

      // Rotate refresh token if enabled
      if (this.config.rotateRefreshTokens) {
        const newRefreshTokenPayload = {
          userId: sessionData.userId,
          sessionId: sessionData.sessionId,
          type: 'refresh',
          deviceFingerprint: deviceInfo.deviceFingerprint,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenTTL
        };

        newRefreshToken = jwt.sign(newRefreshTokenPayload, jwtSecrets.refreshSecret, {
          algorithm: 'HS256',
          issuer: process.env.JWT_ISSUER || 'botrt-ecommerce',
          audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel'
        });

        newRefreshTokenExpiry = new Date(Date.now() + this.config.refreshTokenTTL * 1000);

        // Calculate token hashes
        const oldRefreshTokenHash = crypto
          .createHash('sha256')
          .update(refreshToken)
          .digest('hex');

        const newRefreshTokenHash = crypto
          .createHash('sha256')
          .update(newRefreshToken)
          .digest('hex');

        // Update session with new refresh token hash
        sessionData.refreshTokenHash = newRefreshTokenHash;

        // SECURITY: Implement grace period for token rotation to prevent race conditions
        const { tokenRotationService } = await import('./TokenRotationService.js');
        await tokenRotationService.recordRotation(
          oldRefreshTokenHash,
          newRefreshTokenHash,
          sessionData.sessionId,
          sessionData.userId
        );

        // Note: Old refresh token will be valid during grace period
        // After grace period expires, it will be automatically invalid
        logger.debug('Token rotation completed with grace period', {
          sessionId: sessionData.sessionId,
          userId: sessionData.userId
        });
      }

      // Update session activity
      sessionData.lastActivity = new Date();
      sessionData.deviceInfo = deviceInfo;
      await this.storeSession(sessionData);

      logger.info('Access token refreshed', {
        userId: sessionData.userId,
        sessionId: sessionData.sessionId,
        rotatedRefreshToken: this.config.rotateRefreshTokens,
        deviceFingerprint: deviceInfo.deviceFingerprint
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        accessTokenExpiry: new Date(Date.now() + this.config.accessTokenTTL * 1000),
        refreshTokenExpiry: newRefreshTokenExpiry,
        sessionId: sessionData.sessionId
      };

    } catch (error) {
      logger.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string, deviceInfo?: DeviceInfo): Promise<any> {
    try {
      const jwtSecrets = secretManager.getJWTSecrets();

      // Verify token signature and expiration
      const decoded = jwt.verify(accessToken, jwtSecrets.secret) as any;

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Check if token is revoked (with grace period support for refresh tokens)
      if (this.revokedTokens.has(accessToken)) {
        // For refresh tokens, check if they're in grace period
        if (decoded.type === 'refresh') {
          const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
          const { tokenRotationService } = await import('./TokenRotationService.js');

          const graceCheck = await tokenRotationService.validateTokenInGracePeriod(
            tokenHash,
            decoded.sessionId
          );

          if (graceCheck.valid) {
            logger.info('Token validated during grace period', {
              sessionId: decoded.sessionId,
              newTokenHash: graceCheck.newTokenHash
            });
            // Token is valid during grace period - allow it
            return decoded;
          }
        }

        throw new Error('Access token has been revoked');
      }

      // Get session data for additional validation
      const sessionData = await this.getSession(decoded.sessionId);
      if (!sessionData || !sessionData.isActive) {
        throw new Error('Session not found or inactive');
      }

      // Check session inactivity timeout
      const inactivityMs = Date.now() - sessionData.lastActivity.getTime();
      if (inactivityMs > this.config.sessionInactivityTimeout * 1000) {
        logger.warn('Session expired due to inactivity', {
          sessionId: decoded.sessionId,
          inactivityMs,
          timeoutMs: this.config.sessionInactivityTimeout * 1000
        });

        await this.revokeSession(decoded.sessionId);
        throw new Error('Session expired due to inactivity');
      }

      // Verify device binding if provided
      if (this.config.requireDeviceBinding && deviceInfo) {
        if (sessionData.deviceInfo.deviceFingerprint !== deviceInfo.deviceFingerprint) {
          logger.warn('Device fingerprint mismatch during token validation', {
            sessionId: decoded.sessionId,
            expected: sessionData.deviceInfo.deviceFingerprint,
            actual: deviceInfo.deviceFingerprint
          });

          await this.revokeSession(decoded.sessionId);
          throw new Error('Device binding verification failed');
        }
      }

      // Update last activity
      if (this.config.enableSessionTracking) {
        sessionData.lastActivity = new Date();
        if (deviceInfo) {
          sessionData.deviceInfo = deviceInfo;
        }
        await this.storeSession(sessionData);
      }

      return {
        userId: decoded.userId,
        role: decoded.role,
        storeId: decoded.storeId,
        permissions: decoded.permissions,
        sessionId: decoded.sessionId
      };

    } catch (error) {
      logger.error('Token validation failed:', error);
      throw error;
    }
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    try {
      const sessionData = await this.getSession(sessionId);
      if (sessionData) {
        // Mark session as inactive
        sessionData.isActive = false;
        await this.storeSession(sessionData);

        // Add refresh token to revocation list
        const refreshTokenData = await this.getRefreshTokenBySession(sessionId);
        if (refreshTokenData) {
          this.revokedTokens.add(refreshTokenData);
        }

        // Remove from cache
        await this.removeSessionFromCache(sessionId);

        logger.info('Session revoked', {
          sessionId,
          userId: sessionData.userId
        });
      }

    } catch (error) {
      logger.error('Failed to revoke session:', error);
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      const sessions = await this.getUserSessions(userId);

      for (const session of sessions) {
        await this.revokeSession(session.sessionId);
      }

      logger.info('All user sessions revoked', {
        userId,
        sessionCount: sessions.length
      });

    } catch (error) {
      logger.error('Failed to revoke all user sessions:', error);
      throw error;
    }
  }

  /**
   * Store session data
   */
  private async storeSession(sessionData: SessionData): Promise<void> {
    try {
      // Store in cache for fast access
      await tenantCacheService.set(
        'system',
        `session_${sessionData.sessionId}`,
        sessionData,
        {
          ttl: this.config.refreshTokenTTL,
          namespace: 'auth'
        }
      );

      // Store in database for persistence
      const prisma = databaseService.getPrisma();
      await prisma.$executeRaw`
        INSERT INTO user_sessions (
          session_id, user_id, role, store_id, device_info,
          created_at, last_activity, is_active, refresh_token_hash, permissions
        ) VALUES (
          ${sessionData.sessionId}::TEXT,
          ${sessionData.userId}::UUID,
          ${sessionData.role}::TEXT,
          ${sessionData.storeId || null}::UUID,
          ${JSON.stringify(sessionData.deviceInfo)}::JSONB,
          ${sessionData.createdAt},
          ${sessionData.lastActivity},
          ${sessionData.isActive},
          ${sessionData.refreshTokenHash}::TEXT,
          ${JSON.stringify(sessionData.permissions)}::JSONB
        )
        ON CONFLICT (session_id) DO UPDATE SET
          last_activity = EXCLUDED.last_activity,
          is_active = EXCLUDED.is_active,
          refresh_token_hash = EXCLUDED.refresh_token_hash,
          permissions = EXCLUDED.permissions,
          device_info = EXCLUDED.device_info
      `;

    } catch (error) {
      logger.error('Failed to store session data:', error);
      throw error;
    }
  }

  /**
   * Get session data
   */
  private async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      // Try cache first
      const cached = await tenantCacheService.get<SessionData>(
        'system',
        `session_${sessionId}`,
        { namespace: 'auth' }
      );

      if (cached) {
        return cached;
      }

      // Fallback to database
      const prisma = databaseService.getPrisma();
      const result = await prisma.$queryRaw<any[]>`
        SELECT * FROM user_sessions WHERE session_id = ${sessionId} AND is_active = true
      `;

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      const sessionData: SessionData = {
        sessionId: row.session_id,
        userId: row.user_id,
        role: row.role,
        storeId: row.store_id,
        deviceInfo: row.device_info,
        createdAt: row.created_at,
        lastActivity: row.last_activity,
        isActive: row.is_active,
        refreshTokenHash: row.refresh_token_hash,
        permissions: row.permissions || []
      };

      // Cache for future use
      await tenantCacheService.set(
        'system',
        `session_${sessionId}`,
        sessionData,
        {
          ttl: this.config.refreshTokenTTL,
          namespace: 'auth'
        }
      );

      return sessionData;

    } catch (error) {
      logger.error('Failed to get session data:', error);
      return null;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const prisma = databaseService.getPrisma();
      const result = await prisma.$queryRaw<any[]>`
        SELECT * FROM user_sessions
        WHERE user_id = ${userId}::UUID AND is_active = true
        ORDER BY last_activity DESC
      `;

      return result.map(row => ({
        sessionId: row.session_id,
        userId: row.user_id,
        role: row.role,
        storeId: row.store_id,
        deviceInfo: row.device_info,
        createdAt: row.created_at,
        lastActivity: row.last_activity,
        isActive: row.is_active,
        refreshTokenHash: row.refresh_token_hash,
        permissions: row.permissions || []
      }));

    } catch (error) {
      logger.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Cleanup old sessions for user
   */
  private async cleanupUserSessions(userId: string): Promise<void> {
    try {
      const sessions = await this.getUserSessions(userId);

      if (sessions.length > this.config.maxSessionsPerUser) {
        // Sort by last activity and revoke oldest sessions
        const sessionsToRevoke = sessions
          .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())
          .slice(0, sessions.length - this.config.maxSessionsPerUser);

        for (const session of sessionsToRevoke) {
          await this.revokeSession(session.sessionId);
        }

        logger.info('Cleaned up old user sessions', {
          userId,
          revokedSessions: sessionsToRevoke.length,
          totalSessions: sessions.length
        });
      }

    } catch (error) {
      logger.error('Failed to cleanup user sessions:', error);
    }
  }

  /**
   * Remove session from cache
   */
  private async removeSessionFromCache(sessionId: string): Promise<void> {
    await tenantCacheService.delete('system', `session_${sessionId}`, { namespace: 'auth' });
  }

  /**
   * Get refresh token by session (for revocation)
   */
  private async getRefreshTokenBySession(_sessionId: string): Promise<string | null> {
    // This would require storing refresh tokens, which we avoid for security
    // Instead, we rely on the revocation list and session status
    return null;
  }

  /**
   * Health check for auth service
   */
  async healthCheck(): Promise<{
    status: string;
    activeSessions: number;
    revokedTokens: number;
    config: AuthConfig;
  }> {
    try {
      const prisma = databaseService.getPrisma();
      const result = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count FROM user_sessions WHERE is_active = true
      `;

      return {
        status: 'healthy',
        activeSessions: Number(result[0]?.count || 0),
        revokedTokens: this.revokedTokens.size,
        config: this.config
      };

    } catch (error) {
      logger.error('Auth service health check failed:', error);
      return {
        status: 'error',
        activeSessions: 0,
        revokedTokens: 0,
        config: this.config
      };
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): AuthConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const secureAuthService = SecureAuthService.getInstance();

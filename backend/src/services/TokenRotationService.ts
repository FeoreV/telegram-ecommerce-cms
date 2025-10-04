/**
 * Token Rotation Service with Grace Period
 * Implements safe token rotation with grace period to prevent race conditions
 */

import { redisService } from '../lib/redis';
import { logger } from '../utils/logger';

export interface RotationRecord {
  oldTokenHash: string;
  newTokenHash: string;
  sessionId: string;
  userId: string;
  rotatedAt: Date;
  expiresAt: Date;
}

export interface TokenRotationConfig {
  gracePeriod: number; // in milliseconds
  enableGracePeriod: boolean;
  maxRotationsPerSession: number;
  rotationWindowMs: number;
}

export class TokenRotationService {
  private static instance: TokenRotationService;
  private config: TokenRotationConfig;
  private readonly NAMESPACE = 'token_rotation';
  private readonly GRACE_PERIOD_KEY_PREFIX = 'grace_period';
  private readonly ROTATION_COUNTER_PREFIX = 'rotation_count';

  private constructor() {
    this.config = {
      gracePeriod: parseInt(process.env.TOKEN_ROTATION_GRACE_PERIOD || '10000'), // 10 seconds default
      enableGracePeriod: process.env.TOKEN_ROTATION_GRACE_PERIOD_ENABLED !== 'false',
      maxRotationsPerSession: parseInt(process.env.MAX_TOKEN_ROTATIONS_PER_SESSION || '5'),
      rotationWindowMs: parseInt(process.env.TOKEN_ROTATION_WINDOW || '60000') // 1 minute
    };

    logger.info('Token Rotation Service initialized', {
      gracePeriodMs: this.config.gracePeriod,
      gracePeriodFormatted: `${this.config.gracePeriod}ms`,
      enabled: this.config.enableGracePeriod
    });
  }

  public static getInstance(): TokenRotationService {
    if (!TokenRotationService.instance) {
      TokenRotationService.instance = new TokenRotationService();
    }
    return TokenRotationService.instance;
  }

  /**
   * Generate Redis key for grace period
   */
  private getGracePeriodKey(oldTokenHash: string): string {
    return `${this.NAMESPACE}:${this.GRACE_PERIOD_KEY_PREFIX}:${oldTokenHash}`;
  }

  /**
   * Generate Redis key for rotation counter
   */
  private getRotationCounterKey(sessionId: string): string {
    return `${this.NAMESPACE}:${this.ROTATION_COUNTER_PREFIX}:${sessionId}`;
  }

  /**
   * Record a token rotation with grace period
   */
  async recordRotation(
    oldTokenHash: string,
    newTokenHash: string,
    sessionId: string,
    userId: string
  ): Promise<void> {
    try {
      if (!this.config.enableGracePeriod) {
        return;
      }

      const redis = redisService.getClient();
      const now = new Date();
      const gracePeriodSeconds = Math.ceil(this.config.gracePeriod / 1000);

      const rotationRecord: RotationRecord = {
        oldTokenHash,
        newTokenHash,
        sessionId,
        userId,
        rotatedAt: now,
        expiresAt: new Date(now.getTime() + this.config.gracePeriod)
      };

      const key = this.getGracePeriodKey(oldTokenHash);

      // Store rotation record with grace period TTL
      await redis.setex(
        key,
        gracePeriodSeconds,
        JSON.stringify(rotationRecord)
      );

      // Increment rotation counter for this session
      const counterKey = this.getRotationCounterKey(sessionId);
      const rotationCount = await redis.incr(counterKey);

      // Set expiration on counter key
      if (rotationCount === 1) {
        await redis.expire(counterKey, Math.ceil(this.config.rotationWindowMs / 1000));
      }

      // Check if too many rotations in short period (possible token theft)
      if (rotationCount > this.config.maxRotationsPerSession) {
        logger.warn('Excessive token rotations detected - possible token theft', {
          sessionId,
          userId,
          rotationCount,
          window: `${this.config.rotationWindowMs}ms`
        });

        // You might want to invalidate the session here or trigger additional security measures
      }

      logger.debug('Token rotation recorded with grace period', {
        sessionId,
        userId,
        gracePeriod: `${this.config.gracePeriod}ms`,
        expiresAt: rotationRecord.expiresAt
      });

    } catch (error) {
      logger.error('Failed to record token rotation:', {
        sessionId,
        userId,
        error
      });
      // Don't throw - allow rotation to proceed even if recording fails
    }
  }

  /**
   * Check if old token is still in grace period
   */
  async isInGracePeriod(oldTokenHash: string): Promise<{
    inGracePeriod: boolean;
    newTokenHash?: string;
    expiresAt?: Date;
  }> {
    try {
      if (!this.config.enableGracePeriod) {
        return { inGracePeriod: false };
      }

      const redis = redisService.getClient();
      const key = this.getGracePeriodKey(oldTokenHash);

      const data = await redis.get(key);

      if (!data) {
        return { inGracePeriod: false };
      }

      const record = JSON.parse(data) as RotationRecord;
      const expiresAt = new Date(record.expiresAt);

      // Check if grace period has expired
      if (expiresAt < new Date()) {
        return { inGracePeriod: false };
      }

      return {
        inGracePeriod: true,
        newTokenHash: record.newTokenHash,
        expiresAt
      };

    } catch (error) {
      logger.error('Failed to check grace period:', { oldTokenHash, error });
      // Fail secure - return not in grace period
      return { inGracePeriod: false };
    }
  }

  /**
   * Validate token during grace period
   * Returns the new token hash if old token is in grace period and still valid
   */
  async validateTokenInGracePeriod(
    oldTokenHash: string,
    sessionId: string
  ): Promise<{
    valid: boolean;
    newTokenHash?: string;
    reason?: string;
  }> {
    try {
      const gracePeriodCheck = await this.isInGracePeriod(oldTokenHash);

      if (!gracePeriodCheck.inGracePeriod) {
        return {
          valid: false,
          reason: 'Token not in grace period'
        };
      }

      // Verify session ID matches
      const redis = redisService.getClient();
      const key = this.getGracePeriodKey(oldTokenHash);
      const data = await redis.get(key);

      if (!data) {
        return {
          valid: false,
          reason: 'Grace period record not found'
        };
      }

      const record = JSON.parse(data) as RotationRecord;

      if (record.sessionId !== sessionId) {
        logger.warn('Session ID mismatch during grace period validation', {
          expected: record.sessionId,
          provided: sessionId
        });
        return {
          valid: false,
          reason: 'Session ID mismatch'
        };
      }

      logger.info('Token validated successfully during grace period', {
        sessionId,
        timeRemaining: `${new Date(record.expiresAt).getTime() - Date.now()}ms`
      });

      return {
        valid: true,
        newTokenHash: record.newTokenHash
      };

    } catch (error) {
      logger.error('Failed to validate token in grace period:', {
        oldTokenHash,
        sessionId,
        error
      });
      return {
        valid: false,
        reason: 'Validation error'
      };
    }
  }

  /**
   * Revoke grace period (e.g., on explicit logout)
   */
  async revokeGracePeriod(oldTokenHash: string): Promise<void> {
    try {
      const redis = redisService.getClient();
      const key = this.getGracePeriodKey(oldTokenHash);

      await redis.del(key);

      logger.debug('Grace period revoked', { oldTokenHash });

    } catch (error) {
      logger.error('Failed to revoke grace period:', { oldTokenHash, error });
    }
  }

  /**
   * Get rotation statistics for a session
   */
  async getSessionRotationStats(sessionId: string): Promise<{
    rotationCount: number;
    remainingWindow: number;
  }> {
    try {
      const redis = redisService.getClient();
      const counterKey = this.getRotationCounterKey(sessionId);

      const count = await redis.get(counterKey);
      const ttl = await redis.ttl(counterKey);

      return {
        rotationCount: count ? parseInt(count) : 0,
        remainingWindow: ttl > 0 ? ttl * 1000 : 0
      };

    } catch (error) {
      logger.error('Failed to get rotation stats:', { sessionId, error });
      return {
        rotationCount: 0,
        remainingWindow: 0
      };
    }
  }

  /**
   * Clear all rotation records for a session
   */
  async clearSessionRotations(sessionId: string): Promise<void> {
    try {
      const redis = redisService.getClient();
      const counterKey = this.getRotationCounterKey(sessionId);

      await redis.del(counterKey);

      logger.debug('Session rotation records cleared', { sessionId });

    } catch (error) {
      logger.error('Failed to clear session rotations:', { sessionId, error });
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TokenRotationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Token rotation configuration updated', {
      gracePeriod: this.config.gracePeriod,
      enableGracePeriod: this.config.enableGracePeriod,
      maxRotationsPerSession: this.config.maxRotationsPerSession,
      rotationWindowMs: this.config.rotationWindowMs
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): TokenRotationConfig {
    return { ...this.config };
  }

  /**
   * Get statistics across all sessions
   */
  async getGlobalStats(): Promise<{
    activeGracePeriods: number;
    activeSessions: number;
  }> {
    try {
      const redis = redisService.getClient();

      const gracePeriodKeys = await redis.keys(`${this.NAMESPACE}:${this.GRACE_PERIOD_KEY_PREFIX}:*`);
      const sessionKeys = await redis.keys(`${this.NAMESPACE}:${this.ROTATION_COUNTER_PREFIX}:*`);

      return {
        activeGracePeriods: gracePeriodKeys.length,
        activeSessions: sessionKeys.length
      };

    } catch (error) {
      logger.error('Failed to get global rotation stats:', error);
      return {
        activeGracePeriods: 0,
        activeSessions: 0
      };
    }
  }
}

// Export singleton instance
export const tokenRotationService = TokenRotationService.getInstance();


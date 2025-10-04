/**
 * IP Reputation Service - Redis-backed
 * Centralized IP reputation tracking with Redis storage
 */

import { redisService } from '../lib/redis';
import { logger } from '../utils/logger';

export interface IPReputationData {
  ip: string;
  suspiciousCount: number;
  lastSeen: Date;
  blocked: boolean;
  blockedUntil?: Date;
  reason?: string;
  firstSeen: Date;
  totalRequests: number;
  failedAuth: number;
  violations: string[];
}

export interface IPReputationConfig {
  suspiciousThreshold: number;
  blockDuration: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
  maxViolations: number;
  autoBlockEnabled: boolean;
  whitelistedIPs: string[];
}

export class IPReputationService {
  private static instance: IPReputationService;
  private config: IPReputationConfig;
  private readonly NAMESPACE = 'ip_reputation';
  private readonly BLOCK_LIST_KEY = 'ip_reputation:blocked';
  private cleanupTimer?: NodeJS.Timeout;

  private constructor() {
    this.config = {
      suspiciousThreshold: parseInt(process.env.IP_SUSPICIOUS_THRESHOLD || '10'),
      blockDuration: parseInt(process.env.IP_BLOCK_DURATION || '3600000'), // 1 hour default
      cleanupInterval: parseInt(process.env.IP_CLEANUP_INTERVAL || '300000'), // 5 minutes
      maxViolations: parseInt(process.env.IP_MAX_VIOLATIONS || '5'),
      autoBlockEnabled: process.env.IP_AUTO_BLOCK !== 'false',
      whitelistedIPs: (process.env.IP_WHITELIST || '').split(',').filter(Boolean)
    };

    // Start cleanup task
    this.startCleanupTask();
  }

  public static getInstance(): IPReputationService {
    if (!IPReputationService.instance) {
      IPReputationService.instance = new IPReputationService();
    }
    return IPReputationService.instance;
  }

  /**
   * Generate Redis key for IP
   */
  private getIPKey(ip: string): string {
    return `${this.NAMESPACE}:${ip}`;
  }

  /**
   * Check if IP is whitelisted
   */
  private isWhitelisted(ip: string): boolean {
    return this.config.whitelistedIPs.includes(ip);
  }

  /**
   * Get IP reputation data from Redis
   */
  async getIPReputation(ip: string): Promise<IPReputationData | null> {
    try {
      if (this.isWhitelisted(ip)) {
        return null;
      }

      const redis = redisService.getClient();
      const key = this.getIPKey(ip);
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data) as IPReputationData;
      // Convert string dates back to Date objects
      parsed.lastSeen = new Date(parsed.lastSeen);
      parsed.firstSeen = new Date(parsed.firstSeen);
      if (parsed.blockedUntil) {
        parsed.blockedUntil = new Date(parsed.blockedUntil);
      }

      return parsed;

    } catch (error) {
      logger.error('Failed to get IP reputation:', { ip, error });
      return null;
    }
  }

  /**
   * Record suspicious activity from IP
   */
  async markSuspicious(ip: string, reason: string = 'suspicious_activity'): Promise<void> {
    try {
      if (this.isWhitelisted(ip)) {
        return;
      }

      const redis = redisService.getClient();
      const key = this.getIPKey(ip);
      const now = new Date();

      let ipData = await this.getIPReputation(ip);

      if (!ipData) {
        // Create new reputation record
        ipData = {
          ip,
          suspiciousCount: 1,
          lastSeen: now,
          blocked: false,
          firstSeen: now,
          totalRequests: 1,
          failedAuth: reason.includes('auth') ? 1 : 0,
          violations: [reason]
        };
      } else {
        // Update existing record
        ipData.suspiciousCount++;
        ipData.lastSeen = now;
        ipData.totalRequests++;
        if (reason.includes('auth')) {
          ipData.failedAuth++;
        }
        if (!ipData.violations.includes(reason)) {
          ipData.violations.push(reason);
        }

        // Auto-block if threshold exceeded
        if (
          this.config.autoBlockEnabled &&
          !ipData.blocked &&
          (ipData.suspiciousCount >= this.config.suspiciousThreshold ||
            ipData.violations.length >= this.config.maxViolations)
        ) {
          ipData.blocked = true;
          ipData.blockedUntil = new Date(now.getTime() + this.config.blockDuration);
          ipData.reason = `Auto-blocked: ${reason}`;

          // Add to blocked set for fast lookups
          await redis.sadd(this.BLOCK_LIST_KEY, ip);

          logger.warn('IP automatically blocked due to suspicious activity', {
            ip,
            suspiciousCount: ipData.suspiciousCount,
            violations: ipData.violations,
            reason
          });
        }
      }

      // Store in Redis with TTL
      const ttl = ipData.blocked && ipData.blockedUntil
        ? Math.ceil((ipData.blockedUntil.getTime() - now.getTime()) / 1000)
        : 86400; // 24 hours for non-blocked IPs

      await redis.setex(key, Math.max(ttl, 60), JSON.stringify(ipData));

      logger.debug('IP marked as suspicious', { ip, reason, suspiciousCount: ipData.suspiciousCount });

    } catch (error) {
      logger.error('Failed to mark IP as suspicious:', { ip, reason, error });
    }
  }

  /**
   * Check if IP is blocked
   */
  async isBlocked(ip: string): Promise<{ blocked: boolean; reason?: string; blockedUntil?: Date }> {
    try {
      if (this.isWhitelisted(ip)) {
        return { blocked: false };
      }

      const redis = redisService.getClient();

      // Quick check in blocked set
      const inBlockedSet = await redis.sismember(this.BLOCK_LIST_KEY, ip);

      if (!inBlockedSet) {
        return { blocked: false };
      }

      // Get full data to check if block has expired
      const ipData = await this.getIPReputation(ip);

      if (!ipData || !ipData.blocked) {
        // Remove from blocked set if not actually blocked
        await redis.srem(this.BLOCK_LIST_KEY, ip);
        return { blocked: false };
      }

      // Check if block has expired
      if (ipData.blockedUntil && ipData.blockedUntil < new Date()) {
        await this.unblockIP(ip);
        return { blocked: false };
      }

      return {
        blocked: true,
        reason: ipData.reason,
        blockedUntil: ipData.blockedUntil
      };

    } catch (error) {
      logger.error('Failed to check if IP is blocked:', { ip, error });
      // Fail open on error to prevent blocking legitimate traffic
      return { blocked: false };
    }
  }

  /**
   * Manually block an IP
   */
  async blockIP(ip: string, reason: string, duration?: number): Promise<void> {
    try {
      if (this.isWhitelisted(ip)) {
        logger.warn('Attempted to block whitelisted IP', { ip });
        return;
      }

      const redis = redisService.getClient();
      const key = this.getIPKey(ip);
      const now = new Date();
      const blockDuration = duration || this.config.blockDuration;

      let ipData = await this.getIPReputation(ip);

      if (!ipData) {
        ipData = {
          ip,
          suspiciousCount: this.config.suspiciousThreshold,
          lastSeen: now,
          blocked: true,
          blockedUntil: new Date(now.getTime() + blockDuration),
          reason,
          firstSeen: now,
          totalRequests: 1,
          failedAuth: 0,
          violations: [reason]
        };
      } else {
        ipData.blocked = true;
        ipData.blockedUntil = new Date(now.getTime() + blockDuration);
        ipData.reason = reason;
        ipData.lastSeen = now;
      }

      // Store in Redis
      const ttl = Math.ceil(blockDuration / 1000);
      await redis.setex(key, ttl, JSON.stringify(ipData));

      // Add to blocked set
      await redis.sadd(this.BLOCK_LIST_KEY, ip);

      logger.info('IP manually blocked', {
        ip,
        reason,
        blockedUntil: ipData.blockedUntil
      });

    } catch (error) {
      logger.error('Failed to block IP:', { ip, reason, error });
      throw error;
    }
  }

  /**
   * Unblock an IP
   */
  async unblockIP(ip: string): Promise<void> {
    try {
      const redis = redisService.getClient();
      const key = this.getIPKey(ip);

      const ipData = await this.getIPReputation(ip);

      if (ipData) {
        ipData.blocked = false;
        ipData.blockedUntil = undefined;
        ipData.reason = undefined;
        ipData.suspiciousCount = 0; // Reset count on unblock
        ipData.violations = [];

        // Store updated data
        await redis.setex(key, 86400, JSON.stringify(ipData));
      }

      // Remove from blocked set
      await redis.srem(this.BLOCK_LIST_KEY, ip);

      logger.info('IP unblocked', { ip });

    } catch (error) {
      logger.error('Failed to unblock IP:', { ip, error });
      throw error;
    }
  }

  /**
   * Get all blocked IPs
   */
  async getBlockedIPs(): Promise<string[]> {
    try {
      const redis = redisService.getClient();
      const blockedIPs = await redis.smembers(this.BLOCK_LIST_KEY);
      return blockedIPs;

    } catch (error) {
      logger.error('Failed to get blocked IPs:', error);
      return [];
    }
  }

  /**
   * Get reputation statistics
   */
  async getStatistics(): Promise<{
    totalTracked: number;
    totalBlocked: number;
    topViolators: Array<{ ip: string; suspiciousCount: number; violations: string[] }>;
  }> {
    try {
      const redis = redisService.getClient();

      // Get all IP reputation keys
      const keys = await redis.keys(`${this.NAMESPACE}:*`);
      const blockedCount = await redis.scard(this.BLOCK_LIST_KEY);

      // Get top violators
      const topViolators: Array<{ ip: string; suspiciousCount: number; violations: string[] }> = [];

      for (const key of keys.slice(0, 100)) { // Limit to first 100 for performance
        const data = await redis.get(key);
        if (data) {
          const ipData = JSON.parse(data) as IPReputationData;
          if (ipData.suspiciousCount > 0) {
            topViolators.push({
              ip: ipData.ip,
              suspiciousCount: ipData.suspiciousCount,
              violations: ipData.violations
            });
          }
        }
      }

      // Sort by suspicious count
      topViolators.sort((a, b) => b.suspiciousCount - a.suspiciousCount);

      return {
        totalTracked: keys.length,
        totalBlocked: blockedCount,
        topViolators: topViolators.slice(0, 10) // Top 10
      };

    } catch (error) {
      logger.error('Failed to get IP reputation statistics:', error);
      return {
        totalTracked: 0,
        totalBlocked: 0,
        topViolators: []
      };
    }
  }

  /**
   * Cleanup expired blocks
   */
  private async cleanupExpiredBlocks(): Promise<void> {
    try {
      const redis = redisService.getClient();
      const blockedIPs = await redis.smembers(this.BLOCK_LIST_KEY);
      const now = new Date();
      let cleanedCount = 0;

      for (const ip of blockedIPs) {
        const ipData = await this.getIPReputation(ip);

        if (!ipData || !ipData.blocked || (ipData.blockedUntil && ipData.blockedUntil < now)) {
          await redis.srem(this.BLOCK_LIST_KEY, ip);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up expired IP blocks', { count: cleanedCount });
      }

    } catch (error) {
      logger.error('Failed to cleanup expired IP blocks:', error);
    }
  }

  /**
   * Start cleanup task
   */
  private startCleanupTask(): void {
    this.cleanupTimer = setInterval(
      () => this.cleanupExpiredBlocks(),
      this.config.cleanupInterval
    );

    logger.info('IP reputation cleanup task started', {
      interval: this.config.cleanupInterval
    });
  }

  /**
   * Stop cleanup task
   */
  stopCleanupTask(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      logger.info('IP reputation cleanup task stopped');
    }
  }

  /**
   * Public method to trigger cleanup manually
   */
  async cleanup(): Promise<void> {
    await this.cleanupExpiredBlocks();
  }

  /**
   * Get statistics about IP reputation
   */
  async getStats(): Promise<{ totalSuspicious: number; totalBlocked: number }> {
    try {
      const redis = redisService.getClient();
      const keys = await redis.keys(`${this.NAMESPACE}:*`);
      const blockedCount = await redis.scard(this.BLOCK_LIST_KEY);

      return {
        totalSuspicious: keys.length,
        totalBlocked: blockedCount
      };
    } catch (error) {
      logger.error('Failed to get IP reputation stats:', error);
      return {
        totalSuspicious: 0,
        totalBlocked: 0
      };
    }
  }

  /**
   * Clear all IP reputation data (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      const redis = redisService.getClient();
      const keys = await redis.keys(`${this.NAMESPACE}:*`);

      if (keys.length > 0) {
        await redis.del(...keys);
      }

      await redis.del(this.BLOCK_LIST_KEY);

      logger.warn('All IP reputation data cleared');

    } catch (error) {
      logger.error('Failed to clear IP reputation data:', error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IPReputationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('IP reputation configuration updated', {
      suspiciousThreshold: this.config.suspiciousThreshold,
      blockDuration: this.config.blockDuration,
      maxViolations: this.config.maxViolations,
      autoBlockEnabled: this.config.autoBlockEnabled
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): IPReputationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const ipReputationService = IPReputationService.getInstance();


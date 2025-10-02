import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';

let RedisPackage: any;
try {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  RedisPackage = require('ioredis');
} catch (error) {
  RedisPackage = undefined;
  logger.warn('ioredis package not found; Redis features disabled.');
}

interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    blockDuration: number;
  };
  spamDetection: {
    enabled: boolean;
    maxScore: number;
    scoreDecayMs: number;
    commonPhrases: string[];
  };
  adminSafety: {
    requireConfirmation: boolean;
    logAllActions: boolean;
  };
}

export const PRODUCTION_SECURITY_CONFIG: SecurityConfig = {
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    blockDuration: 5 * 60 * 1000, // 5 minutes
  },
  spamDetection: {
    enabled: true,
    maxScore: 30,
    scoreDecayMs: 30 * 60 * 1000, // 30 minutes
    commonPhrases: ['spam', 'click here', '💰', 'free money'],
  },
  adminSafety: {
    requireConfirmation: true,
    logAllActions: true,
  },
};

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 100, // More lenient for development
    blockDuration: 2 * 60 * 1000, // 2 minutes
  },
  spamDetection: {
    enabled: false, // Disabled in dev
    maxScore: 50,
    scoreDecayMs: 15 * 60 * 1000,
    commonPhrases: [],
  },
  adminSafety: {
    requireConfirmation: false,
    logAllActions: true,
  },
};

type RedisClient = typeof RedisPackage extends { new (...args: any[]): infer R } ? R : undefined;

export class TelegramBotSecurity {
  private config: SecurityConfig;
  private redis: RedisClient;
  
  private requestCounts = new Map<string, { count: number; resetTime: number }>();
  private blockedUsers = new Map<string, number>();
  private suspiciousUsers = new Map<string, { score: number; lastSeen: number }>();
  private lastRedisError: { message: string; timestamp: number } | null = null;

  constructor(config: SecurityConfig, redisClient?: RedisClient) {
    this.config = config;
    this.redis = redisClient ?? this.createRedisClient();

    if (this.redis && typeof (this.redis as any).on === 'function') {
      (this.redis as any).on('error', (err: Error) => {
        const isProduction = process.env.NODE_ENV === 'production';
        const isDevelopment = process.env.NODE_ENV === 'development';
        const errorCode = (err as any).code;
        
        // Suppress ECONNREFUSED spam in development mode
        if (isDevelopment && errorCode === 'ECONNREFUSED') {
          // Only log once every 5 minutes to avoid spam
          const now = Date.now();
          if (!this.lastRedisError || 
              this.lastRedisError.message !== errorCode || 
              now - this.lastRedisError.timestamp > 300000) {
            logger.warn('Redis unavailable in bot security (using in-memory mode). To enable Redis, start Docker: docker-compose up -d redis');
            this.lastRedisError = { message: errorCode, timestamp: now };
          }
          return;
        }
        
        if (isProduction) {
          logger.error('Redis connection error in bot security:', err);
        } else {
          logger.warn('Redis connection error in bot security (development mode):', err);
        }
      });
    }
  }

  private createRedisClient(): RedisClient {
    if (!RedisPackage) {
      logger.warn('ioredis package is not installed; running in in-memory mode.');
      return undefined;
    }
    try {
      const redisUrl = process.env.REDIS_URL?.trim();
      const redisHost = process.env.REDIS_HOST?.trim();

      if (!redisUrl && !redisHost) {
        logger.info('Redis not configured for bot security; using in-memory mode.');
        return undefined;
      }

      const isDevelopment = process.env.NODE_ENV === 'development';
      
      const redisOptions = {
        retryStrategy: (times: number) => {
          // In development, stop retrying after 3 attempts to avoid spam
          if (isDevelopment && times > 3) {
            logger.warn('Redis connection failed after 3 attempts, continuing in in-memory mode');
            return null; // Stop retrying
          }
          // In production, retry with exponential backoff
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true, // Don't connect immediately
      };

      if (redisUrl) {
        return new RedisPackage(redisUrl, redisOptions);
      }

      return new RedisPackage({
        host: redisHost,
        port: Number(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        ...redisOptions,
      });
    } catch (error) {
      logger.warn('Failed to create Redis client for bot security, using in-memory fallback:', error);
      return undefined;
    }
  }

  /**
   * Initialize Redis connection
   */
  async init(): Promise<void> {
    try {
      if (!this.redis) {
        logger.info('Bot security Redis not initialized; continuing with in-memory guards.');
        return;
      }
      if (this.redis && typeof (this.redis as any).connect === 'function') {
        await (this.redis as any).connect();
        logger.info('Bot security Redis connection established');
      }
    } catch (error) {
      logger.warn('Redis connection failed for bot security, using in-memory fallback:', error);
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      if (this.redis && typeof (this.redis as any).quit === 'function') {
        await (this.redis as any).quit();
        logger.info('Bot security Redis connection closed');
      }
    } catch (error) {
      logger.warn('Error closing bot security Redis connection:', error);
    }
  }

  /**
   * Rate limiting middleware
   */
  async checkRateLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const key = `rate_limit:${userId}`;

    try {
      // Try Redis first
      if (this.redis) {
        if (this.redis && typeof (this.redis as any).get === 'function') {
          const current = await (this.redis as any).get(key);
          if (current && parseInt(current) >= this.config.rateLimit.maxRequests) {
            logger.warn(`Rate limit exceeded for user ${userId}`);
            return false;
          }
        }
        
        if (this.redis && typeof (this.redis as any).incr === 'function') {
          await (this.redis as any).incr(key);
        }
        if (this.redis && typeof (this.redis as any).expire === 'function') {
          await (this.redis as any).expire(key, Math.floor(this.config.rateLimit.windowMs / 1000));
        }
        return true;
      }
    } catch (error) {
      logger.warn('Redis rate limiting failed, using in-memory fallback:', error);
    }

    // Fallback to in-memory
    const userLimit = this.requestCounts.get(userId);
    
    if (!userLimit || now >= userLimit.resetTime) {
      this.requestCounts.set(userId, {
        count: 1,
        resetTime: now + this.config.rateLimit.windowMs
      });
      return true;
    }

    if (userLimit.count >= this.config.rateLimit.maxRequests) {
      this.blockedUsers.set(userId, now + this.config.rateLimit.blockDuration);
      logger.warn(`Rate limit exceeded for user ${userId}`);
      return false;
    }

    userLimit.count++;
    return true;
  }

  /**
   * Check if user is blocked
   */
  isBlocked(userId: string): boolean {
    const blockedUntil = this.blockedUsers.get(userId);
    if (blockedUntil && Date.now() < blockedUntil) {
      return true;
    } else if (blockedUntil) {
      this.blockedUsers.delete(userId);
    }
    return false;
  }

  async unblockUser(userId: string): Promise<void> {
    this.blockedUsers.delete(userId);
    try {
      if (this.redis && typeof (this.redis as any).del === 'function') {
        await (this.redis as any).del(`rate_limit:${userId}`);
      }
    } catch (error) {
      logger.warn('Failed to clear Redis rate limit during unblock', error);
    }
    logger.info(`User ${userId} unblocked via security service`);
  }

  /**
   * Spam detection
   */
  checkSpam(userId: string, message: string): boolean {
    if (!this.config.spamDetection.enabled) {
      return false;
    }

    const score = this.calculateSpamScore(userId, message);
    const user = this.suspiciousUsers.get(userId) || { score: 0, lastSeen: Date.now() };
    
    // Decay score over time
    const timeSinceLastSeen = Date.now() - user.lastSeen;
    if (timeSinceLastSeen > this.config.spamDetection.scoreDecayMs) {
      user.score = Math.max(0, user.score - Math.floor(timeSinceLastSeen / this.config.spamDetection.scoreDecayMs) * 5);
    }

    user.score += score;
    user.lastSeen = Date.now();
    this.suspiciousUsers.set(userId, user);

    if (user.score >= this.config.spamDetection.maxScore) {
      logger.warn(`Spam detected for user ${userId}, score: ${user.score}`);
      this.blockedUsers.set(userId, Date.now() + (10 * 60 * 1000)); // Block for 10 minutes
      return true;
    }

    return false;
  }

  private calculateSpamScore(userId: string, message: string): number {
    const msg = message.toLowerCase();
    let score = 0;

    // Check for spam phrases
    for (const phrase of this.config.spamDetection.commonPhrases) {
      if (msg.includes(phrase.toLowerCase())) {
        score += 10;
      }
    }

    // Check for excessive caps
    if (message.length > 10 && (message.match(/[A-Z]/g) || []).length / message.length > 0.7) {
      score += 5;
    }

    // Check for excessive emojis
    const emojiCount = (message.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
    if (emojiCount > 5) {
      score += emojiCount;
    }

    // Check message frequency
    const activity = this.getRecentActivity(userId);
    if (activity.messageCount > 5) {
      score += 10;
    }

    // Rapid fire messages
    if (activity.messageCount > 10) {
      score += 25;
    }

    // New users are slightly more suspicious
    const userAge = (Date.now() / 1000) - (Date.now() / 1000); // User creation time not available via bot API
    if (userAge < 86400) { // Less than 1 day
      score += 5;
    }

    return Math.min(score, 50); // Cap individual message score
  }

  private getRecentActivity(userId: string): { messageCount: number; lastMessageTime: number } {
    // This would typically track recent message activity
    // For now, return minimal activity
    return {
      messageCount: 1,
      lastMessageTime: Date.now()
    };
  }

  /**
   * Security middleware for message processing
   */
  async processMessage(msg: TelegramBot.Message): Promise<boolean> {
    const userId = msg.from?.id?.toString();
    if (!userId) return false;

    // Check if user is blocked
    if (this.isBlocked(userId)) {
      logger.warn(`Blocked user ${userId} attempted to send message`);
      return false;
    }

    // Check rate limits
    if (!(await this.checkRateLimit(userId))) {
      return false;
    }

    // Check for spam
    if (msg.text && this.checkSpam(userId, msg.text)) {
      return false;
    }

    return true;
  }

  /**
   * Log security events
   */
  logSecurityEvent(event: string, userId: string, details: any = {}): void {
    logger.warn(`Security Event: ${event}`, {
      userId,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    blockedUsers: number;
    suspiciousUsers: number;
    totalRequests: number;
    rateLimitedRequests: number;
  } {
    return {
      blockedUsers: this.blockedUsers.size,
      suspiciousUsers: this.suspiciousUsers.size,
      totalRequests: Array.from(this.requestCounts.values()).reduce((sum, item) => sum + item.count, 0),
      rateLimitedRequests: 0 // This would need to be tracked separately
    };
  }

  /**
   * Admin confirmation for sensitive operations
   */
  async requireAdminConfirmation(
    bot: TelegramBot,
    chatId: number,
    action: string,
    userId: string
  ): Promise<boolean> {
    if (!this.config.adminSafety.requireConfirmation) {
      return true;
    }

    // This would implement a confirmation dialog
    // For now, just log and allow
    this.logSecurityEvent('admin_action_attempted', userId, { action, chatId });
    return true;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    
    // Clean up expired blocks
    for (const [userId, blockedUntil] of this.blockedUsers.entries()) {
      if (now >= blockedUntil) {
        this.blockedUsers.delete(userId);
      }
    }

    // Clean up old rate limit data
    for (const [userId, data] of this.requestCounts.entries()) {
      if (now >= data.resetTime) {
        this.requestCounts.delete(userId);
      }
    }

    // Clean up old suspicious user data
    for (const [userId, data] of this.suspiciousUsers.entries()) {
      if (now - data.lastSeen > 24 * 60 * 60 * 1000) { // 24 hours
        this.suspiciousUsers.delete(userId);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000); // Every 10 minutes
  }
}

export default TelegramBotSecurity;
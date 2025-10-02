"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramBotSecurity = exports.DEFAULT_SECURITY_CONFIG = exports.PRODUCTION_SECURITY_CONFIG = void 0;
const logger_1 = require("../utils/logger");
let RedisPackage;
try {
    RedisPackage = require('ioredis');
}
catch (error) {
    RedisPackage = undefined;
    logger_1.logger.warn('ioredis package not found; Redis features disabled.');
}
exports.PRODUCTION_SECURITY_CONFIG = {
    rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 30,
        blockDuration: 5 * 60 * 1000,
    },
    spamDetection: {
        enabled: true,
        maxScore: 30,
        scoreDecayMs: 30 * 60 * 1000,
        commonPhrases: ['spam', 'click here', '💰', 'free money'],
    },
    adminSafety: {
        requireConfirmation: true,
        logAllActions: true,
    },
};
exports.DEFAULT_SECURITY_CONFIG = {
    rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 100,
        blockDuration: 2 * 60 * 1000,
    },
    spamDetection: {
        enabled: false,
        maxScore: 50,
        scoreDecayMs: 15 * 60 * 1000,
        commonPhrases: [],
    },
    adminSafety: {
        requireConfirmation: false,
        logAllActions: true,
    },
};
class TelegramBotSecurity {
    constructor(config, redisClient) {
        this.requestCounts = new Map();
        this.blockedUsers = new Map();
        this.suspiciousUsers = new Map();
        this.lastRedisError = null;
        this.config = config;
        this.redis = redisClient ?? this.createRedisClient();
        if (this.redis && typeof this.redis.on === 'function') {
            this.redis.on('error', (err) => {
                const isProduction = process.env.NODE_ENV === 'production';
                const isDevelopment = process.env.NODE_ENV === 'development';
                const errorCode = err.code;
                if (isDevelopment && errorCode === 'ECONNREFUSED') {
                    const now = Date.now();
                    if (!this.lastRedisError ||
                        this.lastRedisError.message !== errorCode ||
                        now - this.lastRedisError.timestamp > 300000) {
                        logger_1.logger.warn('Redis unavailable in bot security (using in-memory mode). To enable Redis, start Docker: docker-compose up -d redis');
                        this.lastRedisError = { message: errorCode, timestamp: now };
                    }
                    return;
                }
                if (isProduction) {
                    logger_1.logger.error('Redis connection error in bot security:', err);
                }
                else {
                    logger_1.logger.warn('Redis connection error in bot security (development mode):', err);
                }
            });
        }
    }
    createRedisClient() {
        if (!RedisPackage) {
            logger_1.logger.warn('ioredis package is not installed; running in in-memory mode.');
            return undefined;
        }
        try {
            const redisUrl = process.env.REDIS_URL?.trim();
            const redisHost = process.env.REDIS_HOST?.trim();
            if (!redisUrl && !redisHost) {
                logger_1.logger.info('Redis not configured for bot security; using in-memory mode.');
                return undefined;
            }
            const isDevelopment = process.env.NODE_ENV === 'development';
            const redisOptions = {
                retryStrategy: (times) => {
                    if (isDevelopment && times > 3) {
                        logger_1.logger.warn('Redis connection failed after 3 attempts, continuing in in-memory mode');
                        return null;
                    }
                    return Math.min(times * 100, 3000);
                },
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
                lazyConnect: true,
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
        }
        catch (error) {
            logger_1.logger.warn('Failed to create Redis client for bot security, using in-memory fallback:', error);
            return undefined;
        }
    }
    async init() {
        try {
            if (!this.redis) {
                logger_1.logger.info('Bot security Redis not initialized; continuing with in-memory guards.');
                return;
            }
            if (this.redis && typeof this.redis.connect === 'function') {
                await this.redis.connect();
                logger_1.logger.info('Bot security Redis connection established');
            }
        }
        catch (error) {
            logger_1.logger.warn('Redis connection failed for bot security, using in-memory fallback:', error);
        }
    }
    async close() {
        try {
            if (this.redis && typeof this.redis.quit === 'function') {
                await this.redis.quit();
                logger_1.logger.info('Bot security Redis connection closed');
            }
        }
        catch (error) {
            logger_1.logger.warn('Error closing bot security Redis connection:', error);
        }
    }
    async checkRateLimit(userId) {
        const now = Date.now();
        const key = `rate_limit:${userId}`;
        try {
            if (this.redis) {
                if (this.redis && typeof this.redis.get === 'function') {
                    const current = await this.redis.get(key);
                    if (current && parseInt(current) >= this.config.rateLimit.maxRequests) {
                        logger_1.logger.warn(`Rate limit exceeded for user ${userId}`);
                        return false;
                    }
                }
                if (this.redis && typeof this.redis.incr === 'function') {
                    await this.redis.incr(key);
                }
                if (this.redis && typeof this.redis.expire === 'function') {
                    await this.redis.expire(key, Math.floor(this.config.rateLimit.windowMs / 1000));
                }
                return true;
            }
        }
        catch (error) {
            logger_1.logger.warn('Redis rate limiting failed, using in-memory fallback:', error);
        }
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
            logger_1.logger.warn(`Rate limit exceeded for user ${userId}`);
            return false;
        }
        userLimit.count++;
        return true;
    }
    isBlocked(userId) {
        const blockedUntil = this.blockedUsers.get(userId);
        if (blockedUntil && Date.now() < blockedUntil) {
            return true;
        }
        else if (blockedUntil) {
            this.blockedUsers.delete(userId);
        }
        return false;
    }
    async unblockUser(userId) {
        this.blockedUsers.delete(userId);
        try {
            if (this.redis && typeof this.redis.del === 'function') {
                await this.redis.del(`rate_limit:${userId}`);
            }
        }
        catch (error) {
            logger_1.logger.warn('Failed to clear Redis rate limit during unblock', error);
        }
        logger_1.logger.info(`User ${userId} unblocked via security service`);
    }
    checkSpam(userId, message) {
        if (!this.config.spamDetection.enabled) {
            return false;
        }
        const score = this.calculateSpamScore(userId, message);
        const user = this.suspiciousUsers.get(userId) || { score: 0, lastSeen: Date.now() };
        const timeSinceLastSeen = Date.now() - user.lastSeen;
        if (timeSinceLastSeen > this.config.spamDetection.scoreDecayMs) {
            user.score = Math.max(0, user.score - Math.floor(timeSinceLastSeen / this.config.spamDetection.scoreDecayMs) * 5);
        }
        user.score += score;
        user.lastSeen = Date.now();
        this.suspiciousUsers.set(userId, user);
        if (user.score >= this.config.spamDetection.maxScore) {
            logger_1.logger.warn(`Spam detected for user ${userId}, score: ${user.score}`);
            this.blockedUsers.set(userId, Date.now() + (10 * 60 * 1000));
            return true;
        }
        return false;
    }
    calculateSpamScore(userId, message) {
        const msg = message.toLowerCase();
        let score = 0;
        for (const phrase of this.config.spamDetection.commonPhrases) {
            if (msg.includes(phrase.toLowerCase())) {
                score += 10;
            }
        }
        if (message.length > 10 && (message.match(/[A-Z]/g) || []).length / message.length > 0.7) {
            score += 5;
        }
        const emojiCount = (message.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
        if (emojiCount > 5) {
            score += emojiCount;
        }
        const activity = this.getRecentActivity(userId);
        if (activity.messageCount > 5) {
            score += 10;
        }
        if (activity.messageCount > 10) {
            score += 25;
        }
        const userAge = (Date.now() / 1000) - (Date.now() / 1000);
        if (userAge < 86400) {
            score += 5;
        }
        return Math.min(score, 50);
    }
    getRecentActivity(userId) {
        return {
            messageCount: 1,
            lastMessageTime: Date.now()
        };
    }
    async processMessage(msg) {
        const userId = msg.from?.id?.toString();
        if (!userId)
            return false;
        if (this.isBlocked(userId)) {
            logger_1.logger.warn(`Blocked user ${userId} attempted to send message`);
            return false;
        }
        if (!(await this.checkRateLimit(userId))) {
            return false;
        }
        if (msg.text && this.checkSpam(userId, msg.text)) {
            return false;
        }
        return true;
    }
    logSecurityEvent(event, userId, details = {}) {
        logger_1.logger.warn(`Security Event: ${event}`, {
            userId,
            timestamp: new Date().toISOString(),
            ...details
        });
    }
    getSecurityStats() {
        return {
            blockedUsers: this.blockedUsers.size,
            suspiciousUsers: this.suspiciousUsers.size,
            totalRequests: Array.from(this.requestCounts.values()).reduce((sum, item) => sum + item.count, 0),
            rateLimitedRequests: 0
        };
    }
    async requireAdminConfirmation(bot, chatId, action, userId) {
        if (!this.config.adminSafety.requireConfirmation) {
            return true;
        }
        this.logSecurityEvent('admin_action_attempted', userId, { action, chatId });
        return true;
    }
    cleanup() {
        const now = Date.now();
        for (const [userId, blockedUntil] of this.blockedUsers.entries()) {
            if (now >= blockedUntil) {
                this.blockedUsers.delete(userId);
            }
        }
        for (const [userId, data] of this.requestCounts.entries()) {
            if (now >= data.resetTime) {
                this.requestCounts.delete(userId);
            }
        }
        for (const [userId, data] of this.suspiciousUsers.entries()) {
            if (now - data.lastSeen > 24 * 60 * 60 * 1000) {
                this.suspiciousUsers.delete(userId);
            }
        }
    }
    startPeriodicCleanup() {
        setInterval(() => {
            this.cleanup();
        }, 10 * 60 * 1000);
    }
}
exports.TelegramBotSecurity = TelegramBotSecurity;
exports.default = TelegramBotSecurity;
//# sourceMappingURL=security.js.map
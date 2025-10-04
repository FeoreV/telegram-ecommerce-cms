"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramAuthService = exports.TelegramAuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const SecureAuthService_1 = require("./SecureAuthService");
class TelegramAuthService {
    constructor() {
        this.telegramRateLimiter = new Map();
        this.config = {
            authTokenTTL: parseInt(process.env.TELEGRAM_AUTH_TTL || '3600'),
            webhookSecretValidation: process.env.TELEGRAM_WEBHOOK_VALIDATION !== 'false',
            enforceAuthDateTTL: process.env.ENFORCE_TELEGRAM_AUTH_DATE_TTL !== 'false',
            maxAuthAge: parseInt(process.env.TELEGRAM_MAX_AUTH_AGE || '86400'),
            requireUserData: process.env.TELEGRAM_REQUIRE_USER_DATA !== 'false'
        };
    }
    static getInstance() {
        if (!TelegramAuthService.instance) {
            TelegramAuthService.instance = new TelegramAuthService();
        }
        return TelegramAuthService.instance;
    }
    validateTelegramLogin(authData, botToken) {
        try {
            const { hash, ...dataToCheck } = authData;
            if (!authData.id || !authData.auth_date || !hash) {
                return {
                    isValid: false,
                    reason: 'Missing required fields (id, auth_date, hash)'
                };
            }
            if (this.config.enforceAuthDateTTL) {
                const authAge = Date.now() / 1000 - authData.auth_date;
                if (authAge > this.config.maxAuthAge) {
                    logger_1.logger.warn('Telegram auth data expired', {
                        telegramId: authData.id,
                        authAge,
                        maxAge: this.config.maxAuthAge
                    });
                    return {
                        isValid: false,
                        reason: `Auth data expired (${Math.floor(authAge / 60)} minutes old)`
                    };
                }
            }
            const isValidHMAC = this.validateTelegramHMAC(dataToCheck, hash, botToken);
            if (!isValidHMAC) {
                logger_1.logger.warn('Invalid Telegram HMAC signature', {
                    telegramId: authData.id,
                    username: authData.username,
                    authDate: authData.auth_date
                });
                return {
                    isValid: false,
                    reason: 'Invalid HMAC signature'
                };
            }
            if (this.config.requireUserData) {
                if (!authData.first_name && !authData.username) {
                    return {
                        isValid: false,
                        reason: 'Missing required user data (first_name or username)'
                    };
                }
            }
            const userData = {
                telegramId: authData.id,
                firstName: authData.first_name,
                lastName: authData.last_name,
                username: authData.username,
                photoUrl: authData.photo_url,
                authDate: new Date(authData.auth_date * 1000)
            };
            logger_1.logger.info('Telegram login validated successfully', {
                telegramId: authData.id,
                username: authData.username,
                authDate: userData.authDate
            });
            return {
                isValid: true,
                userData
            };
        }
        catch (err) {
            logger_1.logger.error('Telegram login validation error:', err);
            return {
                isValid: false,
                reason: 'Validation process failed'
            };
        }
    }
    validateTelegramHMAC(data, hash, botToken) {
        try {
            const dataCheckString = Object.keys(data)
                .filter(key => key !== 'hash')
                .sort()
                .map(key => `${key}=${data[key]}`)
                .join('\n');
            const secretKey = crypto_1.default
                .createHash('sha256')
                .update(botToken)
                .digest();
            const calculatedHash = crypto_1.default
                .createHmac('sha256', secretKey)
                .update(dataCheckString)
                .digest('hex');
            return this.constantTimeCompare(calculatedHash, hash);
        }
        catch (err) {
            logger_1.logger.error('HMAC validation error:', err);
            return false;
        }
    }
    constantTimeCompare(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }
    validateTelegramWebhook(webhookData, secretToken, receivedSignature) {
        try {
            if (!this.config.webhookSecretValidation) {
                logger_1.logger.debug('Webhook secret validation disabled');
                return true;
            }
            if (!secretToken || !receivedSignature) {
                logger_1.logger.warn('Missing webhook secret token or signature');
                return false;
            }
            const webhookPayload = JSON.stringify(webhookData);
            const expectedSignature = crypto_1.default
                .createHmac('sha256', secretToken)
                .update(webhookPayload)
                .digest('hex');
            const cleanReceivedSignature = receivedSignature.replace(/^sha256=/, '');
            const isValid = this.constantTimeCompare(expectedSignature, cleanReceivedSignature);
            if (!isValid) {
                logger_1.logger.warn('Invalid webhook signature', {
                    updateId: webhookData.update_id,
                    expectedSignature: expectedSignature.substring(0, 8) + '...',
                    receivedSignature: cleanReceivedSignature.substring(0, 8) + '...'
                });
            }
            return isValid;
        }
        catch (err) {
            logger_1.logger.error('Webhook validation error:', err);
            return false;
        }
    }
    async createTelegramSession(authData, botToken, deviceInfo, role = 'CUSTOMER', storeId) {
        try {
            const validation = this.validateTelegramLogin(authData, botToken);
            if (!validation.isValid) {
                throw new Error(`Telegram auth validation failed: ${validation.reason}`);
            }
            if (!validation.userData) {
                throw new Error('Telegram user data is missing');
            }
            const user = await this.findOrCreateTelegramUser(validation.userData);
            const deviceInfoAsRecord = deviceInfo;
            const telegramDeviceInfo = {
                ...deviceInfoAsRecord,
                telegramId: authData.id,
                authDate: authData.auth_date
            };
            const deviceFingerprint = SecureAuthService_1.secureAuthService.generateDeviceFingerprint(deviceInfoAsRecord.userAgent, deviceInfoAsRecord.ipAddress, telegramDeviceInfo);
            const enhancedDeviceInfo = {
                ...deviceInfoAsRecord,
                deviceFingerprint,
                telegramId: authData.id,
                authMethod: 'telegram',
                userAgent: deviceInfoAsRecord.userAgent,
                ipAddress: deviceInfoAsRecord.ipAddress,
            };
            const tokenPair = await SecureAuthService_1.secureAuthService.createSession(user.id, role, enhancedDeviceInfo, storeId);
            logger_1.logger.info('Telegram session created successfully', {
                userId: user.id,
                telegramId: authData.id,
                username: authData.username,
                role,
                storeId,
                sessionId: tokenPair.sessionId
            });
            return {
                ...tokenPair,
                user: {
                    id: user.id,
                    telegramId: user.telegramId,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role
                }
            };
        }
        catch (err) {
            logger_1.logger.error('Failed to create Telegram session:', err);
            throw err;
        }
    }
    async findOrCreateTelegramUser(userData) {
        try {
            const { databaseService } = await import('../lib/database');
            const prisma = databaseService.getPrisma();
            let user = await prisma.user.findUnique({
                where: { telegramId: userData.telegramId }
            });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        telegramId: userData.telegramId,
                        username: userData.username || `user_${userData.telegramId}`,
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        profilePhoto: userData.photoUrl,
                        role: 'CUSTOMER',
                        isActive: true
                    }
                });
                logger_1.logger.info('New Telegram user created', {
                    userId: user.id,
                    telegramId: userData.telegramId,
                    username: userData.username
                });
            }
            else {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        username: userData.username || user.username,
                        firstName: userData.firstName || user.firstName,
                        lastName: userData.lastName || user.lastName,
                        profilePhoto: userData.photoUrl || user.profilePhoto,
                        lastLoginAt: new Date()
                    }
                });
                logger_1.logger.debug('Telegram user updated', {
                    userId: user.id,
                    telegramId: userData.telegramId
                });
            }
            return user;
        }
        catch (err) {
            logger_1.logger.error('Failed to find or create Telegram user:', err);
            throw err;
        }
    }
    validateBotTokenFormat(botToken) {
        const tokenRegex = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;
        return tokenRegex.test(botToken);
    }
    extractBotId(botToken) {
        try {
            const parts = botToken.split(':');
            if (parts.length !== 2) {
                return null;
            }
            const botId = parseInt(parts[0]);
            return isNaN(botId) ? null : botId;
        }
        catch (_error) {
            return null;
        }
    }
    generateWebhookUrl(botToken, baseUrl) {
        const botId = this.extractBotId(botToken);
        if (!botId) {
            throw new Error('Invalid bot token format');
        }
        const tokenHash = crypto_1.default
            .createHash('sha256')
            .update(botToken)
            .digest('hex')
            .substring(0, 16);
        return `${baseUrl}/api/telegram/webhook/${botId}/${tokenHash}`;
    }
    validateWebhookUrl(url, botToken) {
        try {
            const botId = this.extractBotId(botToken);
            if (!botId) {
                return false;
            }
            const tokenHash = crypto_1.default
                .createHash('sha256')
                .update(botToken)
                .digest('hex')
                .substring(0, 16);
            const expectedPath = `/api/telegram/webhook/${botId}/${tokenHash}`;
            const urlObj = new URL(url);
            return urlObj.pathname === expectedPath;
        }
        catch (error) {
            return false;
        }
    }
    checkTelegramRateLimit(identifier, limit = 30, windowMs = 60000) {
        const now = Date.now();
        const key = `telegram:${identifier}`;
        let bucket = this.telegramRateLimiter.get(key);
        if (!bucket || now > bucket.resetTime) {
            bucket = { count: 0, resetTime: now + windowMs };
            this.telegramRateLimiter.set(key, bucket);
        }
        if (bucket.count >= limit) {
            logger_1.logger.warn('Telegram rate limit exceeded', {
                identifier,
                count: bucket.count,
                limit,
                resetTime: new Date(bucket.resetTime)
            });
            return false;
        }
        bucket.count++;
        return true;
    }
    async healthCheck() {
        try {
            const now = Date.now();
            for (const [key, bucket] of this.telegramRateLimiter.entries()) {
                if (now > bucket.resetTime) {
                    this.telegramRateLimiter.delete(key);
                }
            }
            return {
                status: 'healthy',
                config: this.config,
                rateLimiterSize: this.telegramRateLimiter.size
            };
        }
        catch (err) {
            logger_1.logger.error('Telegram auth service health check failed:', err);
            return {
                status: 'error',
                config: this.config,
                rateLimiterSize: 0
            };
        }
    }
    getConfiguration() {
        return { ...this.config };
    }
}
exports.TelegramAuthService = TelegramAuthService;
exports.telegramAuthService = TelegramAuthService.getInstance();
//# sourceMappingURL=TelegramAuthService.js.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureAuthSystem = exports.UserRole = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
const redis_1 = require("redis");
const crypto_1 = __importDefault(require("crypto"));
const AuthConfig_1 = require("./AuthConfig");
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    logger_1.logger.error('JWT_SECRET not set! Generating temporary secret for development');
    return crypto_1.default.randomBytes(64).toString('hex');
})();
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (() => {
    logger_1.logger.error('JWT_REFRESH_SECRET not set! Generating temporary secret for development');
    return crypto_1.default.randomBytes(64).toString('hex');
})();
const authConfig = (0, AuthConfig_1.getAuthConfig)();
const ACCESS_TOKEN_EXPIRY = authConfig.accessTokenExpiry;
const REFRESH_TOKEN_EXPIRY = authConfig.refreshTokenExpiry;
const BCRYPT_ROUNDS = authConfig.bcryptRounds;
var UserRole;
(function (UserRole) {
    UserRole["OWNER"] = "OWNER";
    UserRole["ADMIN"] = "ADMIN";
    UserRole["VENDOR"] = "VENDOR";
    UserRole["CUSTOMER"] = "CUSTOMER";
})(UserRole || (exports.UserRole = UserRole = {}));
let redisClient = null;
const sessionStore = new Map();
const tokenBlacklist = new Map();
const initRedis = async () => {
    if (process.env.REDIS_URL) {
        try {
            redisClient = (0, redis_1.createClient)({ url: process.env.REDIS_URL });
            await redisClient.connect();
            logger_1.logger.info('✅ Redis connected for secure authentication');
        }
        catch (error) {
            logger_1.logger.warn('⚠️ Redis connection failed, using memory fallback', { error });
            redisClient = null;
        }
    }
};
initRedis();
class SecureAuthSystem {
    static async hashPassword(password) {
        try {
            const salt = await bcrypt_1.default.genSalt(BCRYPT_ROUNDS);
            return await bcrypt_1.default.hash(password, salt);
        }
        catch (error) {
            logger_1.logger.error('Password hashing failed', { error });
            throw new Error('Password processing failed');
        }
    }
    static async verifyPassword(password, hashedPassword) {
        try {
            return await bcrypt_1.default.compare(password, hashedPassword);
        }
        catch (error) {
            logger_1.logger.error('Password verification failed', { error });
            return false;
        }
    }
    static generateSessionId() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    static generateTokenFamily() {
        return crypto_1.default.randomBytes(16).toString('hex');
    }
    static async createSession(userId, sessionId) {
        const sessionData = {
            userId,
            createdAt: new Date(),
            lastUsed: new Date()
        };
        try {
            if (redisClient) {
                await redisClient.setEx(`session:${sessionId}`, 7 * 24 * 60 * 60, JSON.stringify(sessionData));
            }
            else {
                sessionStore.set(sessionId, sessionData);
            }
        }
        catch (error) {
            logger_1.logger.error('Session creation failed', { error, userId, sessionId });
            throw new Error('Session management error');
        }
    }
    static async validateSession(sessionId, userId) {
        try {
            let sessionData;
            if (redisClient) {
                const data = await redisClient.get(`session:${sessionId}`);
                sessionData = data ? JSON.parse(data) : null;
            }
            else {
                sessionData = sessionStore.get(sessionId);
            }
            if (!sessionData || sessionData.userId !== userId) {
                return false;
            }
            sessionData.lastUsed = new Date();
            if (redisClient) {
                await redisClient.setEx(`session:${sessionId}`, 7 * 24 * 60 * 60, JSON.stringify(sessionData));
            }
            else {
                sessionStore.set(sessionId, sessionData);
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Session validation failed', { error, sessionId });
            return false;
        }
    }
    static async destroySession(sessionId) {
        try {
            if (redisClient) {
                await redisClient.del(`session:${sessionId}`);
            }
            else {
                sessionStore.delete(sessionId);
            }
        }
        catch (error) {
            logger_1.logger.error('Session destruction failed', { error, sessionId });
        }
    }
    static generateAccessToken(payload) {
        const tokenPayload = {
            ...payload,
            tokenType: 'access'
        };
        const options = {
            expiresIn: ACCESS_TOKEN_EXPIRY,
            algorithm: 'HS256',
            issuer: 'botrt-ecommerce',
            audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel'
        };
        return jsonwebtoken_1.default.sign(tokenPayload, JWT_SECRET, options);
    }
    static generateRefreshToken(payload) {
        const tokenPayload = {
            ...payload,
            tokenType: 'refresh'
        };
        const options = {
            expiresIn: REFRESH_TOKEN_EXPIRY,
            algorithm: 'HS256',
            issuer: 'botrt-ecommerce',
            audience: 'botrt-refresh'
        };
        return jsonwebtoken_1.default.sign(tokenPayload, JWT_REFRESH_SECRET, options);
    }
    static async verifyAccessToken(token) {
        if (await this.isTokenBlacklisted(token)) {
            throw new Error('Token has been revoked');
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, {
                algorithms: ['HS256'],
                issuer: 'botrt-ecommerce',
                audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel'
            });
            if (decoded.tokenType !== 'access') {
                throw new Error('Invalid token type');
            }
            return decoded;
        }
        catch (error) {
            logger_1.logger.debug('Access token verification failed', {
                error: error instanceof Error ? error.message : String(error),
                tokenPreview: token.substring(0, 20) + '...'
            });
            if (error instanceof Error && error.name === 'TokenExpiredError') {
                throw new Error('Access token expired');
            }
            else if (error instanceof Error && error.name === 'JsonWebTokenError') {
                throw new Error('Invalid access token');
            }
            else {
                throw new Error('Access token verification failed');
            }
        }
    }
    static async verifyRefreshToken(token) {
        if (await this.isTokenBlacklisted(token)) {
            throw new Error('Refresh token has been revoked');
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET, {
                algorithms: ['HS256'],
                issuer: 'botrt-ecommerce',
                audience: 'botrt-refresh'
            });
            if (decoded.tokenType !== 'refresh') {
                throw new Error('Invalid refresh token type');
            }
            return decoded;
        }
        catch (error) {
            if (error instanceof Error && error.name === 'TokenExpiredError') {
                throw new Error('Refresh token expired');
            }
            else if (error instanceof Error && error.name === 'JsonWebTokenError') {
                throw new Error('Invalid refresh token');
            }
            else {
                throw new Error('Refresh token verification failed');
            }
        }
    }
    static async blacklistToken(token, reason = 'logout') {
        const tokenHash = this.hashToken(token);
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            const expires = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);
            const ttl = Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1000));
            if (redisClient) {
                await redisClient.setEx(`blacklist:${tokenHash}`, ttl, JSON.stringify({ reason, timestamp: new Date().toISOString() }));
            }
            else {
                tokenBlacklist.set(tokenHash, { expires, reason });
            }
            logger_1.logger.info('Token blacklisted', { tokenHash, reason, ttl });
        }
        catch (error) {
            logger_1.logger.error('Token blacklisting failed', { error });
            throw new Error('Token blacklisting failed');
        }
    }
    static async isTokenBlacklisted(token) {
        const tokenHash = this.hashToken(token);
        try {
            if (redisClient) {
                const result = await redisClient.get(`blacklist:${tokenHash}`);
                return result !== null;
            }
            else {
                const entry = tokenBlacklist.get(tokenHash);
                if (entry) {
                    if (entry.expires < new Date()) {
                        tokenBlacklist.delete(tokenHash);
                        return false;
                    }
                    return true;
                }
                return false;
            }
        }
        catch (error) {
            logger_1.logger.error('Blacklist check failed', { error });
            return false;
        }
    }
    static hashToken(token) {
        return crypto_1.default.createHash('sha256').update(token).digest('hex').substring(0, 32);
    }
    static async authenticateWithEmail(email, password) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                password: true,
                telegramId: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true
            }
        });
        if (!user || !user.isActive || !user.password) {
            throw new Error('Invalid credentials');
        }
        const isPasswordValid = await this.verifyPassword(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }
        return this.generateTokenPair({ ...user, role: user.role });
    }
    static async authenticateWithTelegram(telegramId, telegramData) {
        let user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            select: {
                id: true,
                email: true,
                telegramId: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true
            }
        });
        if (user) {
            user = {
                ...user,
                role: user.role
            };
        }
        if (!user) {
            const newUser = await prisma_1.prisma.user.create({
                data: {
                    telegramId,
                    username: telegramData?.username,
                    firstName: telegramData?.firstName,
                    lastName: telegramData?.lastName,
                    role: UserRole.CUSTOMER,
                    isActive: true
                },
                select: {
                    id: true,
                    email: true,
                    telegramId: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true
                }
            });
            user = {
                ...newUser,
                role: newUser.role
            };
            logger_1.logger.info('New user registered via Telegram', {
                userId: user.id,
                telegramId,
                role: user.role
            });
        }
        else if (telegramData) {
            const updatedUser = await prisma_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    username: telegramData.username || user.username,
                    firstName: telegramData.firstName || user.firstName,
                    lastName: telegramData.lastName || user.lastName
                },
                select: {
                    id: true,
                    email: true,
                    telegramId: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true
                }
            });
            user = {
                ...updatedUser,
                role: updatedUser.role
            };
        }
        if (!user.isActive) {
            throw new Error('Account is deactivated');
        }
        return this.generateTokenPair(user);
    }
    static async generateTokenPair(user) {
        const sessionId = this.generateSessionId();
        const tokenFamily = this.generateTokenFamily();
        await this.createSession(user.id, sessionId);
        const accessToken = this.generateAccessToken({
            userId: user.id,
            telegramId: user.telegramId,
            email: user.email,
            role: user.role,
            sessionId
        });
        const refreshToken = this.generateRefreshToken({
            userId: user.id,
            tokenFamily,
            version: 1
        });
        const userResponse = {
            id: user.id,
            email: user.email,
            telegramId: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive
        };
        logger_1.logger.info('User authenticated successfully', {
            userId: user.id,
            role: user.role,
            authMethod: user.email ? 'email' : 'telegram'
        });
        return {
            user: userResponse,
            accessToken,
            refreshToken
        };
    }
    static async refreshTokenPair(refreshToken) {
        const decoded = await this.verifyRefreshToken(refreshToken);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                telegramId: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true
            }
        });
        if (!user || !user.isActive) {
            throw new Error('User not found or inactive');
        }
        const userWithRole = {
            ...user,
            role: user.role
        };
        await this.blacklistToken(refreshToken, 'token_refresh');
        return this.generateTokenPair(userWithRole);
    }
    static async logout(accessToken, refreshToken, sessionId) {
        const promises = [];
        promises.push(this.blacklistToken(accessToken, 'logout'));
        if (refreshToken) {
            promises.push(this.blacklistToken(refreshToken, 'logout'));
        }
        if (sessionId) {
            promises.push(this.destroySession(sessionId));
        }
        await Promise.all(promises);
        logger_1.logger.info('User logged out successfully', {
            tokenCount: refreshToken ? 2 : 1,
            sessionDestroyed: !!sessionId
        });
    }
    static async setPassword(userId, password) {
        const hashedPassword = await this.hashPassword(password);
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });
        logger_1.logger.info('Password set for user', { userId });
    }
    static async changePassword(userId, currentPassword, newPassword) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { password: true }
        });
        if (!user?.password) {
            throw new Error('No password set for this user');
        }
        const isCurrentValid = await this.verifyPassword(currentPassword, user.password);
        if (!isCurrentValid) {
            throw new Error('Current password is incorrect');
        }
        await this.setPassword(userId, newPassword);
        logger_1.logger.info('Password changed for user', { userId });
    }
    static isTokenNearExpiry(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (!decoded?.exp)
                return true;
            return (0, AuthConfig_1.shouldRefreshToken)(decoded.exp, authConfig.refreshGracePeriod);
        }
        catch (error) {
            return true;
        }
    }
    static async autoRefreshIfNeeded(accessToken, refreshToken) {
        if (!authConfig.enableAutoRefresh) {
            return { needsRefresh: false };
        }
        if (this.isTokenNearExpiry(accessToken)) {
            try {
                const newTokens = await this.refreshTokenPair(refreshToken);
                return {
                    needsRefresh: true,
                    newTokens
                };
            }
            catch (error) {
                logger_1.logger.warn('Auto-refresh failed', { error });
                return { needsRefresh: true };
            }
        }
        return { needsRefresh: false };
    }
    static async updateSessionActivity(sessionId, userId) {
        if (!authConfig.sessionExtendOnActivity)
            return;
        try {
            const sessionData = {
                userId,
                createdAt: new Date(),
                lastUsed: new Date()
            };
            if (redisClient) {
                const existingData = await redisClient.get(`session:${sessionId}`);
                if (existingData) {
                    const parsed = JSON.parse(existingData);
                    sessionData.createdAt = new Date(parsed.createdAt);
                }
                await redisClient.setEx(`session:${sessionId}`, typeof REFRESH_TOKEN_EXPIRY === 'string' ? (0, AuthConfig_1.parseExpiryToSeconds)(REFRESH_TOKEN_EXPIRY) : REFRESH_TOKEN_EXPIRY, JSON.stringify(sessionData));
            }
            else {
                const existing = sessionStore.get(sessionId);
                if (existing) {
                    existing.lastUsed = new Date();
                }
            }
        }
        catch (error) {
            logger_1.logger.debug('Session activity update failed', { error, sessionId });
        }
    }
    static extractTokenFromHeader(authHeader) {
        if (!authHeader)
            return null;
        const matches = authHeader.match(/^Bearer\s+(.+)$/);
        return matches ? matches[1] : null;
    }
    static async getUserPermissions(userId) {
        try {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true }
            });
            if (!user)
                return [];
            const { ROLE_PERMISSIONS } = await Promise.resolve().then(() => __importStar(require('../middleware/permissions')));
            return ROLE_PERMISSIONS[user.role] || [];
        }
        catch (error) {
            console.error('Error getting user permissions:', error);
            return [];
        }
    }
    static async cleanup() {
        try {
            if (!redisClient) {
                const now = new Date();
                let cleanedTokens = 0;
                let cleanedSessions = 0;
                for (const [hash, entry] of tokenBlacklist.entries()) {
                    if (entry.expires < now) {
                        tokenBlacklist.delete(hash);
                        cleanedTokens++;
                    }
                }
                const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                for (const [sessionId, session] of sessionStore.entries()) {
                    if (session.lastUsed < cutoff) {
                        sessionStore.delete(sessionId);
                        cleanedSessions++;
                    }
                }
                logger_1.logger.info('Memory cleanup completed', {
                    cleanedTokens,
                    cleanedSessions,
                    activeTokens: tokenBlacklist.size,
                    activeSessions: sessionStore.size
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Cleanup failed', { error });
        }
    }
}
exports.SecureAuthSystem = SecureAuthSystem;
setInterval(() => {
    SecureAuthSystem.cleanup();
}, 60 * 60 * 1000);
//# sourceMappingURL=SecureAuthSystem.js.map
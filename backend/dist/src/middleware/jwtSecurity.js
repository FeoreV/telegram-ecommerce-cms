"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutMiddleware = exports.tokenRefreshMiddleware = exports.enhancedAuthMiddleware = exports.JWTSecurity = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
const redis_1 = require("redis");
const security_1 = require("../config/security");
const AuthConfig_1 = require("../auth/AuthConfig");
const crypto_1 = __importDefault(require("crypto"));
let JWT_SECRET;
let JWT_REFRESH_SECRET;
let JWT_ACCESS_EXPIRY;
let JWT_REFRESH_EXPIRY;
let JWT_ACCESS_EXPIRY_SECONDS;
let JWT_REFRESH_EXPIRY_SECONDS;
let JWT_CLOCK_SKEW;
let JWT_ISSUER;
let JWT_AUDIENCE;
let REDIS_URL;
let REDIS_ENABLED;
let securityConfigLoaded = false;
const initializeSecurityConfig = async () => {
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
        };
    }
    const config = await (0, security_1.loadSecurityConfig)();
    JWT_SECRET = config.jwt.secret;
    JWT_REFRESH_SECRET = config.jwt.refreshSecret;
    JWT_ACCESS_EXPIRY = config.jwt.accessExpiry;
    JWT_REFRESH_EXPIRY = config.jwt.refreshExpiry;
    JWT_CLOCK_SKEW = config.jwt.clockSkew;
    JWT_ISSUER = config.jwt.issuer;
    JWT_AUDIENCE = config.jwt.audience;
    REDIS_URL = config.redis.url;
    REDIS_ENABLED = config.redis.enabled;
    JWT_ACCESS_EXPIRY_SECONDS = (0, AuthConfig_1.parseExpiryToSeconds)(JWT_ACCESS_EXPIRY);
    JWT_REFRESH_EXPIRY_SECONDS = (0, AuthConfig_1.parseExpiryToSeconds)(JWT_REFRESH_EXPIRY);
    securityConfigLoaded = true;
    return config;
};
initializeSecurityConfig().catch(error => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    logger_1.logger.error('Failed to initialize security configuration:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
    });
    if (!isDevelopment) {
        process.exit(1);
    }
    else {
        logger_1.logger.warn('Continuing in development mode with potential configuration issues');
    }
});
let redisClient = null;
const tokenBlacklist = new Map();
if (REDIS_ENABLED && REDIS_URL) {
    try {
        redisClient = (0, redis_1.createClient)({
            url: REDIS_URL,
            socket: {
                connectTimeout: 2000
            }
        });
        redisClient.connect()
            .then(() => {
            logger_1.logger.info('Redis connected for JWT token management');
        })
            .catch((err) => {
            const isDevelopment = process.env.NODE_ENV === 'development';
            if (isDevelopment) {
                logger_1.logger.warn('Redis not available for JWT - using memory fallback (development mode)', {
                    redisUrl: REDIS_URL?.replace(/\/\/[^@]*@/, '//***@')
                });
            }
            else {
                logger_1.logger.error('Redis connection failed for JWT:', err);
            }
            redisClient = null;
        });
        redisClient.on('error', (err) => {
            const isDevelopment = process.env.NODE_ENV === 'development';
            if (!isDevelopment) {
                logger_1.logger.error('Redis JWT client error:', err);
            }
            redisClient = null;
        });
    }
    catch (error) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (isDevelopment) {
            logger_1.logger.warn('Redis client creation failed for JWT - using memory fallback');
        }
        else {
            logger_1.logger.error('Failed to create Redis client for JWT:', error);
        }
    }
}
class JWTSecurity {
    static generateAccessToken(payload) {
        const jwtPayload = {
            ...payload,
            iss: JWT_ISSUER,
            aud: JWT_AUDIENCE,
        };
        return jsonwebtoken_1.default.sign(jwtPayload, JWT_SECRET, {
            expiresIn: JWT_ACCESS_EXPIRY,
            algorithm: 'HS256',
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
    }
    static generateRefreshToken(payload) {
        return jsonwebtoken_1.default.sign(payload, JWT_REFRESH_SECRET, {
            expiresIn: JWT_REFRESH_EXPIRY,
            algorithm: 'HS256',
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
    }
    static async verifyAccessToken(token) {
        const isBlacklisted = await this.isTokenBlacklisted(token);
        if (isBlacklisted) {
            security_1.securityMetrics.incrementInvalidTokenAttempts();
            throw new Error('Token has been revoked');
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, {
                algorithms: ['HS256'],
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
                clockTolerance: JWT_CLOCK_SKEW,
            });
            if (!decoded.userId || !decoded.role) {
                throw new Error('Invalid token payload');
            }
            if (decoded.iat) {
                const tokenAge = Date.now() / 1000 - decoded.iat;
                const maxAge = JWT_ACCESS_EXPIRY_SECONDS * 2;
                if (tokenAge > maxAge) {
                    logger_1.logger.warn('Suspicious token age detected', {
                        tokenAge,
                        maxAge,
                        userId: decoded.userId
                    });
                }
            }
            return decoded;
        }
        catch (error) {
            security_1.securityMetrics.incrementInvalidTokenAttempts();
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new Error('Token has expired');
            }
            else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            else if (error instanceof jsonwebtoken_1.default.NotBeforeError) {
                throw new Error('Token not active');
            }
            else {
                throw new Error('Token verification failed');
            }
        }
    }
    static async verifyRefreshToken(token) {
        const isBlacklisted = await this.isTokenBlacklisted(token);
        if (isBlacklisted) {
            security_1.securityMetrics.incrementInvalidTokenAttempts();
            throw new Error('Refresh token has been revoked');
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET, {
                algorithms: ['HS256'],
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
                clockTolerance: JWT_CLOCK_SKEW,
            });
            if (!decoded.userId || !decoded.tokenFamily || typeof decoded.version !== 'number') {
                throw new Error('Invalid refresh token payload');
            }
            return decoded;
        }
        catch (error) {
            security_1.securityMetrics.incrementInvalidTokenAttempts();
            throw new Error('Invalid refresh token');
        }
    }
    static async blacklistToken(token, reason = 'manual_logout') {
        const tokenHash = this.hashToken(token);
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            const expires = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + JWT_ACCESS_EXPIRY_SECONDS * 1000);
            const ttlSeconds = Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1000));
            if (redisClient) {
                await redisClient.setEx(`blacklist:${tokenHash}`, ttlSeconds, JSON.stringify({ reason, timestamp: new Date().toISOString() }));
                logger_1.logger.info('Token blacklisted in Redis', {
                    tokenHash,
                    reason,
                    ttlSeconds
                });
            }
            else {
                tokenBlacklist.set(tokenHash, { expires, reason });
                logger_1.logger.info('Token blacklisted in memory', {
                    tokenHash,
                    reason,
                    expires: expires.toISOString()
                });
            }
            security_1.securityMetrics.incrementBlacklistedTokens();
        }
        catch (error) {
            logger_1.logger.error('Failed to blacklist token:', error);
            tokenBlacklist.set(tokenHash, {
                expires: new Date(Date.now() + JWT_ACCESS_EXPIRY_SECONDS * 1000),
                reason
            });
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
            logger_1.logger.error('Error checking token blacklist:', error);
            const entry = tokenBlacklist.get(tokenHash);
            return entry ? entry.expires > new Date() : false;
        }
    }
    static extractTokenFromHeader(authHeader) {
        if (!authHeader)
            return null;
        const matches = authHeader.match(/^Bearer\s+(.+)$/);
        return matches ? matches[1] : null;
    }
    static hashToken(token) {
        return crypto_1.default.createHash('sha256').update(token).digest('hex').substring(0, 16);
    }
    static generateSessionId() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    static async validateSession(userId, sessionId) {
        if (!sessionId)
            return true;
        try {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, isActive: true }
            });
            if (!user || !user.isActive) {
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Session validation error:', error);
            return false;
        }
    }
    static async cleanupBlacklist() {
        if (redisClient) {
            try {
                const keys = await redisClient.keys('blacklist:*');
                logger_1.logger.info('Redis blacklist status', {
                    blacklistedCount: keys.length
                });
            }
            catch (error) {
                logger_1.logger.error('Error getting Redis blacklist status:', error);
            }
        }
        else {
            const now = new Date();
            let cleanedCount = 0;
            for (const [tokenHash, entry] of tokenBlacklist.entries()) {
                if (entry.expires < now) {
                    tokenBlacklist.delete(tokenHash);
                    cleanedCount++;
                }
            }
            logger_1.logger.info('Memory blacklist cleanup completed', {
                cleanedCount,
                remainingCount: tokenBlacklist.size
            });
        }
    }
    static async getBlacklistStats() {
        if (redisClient) {
            try {
                const keys = await redisClient.keys('blacklist:*');
                return { total: keys.length, active: keys.length };
            }
            catch (error) {
                logger_1.logger.error('Error getting Redis stats:', error);
                return { total: 0, active: 0 };
            }
        }
        else {
            const now = new Date();
            const active = Array.from(tokenBlacklist.values()).filter(entry => entry.expires > now).length;
            return { total: tokenBlacklist.size, active };
        }
    }
    static generateTokenFamily() {
        return crypto_1.default.randomBytes(16).toString('hex');
    }
}
exports.JWTSecurity = JWTSecurity;
const enhancedAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = JWTSecurity.extractTokenFromHeader(authHeader);
        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'MISSING_TOKEN'
            });
        }
        let decoded;
        try {
            decoded = await JWTSecurity.verifyAccessToken(token);
        }
        catch (error) {
            logger_1.logger.warn('JWT verification failed', {
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
            if (errorMessage.includes('expired'))
                code = 'TOKEN_EXPIRED';
            else if (errorMessage.includes('revoked'))
                code = 'TOKEN_REVOKED';
            else if (errorMessage.includes('not active'))
                code = 'TOKEN_NOT_ACTIVE';
            return res.status(401).json({
                error: 'Invalid or expired token',
                code,
                message: errorMessage
            });
        }
        const sessionValid = await JWTSecurity.validateSession(decoded.userId, decoded.sessionId);
        if (!sessionValid) {
            return res.status(401).json({
                error: 'Session expired or invalid',
                code: 'INVALID_SESSION'
            });
        }
        const user = await prisma_1.prisma.user.findUnique({
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
            logger_1.logger.warn('Authentication failed - user not found or inactive', {
                userId: decoded.userId,
                ip: req.ip
            });
            return res.status(401).json({
                error: 'User account not found or inactive',
                code: 'USER_INACTIVE'
            });
        }
        if (user.role !== decoded.role) {
            logger_1.logger.warn('User role changed, token invalidated', {
                userId: user.id,
                oldRole: decoded.role,
                newRole: user.role
            });
            return res.status(401).json({
                error: 'User permissions have changed. Please log in again.',
                code: 'ROLE_CHANGED'
            });
        }
        req.user = user;
        req.token = token;
        req.sessionId = decoded.sessionId;
        logger_1.logger.debug('User authenticated successfully', {
            userId: user.id,
            role: user.role,
            ip: req.ip,
            endpoint: req.path
        });
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication middleware error', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            request: {
                method: req.method,
                url: req.url,
                headers: (0, logger_1.maskSensitiveData)(req.headers),
            },
        });
        res.status(500).json({
            error: 'Authentication service error',
            code: 'AUTH_SERVICE_ERROR'
        });
    }
};
exports.enhancedAuthMiddleware = enhancedAuthMiddleware;
const tokenRefreshMiddleware = async (req, res, _next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                error: 'Refresh token required'
            });
        }
        let decoded;
        try {
            decoded = await JWTSecurity.verifyRefreshToken(refreshToken);
        }
        catch (error) {
            logger_1.logger.warn('Refresh token verification failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            return res.status(401).json({
                error: 'Invalid refresh token',
                code: 'INVALID_REFRESH_TOKEN'
            });
        }
        const user = await prisma_1.prisma.user.findUnique({
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
        await JWTSecurity.blacklistToken(refreshToken, 'token_refresh');
        logger_1.logger.info('Tokens refreshed successfully', {
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
    }
    catch (error) {
        logger_1.logger.error('Token refresh error:', error);
        res.status(500).json({
            error: 'Token refresh failed'
        });
    }
};
exports.tokenRefreshMiddleware = tokenRefreshMiddleware;
const logoutMiddleware = async (req, res) => {
    try {
        const token = req.token;
        const { refreshToken } = req.body;
        const user = req.user;
        const promises = [];
        if (token) {
            promises.push(JWTSecurity.blacklistToken(token, 'user_logout'));
        }
        if (refreshToken) {
            promises.push(JWTSecurity.blacklistToken(refreshToken, 'user_logout'));
        }
        await Promise.all(promises);
        logger_1.logger.info('User logged out', {
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
    }
    catch (error) {
        logger_1.logger.error('Logout error:', error);
        res.status(500).json({
            error: 'Logout failed',
            code: 'LOGOUT_ERROR'
        });
    }
};
exports.logoutMiddleware = logoutMiddleware;
setInterval(() => {
    JWTSecurity.cleanupBlacklist().catch(error => {
        logger_1.logger.error('Blacklist cleanup error:', error);
    });
}, 60 * 60 * 1000);
exports.default = exports.enhancedAuthMiddleware;
//# sourceMappingURL=jwtSecurity.js.map
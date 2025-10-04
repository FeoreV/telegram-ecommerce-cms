"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWTService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const env_1 = require("./env");
const logger_1 = require("./logger");
const blacklistedTokens = new Map();
const activeSessions = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [token, expiry] of blacklistedTokens.entries()) {
        if (expiry < now) {
            blacklistedTokens.delete(token);
        }
    }
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    for (const [sessionId, session] of activeSessions.entries()) {
        if (session.lastUsed < thirtyDaysAgo) {
            activeSessions.delete(sessionId);
        }
    }
}, 60 * 60 * 1000);
class JWTService {
    static generateTokenPair(payload) {
        const sessionId = this.generateSessionId();
        const now = Math.floor(Date.now() / 1000);
        const accessPayload = {
            ...payload,
            type: 'access',
            sessionId,
        };
        const accessOptions = {
            expiresIn: this.ACCESS_TOKEN_EXPIRY,
            issuer: this.ISSUER,
            audience: this.AUDIENCE,
            notBefore: now,
        };
        const accessToken = jsonwebtoken_1.default.sign(accessPayload, this.JWT_SECRET, accessOptions);
        const refreshPayload = {
            ...payload,
            type: 'refresh',
            sessionId,
        };
        const refreshOptions = {
            expiresIn: this.REFRESH_TOKEN_EXPIRY,
            issuer: this.ISSUER,
            audience: this.AUDIENCE,
            notBefore: now,
        };
        const refreshToken = jsonwebtoken_1.default.sign(refreshPayload, this.JWT_SECRET, refreshOptions);
        activeSessions.set(sessionId, {
            userId: payload.userId,
            createdAt: now * 1000,
            lastUsed: now * 1000,
        });
        const accessExpiresIn = typeof this.ACCESS_TOKEN_EXPIRY === 'string' ? this.parseExpiry(this.ACCESS_TOKEN_EXPIRY) : this.ACCESS_TOKEN_EXPIRY;
        const refreshExpiresIn = typeof this.REFRESH_TOKEN_EXPIRY === 'string' ? this.parseExpiry(this.REFRESH_TOKEN_EXPIRY) : this.REFRESH_TOKEN_EXPIRY;
        logger_1.logger.info(`Generated token pair for user ${payload.userId}`, {
            userId: payload.userId,
            sessionId,
            accessExpiresIn,
            refreshExpiresIn,
        });
        return {
            accessToken,
            refreshToken,
            expiresIn: accessExpiresIn,
            refreshExpiresIn: refreshExpiresIn,
        };
    }
    static verifyToken(token) {
        try {
            if (this.isTokenBlacklisted(token)) {
                throw new Error('Token has been revoked');
            }
            const decoded = jsonwebtoken_1.default.verify(token, this.JWT_SECRET, {
                issuer: this.ISSUER,
                audience: this.AUDIENCE,
                clockTolerance: 60,
            });
            if (decoded.sessionId) {
                const session = activeSessions.get(decoded.sessionId);
                if (session) {
                    session.lastUsed = Date.now();
                }
            }
            return decoded;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorName = error instanceof Error ? error.name : 'Unknown';
            logger_1.logger.warn('Token verification failed', {
                error: errorMessage
            });
            if (errorName === 'TokenExpiredError') {
                throw new Error('Token expired');
            }
            else if (errorName === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            }
            else if (errorName === 'NotBeforeError') {
                throw new Error('Token not active yet');
            }
            else {
                throw new Error('Authentication failed');
            }
        }
    }
    static async refreshToken(refreshToken) {
        try {
            const decoded = this.verifyToken(refreshToken);
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, isActive: true, role: true, telegramId: true },
            });
            if (!user || !user.isActive) {
                throw new Error('User not found or inactive');
            }
            this.blacklistToken(refreshToken);
            return this.generateTokenPair({
                userId: user.id,
                telegramId: user.telegramId,
                role: user.role,
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.logger.warn('Token refresh failed', {
                error: errorMessage
            });
            throw error;
        }
    }
    static blacklistToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (decoded && decoded.exp) {
                blacklistedTokens.set(token, decoded.exp * 1000);
                if (decoded.sessionId) {
                    activeSessions.delete(decoded.sessionId);
                }
                logger_1.logger.info('Token blacklisted', {
                    userId: decoded.userId,
                    sessionId: decoded.sessionId,
                    type: decoded.type,
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to blacklist token:', error);
        }
    }
    static async blacklistAllUserTokens(userId) {
        try {
            for (const [sessionId, session] of activeSessions.entries()) {
                if (session.userId === userId) {
                    activeSessions.delete(sessionId);
                }
            }
            logger_1.logger.info(`Blacklisted all tokens for user ${userId}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to blacklist all user tokens:', error);
            throw error;
        }
    }
    static getUserSessions(userId) {
        const userSessions = [];
        for (const [sessionId, session] of activeSessions.entries()) {
            if (session.userId === userId) {
                userSessions.push({
                    sessionId,
                    createdAt: new Date(session.createdAt),
                    lastUsed: new Date(session.lastUsed),
                });
            }
        }
        return userSessions;
    }
    static revokeSession(sessionId) {
        activeSessions.delete(sessionId);
        logger_1.logger.info(`Revoked session ${sessionId}`);
    }
    static isTokenBlacklisted(token) {
        return blacklistedTokens.has(token);
    }
    static generateSessionId() {
        return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static parseExpiry(expiry) {
        const match = expiry.match(/^(\d+)([smhd])$/);
        if (!match)
            return 900;
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 24 * 60 * 60;
            default: return 900;
        }
    }
    static getTokenStats() {
        const sessionsByUser = {};
        for (const session of activeSessions.values()) {
            sessionsByUser[session.userId] = (sessionsByUser[session.userId] || 0) + 1;
        }
        return {
            blacklistedTokens: blacklistedTokens.size,
            activeSessions: activeSessions.size,
            sessionsByUser,
        };
    }
}
exports.JWTService = JWTService;
JWTService.JWT_SECRET = env_1.env.JWT_SECRET;
JWTService.ACCESS_TOKEN_EXPIRY = (env_1.env.JWT_EXPIRES_IN || '15m');
JWTService.REFRESH_TOKEN_EXPIRY = (env_1.env.JWT_REFRESH_EXPIRES_IN || '7d');
JWTService.ISSUER = 'telegram-ecommerce-api';
JWTService.AUDIENCE = 'telegram-ecommerce-users';
exports.default = JWTService;
//# sourceMappingURL=jwtEnhanced.js.map
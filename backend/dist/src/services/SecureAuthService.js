"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureAuthService = exports.SecureAuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../lib/database");
const logger_1 = require("../utils/logger");
const SecretManager_1 = require("../utils/SecretManager");
const TenantCacheService_1 = require("./TenantCacheService");
class SecureAuthService {
    static createConfig() {
        const intFromEnv = (key, fallback) => {
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
    constructor() {
        this.revokedTokens = new Set();
        this.config = SecureAuthService.createConfig();
    }
    static getInstance() {
        if (!SecureAuthService.instance) {
            SecureAuthService.instance = new SecureAuthService();
        }
        return SecureAuthService.instance;
    }
    generateSessionId() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    generateDeviceFingerprint(userAgent, ipAddress, additionalData = {}) {
        const fingerprintData = {
            userAgent: this.normalizeUserAgent(userAgent),
            ipAddress: this.hashIpAddress(ipAddress),
            ...additionalData
        };
        return crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify(fingerprintData))
            .digest('hex');
    }
    normalizeUserAgent(userAgent) {
        return userAgent
            .replace(/\d+\.\d+\.\d+/g, 'X.X.X')
            .replace(/\d+\.\d+/g, 'X.X')
            .substring(0, 200);
    }
    hashIpAddress(ipAddress) {
        const salt = process.env.IP_HASH_SALT || 'default-salt';
        return crypto_1.default
            .createHash('sha256')
            .update(ipAddress + salt)
            .digest('hex')
            .substring(0, 16);
    }
    async createSession(userId, role, deviceInfo, storeId, permissions = []) {
        try {
            const sessionId = this.generateSessionId();
            const jwtSecrets = SecretManager_1.secretManager.getJWTSecrets();
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
            const accessToken = jsonwebtoken_1.default.sign(accessTokenPayload, jwtSecrets.secret, {
                algorithm: 'HS256',
                issuer: process.env.JWT_ISSUER || 'botrt-ecommerce',
                audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel'
            });
            const refreshTokenPayload = {
                userId,
                sessionId,
                type: 'refresh',
                deviceFingerprint: deviceInfo.deviceFingerprint,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenTTL
            };
            const refreshToken = jsonwebtoken_1.default.sign(refreshTokenPayload, jwtSecrets.refreshSecret, {
                algorithm: 'HS256',
                issuer: process.env.JWT_ISSUER || 'botrt-ecommerce',
                audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel'
            });
            const refreshTokenHash = crypto_1.default
                .createHash('sha256')
                .update(refreshToken)
                .digest('hex');
            const sessionData = {
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
            await this.storeSession(sessionData);
            await this.cleanupUserSessions(userId);
            logger_1.logger.info('New authentication session created', {
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
        }
        catch (error) {
            logger_1.logger.error('Failed to create authentication session:', error);
            throw error;
        }
    }
    async refreshToken(refreshToken, deviceInfo) {
        try {
            const jwtSecrets = SecretManager_1.secretManager.getJWTSecrets();
            const decoded = jsonwebtoken_1.default.verify(refreshToken, jwtSecrets.refreshSecret);
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }
            if (this.revokedTokens.has(refreshToken)) {
                throw new Error('Refresh token has been revoked');
            }
            const sessionData = await this.getSession(decoded.sessionId);
            if (!sessionData || !sessionData.isActive) {
                throw new Error('Session not found or inactive');
            }
            if (this.config.requireDeviceBinding) {
                if (decoded.deviceFingerprint !== deviceInfo.deviceFingerprint) {
                    logger_1.logger.warn('Device fingerprint mismatch during token refresh', {
                        sessionId: decoded.sessionId,
                        expected: decoded.deviceFingerprint,
                        actual: deviceInfo.deviceFingerprint,
                        ipAddress: deviceInfo.ipAddress
                    });
                    await this.revokeSession(decoded.sessionId);
                    throw new Error('Device binding verification failed');
                }
            }
            const refreshTokenHash = crypto_1.default
                .createHash('sha256')
                .update(refreshToken)
                .digest('hex');
            if (sessionData.refreshTokenHash !== refreshTokenHash) {
                const { tokenRotationService } = await import('./TokenRotationService.js');
                const graceCheck = await tokenRotationService.validateTokenInGracePeriod(refreshTokenHash, sessionData.sessionId);
                if (graceCheck.valid && graceCheck.newTokenHash === sessionData.refreshTokenHash) {
                    logger_1.logger.info('Refresh token used during grace period', {
                        sessionId: sessionData.sessionId,
                        userId: sessionData.userId
                    });
                }
                else {
                    throw new Error('Invalid refresh token');
                }
            }
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
            const newAccessToken = jsonwebtoken_1.default.sign(accessTokenPayload, jwtSecrets.secret, {
                algorithm: 'HS256',
                issuer: process.env.JWT_ISSUER || 'botrt-ecommerce',
                audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel'
            });
            let newRefreshToken = refreshToken;
            let newRefreshTokenExpiry = new Date(decoded.exp * 1000);
            if (this.config.rotateRefreshTokens) {
                const newRefreshTokenPayload = {
                    userId: sessionData.userId,
                    sessionId: sessionData.sessionId,
                    type: 'refresh',
                    deviceFingerprint: deviceInfo.deviceFingerprint,
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenTTL
                };
                newRefreshToken = jsonwebtoken_1.default.sign(newRefreshTokenPayload, jwtSecrets.refreshSecret, {
                    algorithm: 'HS256',
                    issuer: process.env.JWT_ISSUER || 'botrt-ecommerce',
                    audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel'
                });
                newRefreshTokenExpiry = new Date(Date.now() + this.config.refreshTokenTTL * 1000);
                const oldRefreshTokenHash = crypto_1.default
                    .createHash('sha256')
                    .update(refreshToken)
                    .digest('hex');
                const newRefreshTokenHash = crypto_1.default
                    .createHash('sha256')
                    .update(newRefreshToken)
                    .digest('hex');
                sessionData.refreshTokenHash = newRefreshTokenHash;
                const { tokenRotationService } = await import('./TokenRotationService.js');
                await tokenRotationService.recordRotation(oldRefreshTokenHash, newRefreshTokenHash, sessionData.sessionId, sessionData.userId);
                logger_1.logger.debug('Token rotation completed with grace period', {
                    sessionId: sessionData.sessionId,
                    userId: sessionData.userId
                });
            }
            sessionData.lastActivity = new Date();
            sessionData.deviceInfo = deviceInfo;
            await this.storeSession(sessionData);
            logger_1.logger.info('Access token refreshed', {
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
        }
        catch (error) {
            logger_1.logger.error('Failed to refresh token:', error);
            throw error;
        }
    }
    async validateToken(accessToken, deviceInfo) {
        try {
            const jwtSecrets = SecretManager_1.secretManager.getJWTSecrets();
            const decoded = jsonwebtoken_1.default.verify(accessToken, jwtSecrets.secret);
            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }
            if (this.revokedTokens.has(accessToken)) {
                if (decoded.type === 'refresh') {
                    const tokenHash = crypto_1.default.createHash('sha256').update(accessToken).digest('hex');
                    const { tokenRotationService } = await import('./TokenRotationService.js');
                    const graceCheck = await tokenRotationService.validateTokenInGracePeriod(tokenHash, decoded.sessionId);
                    if (graceCheck.valid) {
                        logger_1.logger.info('Token validated during grace period', {
                            sessionId: decoded.sessionId,
                            newTokenHash: graceCheck.newTokenHash
                        });
                        return decoded;
                    }
                }
                throw new Error('Access token has been revoked');
            }
            const sessionData = await this.getSession(decoded.sessionId);
            if (!sessionData || !sessionData.isActive) {
                throw new Error('Session not found or inactive');
            }
            const inactivityMs = Date.now() - sessionData.lastActivity.getTime();
            if (inactivityMs > this.config.sessionInactivityTimeout * 1000) {
                logger_1.logger.warn('Session expired due to inactivity', {
                    sessionId: decoded.sessionId,
                    inactivityMs,
                    timeoutMs: this.config.sessionInactivityTimeout * 1000
                });
                await this.revokeSession(decoded.sessionId);
                throw new Error('Session expired due to inactivity');
            }
            if (this.config.requireDeviceBinding && deviceInfo) {
                if (sessionData.deviceInfo.deviceFingerprint !== deviceInfo.deviceFingerprint) {
                    logger_1.logger.warn('Device fingerprint mismatch during token validation', {
                        sessionId: decoded.sessionId,
                        expected: sessionData.deviceInfo.deviceFingerprint,
                        actual: deviceInfo.deviceFingerprint
                    });
                    await this.revokeSession(decoded.sessionId);
                    throw new Error('Device binding verification failed');
                }
            }
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
        }
        catch (error) {
            logger_1.logger.error('Token validation failed:', error);
            throw error;
        }
    }
    async revokeSession(sessionId) {
        try {
            const sessionData = await this.getSession(sessionId);
            if (sessionData) {
                sessionData.isActive = false;
                await this.storeSession(sessionData);
                const refreshTokenData = await this.getRefreshTokenBySession(sessionId);
                if (refreshTokenData) {
                    this.revokedTokens.add(refreshTokenData);
                }
                await this.removeSessionFromCache(sessionId);
                logger_1.logger.info('Session revoked', {
                    sessionId,
                    userId: sessionData.userId
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to revoke session:', error);
            throw error;
        }
    }
    async revokeAllUserSessions(userId) {
        try {
            const sessions = await this.getUserSessions(userId);
            for (const session of sessions) {
                await this.revokeSession(session.sessionId);
            }
            logger_1.logger.info('All user sessions revoked', {
                userId,
                sessionCount: sessions.length
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to revoke all user sessions:', error);
            throw error;
        }
    }
    async storeSession(sessionData) {
        try {
            await TenantCacheService_1.tenantCacheService.set('system', `session_${sessionData.sessionId}`, sessionData, {
                ttl: this.config.refreshTokenTTL,
                namespace: 'auth'
            });
            const prisma = database_1.databaseService.getPrisma();
            await prisma.$executeRaw `
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
        }
        catch (error) {
            logger_1.logger.error('Failed to store session data:', error);
            throw error;
        }
    }
    async getSession(sessionId) {
        try {
            const cached = await TenantCacheService_1.tenantCacheService.get('system', `session_${sessionId}`, { namespace: 'auth' });
            if (cached) {
                return cached;
            }
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT * FROM user_sessions WHERE session_id = ${sessionId} AND is_active = true
      `;
            if (result.length === 0) {
                return null;
            }
            const row = result[0];
            const sessionData = {
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
            await TenantCacheService_1.tenantCacheService.set('system', `session_${sessionId}`, sessionData, {
                ttl: this.config.refreshTokenTTL,
                namespace: 'auth'
            });
            return sessionData;
        }
        catch (error) {
            logger_1.logger.error('Failed to get session data:', error);
            return null;
        }
    }
    async getUserSessions(userId) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get user sessions:', error);
            return [];
        }
    }
    async cleanupUserSessions(userId) {
        try {
            const sessions = await this.getUserSessions(userId);
            if (sessions.length > this.config.maxSessionsPerUser) {
                const sessionsToRevoke = sessions
                    .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())
                    .slice(0, sessions.length - this.config.maxSessionsPerUser);
                for (const session of sessionsToRevoke) {
                    await this.revokeSession(session.sessionId);
                }
                logger_1.logger.info('Cleaned up old user sessions', {
                    userId,
                    revokedSessions: sessionsToRevoke.length,
                    totalSessions: sessions.length
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup user sessions:', error);
        }
    }
    async removeSessionFromCache(sessionId) {
        await TenantCacheService_1.tenantCacheService.delete('system', `session_${sessionId}`, { namespace: 'auth' });
    }
    async getRefreshTokenBySession(_sessionId) {
        return null;
    }
    async healthCheck() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT COUNT(*) as count FROM user_sessions WHERE is_active = true
      `;
            return {
                status: 'healthy',
                activeSessions: Number(result[0]?.count || 0),
                revokedTokens: this.revokedTokens.size,
                config: this.config
            };
        }
        catch (error) {
            logger_1.logger.error('Auth service health check failed:', error);
            return {
                status: 'error',
                activeSessions: 0,
                revokedTokens: 0,
                config: this.config
            };
        }
    }
    getConfiguration() {
        return { ...this.config };
    }
}
exports.SecureAuthService = SecureAuthService;
exports.secureAuthService = SecureAuthService.getInstance();
//# sourceMappingURL=SecureAuthService.js.map
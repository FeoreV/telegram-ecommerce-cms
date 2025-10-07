"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenRevocationService = exports.TokenRevocationService = void 0;
const database_1 = require("../lib/database");
const logger_1 = require("../utils/logger");
const TenantCacheService_1 = require("./TenantCacheService");
class TokenRevocationService {
    constructor() {
        this.memoryRevocationList = new Set();
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0
        };
        this.maxMemorySize = 10000;
        this.loadRecentRevocations();
    }
    static getInstance() {
        if (!TokenRevocationService.instance) {
            TokenRevocationService.instance = new TokenRevocationService();
        }
        return TokenRevocationService.instance;
    }
    async loadRecentRevocations() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const recentRevocations = await prisma.$queryRaw `
        SELECT token_id
        FROM revoked_tokens
        WHERE revoked_at > NOW() - INTERVAL '24 hours'
        AND expires_at > NOW()
        ORDER BY revoked_at DESC
        LIMIT ${this.maxMemorySize}
      `;
            this.memoryRevocationList.clear();
            recentRevocations.forEach(row => {
                this.memoryRevocationList.add(row.token_id);
            });
            logger_1.logger.info('Loaded recent token revocations into memory', {
                count: recentRevocations.length
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to load recent revocations:', error);
        }
    }
    async revokeToken(tokenId, tokenType, userId, sessionId, revokedBy, reason, expiresAt) {
        try {
            const revokedToken = {
                tokenId,
                tokenType,
                userId,
                sessionId,
                revokedAt: new Date(),
                revokedBy,
                reason,
                expiresAt
            };
            this.memoryRevocationList.add(tokenId);
            await TenantCacheService_1.tenantCacheService.set('system', `revoked_${tokenId}`, revokedToken, {
                ttl: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
                namespace: 'revocation'
            });
            await this.storeRevocation(revokedToken);
            if (this.memoryRevocationList.size > this.maxMemorySize) {
                await this.cleanupMemoryRevocationList();
            }
            logger_1.logger.info('Token revoked', {
                tokenId: tokenId.substring(0, 8) + '...',
                tokenType,
                userId,
                sessionId,
                reason,
                revokedBy
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to revoke token:', error);
            throw error;
        }
    }
    async isTokenRevoked(tokenId) {
        try {
            if (this.memoryRevocationList.has(tokenId)) {
                this.metrics.cacheHits++;
                return true;
            }
            const cached = await TenantCacheService_1.tenantCacheService.get('system', `revoked_${tokenId}`, { namespace: 'revocation' });
            if (cached !== null) {
                this.metrics.cacheHits++;
                if (cached.revoked) {
                    this.memoryRevocationList.add(tokenId);
                    return true;
                }
                return false;
            }
            this.metrics.cacheMisses++;
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT EXISTS (
          SELECT 1 FROM revoked_tokens
          WHERE token_id = ${tokenId}
          AND expires_at > NOW()
        ) as exists
      `;
            const isRevoked = result[0]?.exists || false;
            if (isRevoked) {
                this.memoryRevocationList.add(tokenId);
                const revocationData = await this.getRevocationData(tokenId);
                if (revocationData) {
                    const ttl = Math.floor((revocationData.expiresAt.getTime() - Date.now()) / 1000);
                    if (ttl > 0) {
                        await TenantCacheService_1.tenantCacheService.set('system', `revoked_${tokenId}`, { revoked: true, expiresAt: revocationData.expiresAt.toISOString() }, {
                            ttl,
                            namespace: 'revocation'
                        });
                    }
                }
            }
            else {
                await TenantCacheService_1.tenantCacheService.set('system', `revoked_${tokenId}`, { revoked: false, expiresAt: new Date(Date.now() + 300000).toISOString() }, {
                    ttl: 300,
                    namespace: 'revocation'
                });
            }
            return isRevoked;
        }
        catch (error) {
            logger_1.logger.error('Failed to check token revocation status:', error);
            this.metrics.errors++;
            return true;
        }
    }
    async areTokensRevoked(tokenIds) {
        const results = new Map();
        try {
            const uncachedTokenIds = [];
            for (const tokenId of tokenIds) {
                if (this.memoryRevocationList.has(tokenId)) {
                    results.set(tokenId, true);
                    this.metrics.cacheHits++;
                }
                else {
                    uncachedTokenIds.push(tokenId);
                }
            }
            if (uncachedTokenIds.length === 0) {
                return results;
            }
            const cacheKeys = uncachedTokenIds.map(id => `revoked_${id}`);
            const cachedValues = await TenantCacheService_1.tenantCacheService.mget('system', cacheKeys, { namespace: 'revocation' });
            const tokensToCheckInDb = [];
            uncachedTokenIds.forEach((tokenId, index) => {
                const cached = cachedValues[index];
                if (cached !== null) {
                    this.metrics.cacheHits++;
                    results.set(tokenId, cached.revoked);
                    if (cached.revoked) {
                        this.memoryRevocationList.add(tokenId);
                    }
                }
                else {
                    tokensToCheckInDb.push(tokenId);
                    this.metrics.cacheMisses++;
                }
            });
            if (tokensToCheckInDb.length === 0) {
                return results;
            }
            const prisma = database_1.databaseService.getPrisma();
            let revokedTokens = [];
            try {
                revokedTokens = await prisma.revokedToken?.findMany({
                    where: {
                        tokenId: { in: tokensToCheckInDb },
                        expiresAt: { gt: new Date() }
                    },
                    select: { tokenId: true, expiresAt: true }
                }) || [];
            }
            catch (error) {
                logger_1.logger.debug('RevokedToken model not available, skipping check');
            }
            const revokedSet = new Set(revokedTokens.map(t => t.tokenId));
            for (const tokenId of tokensToCheckInDb) {
                const isRevoked = revokedSet.has(tokenId);
                results.set(tokenId, isRevoked);
                if (isRevoked) {
                    this.memoryRevocationList.add(tokenId);
                    const token = revokedTokens.find(t => t.tokenId === tokenId);
                    if (token) {
                        const ttl = Math.floor((token.expiresAt.getTime() - Date.now()) / 1000);
                        if (ttl > 0) {
                            await TenantCacheService_1.tenantCacheService.set('system', `revoked_${tokenId}`, { revoked: true, expiresAt: token.expiresAt.toISOString() }, { ttl, namespace: 'revocation' });
                        }
                    }
                }
                else {
                    await TenantCacheService_1.tenantCacheService.set('system', `revoked_${tokenId}`, { revoked: false, expiresAt: new Date(Date.now() + 300000).toISOString() }, { ttl: 300, namespace: 'revocation' });
                }
            }
            return results;
        }
        catch (error) {
            logger_1.logger.error('Failed to bulk check token revocation status:', error);
            this.metrics.errors++;
            tokenIds.forEach(id => results.set(id, true));
            return results;
        }
    }
    getCacheMetrics() {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        const hitRate = total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
        return {
            cacheHits: this.metrics.cacheHits,
            cacheMisses: this.metrics.cacheMisses,
            hitRate: Math.round(hitRate * 100) / 100,
            errors: this.metrics.errors
        };
    }
    resetCacheMetrics() {
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0
        };
    }
    async revokeAllUserTokens(userId, revokedBy, reason = 'user_logout') {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const sessions = await prisma.$queryRaw `
        SELECT session_id, refresh_token_hash
        FROM user_sessions
        WHERE user_id = ${userId}::UUID AND is_active = true
      `;
            let revokedCount = 0;
            for (const session of sessions) {
                await this.revokeToken(session.refresh_token_hash, 'refresh', userId, session.session_id, revokedBy, reason, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
                revokedCount++;
            }
            await prisma.$executeRaw `
        UPDATE user_sessions
        SET is_active = false, updated_at = NOW()
        WHERE user_id = ${userId}::UUID AND is_active = true
      `;
            logger_1.logger.info('All user tokens revoked', {
                userId,
                revokedCount,
                reason,
                revokedBy
            });
            return revokedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to revoke all user tokens:', error);
            throw error;
        }
    }
    async revokeSessionTokens(sessionId, revokedBy, reason = 'session_logout') {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const session = await prisma.$queryRaw `
        SELECT user_id, refresh_token_hash
        FROM user_sessions
        WHERE session_id = ${sessionId} AND is_active = true
      `;
            if (session.length === 0) {
                logger_1.logger.warn('Session not found for token revocation', { sessionId });
                return;
            }
            const sessionData = session[0];
            await this.revokeToken(sessionData.refresh_token_hash, 'refresh', sessionData.user_id, sessionId, revokedBy, reason, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
            await prisma.$executeRaw `
        UPDATE user_sessions
        SET is_active = false, updated_at = NOW()
        WHERE session_id = ${sessionId}
      `;
            logger_1.logger.info('Session tokens revoked', {
                sessionId,
                userId: sessionData.user_id,
                reason,
                revokedBy
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to revoke session tokens:', error);
            throw error;
        }
    }
    async storeRevocation(revokedToken) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            await prisma.$executeRaw `
        INSERT INTO revoked_tokens (
          token_id, token_type, user_id, session_id,
          revoked_at, revoked_by, reason, expires_at
        ) VALUES (
          ${revokedToken.tokenId},
          ${revokedToken.tokenType},
          ${revokedToken.userId}::UUID,
          ${revokedToken.sessionId},
          ${revokedToken.revokedAt},
          ${revokedToken.revokedBy},
          ${revokedToken.reason},
          ${revokedToken.expiresAt}
        )
        ON CONFLICT (token_id) DO NOTHING
      `;
        }
        catch (error) {
            logger_1.logger.error('Failed to store token revocation:', error);
            throw error;
        }
    }
    async getRevocationData(tokenId) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT * FROM revoked_tokens
        WHERE token_id = ${tokenId} AND expires_at > NOW()
      `;
            if (result.length === 0) {
                return null;
            }
            const row = result[0];
            return {
                tokenId: row.token_id,
                tokenType: row.token_type,
                userId: row.user_id,
                sessionId: row.session_id,
                revokedAt: row.revoked_at,
                revokedBy: row.revoked_by,
                reason: row.reason,
                expiresAt: row.expires_at
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get revocation data:', error);
            return null;
        }
    }
    async cleanupExpiredRevocations() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$executeRaw `
        DELETE FROM revoked_tokens WHERE expires_at <= NOW()
      `;
            await this.loadRecentRevocations();
            logger_1.logger.info('Cleaned up expired token revocations', {
                deletedCount: result
            });
            return Number(result);
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup expired revocations:', error);
            return 0;
        }
    }
    async cleanupMemoryRevocationList() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const recentRevocations = await prisma.$queryRaw `
        SELECT token_id
        FROM revoked_tokens
        WHERE revoked_at > NOW() - INTERVAL '1 hour'
        AND expires_at > NOW()
        ORDER BY revoked_at DESC
        LIMIT ${Math.floor(this.maxMemorySize * 0.8)}
      `;
            this.memoryRevocationList.clear();
            recentRevocations.forEach(row => {
                this.memoryRevocationList.add(row.token_id);
            });
            logger_1.logger.debug('Memory revocation list cleaned up', {
                newSize: this.memoryRevocationList.size
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup memory revocation list:', error);
        }
    }
    async getRevocationStats() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const totalResult = await prisma.$queryRaw `
        SELECT COUNT(*) as count FROM revoked_tokens
      `;
            const todayResult = await prisma.$queryRaw `
        SELECT COUNT(*) as count FROM revoked_tokens
        WHERE revoked_at > CURRENT_DATE
      `;
            const activeResult = await prisma.$queryRaw `
        SELECT COUNT(*) as count FROM revoked_tokens
        WHERE expires_at > NOW()
      `;
            const reasonResult = await prisma.$queryRaw `
        SELECT reason, COUNT(*) as count
        FROM revoked_tokens
        WHERE revoked_at > NOW() - INTERVAL '30 days'
        GROUP BY reason
        ORDER BY count DESC
      `;
            const revokedByReason = {};
            reasonResult.forEach(row => {
                revokedByReason[row.reason] = Number(row.count);
            });
            return {
                totalRevoked: Number(totalResult[0]?.count || 0),
                revokedToday: Number(todayResult[0]?.count || 0),
                activeRevocations: Number(activeResult[0]?.count || 0),
                revokedByReason
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get revocation statistics:', error);
            return {
                totalRevoked: 0,
                revokedToday: 0,
                activeRevocations: 0,
                revokedByReason: {}
            };
        }
    }
    async bulkRevokeTokens(criteria, revokedBy, reason) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            let revokedCount = 0;
            const whereConditions = ['us.is_active = true'];
            const queryParams = [];
            let paramIndex = 1;
            if (criteria.userId) {
                whereConditions.push(`us.user_id = $${paramIndex}::UUID`);
                queryParams.push(criteria.userId);
                paramIndex++;
            }
            if (criteria.sessionIds && criteria.sessionIds.length > 0) {
                whereConditions.push(`us.session_id = ANY($${paramIndex}::TEXT[])`);
                queryParams.push(criteria.sessionIds);
                paramIndex++;
            }
            if (criteria.olderThan) {
                whereConditions.push(`us.created_at < $${paramIndex}`);
                queryParams.push(criteria.olderThan);
                paramIndex++;
            }
            const whereClause = whereConditions.join(' AND ');
            const query = `
        SELECT us.session_id, us.user_id, us.refresh_token_hash
        FROM user_sessions us
        WHERE ${whereClause}
      `;
            const sessions = await prisma.$queryRawUnsafe(query, ...queryParams);
            for (const session of sessions) {
                if (!criteria.tokenType || criteria.tokenType === 'refresh') {
                    await this.revokeToken(session.refresh_token_hash, 'refresh', session.user_id, session.session_id, revokedBy, reason, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
                    revokedCount++;
                }
            }
            const updateQuery = `
        UPDATE user_sessions
        SET is_active = false, updated_at = NOW()
        WHERE ${whereClause.replace(/us\./g, '')}
      `;
            await prisma.$queryRawUnsafe(updateQuery, ...queryParams);
            logger_1.logger.info('Bulk token revocation completed', {
                criteria,
                revokedCount,
                reason,
                revokedBy
            });
            return revokedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to bulk revoke tokens:', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            const stats = await this.getRevocationStats();
            return {
                status: 'healthy',
                memoryListSize: this.memoryRevocationList.size,
                stats
            };
        }
        catch (error) {
            logger_1.logger.error('Token revocation service health check failed:', error);
            return {
                status: 'error',
                memoryListSize: 0,
                stats: {
                    totalRevoked: 0,
                    revokedToday: 0,
                    activeRevocations: 0,
                    revokedByReason: {}
                }
            };
        }
    }
}
exports.TokenRevocationService = TokenRevocationService;
exports.tokenRevocationService = TokenRevocationService.getInstance();
//# sourceMappingURL=TokenRevocationService.js.map
import { tenantCacheService } from './TenantCacheService';
import { databaseService } from '../lib/database';
import { logger } from '../utils/logger';

export interface RevokedToken {
  tokenId: string;
  tokenType: 'access' | 'refresh';
  userId: string;
  sessionId: string;
  revokedAt: Date;
  revokedBy: string;
  reason: string;
  expiresAt: Date;
}

export interface RevocationStats {
  totalRevoked: number;
  revokedToday: number;
  revokedByReason: Record<string, number>;
  activeRevocations: number;
}

export class TokenRevocationService {
  private static instance: TokenRevocationService;
  private memoryRevocationList: Set<string> = new Set();
  private maxMemorySize: number = 10000; // Maximum tokens to keep in memory

  private constructor() {
    // Load recent revocations into memory on startup
    this.loadRecentRevocations();
  }

  public static getInstance(): TokenRevocationService {
    if (!TokenRevocationService.instance) {
      TokenRevocationService.instance = new TokenRevocationService();
    }
    return TokenRevocationService.instance;
  }

  /**
   * Load recent revocations into memory for fast lookup
   */
  private async loadRecentRevocations(): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();
      
      // Load revocations from last 24 hours
      const recentRevocations = await prisma.$queryRaw<{ token_id: string }[]>`
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

      logger.info('Loaded recent token revocations into memory', {
        count: recentRevocations.length
      });

    } catch (error) {
      logger.error('Failed to load recent revocations:', error);
    }
  }

  /**
   * Revoke a specific token
   */
  async revokeToken(
    tokenId: string,
    tokenType: 'access' | 'refresh',
    userId: string,
    sessionId: string,
    revokedBy: string,
    reason: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      const revokedToken: RevokedToken = {
        tokenId,
        tokenType,
        userId,
        sessionId,
        revokedAt: new Date(),
        revokedBy,
        reason,
        expiresAt
      };

      // Add to memory for fast lookup
      this.memoryRevocationList.add(tokenId);

      // Store in cache
      await tenantCacheService.set(
        'system',
        `revoked_${tokenId}`,
        revokedToken,
        {
          ttl: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
          namespace: 'revocation'
        }
      );

      // Store in database for persistence
      await this.storeRevocation(revokedToken);

      // Clean up memory if it gets too large
      if (this.memoryRevocationList.size > this.maxMemorySize) {
        await this.cleanupMemoryRevocationList();
      }

      logger.info('Token revoked', {
        tokenId: tokenId.substring(0, 8) + '...',
        tokenType,
        userId,
        sessionId,
        reason,
        revokedBy
      });

    } catch (error) {
      logger.error('Failed to revoke token:', error);
      throw error;
    }
  }

  /**
   * Check if a token is revoked
   */
  async isTokenRevoked(tokenId: string): Promise<boolean> {
    try {
      // Check memory first (fastest)
      if (this.memoryRevocationList.has(tokenId)) {
        return true;
      }

      // Check cache (fast)
      const cached = await tenantCacheService.exists(
        'system',
        `revoked_${tokenId}`,
        { namespace: 'revocation' }
      );

      if (cached) {
        // Add to memory for future fast lookups
        this.memoryRevocationList.add(tokenId);
        return true;
      }

      // Check database (slowest, but most reliable)
      const prisma = databaseService.getPrisma();
      const result = await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM revoked_tokens 
          WHERE token_id = ${tokenId} 
          AND expires_at > NOW()
        ) as exists
      `;

      const isRevoked = result[0]?.exists || false;

      if (isRevoked) {
        // Add to memory and cache for future fast lookups
        this.memoryRevocationList.add(tokenId);
        
        // Get full revocation data for caching
        const revocationData = await this.getRevocationData(tokenId);
        if (revocationData) {
          const ttl = Math.floor((revocationData.expiresAt.getTime() - Date.now()) / 1000);
          if (ttl > 0) {
            await tenantCacheService.set(
              'system',
              `revoked_${tokenId}`,
              revocationData,
              {
                ttl,
                namespace: 'revocation'
              }
            );
          }
        }
      }

      return isRevoked;

    } catch (error) {
      logger.error('Failed to check token revocation status:', error);
      // Fail secure - assume token is revoked on error
      return true;
    }
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(
    userId: string,
    revokedBy: string,
    reason: string = 'user_logout'
  ): Promise<number> {
    try {
      const prisma = databaseService.getPrisma();
      
      // Get all active sessions for the user
      const sessions = await prisma.$queryRaw<{ session_id: string; refresh_token_hash: string }[]>`
        SELECT session_id, refresh_token_hash 
        FROM user_sessions 
        WHERE user_id = ${userId}::UUID AND is_active = true
      `;

      let revokedCount = 0;

      for (const session of sessions) {
        // Revoke refresh token (we use hash as token ID for refresh tokens)
        await this.revokeToken(
          session.refresh_token_hash,
          'refresh',
          userId,
          session.session_id,
          revokedBy,
          reason,
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        );

        revokedCount++;
      }

      // Mark all user sessions as inactive
      await prisma.$executeRaw`
        UPDATE user_sessions 
        SET is_active = false, updated_at = NOW()
        WHERE user_id = ${userId}::UUID AND is_active = true
      `;

      logger.info('All user tokens revoked', {
        userId,
        revokedCount,
        reason,
        revokedBy
      });

      return revokedCount;

    } catch (error) {
      logger.error('Failed to revoke all user tokens:', error);
      throw error;
    }
  }

  /**
   * Revoke all tokens for a session
   */
  async revokeSessionTokens(
    sessionId: string,
    revokedBy: string,
    reason: string = 'session_logout'
  ): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();
      
      // Get session data
      const session = await prisma.$queryRaw<{ 
        user_id: string; 
        refresh_token_hash: string 
      }[]>`
        SELECT user_id, refresh_token_hash 
        FROM user_sessions 
        WHERE session_id = ${sessionId} AND is_active = true
      `;

      if (session.length === 0) {
        logger.warn('Session not found for token revocation', { sessionId });
        return;
      }

      const sessionData = session[0];

      // Revoke refresh token
      await this.revokeToken(
        sessionData.refresh_token_hash,
        'refresh',
        sessionData.user_id,
        sessionId,
        revokedBy,
        reason,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );

      // Mark session as inactive
      await prisma.$executeRaw`
        UPDATE user_sessions 
        SET is_active = false, updated_at = NOW()
        WHERE session_id = ${sessionId}
      `;

      logger.info('Session tokens revoked', {
        sessionId,
        userId: sessionData.user_id,
        reason,
        revokedBy
      });

    } catch (error) {
      logger.error('Failed to revoke session tokens:', error);
      throw error;
    }
  }

  /**
   * Store revocation in database
   */
  private async storeRevocation(revokedToken: RevokedToken): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();
      
      await prisma.$executeRaw`
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

    } catch (error) {
      logger.error('Failed to store token revocation:', error);
      throw error;
    }
  }

  /**
   * Get revocation data from database
   */
  private async getRevocationData(tokenId: string): Promise<RevokedToken | null> {
    try {
      const prisma = databaseService.getPrisma();
      
      const result = await prisma.$queryRaw<unknown[]>`
        SELECT * FROM revoked_tokens 
        WHERE token_id = ${tokenId} AND expires_at > NOW()
      `;

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        tokenId: (row as any).token_id,
        tokenType: (row as any).token_type,
        userId: (row as any).user_id,
        sessionId: (row as any).session_id,
        revokedAt: (row as any).revoked_at,
        revokedBy: (row as any).revoked_by,
        reason: (row as any).reason,
        expiresAt: (row as any).expires_at
      };

    } catch (error) {
      logger.error('Failed to get revocation data:', error);
      return null;
    }
  }

  /**
   * Clean up expired revocations
   */
  async cleanupExpiredRevocations(): Promise<number> {
    try {
      const prisma = databaseService.getPrisma();
      
      // Delete expired revocations from database
      const result = await prisma.$executeRaw`
        DELETE FROM revoked_tokens WHERE expires_at <= NOW()
      `;

      // Clean up memory
      await this.loadRecentRevocations();

      // Clean up cache (let TTL handle most of it, but clean up explicitly expired ones)
      // This is done by the cache service's TTL mechanism

      logger.info('Cleaned up expired token revocations', {
        deletedCount: result
      });

      return Number(result);

    } catch (error) {
      logger.error('Failed to cleanup expired revocations:', error);
      return 0;
    }
  }

  /**
   * Clean up memory revocation list
   */
  private async cleanupMemoryRevocationList(): Promise<void> {
    try {
      // Keep only the most recent revocations in memory
      const prisma = databaseService.getPrisma();
      
      const recentRevocations = await prisma.$queryRaw<{ token_id: string }[]>`
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

      logger.debug('Memory revocation list cleaned up', {
        newSize: this.memoryRevocationList.size
      });

    } catch (error) {
      logger.error('Failed to cleanup memory revocation list:', error);
    }
  }

  /**
   * Get revocation statistics
   */
  async getRevocationStats(): Promise<RevocationStats> {
    try {
      const prisma = databaseService.getPrisma();
      
      // Get total revoked tokens
      const totalResult = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count FROM revoked_tokens
      `;

      // Get tokens revoked today
      const todayResult = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count FROM revoked_tokens 
        WHERE revoked_at > CURRENT_DATE
      `;

      // Get active revocations (not expired)
      const activeResult = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count FROM revoked_tokens 
        WHERE expires_at > NOW()
      `;

      // Get revocations by reason
      const reasonResult = await prisma.$queryRaw<{ reason: string; count: number }[]>`
        SELECT reason, COUNT(*) as count 
        FROM revoked_tokens 
        WHERE revoked_at > NOW() - INTERVAL '30 days'
        GROUP BY reason
        ORDER BY count DESC
      `;

      const revokedByReason: Record<string, number> = {};
      reasonResult.forEach(row => {
        revokedByReason[row.reason] = Number(row.count);
      });

      return {
        totalRevoked: Number(totalResult[0]?.count || 0),
        revokedToday: Number(todayResult[0]?.count || 0),
        activeRevocations: Number(activeResult[0]?.count || 0),
        revokedByReason
      };

    } catch (error) {
      logger.error('Failed to get revocation statistics:', error);
      return {
        totalRevoked: 0,
        revokedToday: 0,
        activeRevocations: 0,
        revokedByReason: {}
      };
    }
  }

  /**
   * Bulk revoke tokens by criteria
   */
  async bulkRevokeTokens(
    criteria: {
      userId?: string;
      sessionIds?: string[];
      olderThan?: Date;
      tokenType?: 'access' | 'refresh';
    },
    revokedBy: string,
    reason: string
  ): Promise<number> {
    try {
      const prisma = databaseService.getPrisma();
      let revokedCount = 0;

      // Build query conditions
      const whereConditions = ['us.is_active = true'];
      const queryParams: unknown[] = [];
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

      // Get sessions matching criteria
      const query = `
        SELECT us.session_id, us.user_id, us.refresh_token_hash
        FROM user_sessions us
        WHERE ${whereClause}
      `;

      const sessions = await prisma.$queryRawUnsafe<{
        session_id: string;
        user_id: string;
        refresh_token_hash: string;
      }[]>(query, ...queryParams);

      // Revoke tokens for each session
      for (const session of sessions) {
        if (!criteria.tokenType || criteria.tokenType === 'refresh') {
          await this.revokeToken(
            session.refresh_token_hash,
            'refresh',
            session.user_id,
            session.session_id,
            revokedBy,
            reason,
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          );
          revokedCount++;
        }
      }

      // Mark sessions as inactive
      const updateQuery = `
        UPDATE user_sessions 
        SET is_active = false, updated_at = NOW()
        WHERE ${whereClause.replace(/us\./g, '')}
      `;

      await prisma.$queryRawUnsafe(updateQuery, ...queryParams);

      logger.info('Bulk token revocation completed', {
        criteria,
        revokedCount,
        reason,
        revokedBy
      });

      return revokedCount;

    } catch (error) {
      logger.error('Failed to bulk revoke tokens:', error);
      throw error;
    }
  }

  /**
   * Health check for token revocation service
   */
  async healthCheck(): Promise<{
    status: string;
    memoryListSize: number;
    stats: RevocationStats;
  }> {
    try {
      const stats = await this.getRevocationStats();
      
      return {
        status: 'healthy',
        memoryListSize: this.memoryRevocationList.size,
        stats
      };

    } catch (error) {
      logger.error('Token revocation service health check failed:', error);
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

// Export singleton instance
export const tokenRevocationService = TokenRevocationService.getInstance();

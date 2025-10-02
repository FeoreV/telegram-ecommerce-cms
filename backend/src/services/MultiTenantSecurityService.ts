import { databaseService } from '../lib/database';
import { logger } from '../utils/logger';

export interface UserContext {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOMER';
  storeId?: string;
  permissions?: string[];
}

export interface TenantSecurityConfig {
  enableRLS: boolean;
  enableAuditLogging: boolean;
  strictTenantIsolation: boolean;
  allowCrossStoreAccess: boolean;
  defaultRole: string;
}

export interface RLSValidationResult {
  tableName: string;
  hasRls: boolean;
  policyCount: number;
  status: 'PROTECTED' | 'RLS_ENABLED_NO_POLICIES' | 'NOT_PROTECTED';
  securityStatus: string;
}

export interface TenantStats {
  totalStores: number;
  activeStores: number;
  totalUsers: number;
  usersByRole: Record<string, number>;
  violationCount: number;
  lastViolation: Date | null;
}

export class MultiTenantSecurityService {
  private static instance: MultiTenantSecurityService;
  private config: TenantSecurityConfig;
  private currentContext: Map<string, UserContext> = new Map();

  private constructor() {
    this.config = {
      enableRLS: process.env.ENABLE_RLS !== 'false',
      enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
      strictTenantIsolation: process.env.STRICT_TENANT_ISOLATION === 'true',
      allowCrossStoreAccess: process.env.ALLOW_CROSS_STORE_ACCESS === 'true',
      defaultRole: process.env.DEFAULT_USER_ROLE || 'CUSTOMER'
    };
  }

  public static getInstance(): MultiTenantSecurityService {
    if (!MultiTenantSecurityService.instance) {
      MultiTenantSecurityService.instance = new MultiTenantSecurityService();
    }
    return MultiTenantSecurityService.instance;
  }

  /**
   * Initialize multi-tenant security service
   */
  async initialize(): Promise<void> {
    try {
      // Validate RLS setup
      const rlsStatus = await this.validateRLSPolicies();
      const protectedTables = rlsStatus.filter(table => table.status === 'PROTECTED').length;
      
      if (this.config.enableRLS && protectedTables === 0) {
        logger.warn('RLS is enabled but no tables are protected. Run RLS migration first.');
      }

      logger.info('Multi-tenant security service initialized', {
        rlsEnabled: this.config.enableRLS,
        protectedTables,
        strictIsolation: this.config.strictTenantIsolation
      });

    } catch (error) {
      logger.error('Failed to initialize multi-tenant security service:', error);
      throw error;
    }
  }

  /**
   * Set user context for database session
   */
  async setUserContext(
    sessionId: string,
    context: UserContext,
    connectionId?: string
  ): Promise<void> {
    try {
      if (!this.config.enableRLS) {
        logger.debug('RLS is disabled, skipping context setting');
        return;
      }

      // Store context in memory for validation
      this.currentContext.set(sessionId, context);

      // Set database session variables
      const prisma = databaseService.getPrisma();
      
      await prisma.$executeRaw`
        SELECT security.set_user_context(
          ${context.userId}::UUID,
          ${context.role}::TEXT,
          ${context.storeId ? context.storeId : null}::UUID
        )
      `;

      logger.debug('User context set for database session', {
        sessionId,
        userId: context.userId,
        role: context.role,
        storeId: context.storeId,
        connectionId
      });

    } catch (error) {
      logger.error('Failed to set user context:', error);
      throw error;
    }
  }

  /**
   * Clear user context from database session
   */
  async clearUserContext(sessionId: string): Promise<void> {
    try {
      // Remove from memory
      this.currentContext.delete(sessionId);

      if (!this.config.enableRLS) {
        return;
      }

      // Clear database session variables
      const prisma = databaseService.getPrisma();
      await prisma.$executeRaw`SELECT security.clear_user_context()`;

      logger.debug('User context cleared for session', { sessionId });

    } catch (error) {
      logger.error('Failed to clear user context:', error);
      throw error;
    }
  }

  /**
   * Validate user access to store
   */
  async validateStoreAccess(
    userId: string,
    storeId: string,
    operation: 'read' | 'write' = 'read'
  ): Promise<boolean> {
    try {
      const prisma = databaseService.getPrisma();

      const result = await prisma.$queryRaw<{ has_access: boolean }[]>`
        SELECT security.has_store_access(${storeId}::UUID) as has_access
      `;

      const hasAccess = result[0]?.has_access || false;

      // For write operations, check modify permissions
      if (hasAccess && operation === 'write') {
        const modifyResult = await prisma.$queryRaw<{ can_modify: boolean }[]>`
          SELECT security.can_modify_store_data(${storeId}::UUID) as can_modify
        `;
        
        return modifyResult[0]?.can_modify || false;
      }

      return hasAccess;

    } catch (error) {
      logger.error('Failed to validate store access:', error);
      return false;
    }
  }

  /**
   * Get user's accessible stores
   */
  async getUserAccessibleStores(userId: string, role: string): Promise<string[]> {
    try {
      const prisma = databaseService.getPrisma();

      let query: unknown;

      switch (role) {
        case 'OWNER':
          query = prisma.$queryRaw<{ id: string }[]>`
            SELECT id::TEXT FROM stores WHERE owner_id = ${userId}::UUID
          ` as Promise<{ id: string }[]>;
          break;
          
        case 'ADMIN':
          query = prisma.$queryRaw<{ id: string }[]>`
            SELECT DISTINCT s.id::TEXT 
            FROM stores s
            JOIN store_users su ON s.id = su.store_id
            WHERE su.user_id = ${userId}::UUID AND su.role = 'ADMIN' AND su.is_active = true
          ` as Promise<{ id: string }[]>;
          break;
          
        case 'VENDOR':
          query = prisma.$queryRaw<{ id: string }[]>`
            SELECT DISTINCT s.id::TEXT 
            FROM stores s
            JOIN store_users su ON s.id = su.store_id
            WHERE su.user_id = ${userId}::UUID AND su.role = 'VENDOR' AND su.is_active = true
          ` as Promise<{ id: string }[]>;
          break;
          
        case 'CUSTOMER':
          query = prisma.$queryRaw<{ id: string }[]>`
            SELECT id::TEXT FROM stores WHERE status = 'ACTIVE'
          ` as Promise<{ id: string }[]>;
          break;
          
        default:
          return [];
      }

      const result = await (query as Promise<{ id: string }[]>);
      return result.map(row => row.id);

    } catch (error) {
      logger.error('Failed to get user accessible stores:', error);
      return [];
    }
  }

  /**
   * Assign user to store with specific role
   */
  async assignUserToStore(
    storeId: string,
    userId: string,
    role: 'ADMIN' | 'VENDOR',
    assignedBy: string,
    permissions: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();

      await prisma.$executeRaw`
        INSERT INTO store_users (store_id, user_id, role, permissions, assigned_by)
        VALUES (
          ${storeId}::UUID,
          ${userId}::UUID,
          ${role}::TEXT,
          ${JSON.stringify(permissions)}::JSONB,
          ${assignedBy}::UUID
        )
        ON CONFLICT (store_id, user_id) 
        DO UPDATE SET 
          role = EXCLUDED.role,
          permissions = EXCLUDED.permissions,
          assigned_by = EXCLUDED.assigned_by,
          assigned_at = NOW(),
          is_active = true
      `;

      logger.info('User assigned to store', {
        storeId,
        userId,
        role,
        assignedBy,
        permissions
      });

    } catch (error) {
      logger.error('Failed to assign user to store:', error);
      throw error;
    }
  }

  /**
   * Remove user from store
   */
  async removeUserFromStore(storeId: string, userId: string): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();

      await prisma.$executeRaw`
        UPDATE store_users 
        SET is_active = false 
        WHERE store_id = ${storeId}::UUID AND user_id = ${userId}::UUID
      `;

      logger.info('User removed from store', { storeId, userId });

    } catch (error) {
      logger.error('Failed to remove user from store:', error);
      throw error;
    }
  }

  /**
   * Validate RLS policies are properly configured
   */
  async validateRLSPolicies(): Promise<RLSValidationResult[]> {
    try {
      const prisma = databaseService.getPrisma();

      const result = await prisma.$queryRaw<RLSValidationResult[]>`
        SELECT * FROM security.rls_monitoring
      `;

      return result;

    } catch (error) {
      logger.error('Failed to validate RLS policies:', error);
      return [];
    }
  }

  /**
   * Test RLS isolation for specific user and store
   */
  async testRLSIsolation(
    testUserId: string,
    testUserRole: string,
    testStoreId: string
  ): Promise<unknown[]> {
    try {
      const prisma = databaseService.getPrisma();

      const result = await prisma.$queryRaw<unknown[]>`
        SELECT * FROM security.test_rls_isolation(
          ${testUserId}::UUID,
          ${testUserRole}::TEXT,
          ${testStoreId}::UUID
        )
      `;

      return result;

    } catch (error) {
      logger.error('Failed to test RLS isolation:', error);
      return [];
    }
  }

  /**
   * Get RLS violation logs
   */
  async getRLSViolations(
    limit: number = 100,
    storeId?: string,
    userId?: string
  ): Promise<any[]> {
    try {
      const prisma = databaseService.getPrisma();

      let query = `
        SELECT 
          id, user_id, user_role, store_id, table_name, operation,
          attempted_at, ip_address, session_info
        FROM security.rls_violations
        WHERE 1=1
      `;

      const params: unknown[] = [];
      let paramIndex = 1;

      if (storeId) {
        query += ` AND store_id = $${paramIndex}::UUID`;
        params.push(storeId);
        paramIndex++;
      }

      if (userId) {
        query += ` AND user_id = $${paramIndex}::UUID`;
        params.push(userId);
        paramIndex++;
      }

      query += ` ORDER BY attempted_at DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await prisma.$queryRawUnsafe(query, ...params) as unknown[];
      return result as any[];

    } catch (error) {
      logger.error('Failed to get RLS violations:', error);
      return [];
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(): Promise<TenantStats> {
    try {
      const prisma = databaseService.getPrisma();

      // Get store counts
      const storeStats = await prisma.$queryRaw<{ total: number; active: number }[]>`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'ACTIVE') as active
        FROM stores
      `;

      // Get user counts by role
      const userStats = await prisma.$queryRaw<{ role: string; count: number }[]>`
        SELECT role, COUNT(*) as count
        FROM users
        GROUP BY role
      `;

      // Get violation count
      const violationStats = await prisma.$queryRaw<{ count: number; last_violation: Date | null }[]>`
        SELECT 
          COUNT(*) as count,
          MAX(attempted_at) as last_violation
        FROM security.rls_violations
        WHERE attempted_at > NOW() - INTERVAL '30 days'
      `;

      const usersByRole = userStats.reduce((acc, stat) => {
        acc[stat.role] = Number(stat.count);
        return acc;
      }, {} as Record<string, number>);

      return {
        totalStores: Number(storeStats[0]?.total || 0),
        activeStores: Number(storeStats[0]?.active || 0),
        totalUsers: Object.values(usersByRole).reduce((sum, count) => sum + count, 0),
        usersByRole,
        violationCount: Number(violationStats[0]?.count || 0),
        lastViolation: violationStats[0]?.last_violation || null
      };

    } catch (error) {
      logger.error('Failed to get tenant statistics:', error);
      return {
        totalStores: 0,
        activeStores: 0,
        totalUsers: 0,
        usersByRole: {},
        violationCount: 0,
        lastViolation: null
      };
    }
  }

  /**
   * Health check for multi-tenant security
   */
  async healthCheck(): Promise<{
    status: string;
    rlsEnabled: boolean;
    protectedTables: number;
    totalTables: number;
    violations: number;
    stats: TenantStats;
  }> {
    try {
      const rlsValidation = await this.validateRLSPolicies();
      const stats = await this.getTenantStats();
      
      const protectedTables = rlsValidation.filter(table => table.status === 'PROTECTED').length;
      const totalTables = rlsValidation.length;

      return {
        status: 'healthy',
        rlsEnabled: this.config.enableRLS,
        protectedTables,
        totalTables,
        violations: stats.violationCount,
        stats
      };

    } catch (error) {
      logger.error('Multi-tenant security health check failed:', error);
      return {
        status: 'error',
        rlsEnabled: false,
        protectedTables: 0,
        totalTables: 0,
        violations: 0,
        stats: {
          totalStores: 0,
          activeStores: 0,
          totalUsers: 0,
          usersByRole: {},
          violationCount: 0,
          lastViolation: null
        }
      };
    }
  }

  /**
   * Get current user context
   */
  getCurrentContext(sessionId: string): UserContext | null {
    return this.currentContext.get(sessionId) || null;
  }

  /**
   * Get configuration
   */
  getConfiguration(): TenantSecurityConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const multiTenantSecurityService = MultiTenantSecurityService.getInstance();

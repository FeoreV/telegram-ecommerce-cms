"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiTenantSecurityService = exports.MultiTenantSecurityService = void 0;
const database_1 = require("../lib/database");
const logger_1 = require("../utils/logger");
class MultiTenantSecurityService {
    constructor() {
        this.currentContext = new Map();
        this.config = {
            enableRLS: process.env.ENABLE_RLS !== 'false',
            enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
            strictTenantIsolation: process.env.STRICT_TENANT_ISOLATION === 'true',
            allowCrossStoreAccess: process.env.ALLOW_CROSS_STORE_ACCESS === 'true',
            defaultRole: process.env.DEFAULT_USER_ROLE || 'CUSTOMER'
        };
    }
    static getInstance() {
        if (!MultiTenantSecurityService.instance) {
            MultiTenantSecurityService.instance = new MultiTenantSecurityService();
        }
        return MultiTenantSecurityService.instance;
    }
    async initialize() {
        try {
            const rlsStatus = await this.validateRLSPolicies();
            const protectedTables = rlsStatus.filter(table => table.status === 'PROTECTED').length;
            if (this.config.enableRLS && protectedTables === 0) {
                logger_1.logger.warn('RLS is enabled but no tables are protected. Run RLS migration first.');
            }
            logger_1.logger.info('Multi-tenant security service initialized', {
                rlsEnabled: this.config.enableRLS,
                protectedTables,
                strictIsolation: this.config.strictTenantIsolation
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize multi-tenant security service:', error);
            throw error;
        }
    }
    async setUserContext(sessionId, context, connectionId) {
        try {
            if (!this.config.enableRLS) {
                logger_1.logger.debug('RLS is disabled, skipping context setting');
                return;
            }
            this.currentContext.set(sessionId, context);
            const prisma = database_1.databaseService.getPrisma();
            await prisma.$executeRaw `
        SELECT security.set_user_context(
          ${context.userId}::UUID,
          ${context.role}::TEXT,
          ${context.storeId ? context.storeId : null}::UUID
        )
      `;
            logger_1.logger.debug('User context set for database session', {
                sessionId,
                userId: context.userId,
                role: context.role,
                storeId: context.storeId,
                connectionId
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to set user context:', error);
            throw error;
        }
    }
    async clearUserContext(sessionId) {
        try {
            this.currentContext.delete(sessionId);
            if (!this.config.enableRLS) {
                return;
            }
            const prisma = database_1.databaseService.getPrisma();
            await prisma.$executeRaw `SELECT security.clear_user_context()`;
            logger_1.logger.debug('User context cleared for session', { sessionId });
        }
        catch (error) {
            logger_1.logger.error('Failed to clear user context:', error);
            throw error;
        }
    }
    async validateStoreAccess(userId, storeId, operation = 'read') {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT security.has_store_access(${storeId}::UUID) as has_access
      `;
            const hasAccess = result[0]?.has_access || false;
            if (hasAccess && operation === 'write') {
                const modifyResult = await prisma.$queryRaw `
          SELECT security.can_modify_store_data(${storeId}::UUID) as can_modify
        `;
                return modifyResult[0]?.can_modify || false;
            }
            return hasAccess;
        }
        catch (error) {
            logger_1.logger.error('Failed to validate store access:', error);
            return false;
        }
    }
    async getUserAccessibleStores(userId, role) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            let query;
            switch (role) {
                case 'OWNER':
                    query = prisma.$queryRaw `
            SELECT id::TEXT FROM stores WHERE owner_id = ${userId}::UUID
          `;
                    break;
                case 'ADMIN':
                    query = prisma.$queryRaw `
            SELECT DISTINCT s.id::TEXT 
            FROM stores s
            JOIN store_users su ON s.id = su.store_id
            WHERE su.user_id = ${userId}::UUID AND su.role = 'ADMIN' AND su.is_active = true
          `;
                    break;
                case 'VENDOR':
                    query = prisma.$queryRaw `
            SELECT DISTINCT s.id::TEXT 
            FROM stores s
            JOIN store_users su ON s.id = su.store_id
            WHERE su.user_id = ${userId}::UUID AND su.role = 'VENDOR' AND su.is_active = true
          `;
                    break;
                case 'CUSTOMER':
                    query = prisma.$queryRaw `
            SELECT id::TEXT FROM stores WHERE status = 'ACTIVE'
          `;
                    break;
                default:
                    return [];
            }
            const result = await query;
            return result.map(row => row.id);
        }
        catch (error) {
            logger_1.logger.error('Failed to get user accessible stores:', error);
            return [];
        }
    }
    async assignUserToStore(storeId, userId, role, assignedBy, permissions = {}) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            await prisma.$executeRaw `
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
            logger_1.logger.info('User assigned to store', {
                storeId,
                userId,
                role,
                assignedBy,
                permissions
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to assign user to store:', error);
            throw error;
        }
    }
    async removeUserFromStore(storeId, userId) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            await prisma.$executeRaw `
        UPDATE store_users 
        SET is_active = false 
        WHERE store_id = ${storeId}::UUID AND user_id = ${userId}::UUID
      `;
            logger_1.logger.info('User removed from store', { storeId, userId });
        }
        catch (error) {
            logger_1.logger.error('Failed to remove user from store:', error);
            throw error;
        }
    }
    async validateRLSPolicies() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT * FROM security.rls_monitoring
      `;
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to validate RLS policies:', error);
            return [];
        }
    }
    async testRLSIsolation(testUserId, testUserRole, testStoreId) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT * FROM security.test_rls_isolation(
          ${testUserId}::UUID,
          ${testUserRole}::TEXT,
          ${testStoreId}::UUID
        )
      `;
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to test RLS isolation:', error);
            return [];
        }
    }
    async getRLSViolations(limit = 100, storeId, userId) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            let query = `
        SELECT 
          id, user_id, user_role, store_id, table_name, operation,
          attempted_at, ip_address, session_info
        FROM security.rls_violations
        WHERE 1=1
      `;
            const params = [];
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
            const result = await prisma.$queryRawUnsafe(query, ...params);
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to get RLS violations:', error);
            return [];
        }
    }
    async getTenantStats() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const storeStats = await prisma.$queryRaw `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'ACTIVE') as active
        FROM stores
      `;
            const userStats = await prisma.$queryRaw `
        SELECT role, COUNT(*) as count
        FROM users
        GROUP BY role
      `;
            const violationStats = await prisma.$queryRaw `
        SELECT 
          COUNT(*) as count,
          MAX(attempted_at) as last_violation
        FROM security.rls_violations
        WHERE attempted_at > NOW() - INTERVAL '30 days'
      `;
            const usersByRole = userStats.reduce((acc, stat) => {
                acc[stat.role] = Number(stat.count);
                return acc;
            }, {});
            return {
                totalStores: Number(storeStats[0]?.total || 0),
                activeStores: Number(storeStats[0]?.active || 0),
                totalUsers: Object.values(usersByRole).reduce((sum, count) => sum + count, 0),
                usersByRole,
                violationCount: Number(violationStats[0]?.count || 0),
                lastViolation: violationStats[0]?.last_violation || null
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get tenant statistics:', error);
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
    async healthCheck() {
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
        }
        catch (error) {
            logger_1.logger.error('Multi-tenant security health check failed:', error);
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
    getCurrentContext(sessionId) {
        return this.currentContext.get(sessionId) || null;
    }
    getConfiguration() {
        return { ...this.config };
    }
}
exports.MultiTenantSecurityService = MultiTenantSecurityService;
exports.multiTenantSecurityService = MultiTenantSecurityService.getInstance();
//# sourceMappingURL=MultiTenantSecurityService.js.map
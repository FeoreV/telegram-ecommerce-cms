import { PrismaClient } from '@prisma/client';
import { databaseService } from '../lib/database';
import { multiTenantSecurityService } from '../services/MultiTenantSecurityService';
import { logger, toLogMetadata } from '../utils/logger';

export interface TenantContext {
  userId: string;
  role: string;
  storeId?: string;
  sessionId: string;
}

export interface QueryOptions {
  includeDeleted?: boolean;
  orderBy?: Record<string, 'asc' | 'desc'>;
  skip?: number;
  take?: number;
  select?: Record<string, boolean>;
  include?: Record<string, any>;
}

export interface TenantScopedOptions extends QueryOptions {
  bypassRLS?: boolean; // Only for system operations
  auditOperation?: string;
}

/**
 * Base repository class with tenant scoping and RLS enforcement
 */
export abstract class TenantScopedRepository<T = any> {
  protected prisma: PrismaClient;
  protected tableName: string;
  protected tenantField: string;

  constructor(tableName: string, tenantField: string = 'store_id') {
    this.prisma = databaseService.getPrisma();
    this.tableName = tableName;
    this.tenantField = tenantField;
  }

  /**
   * Set tenant context for the current operation
   */
  protected async setTenantContext(context: TenantContext): Promise<void> {
    try {
      await multiTenantSecurityService.setUserContext(context.sessionId, {
        userId: context.userId,
        role: context.role as any,
        storeId: context.storeId
      });
    } catch (error) {
      logger.error('Failed to set tenant context:', toLogMetadata(error));
      throw error;
    }
  }

  /**
   * Validate tenant access for the operation
   */
  protected async validateTenantAccess(
    storeId: string,
    userId: string,
    operation: 'read' | 'write' = 'read'
  ): Promise<boolean> {
    try {
      return await multiTenantSecurityService.validateStoreAccess(userId, storeId, operation);
    } catch (error) {
      logger.error('Failed to validate tenant access:', toLogMetadata(error));
      return false;
    }
  }

  /**
   * Build tenant-scoped where clause
   */
  protected buildTenantWhereClause(
    storeId: string,
    additionalWhere: Record<string, any> = {}
  ): Record<string, any> {
    return {
      [this.tenantField]: storeId,
      ...additionalWhere
    };
  }

  /**
   * Log repository operation for audit
   */
  protected logOperation(
    operation: string,
    context: TenantContext,
    recordId?: string,
    metadata?: Record<string, any>
  ): void {
    logger.info(`Repository operation: ${this.tableName}.${operation}`, {
      userId: context.userId,
      role: context.role,
      storeId: context.storeId,
      recordId,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Find many records with tenant scoping
   */
  async findMany(
    context: TenantContext,
    where: Record<string, any> = {},
    options: TenantScopedOptions = {}
  ): Promise<T[]> {
    try {
      // Set tenant context
      await this.setTenantContext(context);

      // Build tenant-scoped where clause
      const tenantWhere = context.storeId
        ? this.buildTenantWhereClause(context.storeId, where)
        : where;

      // Validate access if store ID is specified
      if (context.storeId) {
        const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'read');
        if (!hasAccess) {
          throw new Error(`Access denied to store ${context.storeId}`);
        }
      }

      // Execute query with RLS protection
      const result = await (this.prisma as any)[this.tableName].findMany({
        where: tenantWhere,
        orderBy: options.orderBy,
        skip: options.skip,
        take: options.take,
        select: options.select,
        include: options.include
      });

      this.logOperation('findMany', context, undefined, {
        whereClause: tenantWhere,
        resultCount: result.length
      });

      return result;

    } catch (error) {
      logger.error(`Failed to find many ${this.tableName}:`, toLogMetadata(error));
      throw error;
    }
  }

  /**
   * Find unique record with tenant scoping
   */
  async findUnique(
    context: TenantContext,
    where: Record<string, any>,
    options: TenantScopedOptions = {}
  ): Promise<T | null> {
    try {
      // Set tenant context
      await this.setTenantContext(context);

      // Build tenant-scoped where clause
      const tenantWhere = context.storeId
        ? this.buildTenantWhereClause(context.storeId, where)
        : where;

      // Validate access if store ID is specified
      if (context.storeId) {
        const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'read');
        if (!hasAccess) {
          throw new Error(`Access denied to store ${context.storeId}`);
        }
      }

      // Execute query with RLS protection
      const result = await (this.prisma as any)[this.tableName].findUnique({
        where: tenantWhere,
        select: options.select,
        include: options.include
      });

      this.logOperation('findUnique', context, result?.id, {
        whereClause: tenantWhere,
        found: !!result
      });

      return result;

    } catch (error) {
      logger.error(`Failed to find unique ${this.tableName}:`, toLogMetadata(error));
      throw error;
    }
  }

  /**
   * Create record with tenant scoping
   */
  async create(
    context: TenantContext,
    data: Record<string, any>,
    options: TenantScopedOptions = {}
  ): Promise<T> {
    try {
      // Set tenant context
      await this.setTenantContext(context);

      // Ensure tenant field is set
      if (context.storeId && !data[this.tenantField]) {
        data[this.tenantField] = context.storeId;
      }

      // Validate write access
      if (context.storeId) {
        const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'write');
        if (!hasAccess) {
          throw new Error(`Write access denied to store ${context.storeId}`);
        }
      }

      // Execute create with RLS protection
      const result = await (this.prisma as any)[this.tableName].create({
        data,
        select: options.select,
        include: options.include
      });

      this.logOperation('create', context, result.id, {
        data: this.sanitizeLogData(data)
      });

      return result;

    } catch (error) {
      logger.error(`Failed to create ${this.tableName}:`, toLogMetadata(error));
      throw error;
    }
  }

  /**
   * Update record with tenant scoping
   */
  async update(
    context: TenantContext,
    where: Record<string, any>,
    data: Record<string, any>,
    options: TenantScopedOptions = {}
  ): Promise<T> {
    try {
      // Set tenant context
      await this.setTenantContext(context);

      // Build tenant-scoped where clause
      const tenantWhere = context.storeId
        ? this.buildTenantWhereClause(context.storeId, where)
        : where;

      // Validate write access
      if (context.storeId) {
        const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'write');
        if (!hasAccess) {
          throw new Error(`Write access denied to store ${context.storeId}`);
        }
      }

      // Execute update with RLS protection
      const result = await (this.prisma as any)[this.tableName].update({
        where: tenantWhere,
        data,
        select: options.select,
        include: options.include
      });

      this.logOperation('update', context, result.id, {
        whereClause: tenantWhere,
        data: this.sanitizeLogData(data)
      });

      return result;

    } catch (error) {
      logger.error(`Failed to update ${this.tableName}:`, toLogMetadata(error));
      throw error;
    }
  }

  /**
   * Delete record with tenant scoping
   */
  async delete(
    context: TenantContext,
    where: Record<string, any>,
    options: TenantScopedOptions = {}
  ): Promise<T> {
    try {
      // Set tenant context
      await this.setTenantContext(context);

      // Build tenant-scoped where clause
      const tenantWhere = context.storeId
        ? this.buildTenantWhereClause(context.storeId, where)
        : where;

      // Validate write access
      if (context.storeId) {
        const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'write');
        if (!hasAccess) {
          throw new Error(`Write access denied to store ${context.storeId}`);
        }
      }

      // Execute delete with RLS protection
      const result = await (this.prisma as any)[this.tableName].delete({
        where: tenantWhere,
        select: options.select,
        include: options.include
      });

      this.logOperation('delete', context, result.id, {
        whereClause: tenantWhere
      });

      return result;

    } catch (error) {
      logger.error(`Failed to delete ${this.tableName}:`, toLogMetadata(error));
      throw error;
    }
  }

  /**
   * Count records with tenant scoping
   */
  async count(
    context: TenantContext,
    where: Record<string, any> = {}
  ): Promise<number> {
    try {
      // Set tenant context
      await this.setTenantContext(context);

      // Build tenant-scoped where clause
      const tenantWhere = context.storeId
        ? this.buildTenantWhereClause(context.storeId, where)
        : where;

      // Validate access if store ID is specified
      if (context.storeId) {
        const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'read');
        if (!hasAccess) {
          throw new Error(`Access denied to store ${context.storeId}`);
        }
      }

      // Execute count with RLS protection
      const result = await (this.prisma as any)[this.tableName].count({
        where: tenantWhere
      });

      this.logOperation('count', context, undefined, {
        whereClause: tenantWhere,
        count: result
      });

      return result;

    } catch (error) {
      logger.error(`Failed to count ${this.tableName}:`, toLogMetadata(error));
      throw error;
    }
  }

  /**
   * Execute raw query with tenant context
   */
  async executeRaw(
    context: TenantContext,
    query: string,
    params: any[] = []
  ): Promise<any> {
    try {
      // Set tenant context
      await this.setTenantContext(context);

      // Execute raw query (RLS will be enforced at DB level)
      const result = await this.prisma.$queryRawUnsafe(query, ...params);

      this.logOperation('executeRaw', context, undefined, {
        query: this.sanitizeQuery(query),
        paramCount: params.length
      });

      return result;

    } catch (error) {
      logger.error(`Failed to execute raw query on ${this.tableName}:`, toLogMetadata(error));
      throw error;
    }
  }

  /**
   * Batch operations with tenant scoping
   */
  async batchOperation(
    context: TenantContext,
    operations: Array<{
      operation: 'create' | 'update' | 'delete';
      where?: Record<string, any>;
      data?: Record<string, any>;
    }>
  ): Promise<any[]> {
    try {
      // Set tenant context
      await this.setTenantContext(context);

      // Validate write access
      if (context.storeId) {
        const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'write');
        if (!hasAccess) {
          throw new Error(`Write access denied to store ${context.storeId}`);
        }
      }

      // Execute batch in transaction
      const results = await this.prisma.$transaction(
        operations.map(op => {
          const tenantWhere = context.storeId && op.where
            ? this.buildTenantWhereClause(context.storeId, op.where)
            : op.where;

          const tenantData = context.storeId && op.data && !op.data[this.tenantField]
            ? { ...op.data, [this.tenantField]: context.storeId }
            : op.data;

          switch (op.operation) {
            case 'create':
              return (this.prisma as any)[this.tableName].create({ data: tenantData });
            case 'update':
              return (this.prisma as any)[this.tableName].update({ where: tenantWhere, data: tenantData });
            case 'delete':
              return (this.prisma as any)[this.tableName].delete({ where: tenantWhere });
            default:
              throw new Error(`Unsupported batch operation: ${op.operation}`);
          }
        })
      );

      this.logOperation('batchOperation', context, undefined, {
        operationCount: operations.length,
        operations: operations.map(op => op.operation)
      });

      return results;

    } catch (error) {
      logger.error(`Failed to execute batch operation on ${this.tableName}:`, toLogMetadata(error));
      throw error;
    }
  }

  /**
   * Sanitize data for logging (remove sensitive fields)
   */
  protected sanitizeLogData(data: Record<string, any>): Record<string, any> {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'email', 'phone'];
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize SQL query for logging
   */
  protected sanitizeQuery(query: string): string {
    // Remove potential sensitive data from query
    return query.replace(/'[^']*'/g, "'[REDACTED]'").substring(0, 200);
  }

  /**
   * Get table statistics for tenant
   */
  async getTableStats(context: TenantContext): Promise<{
    totalRecords: number;
    tenantRecords: number;
    lastModified: Date | null;
  }> {
    try {
      // Set tenant context
      await this.setTenantContext(context);

      // Get total records (system-wide)
      const totalRecords = await (this.prisma as any)[this.tableName].count();

      // Get tenant-specific records
      const tenantRecords = context.storeId
        ? await this.count(context, {})
        : totalRecords;

      // Get last modified date for tenant
      const lastRecord = context.storeId
        ? await (this.prisma as any)[this.tableName].findFirst({
            where: { [this.tenantField]: context.storeId },
            orderBy: { updated_at: 'desc' },
            select: { updated_at: true }
          })
        : await (this.prisma as any)[this.tableName].findFirst({
            orderBy: { updated_at: 'desc' },
            select: { updated_at: true }
          });

      return {
        totalRecords,
        tenantRecords,
        lastModified: lastRecord?.updated_at || null
      };

    } catch (error) {
      logger.error(`Failed to get table stats for ${this.tableName}:`, toLogMetadata(error));
      return {
        totalRecords: 0,
        tenantRecords: 0,
        lastModified: null
      };
    }
  }
}

/**
 * Store-scoped repository
 */
export class StoreRepository extends TenantScopedRepository {
  constructor() {
    super('stores', 'owner_id'); // Stores are scoped by owner_id
  }

  async findByOwner(context: TenantContext): Promise<any[]> {
    return this.findMany(context, { owner_id: context.userId });
  }

  async findActiveStores(context: TenantContext): Promise<any[]> {
    return this.findMany(context, { status: 'ACTIVE' });
  }
}

/**
 * Product-scoped repository
 */
export class ProductRepository extends TenantScopedRepository {
  constructor() {
    super('products', 'store_id');
  }

  async findByCategory(context: TenantContext, categoryId: string): Promise<any[]> {
    return this.findMany(context, { category_id: categoryId });
  }

  async findInStock(context: TenantContext): Promise<any[]> {
    return this.findMany(context, { stock_quantity: { gt: 0 } });
  }
}

/**
 * Order-scoped repository
 */
export class OrderRepository extends TenantScopedRepository {
  constructor() {
    super('orders', 'store_id');
  }

  async findByCustomer(context: TenantContext, customerId: string): Promise<any[]> {
    return this.findMany(context, { customer_id: customerId });
  }

  async findByStatus(context: TenantContext, status: string): Promise<any[]> {
    return this.findMany(context, { status });
  }

  async findPendingOrders(context: TenantContext): Promise<any[]> {
    return this.findMany(context, { status: 'PENDING_ADMIN' });
  }
}

// Export repository instances
export const storeRepository = new StoreRepository();
export const productRepository = new ProductRepository();
export const orderRepository = new OrderRepository();

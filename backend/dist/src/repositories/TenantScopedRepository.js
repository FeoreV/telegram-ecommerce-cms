"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRepository = exports.productRepository = exports.storeRepository = exports.OrderRepository = exports.ProductRepository = exports.StoreRepository = exports.TenantScopedRepository = void 0;
const database_1 = require("../lib/database");
const MultiTenantSecurityService_1 = require("../services/MultiTenantSecurityService");
const logger_1 = require("../utils/logger");
class TenantScopedRepository {
    constructor(tableName, tenantField = 'store_id') {
        this.prisma = database_1.databaseService.getPrisma();
        this.tableName = tableName;
        this.tenantField = tenantField;
    }
    async setTenantContext(context) {
        try {
            await MultiTenantSecurityService_1.multiTenantSecurityService.setUserContext(context.sessionId, {
                userId: context.userId,
                role: context.role,
                storeId: context.storeId
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to set tenant context:', error);
            throw error;
        }
    }
    async validateTenantAccess(storeId, userId, operation = 'read') {
        try {
            return await MultiTenantSecurityService_1.multiTenantSecurityService.validateStoreAccess(userId, storeId, operation);
        }
        catch (error) {
            logger_1.logger.error('Failed to validate tenant access:', error);
            return false;
        }
    }
    buildTenantWhereClause(storeId, additionalWhere = {}) {
        return {
            [this.tenantField]: storeId,
            ...additionalWhere
        };
    }
    logOperation(operation, context, recordId, metadata) {
        logger_1.logger.info(`Repository operation: ${this.tableName}.${operation}`, {
            userId: context.userId,
            role: context.role,
            storeId: context.storeId,
            recordId,
            metadata,
            timestamp: new Date().toISOString()
        });
    }
    async findMany(context, where = {}, options = {}) {
        try {
            await this.setTenantContext(context);
            const tenantWhere = context.storeId
                ? this.buildTenantWhereClause(context.storeId, where)
                : where;
            if (context.storeId) {
                const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'read');
                if (!hasAccess) {
                    throw new Error(`Access denied to store ${context.storeId}`);
                }
            }
            const result = await this.prisma[this.tableName].findMany({
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
        }
        catch (error) {
            logger_1.logger.error(`Failed to find many ${this.tableName}:`, error);
            throw error;
        }
    }
    async findUnique(context, where, options = {}) {
        try {
            await this.setTenantContext(context);
            const tenantWhere = context.storeId
                ? this.buildTenantWhereClause(context.storeId, where)
                : where;
            if (context.storeId) {
                const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'read');
                if (!hasAccess) {
                    throw new Error(`Access denied to store ${context.storeId}`);
                }
            }
            const result = await this.prisma[this.tableName].findUnique({
                where: tenantWhere,
                select: options.select,
                include: options.include
            });
            this.logOperation('findUnique', context, result?.id, {
                whereClause: tenantWhere,
                found: !!result
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Failed to find unique ${this.tableName}:`, error);
            throw error;
        }
    }
    async create(context, data, options = {}) {
        try {
            await this.setTenantContext(context);
            if (context.storeId && !data[this.tenantField]) {
                data[this.tenantField] = context.storeId;
            }
            if (context.storeId) {
                const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'write');
                if (!hasAccess) {
                    throw new Error(`Write access denied to store ${context.storeId}`);
                }
            }
            const result = await this.prisma[this.tableName].create({
                data,
                select: options.select,
                include: options.include
            });
            this.logOperation('create', context, result.id, {
                data: this.sanitizeLogData(data)
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Failed to create ${this.tableName}:`, error);
            throw error;
        }
    }
    async update(context, where, data, options = {}) {
        try {
            await this.setTenantContext(context);
            const tenantWhere = context.storeId
                ? this.buildTenantWhereClause(context.storeId, where)
                : where;
            if (context.storeId) {
                const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'write');
                if (!hasAccess) {
                    throw new Error(`Write access denied to store ${context.storeId}`);
                }
            }
            const result = await this.prisma[this.tableName].update({
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
        }
        catch (error) {
            logger_1.logger.error(`Failed to update ${this.tableName}:`, error);
            throw error;
        }
    }
    async delete(context, where, options = {}) {
        try {
            await this.setTenantContext(context);
            const tenantWhere = context.storeId
                ? this.buildTenantWhereClause(context.storeId, where)
                : where;
            if (context.storeId) {
                const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'write');
                if (!hasAccess) {
                    throw new Error(`Write access denied to store ${context.storeId}`);
                }
            }
            const result = await this.prisma[this.tableName].delete({
                where: tenantWhere,
                select: options.select,
                include: options.include
            });
            this.logOperation('delete', context, result.id, {
                whereClause: tenantWhere
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Failed to delete ${this.tableName}:`, error);
            throw error;
        }
    }
    async count(context, where = {}) {
        try {
            await this.setTenantContext(context);
            const tenantWhere = context.storeId
                ? this.buildTenantWhereClause(context.storeId, where)
                : where;
            if (context.storeId) {
                const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'read');
                if (!hasAccess) {
                    throw new Error(`Access denied to store ${context.storeId}`);
                }
            }
            const result = await this.prisma[this.tableName].count({
                where: tenantWhere
            });
            this.logOperation('count', context, undefined, {
                whereClause: tenantWhere,
                count: result
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Failed to count ${this.tableName}:`, error);
            throw error;
        }
    }
    async executeRaw(context, query, params = []) {
        try {
            await this.setTenantContext(context);
            const result = await this.prisma.$queryRawUnsafe(query, ...params);
            this.logOperation('executeRaw', context, undefined, {
                query: this.sanitizeQuery(query),
                paramCount: params.length
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Failed to execute raw query on ${this.tableName}:`, error);
            throw error;
        }
    }
    async batchOperation(context, operations) {
        try {
            await this.setTenantContext(context);
            if (context.storeId) {
                const hasAccess = await this.validateTenantAccess(context.storeId, context.userId, 'write');
                if (!hasAccess) {
                    throw new Error(`Write access denied to store ${context.storeId}`);
                }
            }
            const results = await this.prisma.$transaction(operations.map(op => {
                const tenantWhere = context.storeId && op.where
                    ? this.buildTenantWhereClause(context.storeId, op.where)
                    : op.where;
                const tenantData = context.storeId && op.data && !op.data[this.tenantField]
                    ? { ...op.data, [this.tenantField]: context.storeId }
                    : op.data;
                switch (op.operation) {
                    case 'create':
                        return this.prisma[this.tableName].create({ data: tenantData });
                    case 'update':
                        return this.prisma[this.tableName].update({ where: tenantWhere, data: tenantData });
                    case 'delete':
                        return this.prisma[this.tableName].delete({ where: tenantWhere });
                    default:
                        throw new Error(`Unsupported batch operation: ${op.operation}`);
                }
            }));
            this.logOperation('batchOperation', context, undefined, {
                operationCount: operations.length,
                operations: operations.map(op => op.operation)
            });
            return results;
        }
        catch (error) {
            logger_1.logger.error(`Failed to execute batch operation on ${this.tableName}:`, error);
            throw error;
        }
    }
    sanitizeLogData(data) {
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'email', 'phone'];
        const sanitized = { ...data };
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    }
    sanitizeQuery(query) {
        return query.replace(/'[^']*'/g, "'[REDACTED]'").substring(0, 200);
    }
    async getTableStats(context) {
        try {
            await this.setTenantContext(context);
            const totalRecords = await this.prisma[this.tableName].count();
            const tenantRecords = context.storeId
                ? await this.count(context, {})
                : totalRecords;
            const lastRecord = context.storeId
                ? await this.prisma[this.tableName].findFirst({
                    where: { [this.tenantField]: context.storeId },
                    orderBy: { updated_at: 'desc' },
                    select: { updated_at: true }
                })
                : await this.prisma[this.tableName].findFirst({
                    orderBy: { updated_at: 'desc' },
                    select: { updated_at: true }
                });
            return {
                totalRecords,
                tenantRecords,
                lastModified: lastRecord?.updated_at || null
            };
        }
        catch (error) {
            logger_1.logger.error(`Failed to get table stats for ${this.tableName}:`, error);
            return {
                totalRecords: 0,
                tenantRecords: 0,
                lastModified: null
            };
        }
    }
}
exports.TenantScopedRepository = TenantScopedRepository;
class StoreRepository extends TenantScopedRepository {
    constructor() {
        super('stores', 'owner_id');
    }
    async findByOwner(context) {
        return this.findMany(context, { owner_id: context.userId });
    }
    async findActiveStores(context) {
        return this.findMany(context, { status: 'ACTIVE' });
    }
}
exports.StoreRepository = StoreRepository;
class ProductRepository extends TenantScopedRepository {
    constructor() {
        super('products', 'store_id');
    }
    async findByCategory(context, categoryId) {
        return this.findMany(context, { category_id: categoryId });
    }
    async findInStock(context) {
        return this.findMany(context, { stock_quantity: { gt: 0 } });
    }
}
exports.ProductRepository = ProductRepository;
class OrderRepository extends TenantScopedRepository {
    constructor() {
        super('orders', 'store_id');
    }
    async findByCustomer(context, customerId) {
        return this.findMany(context, { customer_id: customerId });
    }
    async findByStatus(context, status) {
        return this.findMany(context, { status });
    }
    async findPendingOrders(context) {
        return this.findMany(context, { status: 'PENDING_ADMIN' });
    }
}
exports.OrderRepository = OrderRepository;
exports.storeRepository = new StoreRepository();
exports.productRepository = new ProductRepository();
exports.orderRepository = new OrderRepository();
//# sourceMappingURL=TenantScopedRepository.js.map
import { PrismaClient } from '@prisma/client';
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
    bypassRLS?: boolean;
    auditOperation?: string;
}
export declare abstract class TenantScopedRepository<T = any> {
    protected prisma: PrismaClient;
    protected tableName: string;
    protected tenantField: string;
    constructor(tableName: string, tenantField?: string);
    protected setTenantContext(context: TenantContext): Promise<void>;
    protected validateTenantAccess(storeId: string, userId: string, operation?: 'read' | 'write'): Promise<boolean>;
    protected buildTenantWhereClause(storeId: string, additionalWhere?: Record<string, any>): Record<string, any>;
    protected logOperation(operation: string, context: TenantContext, recordId?: string, metadata?: Record<string, any>): void;
    findMany(context: TenantContext, where?: Record<string, any>, options?: TenantScopedOptions): Promise<T[]>;
    findUnique(context: TenantContext, where: Record<string, any>, options?: TenantScopedOptions): Promise<T | null>;
    create(context: TenantContext, data: Record<string, any>, options?: TenantScopedOptions): Promise<T>;
    update(context: TenantContext, where: Record<string, any>, data: Record<string, any>, options?: TenantScopedOptions): Promise<T>;
    delete(context: TenantContext, where: Record<string, any>, options?: TenantScopedOptions): Promise<T>;
    count(context: TenantContext, where?: Record<string, any>): Promise<number>;
    executeRaw(context: TenantContext, query: string, params?: any[]): Promise<any>;
    batchOperation(context: TenantContext, operations: Array<{
        operation: 'create' | 'update' | 'delete';
        where?: Record<string, any>;
        data?: Record<string, any>;
    }>): Promise<any[]>;
    protected sanitizeLogData(data: Record<string, any>): Record<string, any>;
    protected sanitizeQuery(query: string): string;
    getTableStats(context: TenantContext): Promise<{
        totalRecords: number;
        tenantRecords: number;
        lastModified: Date | null;
    }>;
}
export declare class StoreRepository extends TenantScopedRepository {
    constructor();
    findByOwner(context: TenantContext): Promise<any[]>;
    findActiveStores(context: TenantContext): Promise<any[]>;
}
export declare class ProductRepository extends TenantScopedRepository {
    constructor();
    findByCategory(context: TenantContext, categoryId: string): Promise<any[]>;
    findInStock(context: TenantContext): Promise<any[]>;
}
export declare class OrderRepository extends TenantScopedRepository {
    constructor();
    findByCustomer(context: TenantContext, customerId: string): Promise<any[]>;
    findByStatus(context: TenantContext, status: string): Promise<any[]>;
    findPendingOrders(context: TenantContext): Promise<any[]>;
}
export declare const storeRepository: StoreRepository;
export declare const productRepository: ProductRepository;
export declare const orderRepository: OrderRepository;
//# sourceMappingURL=TenantScopedRepository.d.ts.map
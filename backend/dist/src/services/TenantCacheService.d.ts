export interface CacheOptions {
    ttl?: number;
    namespace?: string;
    compression?: boolean;
    encryption?: boolean;
}
export interface TenantCacheConfig {
    enabled: boolean;
    defaultTTL: number;
    maxKeyLength: number;
    compressionThreshold: number;
    encryptionEnabled: boolean;
    namespacePrefix: string;
}
export declare class TenantCacheService {
    private static instance;
    private config;
    private constructor();
    static getInstance(): TenantCacheService;
    private generateKey;
    private validateKeyComponents;
    set<T>(storeId: string, key: string, value: T, options?: CacheOptions): Promise<void>;
    setIfNotExists<T>(storeId: string, key: string, value: T, options?: CacheOptions): Promise<boolean>;
    get<T>(storeId: string, key: string, options?: CacheOptions): Promise<T | null>;
    delete(storeId: string, key: string, options?: CacheOptions): Promise<void>;
    exists(storeId: string, key: string, options?: CacheOptions): Promise<boolean>;
    ttl(storeId: string, key: string, options?: CacheOptions): Promise<number>;
    expire(storeId: string, key: string, ttl: number, options?: CacheOptions): Promise<void>;
    mget<T>(storeId: string, keys: string[], options?: CacheOptions): Promise<(T | null)[]>;
    clearTenant(storeId: string): Promise<number>;
    getTenantStats(storeId: string): Promise<{
        totalKeys: number;
        memoryUsage: number;
        hitRate: number;
        namespaces: string[];
    }>;
    getOrSet<T>(storeId: string, key: string, callback: () => Promise<T>, options?: CacheOptions): Promise<T>;
    healthCheck(): Promise<{
        status: string;
        enabled: boolean;
        redisConnected: boolean;
        config: TenantCacheConfig;
    }>;
    getConfiguration(): TenantCacheConfig;
}
export declare const tenantCacheService: TenantCacheService;
//# sourceMappingURL=TenantCacheService.d.ts.map
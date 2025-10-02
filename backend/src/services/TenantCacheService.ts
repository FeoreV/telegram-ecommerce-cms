import { redisService } from '../lib/redis';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import * as zlib from 'zlib';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
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

export class TenantCacheService {
  private static instance: TenantCacheService;
  private config: TenantCacheConfig;

  private constructor() {
    this.config = {
      enabled: process.env.TENANT_CACHE_ENABLED !== 'false',
      defaultTTL: parseInt(process.env.TENANT_CACHE_TTL || '3600'), // 1 hour
      maxKeyLength: parseInt(process.env.TENANT_CACHE_MAX_KEY_LENGTH || '250'),
      compressionThreshold: parseInt(process.env.TENANT_CACHE_COMPRESSION_THRESHOLD || '1024'), // 1KB
      encryptionEnabled: process.env.TENANT_CACHE_ENCRYPTION === 'true',
      namespacePrefix: process.env.TENANT_CACHE_PREFIX || 'tenant'
    };
  }

  public static getInstance(): TenantCacheService {
    if (!TenantCacheService.instance) {
      TenantCacheService.instance = new TenantCacheService();
    }
    return TenantCacheService.instance;
  }

  /**
   * Generate tenant-namespaced cache key
   */
  private generateKey(
    storeId: string,
    key: string,
    namespace?: string
  ): string {
    const baseNamespace = namespace || 'default';
    const tenantKey = `${this.config.namespacePrefix}:${storeId}:${baseNamespace}:${key}`;
    
    if (tenantKey.length > this.config.maxKeyLength) {
      // Hash long keys to prevent Redis key length issues
      const hash = crypto.createHash('sha256').update(tenantKey).digest('hex').substring(0, 16);
      return `${this.config.namespacePrefix}:${storeId}:hashed:${hash}`;
    }
    
    return tenantKey;
  }

  /**
   * Validate cache key components
   */
  private validateKeyComponents(storeId: string, key: string): void {
    if (!storeId || typeof storeId !== 'string') {
      throw new Error('Store ID is required and must be a string');
    }
    
    if (!key || typeof key !== 'string') {
      throw new Error('Cache key is required and must be a string');
    }
    
    if (storeId.includes(':') || key.includes(':')) {
      throw new Error('Store ID and key cannot contain colon characters');
    }
  }

  /**
   * Set cache value with tenant scoping
   */
  async set<T>(
    storeId: string,
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      if (!this.config.enabled) {
        return;
      }

      this.validateKeyComponents(storeId, key);
      
      let cacheKey = this.generateKey(storeId, key, options.namespace);
      const ttl = options.ttl || this.config.defaultTTL;
      
      // Serialize value
      let serializedValue = JSON.stringify(value);
      
      // Compress if value is large
      if (options.compression || serializedValue.length > this.config.compressionThreshold) {
        serializedValue = zlib.gzipSync(serializedValue).toString('base64');
        cacheKey += ':compressed';
      }
      
      // Encrypt if enabled
      if (options.encryption || this.config.encryptionEnabled) {
        // Use Redis secure set method if available
        await redisService.setSecure(cacheKey, serializedValue, ttl);
      } else {
        const redis = redisService.getClient();
        await redis.setex(cacheKey, ttl, serializedValue);
      }
      
      logger.debug('Cache set successful', {
        storeId,
        key,
        cacheKey,
        ttl,
        valueSize: serializedValue.length
      });

    } catch (error) {
      logger.error('Failed to set cache value:', error);
      // Don't throw error to prevent cache failures from breaking application
    }
  }

  /**
   * Set cache value only if key doesn't exist
   */
  async setIfNotExists<T>(
    storeId: string,
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      if (!this.config.enabled) {
        return false;
      }

      this.validateKeyComponents(storeId, key);
      
      const cacheKey = this.generateKey(storeId, key, options.namespace);
      const ttl = options.ttl || this.config.defaultTTL;
      
      // Serialize value
      let serializedValue = JSON.stringify(value);
      
      // Compress if value is large (but don't modify cacheKey here)
      let finalCacheKey = cacheKey;
      if (options.compression || serializedValue.length > this.config.compressionThreshold) {
        serializedValue = zlib.gzipSync(serializedValue).toString('base64');
        finalCacheKey += ':compressed';
      }
      
      // Use Redis SETNX command for atomic set-if-not-exists
      const redis = redisService.getClient();
      const result = await redis.set(finalCacheKey, serializedValue, 'EX', ttl, 'NX');
      
      const success = result === 'OK';
      
      if (success) {
        logger.debug('Cache setIfNotExists successful', {
          storeId,
          key,
          cacheKey: finalCacheKey,
          ttl,
          valueSize: serializedValue.length
        });
      }
      
      return success;

    } catch (error) {
      logger.error('Failed to setIfNotExists cache value:', error);
      return false;
    }
  }

  /**
   * Get cache value with tenant scoping
   */
  async get<T>(
    storeId: string,
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    try {
      if (!this.config.enabled) {
        return null;
      }

      this.validateKeyComponents(storeId, key);
      
      const cacheKey = this.generateKey(storeId, key, options.namespace);
      
      // Try to get value (check both compressed and uncompressed versions)
      let serializedValue: string | null = null;
      let isCompressed = false;
      
      if (options.encryption || this.config.encryptionEnabled) {
        // Try encrypted version first
        serializedValue = await redisService.getSecure<string>(cacheKey);
        
        // Try compressed encrypted version
        if (!serializedValue) {
          serializedValue = await redisService.getSecure<string>(cacheKey + ':compressed');
          isCompressed = !!serializedValue;
        }
      } else {
        const redis = redisService.getClient();
        serializedValue = await redis.get(cacheKey);
        
        // Try compressed version
        if (!serializedValue) {
          serializedValue = await redis.get(cacheKey + ':compressed');
          isCompressed = !!serializedValue;
        }
      }
      
      if (!serializedValue) {
        return null;
      }
      
      // Decompress if needed
      if (isCompressed) {
        const compressedBuffer = Buffer.from(serializedValue, 'base64');
        serializedValue = zlib.gunzipSync(compressedBuffer).toString();
      }
      
      // Parse JSON
      const value = JSON.parse(serializedValue) as T;
      
      logger.debug('Cache get successful', {
        storeId,
        key,
        cacheKey,
        found: true,
        isCompressed
      });
      
      return value;

    } catch (error) {
      logger.error('Failed to get cache value:', error);
      return null;
    }
  }

  /**
   * Delete cache value with tenant scoping
   */
  async delete(
    storeId: string,
    key: string,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      if (!this.config.enabled) {
        return;
      }

      this.validateKeyComponents(storeId, key);
      
      const cacheKey = this.generateKey(storeId, key, options.namespace);
      const redis = redisService.getClient();
      
      // Delete both compressed and uncompressed versions
      await redis.del(cacheKey);
      await redis.del(cacheKey + ':compressed');
      
      logger.debug('Cache delete successful', {
        storeId,
        key,
        cacheKey
      });

    } catch (error) {
      logger.error('Failed to delete cache value:', error);
      // Don't throw error to prevent cache failures from breaking application
    }
  }

  /**
   * Check if cache key exists
   */
  async exists(
    storeId: string,
    key: string,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      if (!this.config.enabled) {
        return false;
      }

      this.validateKeyComponents(storeId, key);
      
      const cacheKey = this.generateKey(storeId, key, options.namespace);
      const redis = redisService.getClient();
      
      const exists = await redis.exists(cacheKey) || await redis.exists(cacheKey + ':compressed');
      return exists > 0;

    } catch (error) {
      logger.error('Failed to check cache existence:', error);
      return false;
    }
  }

  /**
   * Get cache TTL
   */
  async ttl(
    storeId: string,
    key: string,
    options: CacheOptions = {}
  ): Promise<number> {
    try {
      if (!this.config.enabled) {
        return -1;
      }

      this.validateKeyComponents(storeId, key);
      
      const cacheKey = this.generateKey(storeId, key, options.namespace);
      const redis = redisService.getClient();
      
      let ttl = await redis.ttl(cacheKey);
      
      // Check compressed version if main key doesn't exist
      if (ttl === -2) {
        ttl = await redis.ttl(cacheKey + ':compressed');
      }
      
      return ttl;

    } catch (error) {
      logger.error('Failed to get cache TTL:', error);
      return -1;
    }
  }

  /**
   * Set cache expiration
   */
  async expire(
    storeId: string,
    key: string,
    ttl: number,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      if (!this.config.enabled) {
        return;
      }

      this.validateKeyComponents(storeId, key);
      
      const cacheKey = this.generateKey(storeId, key, options.namespace);
      const redis = redisService.getClient();
      
      // Set expiration for both versions
      await redis.expire(cacheKey, ttl);
      await redis.expire(cacheKey + ':compressed', ttl);

    } catch (error) {
      logger.error('Failed to set cache expiration:', error);
    }
  }

  /**
   * Get multiple cache values
   */
  async mget<T>(
    storeId: string,
    keys: string[],
    options: CacheOptions = {}
  ): Promise<(T | null)[]> {
    try {
      if (!this.config.enabled || keys.length === 0) {
        return keys.map(() => null);
      }

      // Validate all keys
      keys.forEach(key => this.validateKeyComponents(storeId, key));
      
      const cacheKeys = keys.map(key => this.generateKey(storeId, key, options.namespace));
      
      const redis = redisService.getClient();
      const values = await redis.mget(...cacheKeys);
      
      // Parse each value
      const results: (T | null)[] = [];
      for (let i = 0; i < values.length; i++) {
        if (values[i]) {
          try {
            results.push(JSON.parse(values[i]) as T);
          } catch (parseError) {
            logger.warn(`Failed to parse cached value for key ${keys[i]}:`, parseError);
            results.push(null);
          }
        } else {
          results.push(null);
        }
      }
      
      return results;

    } catch (error) {
      logger.error('Failed to get multiple cache values:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Clear all cache for a tenant
   */
  async clearTenant(storeId: string): Promise<number> {
    try {
      if (!this.config.enabled) {
        return 0;
      }

      this.validateKeyComponents(storeId, 'dummy');
      
      const pattern = `${this.config.namespacePrefix}:${storeId}:*`;
      const redis = redisService.getClient();
      
      // Get all keys matching pattern
      const keys = await redis.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Delete all keys
      const deletedCount = await redis.del(...keys);
      
      logger.info('Tenant cache cleared', {
        storeId,
        keysDeleted: deletedCount
      });
      
      return deletedCount;

    } catch (error) {
      logger.error('Failed to clear tenant cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics for tenant
   */
  async getTenantStats(storeId: string): Promise<{
    totalKeys: number;
    memoryUsage: number;
    hitRate: number;
    namespaces: string[];
  }> {
    try {
      if (!this.config.enabled) {
        return {
          totalKeys: 0,
          memoryUsage: 0,
          hitRate: 0,
          namespaces: []
        };
      }

      const pattern = `${this.config.namespacePrefix}:${storeId}:*`;
      const redis = redisService.getClient();
      
      // Get all keys for tenant
      const keys = await redis.keys(pattern);
      
      // Calculate memory usage
      let memoryUsage = 0;
      const namespaces = new Set<string>();
      
      for (const key of keys) {
        try {
          const keySize = await redis.memory('usage', key);
          memoryUsage += keySize || 0;
          
          // Extract namespace from key
          const parts = key.split(':');
          if (parts.length >= 3) {
            namespaces.add(parts[2]);
          }
        } catch (error) {
          // Ignore individual key errors
        }
      }
      
      return {
        totalKeys: keys.length,
        memoryUsage,
        hitRate: 0, // Would need additional tracking to calculate hit rate
        namespaces: Array.from(namespaces)
      };

    } catch (error) {
      logger.error('Failed to get tenant cache stats:', error);
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        namespaces: []
      };
    }
  }

  /**
   * Cache with callback pattern (get or set)
   */
  async getOrSet<T>(
    storeId: string,
    key: string,
    callback: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(storeId, key, options);
      if (cached !== null) {
        return cached;
      }
      
      // Execute callback to get fresh value
      const value = await callback();
      
      // Store in cache
      await this.set(storeId, key, value, options);
      
      return value;

    } catch (error) {
      logger.error('Failed to get or set cache value:', error);
      // Fallback to callback execution
      return await callback();
    }
  }

  /**
   * Health check for tenant cache service
   */
  async healthCheck(): Promise<{
    status: string;
    enabled: boolean;
    redisConnected: boolean;
    config: TenantCacheConfig;
  }> {
    try {
      const redisHealth = await redisService.healthCheck();
      
      return {
        status: 'healthy',
        enabled: this.config.enabled,
        redisConnected: redisHealth.status === 'connected',
        config: this.config
      };

    } catch (error) {
      logger.error('Tenant cache health check failed:', error);
      return {
        status: 'error',
        enabled: false,
        redisConnected: false,
        config: this.config
      };
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): TenantCacheConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const tenantCacheService = TenantCacheService.getInstance();

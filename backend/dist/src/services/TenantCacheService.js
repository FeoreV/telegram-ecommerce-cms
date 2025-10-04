"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantCacheService = exports.TenantCacheService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const zlib = __importStar(require("zlib"));
const redis_1 = require("../lib/redis");
const logger_1 = require("../utils/logger");
class TenantCacheService {
    constructor() {
        this.config = {
            enabled: process.env.TENANT_CACHE_ENABLED !== 'false',
            defaultTTL: parseInt(process.env.TENANT_CACHE_TTL || '3600'),
            maxKeyLength: parseInt(process.env.TENANT_CACHE_MAX_KEY_LENGTH || '250'),
            compressionThreshold: parseInt(process.env.TENANT_CACHE_COMPRESSION_THRESHOLD || '1024'),
            encryptionEnabled: process.env.TENANT_CACHE_ENCRYPTION === 'true',
            namespacePrefix: process.env.TENANT_CACHE_PREFIX || 'tenant'
        };
    }
    static getInstance() {
        if (!TenantCacheService.instance) {
            TenantCacheService.instance = new TenantCacheService();
        }
        return TenantCacheService.instance;
    }
    generateKey(storeId, key, namespace) {
        const baseNamespace = namespace || 'default';
        const tenantKey = `${this.config.namespacePrefix}:${storeId}:${baseNamespace}:${key}`;
        if (tenantKey.length > this.config.maxKeyLength) {
            const hash = crypto_1.default.createHash('sha256').update(tenantKey).digest('hex').substring(0, 16);
            return `${this.config.namespacePrefix}:${storeId}:hashed:${hash}`;
        }
        return tenantKey;
    }
    validateKeyComponents(storeId, key) {
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
    async set(storeId, key, value, options = {}) {
        try {
            if (!this.config.enabled) {
                return;
            }
            this.validateKeyComponents(storeId, key);
            let cacheKey = this.generateKey(storeId, key, options.namespace);
            const ttl = options.ttl || this.config.defaultTTL;
            let serializedValue = JSON.stringify(value);
            if (options.compression || serializedValue.length > this.config.compressionThreshold) {
                serializedValue = zlib.gzipSync(serializedValue).toString('base64');
                cacheKey += ':compressed';
            }
            if (options.encryption || this.config.encryptionEnabled) {
                await redis_1.redisService.setSecure(cacheKey, serializedValue, ttl);
            }
            else {
                const redis = redis_1.redisService.getClient();
                await redis.setex(cacheKey, ttl, serializedValue);
            }
            logger_1.logger.debug('Cache set successful', {
                storeId,
                key,
                cacheKey,
                ttl,
                valueSize: serializedValue.length
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to set cache value:', error);
        }
    }
    async setIfNotExists(storeId, key, value, options = {}) {
        try {
            if (!this.config.enabled) {
                return false;
            }
            this.validateKeyComponents(storeId, key);
            const cacheKey = this.generateKey(storeId, key, options.namespace);
            const ttl = options.ttl || this.config.defaultTTL;
            let serializedValue = JSON.stringify(value);
            let finalCacheKey = cacheKey;
            if (options.compression || serializedValue.length > this.config.compressionThreshold) {
                serializedValue = zlib.gzipSync(serializedValue).toString('base64');
                finalCacheKey += ':compressed';
            }
            const redis = redis_1.redisService.getClient();
            const result = await redis.set(finalCacheKey, serializedValue, 'EX', ttl, 'NX');
            const success = result === 'OK';
            if (success) {
                logger_1.logger.debug('Cache setIfNotExists successful', {
                    storeId,
                    key,
                    cacheKey: finalCacheKey,
                    ttl,
                    valueSize: serializedValue.length
                });
            }
            return success;
        }
        catch (error) {
            logger_1.logger.error('Failed to setIfNotExists cache value:', error);
            return false;
        }
    }
    async get(storeId, key, options = {}) {
        try {
            if (!this.config.enabled) {
                return null;
            }
            this.validateKeyComponents(storeId, key);
            const cacheKey = this.generateKey(storeId, key, options.namespace);
            let serializedValue = null;
            let isCompressed = false;
            if (options.encryption || this.config.encryptionEnabled) {
                serializedValue = await redis_1.redisService.getSecure(cacheKey);
                if (!serializedValue) {
                    serializedValue = await redis_1.redisService.getSecure(cacheKey + ':compressed');
                    isCompressed = !!serializedValue;
                }
            }
            else {
                const redis = redis_1.redisService.getClient();
                serializedValue = await redis.get(cacheKey);
                if (!serializedValue) {
                    serializedValue = await redis.get(cacheKey + ':compressed');
                    isCompressed = !!serializedValue;
                }
            }
            if (!serializedValue) {
                return null;
            }
            if (isCompressed) {
                const compressedBuffer = Buffer.from(serializedValue, 'base64');
                serializedValue = zlib.gunzipSync(compressedBuffer).toString();
            }
            const value = JSON.parse(serializedValue);
            logger_1.logger.debug('Cache get successful', {
                storeId,
                key,
                cacheKey,
                found: true,
                isCompressed
            });
            return value;
        }
        catch (error) {
            logger_1.logger.error('Failed to get cache value:', error);
            return null;
        }
    }
    async delete(storeId, key, options = {}) {
        try {
            if (!this.config.enabled) {
                return;
            }
            this.validateKeyComponents(storeId, key);
            const cacheKey = this.generateKey(storeId, key, options.namespace);
            const redis = redis_1.redisService.getClient();
            await redis.del(cacheKey);
            await redis.del(cacheKey + ':compressed');
            logger_1.logger.debug('Cache delete successful', {
                storeId,
                key,
                cacheKey
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to delete cache value:', error);
        }
    }
    async exists(storeId, key, options = {}) {
        try {
            if (!this.config.enabled) {
                return false;
            }
            this.validateKeyComponents(storeId, key);
            const cacheKey = this.generateKey(storeId, key, options.namespace);
            const redis = redis_1.redisService.getClient();
            const exists = await redis.exists(cacheKey) || await redis.exists(cacheKey + ':compressed');
            return exists > 0;
        }
        catch (error) {
            logger_1.logger.error('Failed to check cache existence:', error);
            return false;
        }
    }
    async ttl(storeId, key, options = {}) {
        try {
            if (!this.config.enabled) {
                return -1;
            }
            this.validateKeyComponents(storeId, key);
            const cacheKey = this.generateKey(storeId, key, options.namespace);
            const redis = redis_1.redisService.getClient();
            let ttl = await redis.ttl(cacheKey);
            if (ttl === -2) {
                ttl = await redis.ttl(cacheKey + ':compressed');
            }
            return ttl;
        }
        catch (error) {
            logger_1.logger.error('Failed to get cache TTL:', error);
            return -1;
        }
    }
    async expire(storeId, key, ttl, options = {}) {
        try {
            if (!this.config.enabled) {
                return;
            }
            this.validateKeyComponents(storeId, key);
            const cacheKey = this.generateKey(storeId, key, options.namespace);
            const redis = redis_1.redisService.getClient();
            await redis.expire(cacheKey, ttl);
            await redis.expire(cacheKey + ':compressed', ttl);
        }
        catch (error) {
            logger_1.logger.error('Failed to set cache expiration:', error);
        }
    }
    async mget(storeId, keys, options = {}) {
        try {
            if (!this.config.enabled || keys.length === 0) {
                return keys.map(() => null);
            }
            keys.forEach(key => this.validateKeyComponents(storeId, key));
            const cacheKeys = keys.map(key => this.generateKey(storeId, key, options.namespace));
            const redis = redis_1.redisService.getClient();
            const values = await redis.mget(...cacheKeys);
            const results = [];
            for (let i = 0; i < values.length; i++) {
                if (values[i]) {
                    try {
                        results.push(JSON.parse(values[i]));
                    }
                    catch (parseError) {
                        logger_1.logger.warn(`Failed to parse cached value for key ${keys[i]}:`, parseError);
                        results.push(null);
                    }
                }
                else {
                    results.push(null);
                }
            }
            return results;
        }
        catch (error) {
            logger_1.logger.error('Failed to get multiple cache values:', error);
            return keys.map(() => null);
        }
    }
    async clearTenant(storeId) {
        try {
            if (!this.config.enabled) {
                return 0;
            }
            this.validateKeyComponents(storeId, 'dummy');
            const pattern = `${this.config.namespacePrefix}:${storeId}:*`;
            const redis = redis_1.redisService.getClient();
            const keys = await redis.keys(pattern);
            if (keys.length === 0) {
                return 0;
            }
            const deletedCount = await redis.del(...keys);
            logger_1.logger.info('Tenant cache cleared', {
                storeId,
                keysDeleted: deletedCount
            });
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to clear tenant cache:', error);
            return 0;
        }
    }
    async getTenantStats(storeId) {
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
            const redis = redis_1.redisService.getClient();
            const keys = await redis.keys(pattern);
            let memoryUsage = 0;
            const namespaces = new Set();
            for (const key of keys) {
                try {
                    const keySize = await redis.memory('usage', key);
                    memoryUsage += keySize || 0;
                    const parts = key.split(':');
                    if (parts.length >= 3) {
                        namespaces.add(parts[2]);
                    }
                }
                catch (_error) {
                }
            }
            return {
                totalKeys: keys.length,
                memoryUsage,
                hitRate: 0,
                namespaces: Array.from(namespaces)
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get tenant cache stats:', error);
            return {
                totalKeys: 0,
                memoryUsage: 0,
                hitRate: 0,
                namespaces: []
            };
        }
    }
    async getOrSet(storeId, key, callback, options = {}) {
        try {
            const cached = await this.get(storeId, key, options);
            if (cached !== null) {
                return cached;
            }
            const value = await callback();
            await this.set(storeId, key, value, options);
            return value;
        }
        catch (error) {
            logger_1.logger.error('Failed to get or set cache value:', error);
            return await callback();
        }
    }
    async healthCheck() {
        try {
            const redisHealth = await redis_1.redisService.healthCheck();
            return {
                status: 'healthy',
                enabled: this.config.enabled,
                redisConnected: redisHealth.status === 'connected',
                config: this.config
            };
        }
        catch (error) {
            logger_1.logger.error('Tenant cache health check failed:', error);
            return {
                status: 'error',
                enabled: false,
                redisConnected: false,
                config: this.config
            };
        }
    }
    getConfiguration() {
        return { ...this.config };
    }
}
exports.TenantCacheService = TenantCacheService;
exports.tenantCacheService = TenantCacheService.getInstance();
//# sourceMappingURL=TenantCacheService.js.map
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisSessionStore = exports.RedisSessionStore = void 0;
const logger_1 = require("./logger");
class RedisSessionStore {
    constructor(ttlSeconds = 24 * 60 * 60, prefix = 'bot:sess:') {
        this.client = null;
        this.lastErrorLog = null;
        this.ttlSeconds = ttlSeconds;
        this.prefix = prefix;
    }
    async init(url) {
        try {
            const mod = await Promise.resolve().then(() => __importStar(require('redis')));
            const redis = mod.createClient({
                url,
                socket: {
                    connectTimeout: 5000,
                    reconnectStrategy: (retries) => {
                        if (retries > 3) {
                            logger_1.logger.warn('Redis reconnection failed after 3 attempts, using in-memory fallback');
                            return false;
                        }
                        return Math.min(retries * 100, 3000);
                    }
                }
            });
            redis.on('error', (err) => {
                const isDevelopment = process.env.NODE_ENV === 'development';
                const errorCode = err.code;
                if (isDevelopment && errorCode === 'ECONNREFUSED') {
                    const now = Date.now();
                    if (!this.lastErrorLog ||
                        this.lastErrorLog.code !== errorCode ||
                        now - this.lastErrorLog.timestamp > 300000) {
                        logger_1.logger.warn('Redis unavailable for bot sessions (using in-memory mode). To enable Redis, start Docker: docker-compose up -d redis');
                        this.lastErrorLog = { code: errorCode, timestamp: now };
                    }
                }
                else if (isDevelopment) {
                    logger_1.logger.warn('Bot Redis client error (development mode):', { error: err });
                }
                else {
                    logger_1.logger.error('Bot Redis client error', { error: err });
                }
            });
            await redis.connect();
            this.client = redis;
            logger_1.logger.info('Bot Redis session store connected', {
                prefix: this.prefix,
                ttlSeconds: this.ttlSeconds,
            });
        }
        catch (error) {
            const isDevelopment = process.env.NODE_ENV === 'development';
            if (isDevelopment) {
                logger_1.logger.warn('Failed to initialize bot Redis session store, using in-memory fallback');
            }
            else {
                logger_1.logger.error('Failed to initialize bot Redis session store', { error });
            }
            this.client = null;
            throw error;
        }
    }
    ensureClient() {
        if (!this.client) {
            throw new Error('Bot Redis session store not initialized');
        }
    }
    key(telegramId) {
        return `${this.prefix}${telegramId}`;
    }
    async get(telegramId) {
        if (!this.client) {
            return null;
        }
        try {
            const raw = await this.client.get(this.key(telegramId));
            return raw ? JSON.parse(raw) : null;
        }
        catch (error) {
            logger_1.logger.warn('Bot Redis get session failed', { error, telegramId });
            return null;
        }
    }
    async set(telegramId, session) {
        if (!this.client) {
            return;
        }
        try {
            await this.client.set(this.key(telegramId), JSON.stringify(session), { EX: this.ttlSeconds });
        }
        catch (error) {
            logger_1.logger.warn('Bot Redis set session failed', { error, telegramId });
        }
    }
    async del(telegramId) {
        if (!this.client) {
            return;
        }
        try {
            await this.client.del(this.key(telegramId));
        }
        catch (error) {
            logger_1.logger.warn('Bot Redis delete session failed', { error, telegramId });
        }
    }
    async disconnect() {
        if (!this.client) {
            return;
        }
        try {
            await this.client.disconnect();
            logger_1.logger.info('Bot Redis session store disconnected');
        }
        catch (error) {
            logger_1.logger.warn('Bot Redis disconnect failed', { error });
        }
        finally {
            this.client = null;
        }
    }
}
exports.RedisSessionStore = RedisSessionStore;
exports.redisSessionStore = new RedisSessionStore();
//# sourceMappingURL=redisStore.js.map
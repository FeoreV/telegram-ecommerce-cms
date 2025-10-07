"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisService = exports.RedisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const TLSService_1 = require("../services/TLSService");
const SecretManager_1 = require("../utils/SecretManager");
const logger_1 = require("../utils/logger");
class RedisService {
    constructor() {
        this.client = null;
        this.subscriber = null;
        this.publisher = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000;
    }
    static getInstance() {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }
    async initialize() {
        if (this.client) {
            return this.client;
        }
        try {
            const redisSecrets = SecretManager_1.secretManager.getRedisSecrets();
            const tlsConfig = TLSService_1.tlsService.getRedisTLSConfig();
            const redisOptions = {
                host: this.extractHost(redisSecrets.url),
                port: this.extractPort(redisSecrets.url),
                password: redisSecrets.password,
                db: 0,
                connectTimeout: 10000,
                commandTimeout: 5000,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                keepAlive: 30000,
                showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
            };
            if (TLSService_1.tlsService.isEnabled() && tlsConfig.tls) {
                redisOptions.tls = tlsConfig.tls;
                redisOptions.port = 6380;
                logger_1.logger.info('Redis TLS enabled');
            }
            this.client = new ioredis_1.default(redisOptions);
            this.setupEventHandlers(this.client, 'main');
            await this.client.ping();
            logger_1.logger.info('Redis main client connected successfully');
            await this.initializePubSub(redisOptions);
            this.reconnectAttempts = 0;
            return this.client;
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Redis service:', error);
            throw error;
        }
    }
    async initializePubSub(options) {
        try {
            this.subscriber = new ioredis_1.default({
                ...options,
                lazyConnect: true
            });
            this.setupEventHandlers(this.subscriber, 'subscriber');
            await this.subscriber.ping();
            logger_1.logger.info('Redis subscriber client connected successfully');
            this.publisher = new ioredis_1.default({
                ...options,
                lazyConnect: true
            });
            this.setupEventHandlers(this.publisher, 'publisher');
            await this.publisher.ping();
            logger_1.logger.info('Redis publisher client connected successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Redis pub/sub clients:', error);
            throw error;
        }
    }
    setupEventHandlers(client, clientType) {
        client.on('connect', () => {
            logger_1.logger.info(`Redis ${clientType} client connected`);
        });
        client.on('ready', () => {
            logger_1.logger.info(`Redis ${clientType} client ready`);
            this.reconnectAttempts = 0;
        });
        client.on('error', (error) => {
            logger_1.logger.error(`Redis ${clientType} client error:`, { error: error.message, stack: error.stack });
        });
        client.on('close', () => {
            logger_1.logger.warn(`Redis ${clientType} client connection closed`);
        });
        client.on('reconnecting', (ms) => {
            this.reconnectAttempts++;
            logger_1.logger.info(`Redis ${clientType} client reconnecting in ${ms}ms (attempt ${this.reconnectAttempts})`);
        });
        client.on('end', () => {
            logger_1.logger.info(`Redis ${clientType} client connection ended`);
        });
    }
    extractHost(url) {
        if (!url)
            return '82.147.84.78';
        try {
            const parsed = new URL(url);
            return parsed.hostname;
        }
        catch {
            return '82.147.84.78';
        }
    }
    extractPort(url) {
        if (!url)
            return TLSService_1.tlsService.isEnabled() ? 6380 : 6379;
        try {
            const parsed = new URL(url);
            return parseInt(parsed.port) || (TLSService_1.tlsService.isEnabled() ? 6380 : 6379);
        }
        catch {
            return TLSService_1.tlsService.isEnabled() ? 6380 : 6379;
        }
    }
    async disconnect() {
        const promises = [];
        if (this.client) {
            promises.push(this.client.quit().catch(() => {
                if (this.client) {
                    this.client.disconnect();
                }
            }));
        }
        if (this.subscriber) {
            promises.push(this.subscriber.quit().catch(() => {
                if (this.subscriber) {
                    this.subscriber.disconnect();
                }
            }));
        }
        if (this.publisher) {
            promises.push(this.publisher.quit().catch(() => {
                if (this.publisher) {
                    this.publisher.disconnect();
                }
            }));
        }
        try {
            await Promise.all(promises);
            this.client = null;
            this.subscriber = null;
            this.publisher = null;
            logger_1.logger.info('All Redis clients disconnected successfully');
        }
        catch (error) {
            logger_1.logger.error('Error disconnecting Redis clients:', error);
            throw error;
        }
    }
    getClient() {
        if (!this.client) {
            throw new Error('Redis not initialized. Call initialize() first.');
        }
        return this.client;
    }
    getSubscriber() {
        if (!this.subscriber) {
            throw new Error('Redis subscriber not initialized. Call initialize() first.');
        }
        return this.subscriber;
    }
    getPublisher() {
        if (!this.publisher) {
            throw new Error('Redis publisher not initialized. Call initialize() first.');
        }
        return this.publisher;
    }
    async healthCheck() {
        const clientStatus = {
            main: !!this.client && this.client.status === 'ready',
            subscriber: !!this.subscriber && this.subscriber.status === 'ready',
            publisher: !!this.publisher && this.publisher.status === 'ready'
        };
        if (!this.client) {
            return {
                status: 'disconnected',
                latency: -1,
                tlsEnabled: TLSService_1.tlsService.isEnabled(),
                connectionInfo: null,
                clients: clientStatus
            };
        }
        try {
            const startTime = Date.now();
            const pong = await this.client.ping();
            const latency = Date.now() - startTime;
            const info = await this.client.info();
            const connectionInfo = this.parseRedisInfo(info);
            return {
                status: pong === 'PONG' ? 'connected' : 'error',
                latency,
                tlsEnabled: TLSService_1.tlsService.isEnabled(),
                connectionInfo,
                clients: clientStatus
            };
        }
        catch (error) {
            logger_1.logger.error('Redis health check failed:', error);
            return {
                status: 'error',
                latency: -1,
                tlsEnabled: TLSService_1.tlsService.isEnabled(),
                connectionInfo: { error: error instanceof Error ? error.message : 'Unknown error' },
                clients: clientStatus
            };
        }
    }
    parseRedisInfo(info) {
        const lines = info.split('\r\n');
        const result = {};
        let section = '';
        for (const line of lines) {
            if (line.startsWith('#')) {
                section = line.substring(1).trim();
                result[section] = {};
            }
            else if (line.includes(':')) {
                const [key, value] = line.split(':', 2);
                if (section) {
                    result[section][key] = value;
                }
            }
        }
        return result;
    }
    async executeWithRetry(operation, maxRetries = 3) {
        const client = this.getClient();
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation(client);
            }
            catch (error) {
                logger_1.logger.warn(`Redis operation attempt ${attempt} failed:`, error);
                if (attempt === maxRetries) {
                    logger_1.logger.error('Redis operation failed after all retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
        }
        throw new Error('Redis operation failed after all retries');
    }
    async setSecure(key, value, ttl) {
        const client = this.getClient();
        const serialized = JSON.stringify(value);
        if (ttl) {
            await client.setex(key, ttl, serialized);
        }
        else {
            await client.set(key, serialized);
        }
    }
    async getSecure(key) {
        const client = this.getClient();
        const value = await client.get(key);
        if (!value) {
            return null;
        }
        try {
            return JSON.parse(value);
        }
        catch (error) {
            logger_1.logger.error('Failed to parse cached value:', error);
            return null;
        }
    }
    async publish(channel, message) {
        const publisher = this.getPublisher();
        const serialized = JSON.stringify(message);
        return await publisher.publish(channel, serialized);
    }
    async subscribe(channel, callback) {
        const subscriber = this.getSubscriber();
        subscriber.on('message', (receivedChannel, message) => {
            if (receivedChannel === channel) {
                try {
                    const parsed = JSON.parse(message);
                    callback(parsed);
                }
                catch (error) {
                    logger_1.logger.error('Failed to parse pub/sub message:', error);
                }
            }
        });
        await subscriber.subscribe(channel);
    }
    async unsubscribe(channel) {
        const subscriber = this.getSubscriber();
        await subscriber.unsubscribe(channel);
    }
    getConnectionStatus() {
        return {
            main: this.client?.status || 'disconnected',
            subscriber: this.subscriber?.status || 'disconnected',
            publisher: this.publisher?.status || 'disconnected',
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
        };
    }
}
exports.RedisService = RedisService;
exports.redisService = RedisService.getInstance();
//# sourceMappingURL=redis.js.map
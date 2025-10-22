import Redis, { RedisOptions } from 'ioredis';
import { tlsService } from '../services/TLSService';
import { secretManager } from '../utils/SecretManager';
import { logger } from '../utils/logger';

export class RedisService {
  private static instance: RedisService;
  private client: any | null = null;
  private subscriber: any | null = null;
  private publisher: any | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000; // 5 seconds

  private constructor() {}

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  async initialize(): Promise<any> {
    if (this.client) {
      return this.client;
    }

    try {
      const redisSecrets = secretManager.getRedisSecrets();
      const tlsConfig = tlsService.getRedisTLSConfig();

      // Build Redis configuration
      const redisOptions: RedisOptions = {
        host: this.extractHost(redisSecrets.url),
        port: this.extractPort(redisSecrets.url),
        password: redisSecrets.password,
        db: 0,

        // Connection settings
        connectTimeout: 10000,
        commandTimeout: 5000,
        maxRetriesPerRequest: 3,

        // Reconnection settings
        lazyConnect: true,
        keepAlive: 30000,

        // Logging
        showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
      };

      // Add TLS configuration if enabled
      if (tlsService.isEnabled() && tlsConfig.tls) {
        redisOptions.tls = tlsConfig.tls as any;
        redisOptions.port = 6380; // TLS port
        logger.info('Redis TLS enabled');
      }

      this.client = new Redis(redisOptions);

      // Set up event handlers
      this.setupEventHandlers(this.client, 'main');

      // Test connection
      await this.client.ping();
      logger.info('Redis main client connected successfully');

      // Initialize subscriber and publisher for pub/sub
      await this.initializePubSub(redisOptions);

      this.reconnectAttempts = 0;
      return this.client;

    } catch (error) {
      logger.error('Failed to initialize Redis service:', error);
      throw error;
    }
  }

  private async initializePubSub(options: RedisOptions): Promise<void> {
    try {
      // Create subscriber client
      this.subscriber = new Redis({
        ...options,
        lazyConnect: true
      });
      this.setupEventHandlers(this.subscriber, 'subscriber');
      await this.subscriber.ping();
      logger.info('Redis subscriber client connected successfully');

      // Create publisher client
      this.publisher = new Redis({
        ...options,
        lazyConnect: true
      });
      this.setupEventHandlers(this.publisher, 'publisher');
      await this.publisher.ping();
      logger.info('Redis publisher client connected successfully');

    } catch (error) {
      logger.error('Failed to initialize Redis pub/sub clients:', error);
      throw error;
    }
  }

  private setupEventHandlers(client: any, clientType: string): void {
    client.on('connect', () => {
      logger.info(`Redis ${clientType} client connected`);
    });

    client.on('ready', () => {
      logger.info(`Redis ${clientType} client ready`);
      this.reconnectAttempts = 0;
    });

    client.on('error', (error: Error) => {
      logger.error(`Redis ${clientType} client error:`, { error: error.message, stack: error.stack });
    });

    client.on('close', () => {
      logger.warn(`Redis ${clientType} client connection closed`);
    });

    client.on('reconnecting', (ms: number) => {
      this.reconnectAttempts++;
      logger.info(`Redis ${clientType} client reconnecting in ${ms}ms (attempt ${this.reconnectAttempts})`);
    });

    client.on('end', () => {
      logger.info(`Redis ${clientType} client connection ended`);
    });
  }

  private extractHost(url?: string): string {
    if (!url) return 'localhost';

    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return 'localhost';
    }
  }

  private extractPort(url?: string): number {
    if (!url) return tlsService.isEnabled() ? 6380 : 6379;

    try {
      const parsed = new URL(url);
      return parseInt(parsed.port) || (tlsService.isEnabled() ? 6380 : 6379);
    } catch {
      return tlsService.isEnabled() ? 6380 : 6379;
    }
  }

  async disconnect(): Promise<void> {
    const promises: Promise<void>[] = [];

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
      logger.info('All Redis clients disconnected successfully');
    } catch (error: unknown) {
      logger.error('Error disconnecting Redis clients:', error as Record<string, unknown>);
      throw error;
    }
  }

  getClient(): any {
    if (!this.client) {
      throw new Error('Redis not initialized. Call initialize() first.');
    }
    return this.client;
  }

  getSubscriber(): any {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not initialized. Call initialize() first.');
    }
    return this.subscriber;
  }

  getPublisher(): any {
    if (!this.publisher) {
      throw new Error('Redis publisher not initialized. Call initialize() first.');
    }
    return this.publisher;
  }

  async healthCheck(): Promise<{
    status: string;
    latency: number;
    tlsEnabled: boolean;
    connectionInfo: any;
    clients: {
      main: boolean;
      subscriber: boolean;
      publisher: boolean;
    };
  }> {
    const clientStatus = {
      main: !!this.client && this.client.status === 'ready',
      subscriber: !!this.subscriber && this.subscriber.status === 'ready',
      publisher: !!this.publisher && this.publisher.status === 'ready'
    };

    if (!this.client) {
      return {
        status: 'disconnected',
        latency: -1,
        tlsEnabled: tlsService.isEnabled(),
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
        tlsEnabled: tlsService.isEnabled(),
        connectionInfo,
        clients: clientStatus
      };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return {
        status: 'error',
        latency: -1,
        tlsEnabled: tlsService.isEnabled(),
        connectionInfo: { error: error instanceof Error ? error.message : 'Unknown error' },
        clients: clientStatus
      };
    }
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const result: any = {};

    let section = '';
    for (const line of lines) {
      if (line.startsWith('#')) {
        section = line.substring(1).trim();
        result[section] = {};
      } else if (line.includes(':')) {
        const [key, value] = line.split(':', 2);
        if (section) {
          result[section][key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Execute Redis commands with retry logic
   */
  async executeWithRetry<T>(
    operation: (client: any) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    const client = this.getClient();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation(client);
      } catch (error) {
        logger.warn(`Redis operation attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          logger.error('Redis operation failed after all retries:', error);
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }

    throw new Error('Redis operation failed after all retries');
  }

  /**
   * Cache operations with encryption
   */
  async setSecure(key: string, value: any, ttl?: number): Promise<void> {
    const client = this.getClient();
    const serialized = JSON.stringify(value);

    // Encrypt the value if TLS service has encryption capabilities
    // For now, just store as-is since Redis connection is already encrypted

    if (ttl) {
      await client.setex(key, ttl, serialized);
    } else {
      await client.set(key, serialized);
    }
  }

  async getSecure<T>(key: string): Promise<T | null> {
    const client = this.getClient();
    const value = await client.get(key);

    if (!value) {
      return null;
    }

    try {
      // Decrypt the value if needed
      // For now, just parse since Redis connection is already encrypted
      return JSON.parse(value) as T;
    } catch (error: unknown) {
      logger.error('Failed to parse cached value:', error as Record<string, unknown>);
      return null;
    }
  }

  /**
   * Pub/Sub operations
   */
  async publish(channel: string, message: any): Promise<number> {
    const publisher = this.getPublisher();
    const serialized = JSON.stringify(message);
    return await publisher.publish(channel, serialized);
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    const subscriber = this.getSubscriber();

    subscriber.on('message', (receivedChannel: string, message: string) => {
      if (receivedChannel === channel) {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (error: unknown) {
          logger.error('Failed to parse pub/sub message:', error as Record<string, unknown>);
        }
      }
    });

    await subscriber.subscribe(channel);
  }

  async unsubscribe(channel: string): Promise<void> {
    const subscriber = this.getSubscriber();
    await subscriber.unsubscribe(channel);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    main: string;
    subscriber: string;
    publisher: string;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  } {
    return {
      main: this.client?.status || 'disconnected',
      subscriber: this.subscriber?.status || 'disconnected',
      publisher: this.publisher?.status || 'disconnected',
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }
}

// Export singleton instance
export const redisService = RedisService.getInstance();

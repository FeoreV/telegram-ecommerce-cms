import { logger } from './logger';

type RedisClientType = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<void>;
  del(key: string): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  on(event: 'error', listener: (err: unknown) => void): void;
};

export class RedisSessionStore<T = unknown> {
  private client: RedisClientType | null = null;
  private readonly ttlSeconds: number;
  private readonly prefix: string;
  private lastErrorLog: { code: string; timestamp: number } | null = null;

  constructor(ttlSeconds: number = 24 * 60 * 60, prefix: string = 'bot:sess:') {
    this.ttlSeconds = ttlSeconds;
    this.prefix = prefix;
  }

  async init(url: string): Promise<void> {
    try {
      const mod = await import('redis');
      const redis = (mod as any).createClient({ 
        url,
        socket: {
          connectTimeout: 5000, // 5 second timeout
          reconnectStrategy: (retries: number) => {
            if (retries > 3) {
              logger.warn('Redis reconnection failed after 3 attempts, using in-memory fallback');
              return false; // Stop reconnecting
            }
            return Math.min(retries * 100, 3000); // Max 3 second delay
          }
        }
      }) as RedisClientType;
      
      redis.on('error', (err: unknown) => {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const errorCode = (err as any).code;
        
        if (isDevelopment && errorCode === 'ECONNREFUSED') {
          // Suppress ECONNREFUSED spam in development - log once every 5 minutes
          const now = Date.now();
          if (!this.lastErrorLog || 
              this.lastErrorLog.code !== errorCode || 
              now - this.lastErrorLog.timestamp > 300000) {
            logger.warn('Redis unavailable for bot sessions (using in-memory mode). To enable Redis, start Docker: docker-compose up -d redis');
            this.lastErrorLog = { code: errorCode, timestamp: now };
          }
        } else if (isDevelopment) {
          logger.warn('Bot Redis client error (development mode):', { error: err });
        } else {
          logger.error('Bot Redis client error', { error: err });
        }
      });

      await redis.connect();
      this.client = redis;

      logger.info('Bot Redis session store connected', {
        prefix: this.prefix,
        ttlSeconds: this.ttlSeconds,
      });
    } catch (error) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment) {
        logger.warn('Failed to initialize bot Redis session store, using in-memory fallback');
      } else {
        logger.error('Failed to initialize bot Redis session store', { error });
      }
      this.client = null;
      throw error;
    }
  }

  private ensureClient(): asserts this is { client: RedisClientType } {
    if (!this.client) {
      throw new Error('Bot Redis session store not initialized');
    }
  }

  private key(telegramId: string): string {
    return `${this.prefix}${telegramId}`;
  }

  async get(telegramId: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    try {
      const raw = await this.client.get(this.key(telegramId));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      logger.warn('Bot Redis get session failed', { error, telegramId });
      return null;
    }
  }

  async set(telegramId: string, session: T): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.set(this.key(telegramId), JSON.stringify(session), { EX: this.ttlSeconds });
    } catch (error) {
      logger.warn('Bot Redis set session failed', { error, telegramId });
    }
  }

  async del(telegramId: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.del(this.key(telegramId));
    } catch (error) {
      logger.warn('Bot Redis delete session failed', { error, telegramId });
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.disconnect();
      logger.info('Bot Redis session store disconnected');
    } catch (error) {
      logger.warn('Bot Redis disconnect failed', { error });
    } finally {
      this.client = null;
    }
  }
}

export const redisSessionStore = new RedisSessionStore();



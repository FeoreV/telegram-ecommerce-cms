import { PrismaClient } from '@prisma/client';
import { tlsService } from '../services/TLSService';
import { secretManager } from '../utils/SecretManager';
import { logger } from '../utils/logger';
import { sanitizeObjectForLog } from '../utils/sanitizer';

export class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000; // 5 seconds

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(): Promise<PrismaClient> {
    if (this.prisma) {
      return this.prisma;
    }

    try {
      const dbSecrets = secretManager.getDatabaseSecrets();
      tlsService.getDatabaseTLSConfig(); // Initialize TLS config

      // Build connection URL with TLS parameters
      let connectionUrl = dbSecrets.url;

      if (tlsService.isEnabled()) {
        const urlParams = new URLSearchParams();
        urlParams.set('sslmode', 'require');
        urlParams.set('sslcert', process.env.TLS_CLIENT_CERT_PATH || '/certs/backend.client.cert.pem');
        urlParams.set('sslkey', process.env.TLS_CLIENT_KEY_PATH || '/certs/backend.client.key.pem');
        urlParams.set('sslrootcert', process.env.TLS_CA_PATH || '/certs/ca.cert.pem');

        // Add TLS parameters to connection URL
        const separator = connectionUrl.includes('?') ? '&' : '?';
        connectionUrl += separator + urlParams.toString();
      }

      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: connectionUrl,
          },
        },
        log: [
          {
            emit: 'event',
            level: 'query',
          },
          {
            emit: 'event',
            level: 'error',
          },
          {
            emit: 'event',
            level: 'info',
          },
          {
            emit: 'event',
            level: 'warn',
          },
        ],
      });

      // Set up logging - with proper typing for Prisma events
      (this.prisma as any).$on('error', (e: any) => {
        logger.error('Database error:', sanitizeObjectForLog(e));
      });

      (this.prisma as any).$on('warn', (e: any) => {
        logger.warn('Database warning:', sanitizeObjectForLog(e));
      });

      (this.prisma as any).$on('info', (e: any) => {
        logger.info('Database info:', sanitizeObjectForLog(e));
      });

      (this.prisma as any).$on('query', (e: any) => {
        if (process.env.LOG_LEVEL === 'debug') {
          logger.debug('Database query:', {
            query: e.query,
            params: e.params,
            duration: e.duration,
          });
        }
      });

      // Test connection
      await this.testConnection();

      logger.info('Database service initialized successfully', {
        tlsEnabled: tlsService.isEnabled(),
        connectionUrl: connectionUrl.replace(/password=[^&]+/g, 'password=***')
      });

      return this.prisma;

    } catch (error) {
      logger.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.prisma) {
      throw new Error('Prisma client not initialized');
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      logger.info('Database connection test successful');
      this.reconnectAttempts = 0;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw error;
    }
  }

  async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('Max reconnection attempts reached');
    }

    this.reconnectAttempts++;
    logger.info(`Attempting database reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    try {
      await this.disconnect();
      await new Promise(resolve => setTimeout(resolve, this.reconnectInterval));
      await this.initialize();
      logger.info('Database reconnection successful');
    } catch (error) {
      logger.error(`Database reconnection attempt ${this.reconnectAttempts} failed:`, error);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.reconnect(), this.reconnectInterval);
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.prisma) {
      try {
        await this.prisma.$disconnect();
        this.prisma = null;
        logger.info('Database disconnected successfully');
      } catch (error) {
        logger.error('Error disconnecting from database:', error);
        throw error;
      }
    }
  }

  getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.prisma;
  }

  async healthCheck(): Promise<{
    status: string;
    latency: number;
    tlsEnabled: boolean;
    connectionInfo: any;
  }> {
    if (!this.prisma) {
      return {
        status: 'disconnected',
        latency: -1,
        tlsEnabled: tlsService.isEnabled(),
        connectionInfo: null
      };
    }

    try {
      const startTime = Date.now();
      const result = await this.prisma.$queryRaw`SELECT
        version() as version,
        current_database() as database,
        current_user as user,
        inet_server_addr() as server_addr,
        inet_server_port() as server_port,
        pg_is_in_recovery() as is_replica,
        CASE WHEN ssl_is_used() THEN 'SSL' ELSE 'No SSL' END as ssl_status
      ` as any[];

      const latency = Date.now() - startTime;

      return {
        status: 'connected',
        latency,
        tlsEnabled: tlsService.isEnabled(),
        connectionInfo: result[0]
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'error',
        latency: -1,
        tlsEnabled: tlsService.isEnabled(),
        connectionInfo: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Execute a transaction with retry logic
   */
  async executeTransaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    const prisma = this.getPrisma();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await prisma.$transaction(fn as any) as T;
      } catch (error) {
        logger.warn(`Transaction attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          logger.error('Transaction failed after all retries:', error);
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }

    throw new Error('Transaction failed after all retries');
  }

  /**
   * Get connection pool status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  } {
    return {
      isConnected: !!this.prisma,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();

// Legacy export for backward compatibility
export const getPrisma = () => databaseService.getPrisma();
export const disconnectPrisma = () => databaseService.disconnect();

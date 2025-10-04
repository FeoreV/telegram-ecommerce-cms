import * as crypto from 'crypto';
import { getVaultService } from '../services/VaultService';
import { logger } from './logger';

// Internal interfaces for vault secrets
interface VaultSecret {
  [key: string]: unknown;
}

interface SmtpSecret extends VaultSecret {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  from?: string;
}

interface RedisSecret extends VaultSecret {
  url?: string;
  password?: string;
}

export interface ApplicationSecrets {
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  database: {
    url: string;
    username?: string;
    password?: string;
  };
  telegram: {
    botToken: string;
    webhookSecret?: string;
  };
  admin: {
    defaultPassword: string;
    cookieSecret: string;
    sessionSecret: string;
  };
  smtp: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    from?: string;
  };
  encryption: {
    masterKey: string;
    dataEncryptionKey: string;
  };
  redis: {
    url?: string;
    password?: string;
  };
}

export class SecretManager {
  private static instance: SecretManager;
  private secrets: ApplicationSecrets | null = null;
  private useVault: boolean;
  private initialized: boolean = false;

  private constructor() {
    this.useVault = process.env.USE_VAULT === 'true';
  }

  public static getInstance(): SecretManager {
    if (!SecretManager.instance) {
      SecretManager.instance = new SecretManager();
    }
    return SecretManager.instance;
  }

  /**
   * Initialize secrets from Vault or environment variables
   */
  async initialize(force: boolean = false): Promise<void> {
    // Skip if already initialized unless forced
    if (this.initialized && !force) {
      return;
    }

    if (this.useVault) {
      await this.loadSecretsFromVault();
    } else {
      this.loadSecretsFromEnv();
    }

    // Validate critical secrets
    this.validateSecrets();
    this.initialized = true;
  }

  /**
   * Load secrets from Vault
   */
  private async loadSecretsFromVault(): Promise<void> {
    try {
      const vault = getVaultService();

      // Load secrets from different Vault paths
      const [jwtSecrets, dbSecrets, telegramSecrets, adminSecrets, smtpSecrets, encryptionSecrets, redisSecrets] = await Promise.all([
        vault.getSecret('app/jwt'),
        vault.getSecret('app/database'),
        vault.getSecret('app/telegram'),
        vault.getSecret('app/admin'),
        vault.getSecret('app/smtp').catch(() => ({})), // Optional
        vault.getSecret('app/encryption'),
        vault.getSecret('app/redis').catch(() => ({})), // Optional
      ]);

      this.secrets = {
        jwt: {
          secret: jwtSecrets.secret as string,
          refreshSecret: jwtSecrets.refreshSecret as string,
          expiresIn: jwtSecrets.expiresIn as string || '15m',
          refreshExpiresIn: jwtSecrets.refreshExpiresIn as string || '7d',
        },
        database: {
          url: dbSecrets.url as string,
          username: dbSecrets.username as string,
          password: dbSecrets.password as string,
        },
        telegram: {
          botToken: telegramSecrets.botToken as string,
          webhookSecret: telegramSecrets.webhookSecret as string,
        },
        admin: {
          defaultPassword: adminSecrets.defaultPassword as string,
          cookieSecret: adminSecrets.cookieSecret as string,
          sessionSecret: adminSecrets.sessionSecret as string,
        },
        smtp: {
          host: (smtpSecrets as SmtpSecret).host,
          port: (smtpSecrets as SmtpSecret).port,
          secure: (smtpSecrets as SmtpSecret).secure,
          user: (smtpSecrets as SmtpSecret).user,
          password: (smtpSecrets as SmtpSecret).password,
          from: (smtpSecrets as SmtpSecret).from,
        },
        encryption: {
          masterKey: encryptionSecrets.masterKey as string,
          dataEncryptionKey: encryptionSecrets.dataEncryptionKey as string,
        },
        redis: {
          url: (redisSecrets as RedisSecret).url,
          password: (redisSecrets as RedisSecret).password,
        },
      };

      logger.info('Successfully loaded secrets from Vault');
    } catch (error) {
      logger.error('Failed to load secrets from Vault:', error);
      throw new Error('Failed to initialize secrets from Vault');
    }
  }

  /**
   * Load secrets from environment variables (fallback)
   */
  private loadSecretsFromEnv(): void {
    // SECURITY: Generate random secrets even in development mode
    // This prevents accidentally using weak default secrets in production
    const generateJWTSecret = () => {
      if (!process.env.JWT_SECRET) {
        const secret = crypto.randomBytes(64).toString('base64');
        logger.warn('JWT_SECRET not set - generated random secret (will change on restart)');
        return secret;
      }
      return process.env.JWT_SECRET;
    };

    const generateJWTRefreshSecret = () => {
      if (!process.env.JWT_REFRESH_SECRET) {
        const secret = crypto.randomBytes(64).toString('base64');
        logger.warn('JWT_REFRESH_SECRET not set - generated random secret (will change on restart)');
        return secret;
      }
      return process.env.JWT_REFRESH_SECRET;
    };

    this.secrets = {
      jwt: {
        secret: generateJWTSecret(),
        refreshSecret: generateJWTRefreshSecret(),
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
      database: {
        url: process.env.DATABASE_URL || 'file:./dev.db',
      },
      telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || (process.env.NODE_ENV === 'development' ? 'dev-token' : ''),
        webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || (() => {
          const secret = crypto.randomBytes(32).toString('hex');
          logger.warn('TELEGRAM_WEBHOOK_SECRET not set - generated random secret');
          return secret;
        })(),
      },
      admin: {
        defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || (() => {
          logger.warn('SECURITY WARNING: ADMIN_DEFAULT_PASSWORD not set - admin authentication will fail');
          return '';
        })(),
        cookieSecret: process.env.ADMIN_COOKIE_SECRET || (() => {
          const secret = crypto.randomBytes(32).toString('hex');
          logger.warn('ADMIN_COOKIE_SECRET not set - generated random secret (will change on restart)');
          return secret;
        })(),
        sessionSecret: process.env.ADMIN_SESSION_SECRET || (() => {
          const secret = crypto.randomBytes(32).toString('hex');
          logger.warn('ADMIN_SESSION_SECRET not set - generated random secret (will change on restart)');
          return secret;
        })(),
      },
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM,
      },
      encryption: {
        masterKey: process.env.ENCRYPTION_MASTER_KEY || (() => {
          const key = this.generateKey();
          logger.warn('ENCRYPTION_MASTER_KEY not set - generated random key (will change on restart)');
          return key;
        })(),
        dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || (() => {
          const key = this.generateKey();
          logger.warn('DATA_ENCRYPTION_KEY not set - generated random key (will change on restart)');
          return key;
        })(),
      },
      redis: {
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD,
      },
    };

    logger.info('Loaded secrets from environment variables');
    logger.warn('⚠️  Some secrets were auto-generated and will change on restart');
    logger.warn('⚠️  Set all required secrets in .env file for persistent configuration');
  }

  /**
   * Validate that critical secrets are present
   */
  private validateSecrets(): void {
    if (!this.secrets) {
      throw new Error('Secrets not initialized');
    }

    const isDevelopment = process.env.NODE_ENV === 'development';

    const requiredSecrets = [
      'jwt.secret',
      'jwt.refreshSecret',
      'database.url',
      'admin.defaultPassword',
      'admin.cookieSecret',
      'admin.sessionSecret',
      'encryption.masterKey',
      'encryption.dataEncryptionKey',
    ];

    // Only require telegram.botToken in production
    if (!isDevelopment) {
      requiredSecrets.push('telegram.botToken');
    }

    for (const path of requiredSecrets) {
      const value = this.getNestedValue(this.secrets as any, path);
      if (!value) {
        throw new Error(`Required secret missing: ${path}`);
      }
    }

    // Validate secret strength
    this.validateSecretStrength();
  }

  /**
   * Validate secret strength
   */
  private validateSecretStrength(): void {
    if (!this.secrets) {
      logger.error('No secrets available for validation');
      return;
    }
    const secrets = this.secrets;

    // JWT secrets should be at least 32 characters
    if (secrets.jwt.secret.length < 32) {
      logger.warn('JWT secret is shorter than recommended (32 characters)');
    }

    if (secrets.jwt.refreshSecret.length < 32) {
      logger.warn('JWT refresh secret is shorter than recommended (32 characters)');
    }

    // JWT secrets should be different
    if (secrets.jwt.secret === secrets.jwt.refreshSecret) {
      throw new Error('JWT secret and refresh secret must be different');
    }

    // Admin secrets should be strong
    if (secrets.admin.cookieSecret.length < 32) {
      throw new Error('Admin cookie secret must be at least 32 characters');
    }

    if (secrets.admin.sessionSecret.length < 32) {
      throw new Error('Admin session secret must be at least 32 characters');
    }

    // Check for default values in production
    if (process.env.NODE_ENV === 'production') {
      const defaultSecrets = [
        'your-super-secret-jwt-key',
        'dev-jwt-secret',
        'change-me',
        'ChangeMe123!',
      ];

      const secretValues = [
        secrets.jwt.secret,
        secrets.jwt.refreshSecret,
        secrets.admin.defaultPassword,
      ];

      for (const secret of secretValues) {
        if (defaultSecrets.includes(secret)) {
          throw new Error('Default secrets detected in production environment');
        }
      }
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) =>
      current && typeof current === 'object' && current !== null
        ? (current as Record<string, unknown>)[key]
        : undefined,
      obj
    );
  }

  /**
   * Generate a random key
   */
  private generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get all secrets
   */
  getSecrets(): ApplicationSecrets {
    if (!this.secrets) {
      throw new Error('Secrets not initialized. Call initialize() first.');
    }
    return this.secrets;
  }

  /**
   * Get JWT secrets
   */
  getJWTSecrets() {
    return this.getSecrets().jwt;
  }

  /**
   * Get database secrets
   */
  getDatabaseSecrets() {
    return this.getSecrets().database;
  }

  /**
   * Get Telegram secrets
   */
  getTelegramSecrets() {
    return this.getSecrets().telegram;
  }

  /**
   * Get admin secrets
   */
  getAdminSecrets() {
    return this.getSecrets().admin;
  }

  /**
   * Get SMTP secrets
   */
  getSMTPSecrets() {
    return this.getSecrets().smtp;
  }

  /**
   * Get encryption secrets
   */
  getEncryptionSecrets() {
    return this.getSecrets().encryption;
  }

  /**
   * Get Redis secrets
   */
  getRedisSecrets() {
    return this.getSecrets().redis;
  }

  /**
   * Rotate secrets (for Vault-backed deployments)
   */
  async rotateSecrets(): Promise<void> {
    if (!this.useVault) {
      throw new Error('Secret rotation is only available with Vault');
    }

    // Force reload secrets from Vault
    await this.initialize(true);
    logger.info('Secrets rotated successfully');
  }
}

// Export singleton instance
export const secretManager = SecretManager.getInstance();

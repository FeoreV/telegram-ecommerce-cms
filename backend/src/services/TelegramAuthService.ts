import crypto from 'crypto';
import { secureAuthService } from './SecureAuthService';
import { logger } from '../utils/logger';
import { User } from '@prisma/client';

export interface TelegramAuthData {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface TelegramWebhookData {
  update_id: number;
  message?: unknown;
  callback_query?: unknown;
  // ... other webhook fields
}

export interface TelegramValidationResult {
  isValid: boolean;
  reason?: string;
  userData?: {
    telegramId: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
    authDate: Date;
  };
}

export interface ValidatedTelegramUserData {
  telegramId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  authDate: Date;
}

export interface TelegramConfig {
  authTokenTTL: number; // seconds
  webhookSecretValidation: boolean;
  enforceAuthDateTTL: boolean;
  maxAuthAge: number; // seconds
  requireUserData: boolean;
}

export class TelegramAuthService {
  private static instance: TelegramAuthService;
  private config: TelegramConfig;

  private constructor() {
    this.config = {
      authTokenTTL: parseInt(process.env.TELEGRAM_AUTH_TTL || '3600'), // 1 hour
      webhookSecretValidation: process.env.TELEGRAM_WEBHOOK_VALIDATION !== 'false',
      enforceAuthDateTTL: process.env.ENFORCE_TELEGRAM_AUTH_DATE_TTL !== 'false',
      maxAuthAge: parseInt(process.env.TELEGRAM_MAX_AUTH_AGE || '86400'), // 24 hours
      requireUserData: process.env.TELEGRAM_REQUIRE_USER_DATA !== 'false'
    };
  }

  public static getInstance(): TelegramAuthService {
    if (!TelegramAuthService.instance) {
      TelegramAuthService.instance = new TelegramAuthService();
    }
    return TelegramAuthService.instance;
  }

  /**
   * Validate Telegram login data
   */
  validateTelegramLogin(authData: TelegramAuthData, botToken: string): TelegramValidationResult {
    try {
      // Extract hash from auth data
      const { hash, ...dataToCheck } = authData;

      // Check required fields
      if (!authData.id || !authData.auth_date || !hash) {
        return {
          isValid: false,
          reason: 'Missing required fields (id, auth_date, hash)'
        };
      }

      // Check auth_date TTL if enforced
      if (this.config.enforceAuthDateTTL) {
        const authAge = Date.now() / 1000 - authData.auth_date;
        if (authAge > this.config.maxAuthAge) {
          logger.warn('Telegram auth data expired', {
            telegramId: authData.id,
            authAge,
            maxAge: this.config.maxAuthAge
          });
          
          return {
            isValid: false,
            reason: `Auth data expired (${Math.floor(authAge / 60)} minutes old)`
          };
        }
      }

      // Validate HMAC
      const isValidHMAC = this.validateTelegramHMAC(dataToCheck, hash, botToken);
      if (!isValidHMAC) {
        logger.warn('Invalid Telegram HMAC signature', {
          telegramId: authData.id,
          username: authData.username,
          authDate: authData.auth_date
        });
        
        return {
          isValid: false,
          reason: 'Invalid HMAC signature'
        };
      }

      // Check user data requirements
      if (this.config.requireUserData) {
        if (!authData.first_name && !authData.username) {
          return {
            isValid: false,
            reason: 'Missing required user data (first_name or username)'
          };
        }
      }

      // Validation successful
      const userData: ValidatedTelegramUserData = {
        telegramId: authData.id,
        firstName: authData.first_name,
        lastName: authData.last_name,
        username: authData.username,
        photoUrl: authData.photo_url,
        authDate: new Date(authData.auth_date * 1000)
      };

      logger.info('Telegram login validated successfully', {
        telegramId: authData.id,
        username: authData.username,
        authDate: userData.authDate
      });

      return {
        isValid: true,
        userData
      };

    } catch (err: unknown) {
      logger.error('Telegram login validation error:', err as Record<string, unknown>);
      return {
        isValid: false,
        reason: 'Validation process failed'
      };
    }
  }

  /**
   * Validate Telegram HMAC signature
   */
  private validateTelegramHMAC(data: Omit<TelegramAuthData, 'hash'>, hash: string, botToken: string): boolean {
    try {
      // Create data check string
      const dataCheckString = Object.keys(data)
        .filter(key => key !== 'hash')
        .sort()
        .map(key => `${key}=${data[key]}`)
        .join('\n');

      // Create secret key from bot token
      const secretKey = crypto
        .createHash('sha256')
        .update(botToken)
        .digest();

      // Calculate HMAC
      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      // Compare hashes in constant time
      return this.constantTimeCompare(calculatedHash, hash);

    } catch (err: unknown) {
      logger.error('HMAC validation error:', err as Record<string, unknown>);
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Validate Telegram webhook data
   */
  validateTelegramWebhook(
    webhookData: TelegramWebhookData,
    secretToken: string,
    receivedSignature: string
  ): boolean {
    try {
      if (!this.config.webhookSecretValidation) {
        logger.debug('Webhook secret validation disabled');
        return true;
      }

      if (!secretToken || !receivedSignature) {
        logger.warn('Missing webhook secret token or signature');
        return false;
      }

      // Calculate expected signature
      const webhookPayload = JSON.stringify(webhookData);
      const expectedSignature = crypto
        .createHmac('sha256', secretToken)
        .update(webhookPayload)
        .digest('hex');

      // Remove 'sha256=' prefix if present
      const cleanReceivedSignature = receivedSignature.replace(/^sha256=/, '');

      // Compare signatures
      const isValid = this.constantTimeCompare(expectedSignature, cleanReceivedSignature);

      if (!isValid) {
        logger.warn('Invalid webhook signature', {
          updateId: webhookData.update_id,
          expectedSignature: expectedSignature.substring(0, 8) + '...',
          receivedSignature: cleanReceivedSignature.substring(0, 8) + '...'
        });
      }

      return isValid;

    } catch (err: unknown) {
      logger.error('Webhook validation error:', err as Record<string, unknown>);
      return false;
    }
  }

  /**
   * Create secure session from Telegram auth
   */
  async createTelegramSession(
    authData: TelegramAuthData,
    botToken: string,
    deviceInfo: unknown,
    role: string = 'CUSTOMER',
    storeId?: string
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string; user: { id: string; telegramId: string; username?: string; firstName?: string; lastName?: string; role: string; }; }> {
    try {
      // Validate Telegram auth data
      const validation = this.validateTelegramLogin(authData, botToken);
      if (!validation.isValid) {
        throw new Error(`Telegram auth validation failed: ${validation.reason}`);
      }

      if (!validation.userData) {
        throw new Error('Telegram user data is missing');
      }
      // Find or create user
      const user = await this.findOrCreateTelegramUser(validation.userData);

      const deviceInfoAsRecord = deviceInfo as Record<string, unknown>;
      // Generate device fingerprint with Telegram-specific data
      const telegramDeviceInfo = {
        ...deviceInfoAsRecord,
        telegramId: authData.id,
        authDate: authData.auth_date
      };

      const deviceFingerprint = secureAuthService.generateDeviceFingerprint(
        deviceInfoAsRecord.userAgent as string,
        deviceInfoAsRecord.ipAddress as string,
        telegramDeviceInfo
      );

      const enhancedDeviceInfo = {
        ...deviceInfoAsRecord,
        deviceFingerprint,
        telegramId: authData.id,
        authMethod: 'telegram',
        userAgent: deviceInfoAsRecord.userAgent as string,
        ipAddress: deviceInfoAsRecord.ipAddress as string,
      };

      // Create secure session
      const tokenPair = await secureAuthService.createSession(
        user.id,
        role,
        enhancedDeviceInfo,
        storeId
      );

      logger.info('Telegram session created successfully', {
        userId: user.id,
        telegramId: authData.id,
        username: authData.username,
        role,
        storeId,
        sessionId: tokenPair.sessionId
      });

      return {
        ...tokenPair,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      };

    } catch (err: unknown) {
      logger.error('Failed to create Telegram session:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Find or create user from Telegram data
   */
  private async findOrCreateTelegramUser(userData: ValidatedTelegramUserData): Promise<User> {
    try {
      const { databaseService } = await import('../lib/database');
      const prisma = databaseService.getPrisma();

      // Try to find existing user by Telegram ID
      let user = await prisma.user.findUnique({
        where: { telegramId: userData.telegramId }
      });

      if (!user) {
        // Create new user
        user = await prisma.user.create({
          data: {
            telegramId: userData.telegramId,
            username: userData.username || `user_${userData.telegramId}`,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profilePhoto: userData.photoUrl,
            role: 'CUSTOMER',
            isActive: true
          }
        });

        logger.info('New Telegram user created', {
          userId: user.id,
          telegramId: userData.telegramId,
          username: userData.username
        });
      } else {
        // Update existing user data
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            username: userData.username || user.username,
            firstName: userData.firstName || user.firstName,
            lastName: userData.lastName || user.lastName,
            profilePhoto: userData.photoUrl || user.profilePhoto,
            lastLoginAt: new Date()
          }
        });

        logger.debug('Telegram user updated', {
          userId: user.id,
          telegramId: userData.telegramId
        });
      }

      return user;

    } catch (err: unknown) {
      logger.error('Failed to find or create Telegram user:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Validate Telegram bot token format
   */
  validateBotTokenFormat(botToken: string): boolean {
    // Telegram bot token format: <bot_id>:<auth_token>
    // Example: 123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ
    const tokenRegex = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;
    return tokenRegex.test(botToken);
  }

  /**
   * Extract bot ID from token
   */
  extractBotId(botToken: string): number | null {
    try {
      const parts = botToken.split(':');
      if (parts.length !== 2) {
        return null;
      }
      
      const botId = parseInt(parts[0]);
      return isNaN(botId) ? null : botId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate secure webhook URL
   */
  generateWebhookUrl(botToken: string, baseUrl: string): string {
    const botId = this.extractBotId(botToken);
    if (!botId) {
      throw new Error('Invalid bot token format');
    }

    // Create a secure path using bot ID and token hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(botToken)
      .digest('hex')
      .substring(0, 16);

    return `${baseUrl}/api/telegram/webhook/${botId}/${tokenHash}`;
  }

  /**
   * Validate webhook URL security
   */
  validateWebhookUrl(url: string, botToken: string): boolean {
    try {
      const botId = this.extractBotId(botToken);
      if (!botId) {
        return false;
      }

      const tokenHash = crypto
        .createHash('sha256')
        .update(botToken)
        .digest('hex')
        .substring(0, 16);

      const expectedPath = `/api/telegram/webhook/${botId}/${tokenHash}`;
      const urlObj = new URL(url);
      
      return urlObj.pathname === expectedPath;

    } catch (error) {
      return false;
    }
  }

  /**
   * Rate limit Telegram operations
   */
  private telegramRateLimiter: Map<string, { count: number; resetTime: number }> = new Map();

  checkTelegramRateLimit(identifier: string, limit: number = 30, windowMs: number = 60000): boolean {
    const now = Date.now();
    const key = `telegram:${identifier}`;
    
    let bucket = this.telegramRateLimiter.get(key);
    
    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 0, resetTime: now + windowMs };
      this.telegramRateLimiter.set(key, bucket);
    }
    
    if (bucket.count >= limit) {
      logger.warn('Telegram rate limit exceeded', {
        identifier,
        count: bucket.count,
        limit,
        resetTime: new Date(bucket.resetTime)
      });
      return false;
    }
    
    bucket.count++;
    return true;
  }

  /**
   * Health check for Telegram auth service
   */
  async healthCheck(): Promise<{
    status: string;
    config: TelegramConfig;
    rateLimiterSize: number;
  }> {
    try {
      // Clean up old rate limiter entries
      const now = Date.now();
      for (const [key, bucket] of this.telegramRateLimiter.entries()) {
        if (now > bucket.resetTime) {
          this.telegramRateLimiter.delete(key);
        }
      }

      return {
        status: 'healthy',
        config: this.config,
        rateLimiterSize: this.telegramRateLimiter.size
      };

    } catch (err: unknown) {
      logger.error('Telegram auth service health check failed:', err as Record<string, unknown>);
      return {
        status: 'error',
        config: this.config,
        rateLimiterSize: 0
      };
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): TelegramConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const telegramAuthService = TelegramAuthService.getInstance();

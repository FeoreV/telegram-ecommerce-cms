import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from './loggerEnhanced';
import { secretManager } from './SecretManager';

export interface JWTKeyPair {
  id: string; // Key ID (kid)
  secret: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface EnhancedTokenPayload {
  userId: string;
  telegramId: string;
  role: string;
  storeId?: string;
  permissions?: string[];
  sessionId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  kid: string; // Key ID
}

/**
 * Enhanced JWT service with key rotation and improved security
 */
export class EnhancedJWTService {
  private static instance: EnhancedJWTService;
  private activeKeys: Map<string, JWTKeyPair> = new Map();
  private currentKeyId: string = '';
  private rotationInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeKeys();
    this.startKeyRotation();
  }

  static getInstance(): EnhancedJWTService {
    if (!this.instance) {
      this.instance = new EnhancedJWTService();
    }
    return this.instance;
  }

  /**
   * Initialize JWT keys from secret manager
   */
  private async initializeKeys(): Promise<void> {
    try {
      const jwtSecrets = secretManager.getJWTSecrets();

      // Create initial key pair
      const keyId = this.generateKeyId();
      const keyPair: JWTKeyPair = {
        id: keyId,
        secret: jwtSecrets.secret,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        isActive: true
      };

      this.activeKeys.set(keyId, keyPair);
      this.currentKeyId = keyId;

      logger.info('Enhanced JWT service initialized', {
        keyId: keyId.substring(0, 8) + '...',
        totalKeys: this.activeKeys.size
      });

    } catch (error) {
      logger.error('Failed to initialize JWT keys:', error);
      throw error;
    }
  }

  /**
   * Generate a new key ID
   */
  private generateKeyId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}_${random}`;
  }

  /**
   * Create a new key pair for rotation
   */
  private async createNewKeyPair(): Promise<JWTKeyPair> {
    try {
      // Generate new secret
      const newSecret = crypto.randomBytes(64).toString('hex');
      const keyId = this.generateKeyId();

      const keyPair: JWTKeyPair = {
        id: keyId,
        secret: newSecret,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        isActive: true
      };

      // Store in secret manager (if supported)
      try {
        await secretManager.rotateSecrets();
      } catch (error) {
        logger.warn('Could not rotate secrets in vault:', error);
      }

      return keyPair;
    } catch (error) {
      logger.error('Failed to create new key pair:', error);
      throw error;
    }
  }

  /**
   * Start automatic key rotation
   */
  private startKeyRotation(): void {
    // Rotate keys every 24 hours
    const rotationInterval = 24 * 60 * 60 * 1000;

    this.rotationInterval = setInterval(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        logger.error('Key rotation failed:', error);
      }
    }, rotationInterval);

    logger.info('JWT key rotation started', {
      intervalHours: 24
    });
  }

  /**
   * Rotate JWT keys
   */
  async rotateKeys(): Promise<void> {
    try {
      logger.info('Starting JWT key rotation');

      // Create new key pair
      const newKeyPair = await this.createNewKeyPair();

      // Add new key to active keys
      this.activeKeys.set(newKeyPair.id, newKeyPair);

      // Update current key ID
      const oldKeyId = this.currentKeyId;
      this.currentKeyId = newKeyPair.id;

      // Mark old keys as inactive (but keep them for token verification)
      for (const [keyId, keyPair] of this.activeKeys.entries()) {
        if (keyId !== newKeyPair.id) {
          keyPair.isActive = false;
        }
      }

      // Clean up expired keys (older than 14 days)
      const cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      for (const [keyId, keyPair] of this.activeKeys.entries()) {
        if (keyPair.createdAt < cutoffDate) {
          this.activeKeys.delete(keyId);
        }
      }

      logger.info('JWT key rotation completed', {
        newKeyId: newKeyPair.id.substring(0, 8) + '...',
        oldKeyId: oldKeyId.substring(0, 8) + '...',
        totalActiveKeys: this.activeKeys.size
      });

    } catch (error) {
      logger.error('JWT key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Generate access token with current key
   */
  generateAccessToken(payload: {
    userId: string;
    telegramId: string;
    role: string;
    storeId?: string;
    permissions?: string[];
    sessionId: string;
  }): string {
    try {
      const currentKey = this.activeKeys.get(this.currentKeyId);
      if (!currentKey || !currentKey.isActive) {
        throw new Error('No active JWT key available');
      }

      const now = Math.floor(Date.now() / 1000);
      const tokenPayload: EnhancedTokenPayload = {
        ...payload,
        iat: now,
        exp: now + (15 * 60), // 15 minutes
        iss: 'botrt-ecommerce',
        aud: 'botrt-users',
        kid: currentKey.id
      };

      const token = jwt.sign(tokenPayload, currentKey.secret, {
        algorithm: 'HS256',
        header: {
          alg: 'HS256',
          kid: currentKey.id
        }
      });

      // SECURITY FIX: CWE-522 - Log token generation without sensitive data
      logger.debug('Access token generated', {
        userId: payload.userId,
        role: payload.role,
        // sessionId and keyId removed to prevent information exposure
        expiresIn: '15m'
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate access token:', error);
      throw error;
    }
  }

  /**
   * Verify token with key rotation support
   */
  verifyToken(token: string): EnhancedTokenPayload {
    try {
      // Decode header to get kid
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        throw new Error('Invalid token format');
      }

      const keyId = decoded.header.kid as string;
      if (!keyId) {
        throw new Error('Token missing key ID');
      }

      // Find the key
      const keyPair = this.activeKeys.get(keyId);
      if (!keyPair) {
        throw new Error('Unknown key ID');
      }

      // Verify token
      const payload = jwt.verify(token, keyPair.secret, {
        algorithms: ['HS256'],
        issuer: 'botrt-ecommerce',
        audience: 'botrt-users'
      }) as EnhancedTokenPayload;

      // Log token verification (without sensitive data)
      logger.debug('Token verified successfully', {
        userId: payload.userId,
        role: payload.role,
        keyId: keyId.substring(0, 8) + '...',
        sessionId: payload.sessionId?.substring(0, 8) + '...'
      });

      return payload;
    } catch (error) {
      // Log verification failure (without token data)
      logger.warn('Token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hasToken: !!token,
        tokenLength: token?.length
      });
      throw error;
    }
  }

  /**
   * Get active key information (for monitoring)
   */
  getKeyInfo(): {
    currentKeyId: string;
    totalKeys: number;
    activeKeys: number;
    oldestKeyAge: number;
  } {
    const activeKeyCount = Array.from(this.activeKeys.values())
      .filter(key => key.isActive).length;

    const oldestKey = Array.from(this.activeKeys.values())
      .reduce((oldest, current) =>
        current.createdAt < oldest.createdAt ? current : oldest
      );

    return {
      currentKeyId: this.currentKeyId.substring(0, 8) + '...',
      totalKeys: this.activeKeys.size,
      activeKeys: activeKeyCount,
      oldestKeyAge: Date.now() - oldestKey.createdAt.getTime()
    };
  }

  /**
   * Manual key rotation (for emergency situations)
   */
  async forceKeyRotation(): Promise<void> {
    logger.warn('Forcing JWT key rotation');
    await this.rotateKeys();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }

    this.activeKeys.clear();
    logger.info('Enhanced JWT service destroyed');
  }
}

// Export singleton instance
export const enhancedJWTService = EnhancedJWTService.getInstance();

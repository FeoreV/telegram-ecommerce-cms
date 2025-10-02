import crypto from 'crypto';
import { getVaultService } from './VaultService';
import { secretManager } from '../utils/SecretManager';
import { logger } from '../utils/logger';

export interface EncryptionResult {
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface DecryptionInput {
  ciphertext: string;
  iv: string;
  tag: string;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private useVaultTransit: boolean;
  private transitKeyName: string = 'telegram-ecommerce-key';

  private constructor() {
    this.useVaultTransit = process.env.USE_VAULT === 'true';
  }

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Encrypt data using Vault Transit or local encryption
   */
  async encryptData(plaintext: string, context?: string): Promise<string> {
    if (this.useVaultTransit) {
      return this.encryptWithVault(plaintext);
    } else {
      return this.encryptWithLocal(plaintext);
    }
  }

  /**
   * Decrypt data using Vault Transit or local encryption
   */
  async decryptData(ciphertext: string, context?: string): Promise<string> {
    if (this.useVaultTransit) {
      return this.decryptWithVault(ciphertext);
    } else {
      return this.decryptWithLocal(ciphertext);
    }
  }

  /**
   * Encrypt using Vault Transit engine
   */
  private async encryptWithVault(plaintext: string): Promise<string> {
    try {
      const vault = getVaultService();
      return await vault.encrypt(this.transitKeyName, plaintext);
    } catch (err: unknown) {
      logger.error('Vault encryption failed:', err as Record<string, unknown>);
      throw new Error('Failed to encrypt data with Vault');
    }
  }

  /**
   * Decrypt using Vault Transit engine
   */
  private async decryptWithVault(ciphertext: string): Promise<string> {
    try {
      const vault = getVaultService();
      return await vault.decrypt(this.transitKeyName, ciphertext);
    } catch (err: unknown) {
      logger.error('Vault decryption failed:', err as Record<string, unknown>);
      throw new Error('Failed to decrypt data with Vault');
    }
  }

  /**
   * Encrypt using local AES-256-GCM
   */
  private encryptWithLocal(plaintext: string): string {
    try {
      const encryptionSecrets = secretManager.getEncryptionSecrets();
      const key = Buffer.from(encryptionSecrets.dataEncryptionKey, 'hex');
      
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', key);
      
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      const result: EncryptionResult = {
        ciphertext,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
      
      return Buffer.from(JSON.stringify(result)).toString('base64');
    } catch (err: unknown) {
      logger.error('Local encryption failed:', err as Record<string, unknown>);
      throw new Error('Failed to encrypt data locally');
    }
  }

  /**
   * Decrypt using local AES-256-GCM
   */
  private decryptWithLocal(encryptedData: string): string {
    try {
      const encryptionSecrets = secretManager.getEncryptionSecrets();
      const key = Buffer.from(encryptionSecrets.dataEncryptionKey, 'hex');
      
      const data: DecryptionInput = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
      
      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
      
      let plaintext = decipher.update(data.ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');
      
      return plaintext;
    } catch (err: unknown) {
      logger.error('Local decryption failed:', err as Record<string, unknown>);
      throw new Error('Failed to decrypt data locally');
    }
  }

  /**
   * Get encryption secrets (delegate to SecretManager)
   */
  getEncryptionSecrets() {
    return secretManager.getEncryptionSecrets();
  }

  /**
   * Get data encryption key by ID
   */
  async getDataKey(keyId: string): Promise<string | null> {
    try {
      if (this.useVaultTransit) {
        const vault = getVaultService();
        const secret = await vault.getSecret(`data-keys/${keyId}`);
        return secret.key as string || null;
      } else {
        // For local encryption, return the configured data key
        const secrets = this.getEncryptionSecrets();
        return secrets.dataEncryptionKey;
      }
    } catch (err: unknown) {
      logger.error(`Failed to get data key ${keyId}:`, err as Record<string, unknown>);
      return null;
    }
  }

  /**
   * Generate a new data encryption key
   */
  async generateDataKey(keyId: string, keySize: number = 32): Promise<string> {
    try {
      const newKey = crypto.randomBytes(keySize).toString('hex');
      
      if (this.useVaultTransit) {
        const vault = getVaultService();
        await vault.putSecret(`data-keys/${keyId}`, { key: newKey });
      }
      
      logger.info(`Generated new data key: ${keyId}`);
      return newKey;
    } catch (err: unknown) {
      logger.error(`Failed to generate data key ${keyId}:`, err as Record<string, unknown>);
      throw new Error(`Failed to generate data key: ${keyId}`);
    }
  }

  /**
   * Encrypt PII fields for database storage
   */
  async encryptPII(data: Record<string, any>): Promise<Record<string, any>> {
    const piiFields = ['email', 'phone', 'firstName', 'lastName', 'customerInfo'];
    const encrypted = { ...data };

    for (const field of piiFields) {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        encrypted[field] = await this.encryptData(encrypted[field]);
      }
    }

    return encrypted;
  }

  /**
   * Decrypt PII fields from database storage
   */
  async decryptPII(data: Record<string, any>): Promise<Record<string, any>> {
    const piiFields = ['email', 'phone', 'firstName', 'lastName', 'customerInfo'];
    const decrypted = { ...data };

    for (const field of piiFields) {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        try {
          decrypted[field] = await this.decryptData(decrypted[field]);
        } catch (error) {
          // If decryption fails, the field might not be encrypted (migration scenario)
          logger.warn(`Failed to decrypt field ${field}, assuming unencrypted data`);
        }
      }
    }

    return decrypted;
  }

  /**
   * Hash password with salt
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify password against hash
   */
  verifyPassword(password: string, hashedPassword: string): boolean {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate HMAC signature
   */
  generateHMAC(data: string, secret?: string): string {
    const key = secret || secretManager.getEncryptionSecrets().masterKey;
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifyHMAC(data: string, signature: string, secret?: string): boolean {
    const key = secret || secretManager.getEncryptionSecrets().masterKey;
    const expectedSignature = crypto.createHmac('sha256', key).update(data).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Encrypt file content
   */
  async encryptFile(filePath: string, outputPath: string): Promise<void> {
    const fs = await import('fs').then(m => m.promises);
    const content = await fs.readFile(filePath, 'utf8');
    const encrypted = await this.encryptData(content);
    await fs.writeFile(outputPath, encrypted, 'utf8');
  }

  /**
   * Decrypt file content
   */
  async decryptFile(filePath: string, outputPath: string): Promise<void> {
    const fs = await import('fs').then(m => m.promises);
    const encrypted = await fs.readFile(filePath, 'utf8');
    const decrypted = await this.decryptData(encrypted);
    await fs.writeFile(outputPath, decrypted, 'utf8');
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance();

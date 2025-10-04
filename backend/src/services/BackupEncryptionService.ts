import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import zlib from 'zlib';
import { logger } from '../utils/logger';
import { encryptionService } from './EncryptionService';
import { getVaultService } from './VaultService';

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

// SECURITY: Helper function to safely resolve paths and prevent traversal (CWE-22/23)
function safePathJoin(basePath: string, ...paths: string[]): string {
  // Validate that no path component contains traversal sequences
  for (const p of paths) {
    if (p.includes('..') || p.includes('/') || p.includes('\\')) {
      throw new Error('SECURITY: Path traversal detected in path component');
    }
  }

  const joined = path.join(basePath, ...paths);
  const normalized = path.normalize(joined);

  // Ensure the normalized path still starts with the base path
  if (!normalized.startsWith(path.normalize(basePath))) {
    throw new Error('SECURITY: Path traversal attempt detected');
  }

  return normalized;
}

// SECURITY: Validate backup ID format to prevent path traversal
function validateBackupId(backupId: string): void {
  if (!backupId || typeof backupId !== 'string') {
    throw new Error('Invalid backup ID: must be a non-empty string');
  }

  // Only allow alphanumeric characters, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(backupId)) {
    throw new Error('Invalid backup ID format: only alphanumeric, hyphens, and underscores allowed');
  }

  // Prevent path traversal attempts
  if (backupId.includes('..') || backupId.includes('/') || backupId.includes('\\')) {
    throw new Error('SECURITY: Path traversal detected in backup ID');
  }
}

export interface BackupEncryptionConfig {
  enabled: boolean;
  backupPath: string;
  encryptedBackupPath: string;
  compressionEnabled: boolean;
  compressionLevel: number;
  retentionDays: number;
  keyRotationDays: number;
}

export interface BackupMetadata {
  backupId: string;
  originalName: string;
  encryptedName: string;
  createdAt: Date;
  size: number;
  encryptedSize: number;
  checksum: string;
  keyVersion: string;
  compressionRatio: number;
  backupType: 'database' | 'files' | 'logs' | 'full';
  retentionUntil: Date;
}

export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  encryptedSize: number;
  oldestBackup: Date | null;
  newestBackup: Date | null;
  averageCompressionRatio: number;
}

export class BackupEncryptionService {
  private static instance: BackupEncryptionService;
  private config: BackupEncryptionConfig;

  private constructor() {
    this.config = {
      enabled: process.env.BACKUP_ENCRYPTION_ENABLED === 'true',
      backupPath: process.env.BACKUP_PATH || './storage/backups',
      encryptedBackupPath: process.env.ENCRYPTED_BACKUP_PATH || './storage/backups/encrypted',
      compressionEnabled: process.env.BACKUP_COMPRESSION_ENABLED !== 'false',
      compressionLevel: parseInt(process.env.BACKUP_COMPRESSION_LEVEL || '6'),
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      keyRotationDays: parseInt(process.env.BACKUP_KEY_ROTATION_DAYS || '90')
    };
  }

  public static getInstance(): BackupEncryptionService {
    if (!BackupEncryptionService.instance) {
      BackupEncryptionService.instance = new BackupEncryptionService();
    }
    return BackupEncryptionService.instance;
  }

  /**
   * Initialize backup encryption service
   */
  async initialize(): Promise<void> {
    try {
      // Create necessary directories
      await this.ensureDirectories();

      // Verify encryption capabilities
      await this.verifyEncryption();

      logger.info('Backup encryption service initialized', {
        enabled: this.config.enabled,
        compressionEnabled: this.config.compressionEnabled,
        retentionDays: this.config.retentionDays
      });

    } catch (error) {
      logger.error('Failed to initialize backup encryption service:', error);
      throw error;
    }
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const directories = [
      this.config.backupPath,
      this.config.encryptedBackupPath,
      path.join(this.config.encryptedBackupPath, 'database'),
      path.join(this.config.encryptedBackupPath, 'files'),
      path.join(this.config.encryptedBackupPath, 'logs'),
      path.join(this.config.encryptedBackupPath, 'metadata')
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        if ((error as any).code !== 'EEXIST') {
          throw error;
        }
      }
    }
  }

  /**
   * Verify encryption functionality
   */
  private async verifyEncryption(): Promise<void> {
    const testData = Buffer.from('backup-encryption-test');
    const encrypted = await this.encryptData(testData);
    const decrypted = await this.decryptData(encrypted.data, encrypted.keyVersion, encrypted.iv, encrypted.tag);

    if (!testData.equals(decrypted)) {
      throw new Error('Backup encryption verification failed');
    }
  }

  /**
   * Create encrypted backup
   */
  async createEncryptedBackup(
    sourcePath: string,
    backupType: BackupMetadata['backupType'],
    backupName?: string
  ): Promise<BackupMetadata> {
    try {
      if (!this.config.enabled) {
        throw new Error('Backup encryption is disabled');
      }

      const backupId = this.generateBackupId();
      const originalName = backupName || path.basename(sourcePath);

      logger.info('Starting encrypted backup creation', {
        backupId,
        sourcePath,
        backupType,
        originalName
      });

      // Read and optionally compress source data
      let sourceData: Buffer;
      if (this.config.compressionEnabled) {
        sourceData = await this.compressData(sourcePath);
      } else {
        sourceData = await fs.readFile(sourcePath);
      }

      const originalSize = sourceData.length;
      const checksum = crypto.createHash('sha256').update(sourceData).digest('hex');

      // Encrypt the data
      const encrypted = await this.encryptData(sourceData);

      // Generate encrypted filename
      const encryptedName = `${backupId}.backup`;
      const encryptedPath = path.join(this.config.encryptedBackupPath, backupType, encryptedName);

      // Prepare encrypted backup structure
      const encryptedBackupData = {
        version: '1.0',
        backupId,
        backupType,
        algorithm: 'aes-256-gcm',
        keyVersion: encrypted.keyVersion,
        compressed: this.config.compressionEnabled,
        iv: encrypted.iv.toString('base64'),
        tag: encrypted.tag.toString('base64'),
        checksum,
        createdAt: new Date().toISOString(),
        data: encrypted.data.toString('base64')
      };

      // Write encrypted backup
      await fs.writeFile(encryptedPath, JSON.stringify(encryptedBackupData));

      // Get encrypted file size
      const encryptedStats = await fs.stat(encryptedPath);
      const encryptedSize = encryptedStats.size;

      // Calculate retention date
      const retentionUntil = new Date();
      retentionUntil.setDate(retentionUntil.getDate() + this.config.retentionDays);

      // Create metadata
      const metadata: BackupMetadata = {
        backupId,
        originalName,
        encryptedName,
        createdAt: new Date(),
        size: originalSize,
        encryptedSize,
        checksum,
        keyVersion: encrypted.keyVersion,
        compressionRatio: this.config.compressionEnabled ? originalSize / sourceData.length : 1,
        backupType,
        retentionUntil
      };

      // Store metadata
      await this.storeBackupMetadata(metadata);

      logger.info('Encrypted backup created successfully', {
        backupId,
        originalSize,
        encryptedSize,
        compressionRatio: metadata.compressionRatio.toFixed(2)
      });

      return metadata;

    } catch (error) {
      logger.error('Failed to create encrypted backup:', error);
      throw error;
    }
  }

  /**
   * Restore from encrypted backup
   */
  async restoreFromBackup(
    backupId: string,
    targetPath: string
  ): Promise<BackupMetadata> {
    try {
      if (!this.config.enabled) {
        throw new Error('Backup encryption is disabled');
      }

      // Load metadata
      const metadata = await this.loadBackupMetadata(backupId);

      // Read encrypted backup
      const encryptedPath = path.join(
        this.config.encryptedBackupPath,
        metadata.backupType,
        metadata.encryptedName
      );

      const encryptedContent = await fs.readFile(encryptedPath, 'utf8');
      const encryptedBackupData = JSON.parse(encryptedContent);

      // Extract encryption components
      const iv = Buffer.from(encryptedBackupData.iv, 'base64');
      const tag = Buffer.from(encryptedBackupData.tag, 'base64');
      const data = Buffer.from(encryptedBackupData.data, 'base64');

      // Decrypt the data
      let decryptedData = await this.decryptData(data, encryptedBackupData.keyVersion, iv, tag);

      // Decompress if needed
      if (encryptedBackupData.compressed) {
        decryptedData = await this.decompressData(decryptedData);
      }

      // Verify checksum
      const checksum = crypto.createHash('sha256').update(decryptedData).digest('hex');
      if (checksum !== metadata.checksum) {
        throw new Error('Backup integrity check failed');
      }

      // Write restored data
      await fs.writeFile(targetPath, decryptedData);

      logger.info('Backup restored successfully', {
        backupId,
        targetPath,
        size: decryptedData.length
      });

      return metadata;

    } catch (error) {
      logger.error('Failed to restore from backup:', error);
      throw error;
    }
  }

  /**
   * Encrypt data using Vault or local encryption
   */
  private async encryptData(data: Buffer): Promise<{
    data: Buffer;
    keyVersion: string;
    iv: Buffer;
    tag: Buffer;
  }> {
    try {
      const useVault = process.env.USE_VAULT === 'true';

      if (useVault) {
        const vault = getVaultService();
        const encryptedData = await vault.encrypt('backup-key', data.toString('base64'));

        return {
          data: Buffer.from(encryptedData),
          keyVersion: 'vault-backup-1',
          iv: Buffer.alloc(16), // Vault manages IV
          tag: Buffer.alloc(16) // Vault manages tag
        };
      } else {
        // Local encryption with dedicated backup key
        const key = encryptionService.getEncryptionSecrets().masterKey;
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipher('aes-256-gcm', Buffer.from(key, 'hex'));
        cipher.setAAD(Buffer.from('backup-encryption', 'utf8'));

        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const tag = cipher.getAuthTag();

        return {
          data: encrypted,
          keyVersion: 'local-backup-1',
          iv,
          tag
        };
      }

    } catch (error) {
      logger.error('Failed to encrypt backup data:', error);
      throw error;
    }
  }

  /**
   * Decrypt backup data
   */
  private async decryptData(
    encryptedData: Buffer,
    keyVersion: string,
    iv: Buffer,
    tag: Buffer
  ): Promise<Buffer> {
    try {
      if (keyVersion.startsWith('vault-')) {
        const vault = getVaultService();
        const decryptedData = await vault.decrypt('backup-key', encryptedData.toString());
        return Buffer.from(decryptedData, 'base64');
      } else {
        // Local decryption
        const key = encryptionService.getEncryptionSecrets().masterKey;

        const decipher = crypto.createDecipher('aes-256-gcm', Buffer.from(key, 'hex'));
        decipher.setAAD(Buffer.from('backup-encryption', 'utf8'));
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted;
      }

    } catch (error) {
      logger.error('Failed to decrypt backup data:', error);
      throw error;
    }
  }

  /**
   * Compress data using zlib (CWE-94 fix: no command execution)
   */
  private async compressData(sourcePath: string): Promise<Buffer> {
    const data = await fs.readFile(sourcePath);
    // Clamp compression level to valid range (0-9)
    const level = Math.max(0, Math.min(9, this.config.compressionLevel));
    return await gzipAsync(data, { level });
  }

  /**
   * Decompress data using zlib (CWE-94 fix: no command execution)
   */
  private async decompressData(compressedData: Buffer): Promise<Buffer> {
    return await gunzipAsync(compressedData);
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }

  /**
   * Store backup metadata
   */
  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    // SECURITY: Validate backup ID to prevent path traversal (CWE-22/23)
    validateBackupId(metadata.backupId);

    const metadataPath = safePathJoin(
      this.config.encryptedBackupPath,
      'metadata',
      `${metadata.backupId}.json`
    );
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load backup metadata
   */
  private async loadBackupMetadata(backupId: string): Promise<BackupMetadata> {
    // SECURITY: Validate backup ID to prevent path traversal (CWE-22/23)
    validateBackupId(backupId);

    const metadataPath = safePathJoin(
      this.config.encryptedBackupPath,
      'metadata',
      `${backupId}.json`
    );
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(metadataContent);
  }

  /**
   * List all backups
   */
  async listBackups(backupType?: BackupMetadata['backupType']): Promise<BackupMetadata[]> {
    try {
      const metadataDir = safePathJoin(this.config.encryptedBackupPath, 'metadata');
      const files = await fs.readdir(metadataDir);

      const metadataFiles = files.filter(file => file.endsWith('.json'));
      const backupList: BackupMetadata[] = [];

      for (const metaFile of metadataFiles) {
        try {
          const backupId = metaFile.replace('.json', '');
          const metadata = await this.loadBackupMetadata(backupId);

          if (!backupType || metadata.backupType === backupType) {
            backupList.push(metadata);
          }
        } catch (error) {
          logger.warn(`Failed to load backup metadata for ${metaFile}:`, error);
        }
      }

      // Sort by creation date (newest first)
      return backupList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    } catch (error) {
      logger.error('Failed to list backups:', error);
      throw error;
    }
  }

  /**
   * Delete expired backups
   */
  async cleanupExpiredBackups(): Promise<number> {
    try {
      const allBackups = await this.listBackups();
      const now = new Date();
      let deletedCount = 0;

      for (const backup of allBackups) {
        if (backup.retentionUntil < now) {
          try {
            await this.deleteBackup(backup.backupId);
            deletedCount++;

            logger.info('Deleted expired backup', {
              backupId: backup.backupId,
              createdAt: backup.createdAt,
              retentionUntil: backup.retentionUntil
            });
          } catch (error) {
            logger.error(`Failed to delete expired backup ${backup.backupId}:`, error);
          }
        }
      }

      logger.info('Backup cleanup completed', { deletedCount });
      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup expired backups:', error);
      throw error;
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const metadata = await this.loadBackupMetadata(backupId);

      const backupPath = path.join(
        this.config.encryptedBackupPath,
        metadata.backupType,
        metadata.encryptedName
      );

      const metadataPath = path.join(
        this.config.encryptedBackupPath,
        'metadata',
        `${backupId}.json`
      );

      // Delete backup file and metadata
      await Promise.all([
        fs.unlink(backupPath).catch(() => {}), // Ignore if file doesn't exist
        fs.unlink(metadataPath).catch(() => {}) // Ignore if metadata doesn't exist
      ]);

      logger.info('Backup deleted successfully', { backupId });

    } catch (error) {
      logger.error('Failed to delete backup:', error);
      throw error;
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<BackupStats> {
    try {
      const backups = await this.listBackups();

      if (backups.length === 0) {
        return {
          totalBackups: 0,
          totalSize: 0,
          encryptedSize: 0,
          oldestBackup: null,
          newestBackup: null,
          averageCompressionRatio: 1
        };
      }

      const totalBackups = backups.length;
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      const encryptedSize = backups.reduce((sum, backup) => sum + backup.encryptedSize, 0);
      const oldestBackup = backups[backups.length - 1].createdAt;
      const newestBackup = backups[0].createdAt;
      const averageCompressionRatio = backups.reduce((sum, backup) => sum + backup.compressionRatio, 0) / totalBackups;

      return {
        totalBackups,
        totalSize,
        encryptedSize,
        oldestBackup,
        newestBackup,
        averageCompressionRatio
      };

    } catch (error) {
      logger.error('Failed to get backup statistics:', error);
      throw error;
    }
  }

  /**
   * Health check for backup encryption
   */
  async healthCheck(): Promise<{
    status: string;
    enabled: boolean;
    stats: BackupStats;
    directories: { [key: string]: boolean };
  }> {
    try {
      const stats = await this.getBackupStats();

      // Check if directories exist
      const directories = {
        backup: await this.directoryExists(this.config.backupPath),
        encrypted: await this.directoryExists(this.config.encryptedBackupPath),
        metadata: await this.directoryExists(path.join(this.config.encryptedBackupPath, 'metadata'))
      };

      return {
        status: 'healthy',
        enabled: this.config.enabled,
        stats,
        directories
      };

    } catch (error) {
      logger.error('Backup encryption health check failed:', error);
      return {
        status: 'error',
        enabled: false,
        stats: {
          totalBackups: 0,
          totalSize: 0,
          encryptedSize: 0,
          oldestBackup: null,
          newestBackup: null,
          averageCompressionRatio: 1
        },
        directories: {}
      };
    }
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): BackupEncryptionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const backupEncryptionService = BackupEncryptionService.getInstance();

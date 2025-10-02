import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { encryptionService } from './EncryptionService';
import { getVaultService } from './VaultService';
import { logger } from '../utils/logger';

export interface StorageEncryptionConfig {
  enabled: boolean;
  encryptionAlgorithm: string;
  keyDerivationIterations: number;
  storageBasePath: string;
  backupPath: string;
  tempPath: string;
}

export interface EncryptedFileMetadata {
  originalName: string;
  encryptedName: string;
  size: number;
  encryptedSize: number;
  mimeType: string;
  checksum: string;
  encryptedAt: Date;
  keyVersion: string;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  encryptedFiles: number;
  encryptedSize: number;
  compressionRatio: number;
}

export class StorageEncryptionService {
  private static instance: StorageEncryptionService;
  private config: StorageEncryptionConfig;

  private constructor() {
    this.config = {
      enabled: process.env.STORAGE_ENCRYPTION_ENABLED === 'true',
      encryptionAlgorithm: 'aes-256-gcm',
      keyDerivationIterations: 100000,
      storageBasePath: process.env.STORAGE_BASE_PATH || './storage',
      backupPath: process.env.BACKUP_PATH || './storage/backups',
      tempPath: process.env.TEMP_PATH || './storage/temp'
    };
  }

  public static getInstance(): StorageEncryptionService {
    if (!StorageEncryptionService.instance) {
      StorageEncryptionService.instance = new StorageEncryptionService();
    }
    return StorageEncryptionService.instance;
  }

  /**
   * Initialize storage encryption service
   */
  async initialize(): Promise<void> {
    try {
      // Create necessary directories
      await this.ensureDirectories();
      
      // Verify encryption capabilities
      await this.verifyEncryption();
      
      logger.info('Storage encryption service initialized', {
        enabled: this.config.enabled,
        algorithm: this.config.encryptionAlgorithm
      });

    } catch (error) {
      logger.error('Failed to initialize storage encryption service:', error);
      throw error;
    }
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const directories = [
      this.config.storageBasePath,
      this.config.backupPath,
      this.config.tempPath,
      path.join(this.config.storageBasePath, 'uploads'),
      path.join(this.config.storageBasePath, 'logs'),
      path.join(this.config.storageBasePath, 'encrypted')
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
    const testData = 'encryption-test-data';
    const encrypted = await this.encryptData(Buffer.from(testData));
    const decrypted = await this.decryptData(encrypted.data, encrypted.key, encrypted.iv, encrypted.tag);
    
    if (decrypted.toString() !== testData) {
      throw new Error('Encryption verification failed');
    }
  }

  /**
   * Encrypt file and store it
   */
  async encryptFile(
    filePath: string,
    originalName: string,
    mimeType: string = 'application/octet-stream'
  ): Promise<EncryptedFileMetadata> {
    try {
      if (!this.config.enabled) {
        throw new Error('Storage encryption is disabled');
      }

      // Read original file
      const originalData = await fs.readFile(filePath);
      const originalSize = originalData.length;
      const checksum = crypto.createHash('sha256').update(originalData).digest('hex');

      // Encrypt the data
      const encrypted = await this.encryptData(originalData);

      // Generate encrypted filename
      const encryptedName = this.generateEncryptedFilename(originalName);
      const encryptedPath = path.join(this.config.storageBasePath, 'encrypted', encryptedName);

      // Prepare encrypted file structure
      const encryptedFileData = {
        version: '1.0',
        algorithm: this.config.encryptionAlgorithm,
        keyVersion: encrypted.keyVersion,
        iv: encrypted.iv.toString('base64'),
        tag: encrypted.tag.toString('base64'),
        data: encrypted.data.toString('base64')
      };

      // Write encrypted file
      await fs.writeFile(encryptedPath, JSON.stringify(encryptedFileData), 'utf8');

      // Get encrypted file size
      const encryptedStats = await fs.stat(encryptedPath);
      const encryptedSize = encryptedStats.size;

      // Create metadata
      const metadata: EncryptedFileMetadata = {
        originalName,
        encryptedName,
        size: originalSize,
        encryptedSize,
        mimeType,
        checksum,
        encryptedAt: new Date(),
        keyVersion: encrypted.keyVersion
      };

      // Store metadata
      await this.storeMetadata(encryptedName, metadata);

      logger.info('File encrypted successfully', {
        originalName,
        encryptedName,
        originalSize,
        encryptedSize,
        compressionRatio: (originalSize / encryptedSize).toFixed(2)
      });

      return metadata;

    } catch (error) {
      logger.error('Failed to encrypt file:', error);
      throw error;
    }
  }

  /**
   * Decrypt file and return data
   */
  async decryptFile(encryptedName: string): Promise<{
    data: Buffer;
    metadata: EncryptedFileMetadata;
  }> {
    try {
      if (!this.config.enabled) {
        throw new Error('Storage encryption is disabled');
      }

      // Load metadata
      const metadata = await this.loadMetadata(encryptedName);
      
      // Read encrypted file
      const encryptedPath = path.join(this.config.storageBasePath, 'encrypted', encryptedName);
      const encryptedFileContent = await fs.readFile(encryptedPath, 'utf8');
      const encryptedFileData = JSON.parse(encryptedFileContent);

      // Extract encryption components
      const iv = Buffer.from(encryptedFileData.iv, 'base64');
      const tag = Buffer.from(encryptedFileData.tag, 'base64');
      const data = Buffer.from(encryptedFileData.data, 'base64');

      // Decrypt the data
      const decryptedData = await this.decryptData(data, encryptedFileData.keyVersion, iv, tag);

      // Verify checksum
      const checksum = crypto.createHash('sha256').update(decryptedData).digest('hex');
      if (checksum !== metadata.checksum) {
        throw new Error('File integrity check failed');
      }

      logger.debug('File decrypted successfully', {
        encryptedName,
        originalName: metadata.originalName,
        size: decryptedData.length
      });

      return {
        data: decryptedData,
        metadata
      };

    } catch (error) {
      logger.error('Failed to decrypt file:', error);
      throw error;
    }
  }

  /**
   * Encrypt data buffer
   */
  private async encryptData(data: Buffer): Promise<{
    data: Buffer;
    key: string;
    iv: Buffer;
    tag: Buffer;
    keyVersion: string;
  }> {
    try {
      // Use Vault transit engine if available, otherwise use local encryption
      const useVault = process.env.USE_VAULT === 'true';
      
      if (useVault) {
        const vault = getVaultService();
        const encryptedData = await vault.encrypt('file-storage-key', data.toString('base64'));
        
        // For Vault, we return the encrypted string as data
        return {
          data: Buffer.from(encryptedData),
          key: 'vault-managed',
          iv: Buffer.alloc(16), // Vault manages IV
          tag: Buffer.alloc(16), // Vault manages tag
          keyVersion: 'vault-1'
        };
      } else {
        // Local encryption
        const key = encryptionService.getEncryptionSecrets().dataEncryptionKey;
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher(this.config.encryptionAlgorithm, Buffer.from(key, 'hex'));
        
        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const tag = (cipher as any).getAuthTag();

        return {
          data: encrypted,
          key,
          iv,
          tag,
          keyVersion: 'local-1'
        };
      }

    } catch (error) {
      logger.error('Failed to encrypt data:', error);
      throw error;
    }
  }

  /**
   * Decrypt data buffer
   */
  private async decryptData(
    encryptedData: Buffer,
    keyVersion: string,
    iv: Buffer,
    tag: Buffer
  ): Promise<Buffer> {
    try {
      if (keyVersion.startsWith('vault-')) {
        // Use Vault transit engine
        const vault = getVaultService();
        const decryptedData = await vault.decrypt('file-storage-key', encryptedData.toString());
        return Buffer.from(decryptedData, 'base64');
      } else {
        // Local decryption
        const key = encryptionService.getEncryptionSecrets().dataEncryptionKey;
        
        const decipher = crypto.createDecipher(this.config.encryptionAlgorithm, Buffer.from(key, 'hex'));
        (decipher as any).setAuthTag(tag);
        
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted;
      }

    } catch (error) {
      logger.error('Failed to decrypt data:', error);
      throw error;
    }
  }

  /**
   * Encrypt buffer data
   */
  async encryptBuffer(data: Buffer): Promise<Buffer> {
    try {
      const encrypted = await this.encryptData(data);
      return encrypted.data;
    } catch (error) {
      logger.error('Failed to encrypt buffer:', error);
      throw error;
    }
  }

  /**
   * Decrypt buffer data
   */
  async decryptBuffer(encryptedData: Buffer): Promise<Buffer> {
    try {
      // For simplified implementation, assume IV and tag are stored with data
      // In real implementation, you would need to extract these from the encrypted data
      const iv = crypto.randomBytes(16); // This should be extracted from encrypted data
      const tag = Buffer.alloc(16); // This should be extracted from encrypted data
      
      const decrypted = await this.decryptData(encryptedData, 'local-v1', iv, tag);
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt buffer:', error);
      throw error;
    }
  }

  /**
   * Generate encrypted filename
   */
  private generateEncryptedFilename(originalName: string): string {
    const hash = crypto.createHash('sha256').update(originalName + Date.now()).digest('hex');
    return `${hash.substring(0, 16)}.enc`;
  }

  /**
   * Store file metadata
   */
  private async storeMetadata(encryptedName: string, metadata: EncryptedFileMetadata): Promise<void> {
    const metadataPath = path.join(this.config.storageBasePath, 'encrypted', `${encryptedName}.meta`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load file metadata
   */
  private async loadMetadata(encryptedName: string): Promise<EncryptedFileMetadata> {
    const metadataPath = path.join(this.config.storageBasePath, 'encrypted', `${encryptedName}.meta`);
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(metadataContent);
  }

  /**
   * Delete encrypted file
   */
  async deleteFile(encryptedName: string): Promise<void> {
    try {
      const encryptedPath = path.join(this.config.storageBasePath, 'encrypted', encryptedName);
      const metadataPath = path.join(this.config.storageBasePath, 'encrypted', `${encryptedName}.meta`);

      // Delete encrypted file and metadata
      await Promise.all([
        fs.unlink(encryptedPath).catch(() => {}), // Ignore if file doesn't exist
        fs.unlink(metadataPath).catch(() => {})   // Ignore if metadata doesn't exist
      ]);

      logger.info('Encrypted file deleted', { encryptedName });

    } catch (error) {
      logger.error('Failed to delete encrypted file:', error);
      throw error;
    }
  }

  /**
   * List encrypted files
   */
  async listFiles(): Promise<EncryptedFileMetadata[]> {
    try {
      const encryptedDir = path.join(this.config.storageBasePath, 'encrypted');
      const files = await fs.readdir(encryptedDir);
      
      const metadataFiles = files.filter(file => file.endsWith('.meta'));
      const metadataList: EncryptedFileMetadata[] = [];

      for (const metaFile of metadataFiles) {
        try {
          const metadata = await this.loadMetadata(metaFile.replace('.meta', ''));
          metadataList.push(metadata);
        } catch (error) {
          logger.warn(`Failed to load metadata for ${metaFile}:`, error);
        }
      }

      return metadataList;

    } catch (error) {
      logger.error('Failed to list encrypted files:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const files = await this.listFiles();
      
      const totalFiles = files.length;
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const encryptedFiles = files.length; // All files are encrypted
      const encryptedSize = files.reduce((sum, file) => sum + file.encryptedSize, 0);
      const compressionRatio = totalSize > 0 ? encryptedSize / totalSize : 1;

      return {
        totalFiles,
        totalSize,
        encryptedFiles,
        encryptedSize,
        compressionRatio
      };

    } catch (error) {
      logger.error('Failed to get storage statistics:', error);
      throw error;
    }
  }

  /**
   * Encrypt existing files in storage
   */
  async encryptExistingFiles(sourceDir: string): Promise<number> {
    try {
      let processedCount = 0;
      const files = await fs.readdir(sourceDir, { withFileTypes: true });

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(sourceDir, file.name);
          
          try {
            await this.encryptFile(filePath, file.name);
            processedCount++;
            
            // Optionally delete original file after successful encryption
            if (process.env.DELETE_ORIGINAL_AFTER_ENCRYPTION === 'true') {
              await fs.unlink(filePath);
            }
            
          } catch (error) {
            logger.error(`Failed to encrypt file ${file.name}:`, error);
          }
        }
      }

      logger.info(`Encrypted ${processedCount} existing files from ${sourceDir}`);
      return processedCount;

    } catch (error) {
      logger.error('Failed to encrypt existing files:', error);
      throw error;
    }
  }

  /**
   * Health check for storage encryption
   */
  async healthCheck(): Promise<{
    status: string;
    enabled: boolean;
    stats: StorageStats;
    directories: { [key: string]: boolean };
  }> {
    try {
      const stats = await this.getStorageStats();
      
      // Check if directories exist
      const directories = {
        storage: await this.directoryExists(this.config.storageBasePath),
        backup: await this.directoryExists(this.config.backupPath),
        temp: await this.directoryExists(this.config.tempPath),
        encrypted: await this.directoryExists(path.join(this.config.storageBasePath, 'encrypted'))
      };

      return {
        status: 'healthy',
        enabled: this.config.enabled,
        stats,
        directories
      };

    } catch (error) {
      logger.error('Storage encryption health check failed:', error);
      return {
        status: 'error',
        enabled: false,
        stats: {
          totalFiles: 0,
          totalSize: 0,
          encryptedFiles: 0,
          encryptedSize: 0,
          compressionRatio: 1
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
  getConfiguration(): StorageEncryptionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const storageEncryptionService = StorageEncryptionService.getInstance();

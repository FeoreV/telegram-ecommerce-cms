import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Transform, TransformCallback } from 'stream';
import { logger } from '../utils/logger';
import { encryptionService } from './EncryptionService';
import { getVaultService } from './VaultService';

export interface LogEncryptionConfig {
  enabled: boolean;
  logBasePath: string;
  encryptedLogPath: string;
  rotationSize: number; // bytes
  rotationInterval: number; // hours
  retentionDays: number;
  compressionEnabled: boolean;
  realtimeEncryption: boolean;
}

export interface EncryptedLogMetadata {
  logId: string;
  originalFile: string;
  encryptedFile: string;
  createdAt: Date;
  rotatedAt: Date;
  size: number;
  encryptedSize: number;
  checksum: string;
  keyVersion: string;
  logLevel: string;
  service: string;
}

export interface LogStats {
  totalLogs: number;
  totalSize: number;
  encryptedSize: number;
  oldestLog: Date | null;
  newestLog: Date | null;
  logsByLevel: { [level: string]: number };
}

export class LogEncryptionService {
  private static instance: LogEncryptionService;
  private config: LogEncryptionConfig;
  private encryptionStreams: Map<string, EncryptedLogStream> = new Map();

  private constructor() {
    this.config = {
      enabled: process.env.LOG_ENCRYPTION_ENABLED === 'true',
      logBasePath: process.env.LOG_BASE_PATH || './storage/logs',
      encryptedLogPath: process.env.ENCRYPTED_LOG_PATH || './storage/logs/encrypted',
      rotationSize: parseInt(process.env.LOG_ROTATION_SIZE || '104857600'), // 100MB
      rotationInterval: parseInt(process.env.LOG_ROTATION_INTERVAL || '24'), // 24 hours
      retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '90'),
      compressionEnabled: process.env.LOG_COMPRESSION_ENABLED !== 'false',
      realtimeEncryption: process.env.LOG_REALTIME_ENCRYPTION === 'true'
    };
  }

  public static getInstance(): LogEncryptionService {
    if (!LogEncryptionService.instance) {
      LogEncryptionService.instance = new LogEncryptionService();
    }
    return LogEncryptionService.instance;
  }

  /**
   * Initialize log encryption service
   */
  async initialize(): Promise<void> {
    try {
      // Create necessary directories
      await this.ensureDirectories();

      // Set up log rotation scheduler
      if (this.config.enabled) {
        this.setupLogRotation();
      }

      logger.info('Log encryption service initialized', {
        enabled: this.config.enabled,
        realtimeEncryption: this.config.realtimeEncryption,
        retentionDays: this.config.retentionDays
      });

    } catch (error) {
      logger.error('Failed to initialize log encryption service:', error);
      throw error;
    }
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const directories = [
      this.config.logBasePath,
      this.config.encryptedLogPath,
      path.join(this.config.encryptedLogPath, 'metadata'),
      path.join(this.config.encryptedLogPath, 'archived')
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
   * Create encrypted log stream
   */
  createEncryptedLogStream(
    logFile: string,
    logLevel: string = 'info',
    service: string = 'backend'
  ): EncryptedLogStream {
    if (!this.config.enabled || !this.config.realtimeEncryption) {
      throw new Error('Real-time log encryption is disabled');
    }

    const streamId = `${service}-${logLevel}-${Date.now()}`;
    const stream = new EncryptedLogStream(logFile, logLevel, service, this.config);

    this.encryptionStreams.set(streamId, stream);

    // Clean up stream when it ends
    stream.on('end', () => {
      this.encryptionStreams.delete(streamId);
    });

    return stream;
  }

  /**
   * Encrypt existing log file
   */
  async encryptLogFile(
    logFilePath: string,
    logLevel: string = 'info',
    service: string = 'backend'
  ): Promise<EncryptedLogMetadata> {
    try {
      if (!this.config.enabled) {
        throw new Error('Log encryption is disabled');
      }

      const logId = this.generateLogId(service, logLevel);
      const originalFile = path.basename(logFilePath);

      logger.debug('Starting log file encryption', {
        logId,
        logFilePath,
        logLevel,
        service
      });

      // Read log file
      const logData = await fs.readFile(logFilePath);
      const originalSize = logData.length;
      const checksum = crypto.createHash('sha256').update(logData).digest('hex');

      // Compress if enabled
      let processedData = logData;
      if (this.config.compressionEnabled) {
        processedData = await this.compressLogData(logData);
      }

      // Encrypt the data
      const encrypted = await this.encryptLogData(processedData);

      // Generate encrypted filename
      const encryptedFile = `${logId}.log.enc`;
      const encryptedPath = path.join(this.config.encryptedLogPath, encryptedFile);

      // Prepare encrypted log structure
      const encryptedLogData = {
        version: '1.0',
        logId,
        service,
        logLevel,
        algorithm: 'aes-256-gcm',
        keyVersion: encrypted.keyVersion,
        compressed: this.config.compressionEnabled,
        iv: encrypted.iv.toString('base64'),
        tag: encrypted.tag.toString('base64'),
        checksum,
        createdAt: new Date().toISOString(),
        data: encrypted.data.toString('base64')
      };

      // Write encrypted log
      await fs.writeFile(encryptedPath, JSON.stringify(encryptedLogData));

      // Get encrypted file size
      const encryptedStats = await fs.stat(encryptedPath);
      const encryptedSize = encryptedStats.size;

      // Create metadata
      const metadata: EncryptedLogMetadata = {
        logId,
        originalFile,
        encryptedFile,
        createdAt: new Date(),
        rotatedAt: new Date(),
        size: originalSize,
        encryptedSize,
        checksum,
        keyVersion: encrypted.keyVersion,
        logLevel,
        service
      };

      // Store metadata
      await this.storeLogMetadata(metadata);

      logger.info('Log file encrypted successfully', {
        logId,
        originalSize,
        encryptedSize,
        compressionRatio: this.config.compressionEnabled ? originalSize / processedData.length : 1
      });

      return metadata;

    } catch (error) {
      logger.error('Failed to encrypt log file:', error);
      throw error;
    }
  }

  /**
   * Decrypt log file
   */
  async decryptLogFile(logId: string, targetPath?: string): Promise<{
    data: Buffer;
    metadata: EncryptedLogMetadata;
  }> {
    try {
      if (!this.config.enabled) {
        throw new Error('Log encryption is disabled');
      }

      // Load metadata
      const metadata = await this.loadLogMetadata(logId);

      // Read encrypted log
      const encryptedPath = path.join(this.config.encryptedLogPath, metadata.encryptedFile);
      const encryptedContent = await fs.readFile(encryptedPath, 'utf8');
      const encryptedLogData = JSON.parse(encryptedContent);

      // Extract encryption components
      const iv = Buffer.from(encryptedLogData.iv, 'base64');
      const tag = Buffer.from(encryptedLogData.tag, 'base64');
      const data = Buffer.from(encryptedLogData.data, 'base64');

      // Decrypt the data
      let decryptedData = await this.decryptLogData(data, encryptedLogData.keyVersion, iv, tag);

      // Decompress if needed
      if (encryptedLogData.compressed) {
        decryptedData = await this.decompressLogData(decryptedData);
      }

      // Verify checksum
      const checksum = crypto.createHash('sha256').update(decryptedData).digest('hex');
      if (checksum !== metadata.checksum) {
        throw new Error('Log integrity check failed');
      }

      // Write to target path if specified
      if (targetPath) {
        await fs.writeFile(targetPath, decryptedData);
      }

      logger.info('Log file decrypted successfully', {
        logId,
        size: decryptedData.length,
        targetPath
      });

      return {
        data: decryptedData,
        metadata
      };

    } catch (error) {
      logger.error('Failed to decrypt log file:', error);
      throw error;
    }
  }

  /**
   * Encrypt log data
   */
  private async encryptLogData(data: Buffer): Promise<{
    data: Buffer;
    keyVersion: string;
    iv: Buffer;
    tag: Buffer;
  }> {
    try {
      const useVault = process.env.USE_VAULT === 'true';

      if (useVault) {
        const vault = getVaultService();
        const encryptedData = await vault.encrypt('app-data-key', data.toString('base64'));

        return {
          data: Buffer.from(encryptedData),
          keyVersion: 'vault-log-1',
          iv: Buffer.alloc(16), // Vault manages IV
          tag: Buffer.alloc(16) // Vault manages tag
        };
      } else {
        // Local encryption
        const key = encryptionService.getEncryptionSecrets().dataEncryptionKey;
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
        cipher.setAAD(Buffer.from('log-encryption', 'utf8'));

        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const tag = cipher.getAuthTag();

        return {
          data: encrypted,
          keyVersion: 'local-log-1',
          iv,
          tag
        };
      }

    } catch (error) {
      logger.error('Failed to encrypt log data:', error);
      throw error;
    }
  }

  /**
   * Decrypt log data
   */
  private async decryptLogData(
    encryptedData: Buffer,
    keyVersion: string,
    iv: Buffer,
    tag: Buffer
  ): Promise<Buffer> {
    try {
      if (keyVersion.startsWith('vault-')) {
        const vault = getVaultService();
        const decryptedData = await vault.decrypt('app-data-key', encryptedData.toString());
        return Buffer.from(decryptedData, 'base64');
      } else {
        // Local decryption
        const key = encryptionService.getEncryptionSecrets().dataEncryptionKey;

        const decipher = crypto.createDecipher('aes-256-gcm', Buffer.from(key, 'hex'));
        decipher.setAAD(Buffer.from('log-encryption', 'utf8'));
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted;
      }

    } catch (error) {
      logger.error('Failed to decrypt log data:', error);
      throw error;
    }
  }

  /**
   * Compress log data
   */
  private async compressLogData(data: Buffer): Promise<Buffer> {
    // Simple gzip compression
    const zlib = await import('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(data, { level: 6 }, (error, compressed) => {
        if (error) {
          reject(error);
        } else {
          resolve(compressed);
        }
      });
    });
  }

  /**
   * Decompress log data
   */
  private async decompressLogData(compressedData: Buffer): Promise<Buffer> {
    const zlib = await import('zlib');
    return new Promise((resolve, reject) => {
      zlib.gunzip(compressedData, (error, decompressed) => {
        if (error) {
          reject(error);
        } else {
          resolve(decompressed);
        }
      });
    });
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(service: string, logLevel: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `log-${service}-${logLevel}-${timestamp}-${random}`;
  }

  /**
   * Store log metadata
   */
  private async storeLogMetadata(metadata: EncryptedLogMetadata): Promise<void> {
    const metadataPath = path.join(
      this.config.encryptedLogPath,
      'metadata',
      `${metadata.logId}.json`
    );
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load log metadata
   */
  private async loadLogMetadata(logId: string): Promise<EncryptedLogMetadata> {
    const metadataPath = path.join(
      this.config.encryptedLogPath,
      'metadata',
      `${logId}.json`
    );
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(metadataContent);
  }

  /**
   * Set up log rotation scheduler
   */
  private setupLogRotation(): void {
    // Rotate logs every hour
    setInterval(() => {
      this.rotateLogsIfNeeded().catch(error => {
        logger.error('Log rotation failed:', error);
      });
    }, 60 * 60 * 1000); // 1 hour

    // Cleanup old logs daily
    setInterval(() => {
      this.cleanupOldLogs().catch(error => {
        logger.error('Log cleanup failed:', error);
      });
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Rotate logs if needed
   */
  private async rotateLogsIfNeeded(): Promise<void> {
    try {
      const logFiles = await fs.readdir(this.config.logBasePath);

      for (const logFile of logFiles) {
        if (logFile.endsWith('.log')) {
          const logPath = path.join(this.config.logBasePath, logFile);
          const stats = await fs.stat(logPath);

          // Check if rotation is needed based on size or time
          const needsRotation =
            stats.size > this.config.rotationSize ||
            (Date.now() - stats.mtime.getTime()) > (this.config.rotationInterval * 60 * 60 * 1000);

          if (needsRotation) {
            await this.encryptLogFile(logPath);

            // Archive the original log
            const archivedPath = path.join(
              this.config.encryptedLogPath,
              'archived',
              `${logFile}.${Date.now()}`
            );
            await fs.rename(logPath, archivedPath);

            logger.info('Log file rotated and encrypted', {
              originalFile: logFile,
              size: stats.size
            });
          }
        }
      }

    } catch (error) {
      logger.error('Failed to rotate logs:', error);
    }
  }

  /**
   * Clean up old logs
   */
  private async cleanupOldLogs(): Promise<number> {
    try {
      const logs = await this.listLogs();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      let deletedCount = 0;

      for (const log of logs) {
        if (log.createdAt < cutoffDate) {
          try {
            await this.deleteLog(log.logId);
            deletedCount++;
          } catch (error) {
            logger.error(`Failed to delete old log ${log.logId}:`, error);
          }
        }
      }

      logger.info('Old logs cleanup completed', { deletedCount });
      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup old logs:', error);
      throw error;
    }
  }

  /**
   * List all encrypted logs
   */
  async listLogs(service?: string, logLevel?: string): Promise<EncryptedLogMetadata[]> {
    try {
      const metadataDir = path.join(this.config.encryptedLogPath, 'metadata');
      const files = await fs.readdir(metadataDir);

      const metadataFiles = files.filter(file => file.endsWith('.json'));
      const logList: EncryptedLogMetadata[] = [];

      for (const metaFile of metadataFiles) {
        try {
          const logId = metaFile.replace('.json', '');
          const metadata = await this.loadLogMetadata(logId);

          if ((!service || metadata.service === service) &&
              (!logLevel || metadata.logLevel === logLevel)) {
            logList.push(metadata);
          }
        } catch (error) {
          logger.warn(`Failed to load log metadata for ${metaFile}:`, error);
        }
      }

      // Sort by creation date (newest first)
      return logList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    } catch (error) {
      logger.error('Failed to list logs:', error);
      throw error;
    }
  }

  /**
   * Delete encrypted log
   */
  async deleteLog(logId: string): Promise<void> {
    try {
      const metadata = await this.loadLogMetadata(logId);

      const logPath = path.join(this.config.encryptedLogPath, metadata.encryptedFile);
      const metadataPath = path.join(
        this.config.encryptedLogPath,
        'metadata',
        `${logId}.json`
      );

      // Delete log file and metadata
      await Promise.all([
        fs.unlink(logPath).catch(() => {}), // Ignore if file doesn't exist
        fs.unlink(metadataPath).catch(() => {}) // Ignore if metadata doesn't exist
      ]);

      logger.debug('Encrypted log deleted', { logId });

    } catch (error) {
      logger.error('Failed to delete encrypted log:', error);
      throw error;
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<LogStats> {
    try {
      const logs = await this.listLogs();

      if (logs.length === 0) {
        return {
          totalLogs: 0,
          totalSize: 0,
          encryptedSize: 0,
          oldestLog: null,
          newestLog: null,
          logsByLevel: {}
        };
      }

      const totalLogs = logs.length;
      const totalSize = logs.reduce((sum, log) => sum + log.size, 0);
      const encryptedSize = logs.reduce((sum, log) => sum + log.encryptedSize, 0);
      const oldestLog = logs[logs.length - 1].createdAt;
      const newestLog = logs[0].createdAt;

      const logsByLevel: { [level: string]: number } = {};
      logs.forEach(log => {
        logsByLevel[log.logLevel] = (logsByLevel[log.logLevel] || 0) + 1;
      });

      return {
        totalLogs,
        totalSize,
        encryptedSize,
        oldestLog,
        newestLog,
        logsByLevel
      };

    } catch (error) {
      logger.error('Failed to get log statistics:', error);
      throw error;
    }
  }

  /**
   * Health check for log encryption
   */
  async healthCheck(): Promise<{
    status: string;
    enabled: boolean;
    realtimeEncryption: boolean;
    stats: LogStats;
    activeStreams: number;
  }> {
    try {
      const stats = await this.getLogStats();

      return {
        status: 'healthy',
        enabled: this.config.enabled,
        realtimeEncryption: this.config.realtimeEncryption,
        stats,
        activeStreams: this.encryptionStreams.size
      };

    } catch (error) {
      logger.error('Log encryption health check failed:', error);
      return {
        status: 'error',
        enabled: false,
        realtimeEncryption: false,
        stats: {
          totalLogs: 0,
          totalSize: 0,
          encryptedSize: 0,
          oldestLog: null,
          newestLog: null,
          logsByLevel: {}
        },
        activeStreams: 0
      };
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): LogEncryptionConfig {
    return { ...this.config };
  }
}

/**
 * Encrypted log stream for real-time encryption
 */
class EncryptedLogStream extends Transform {
  private buffer: Buffer = Buffer.alloc(0);
  private config: LogEncryptionConfig;
  private logFile: string;
  private logLevel: string;
  private service: string;

  constructor(
    logFile: string,
    logLevel: string,
    service: string,
    config: LogEncryptionConfig
  ) {
    super({ objectMode: false });
    this.logFile = logFile;
    this.logLevel = logLevel;
    this.service = service;
    this.config = config;
  }

  _transform(chunk: unknown, encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      // Buffer incoming data
      this.buffer = Buffer.concat([this.buffer, chunk as Buffer]);

      // Process complete log lines
      const lines = this.buffer.toString().split('\n');
      this.buffer = Buffer.from(lines.pop() || ''); // Keep incomplete line in buffer

      // Encrypt and push complete lines
      for (const line of lines) {
        if (line.trim()) {
          const encryptedLine = this.encryptLogLine(line + '\n');
          this.push(encryptedLine);
        }
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      // Process any remaining data in buffer
      if (this.buffer.length > 0) {
        const encryptedLine = this.encryptLogLine(this.buffer.toString());
        this.push(encryptedLine);
      }
      callback();
    } catch (error) {
      callback(error);
    }
  }

  private encryptLogLine(line: string): string {
    // Simple line-level encryption for real-time processing
    // In production, consider batching for better performance
    const key = encryptionService.getEncryptionSecrets().dataEncryptionKey;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);

    let encrypted = cipher.update(line, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return encrypted + '\n';
  }
}

// Export singleton instance
export const logEncryptionService = LogEncryptionService.getInstance();

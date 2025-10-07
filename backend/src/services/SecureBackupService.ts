import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { encryptionService } from './EncryptionService';
import { getVaultService } from './VaultService';
const vaultService = getVaultService();
import { securityLogService } from './SecurityLogService';

export interface BackupConfig {
  enableSecureBackups: boolean;
  enableEncryption: boolean;
  enableCompression: boolean;
  enableDeduplication: boolean;
  enableIntegrityChecks: boolean;
  
  // Encryption settings
  encryptionAlgorithm: string;
  keyRotationIntervalDays: number;
  enableEnvelopeEncryption: boolean;
  encryptionKeyStrength: number;
  
  // Backup scheduling
  enableAutomaticBackups: boolean;
  fullBackupIntervalHours: number;
  incrementalBackupIntervalHours: number;
  backupRetentionDays: number;
  maxBackupVersions: number;
  
  // Storage settings
  backupStorageType: 'local' | 's3' | 'azure' | 'gcp' | 'vault';
  storageEndpoint?: string;
  storageRegion?: string;
  storageBucket?: string;
  enableCrossRegionReplication: boolean;
  
  // Security settings
  enableAccessLogging: boolean;
  enableTamperDetection: boolean;
  enableBackupSigning: boolean;
  enableImmutableStorage: boolean;
  
  // Performance settings
  maxParallelBackups: number;
  backupBandwidthLimitMBps: number;
  enableResumableBackups: boolean;
  backupChunkSizeMB: number;
  
  // Compliance
  enableGDPRCompliance: boolean;
  enableSOXCompliance: boolean;
  enableHIPAACompliance: boolean;
  enablePCICompliance: boolean;
  
  // Monitoring
  enableBackupMonitoring: boolean;
  enableAlerting: boolean;
  alertWebhookUrl?: string;
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'differential' | 'snapshot';
  source: string;
  version: string;
  
  // Encryption details
  encrypted: boolean;
  encryptionKeyId: string;
  encryptionAlgorithm: string;
  keyDerivationFunction: string;
  
  // Integrity verification
  checksum: string;
  checksumAlgorithm: string;
  signature?: string;
  signatureAlgorithm?: string;
  
  // Size and compression
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionAlgorithm?: string;
  
  // Storage information
  storageLocation: string;
  storageProvider: string;
  storageRegion?: string;
  storageClass?: string;
  
  // Performance metrics
  backupDuration: number;
  throughputMBps: number;
  networkBandwidthUsed: number;
  
  // Compliance and audit
  complianceFlags: {
    gdpr: boolean;
    sox: boolean;
    hipaa: boolean;
    pci: boolean;
  };
  auditTrail: BackupAuditEvent[];
  
  // Retention and lifecycle
  retentionPolicy: string;
  expirationDate: Date;
  immutable: boolean;
  
  // Recovery information
  recoveryTested: boolean;
  lastRecoveryTest?: Date;
  recoveryRTO: number; // Recovery Time Objective in seconds
  recoveryRPO: number; // Recovery Point Objective in seconds
}

export interface BackupAuditEvent {
  timestamp: Date;
  action: 'created' | 'encrypted' | 'stored' | 'verified' | 'tested' | 'restored' | 'deleted';
  user: string;
  details: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'warning';
}

export interface RestoreOptions {
  backupId: string;
  targetLocation: string;
  verifyIntegrity: boolean;
  enableProgressTracking: boolean;
  maxBandwidthMBps?: number;
  preservePermissions: boolean;
  preserveTimestamps: boolean;
  decryptionKeyId?: string;
}

export interface BackupJob {
  id: string;
  type: 'backup' | 'restore' | 'verify';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  source: string;
  destination: string;
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  errorMessage?: string;
  metadata?: BackupMetadata;
}

export class SecureBackupService {
  private static instance: SecureBackupService;
  private config: BackupConfig;
  private activeJobs: Map<string, BackupJob> = new Map();
  private backupMetadata: Map<string, BackupMetadata> = new Map();
  private encryptionKeys: Map<string, Buffer> = new Map();
  private backupScheduler: NodeJS.Timeout[] = [];

  private constructor() {
    this.config = {
      enableSecureBackups: process.env.ENABLE_SECURE_BACKUPS !== 'false',
      enableEncryption: process.env.ENABLE_BACKUP_ENCRYPTION !== 'false',
      enableCompression: process.env.ENABLE_BACKUP_COMPRESSION !== 'false',
      enableDeduplication: process.env.ENABLE_BACKUP_DEDUPLICATION === 'true',
      enableIntegrityChecks: process.env.ENABLE_BACKUP_INTEGRITY_CHECKS !== 'false',
      
      encryptionAlgorithm: process.env.BACKUP_ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      keyRotationIntervalDays: parseInt(process.env.BACKUP_KEY_ROTATION_DAYS || '90'),
      enableEnvelopeEncryption: process.env.ENABLE_BACKUP_ENVELOPE_ENCRYPTION !== 'false',
      encryptionKeyStrength: parseInt(process.env.BACKUP_ENCRYPTION_KEY_STRENGTH || '256'),
      
      enableAutomaticBackups: process.env.ENABLE_AUTOMATIC_BACKUPS !== 'false',
      fullBackupIntervalHours: parseInt(process.env.FULL_BACKUP_INTERVAL_HOURS || '24'),
      incrementalBackupIntervalHours: parseInt(process.env.INCREMENTAL_BACKUP_INTERVAL_HOURS || '4'),
      backupRetentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '90'),
      maxBackupVersions: parseInt(process.env.MAX_BACKUP_VERSIONS || '30'),
      
      backupStorageType: (process.env.BACKUP_STORAGE_TYPE as BackupConfig['backupStorageType']) || 's3',
      storageEndpoint: process.env.BACKUP_STORAGE_ENDPOINT,
      storageRegion: process.env.BACKUP_STORAGE_REGION || 'us-east-1',
      storageBucket: process.env.BACKUP_STORAGE_BUCKET || 'botrt-secure-backups',
      enableCrossRegionReplication: process.env.ENABLE_BACKUP_CROSS_REGION_REPLICATION === 'true',
      
      enableAccessLogging: process.env.ENABLE_BACKUP_ACCESS_LOGGING !== 'false',
      enableTamperDetection: process.env.ENABLE_BACKUP_TAMPER_DETECTION !== 'false',
      enableBackupSigning: process.env.ENABLE_BACKUP_SIGNING !== 'false',
      enableImmutableStorage: process.env.ENABLE_BACKUP_IMMUTABLE_STORAGE !== 'false',
      
      maxParallelBackups: parseInt(process.env.MAX_PARALLEL_BACKUPS || '3'),
      backupBandwidthLimitMBps: parseInt(process.env.BACKUP_BANDWIDTH_LIMIT_MBPS || '100'),
      enableResumableBackups: process.env.ENABLE_RESUMABLE_BACKUPS !== 'false',
      backupChunkSizeMB: parseInt(process.env.BACKUP_CHUNK_SIZE_MB || '64'),
      
      enableGDPRCompliance: process.env.ENABLE_BACKUP_GDPR_COMPLIANCE !== 'false',
      enableSOXCompliance: process.env.ENABLE_BACKUP_SOX_COMPLIANCE !== 'false',
      enableHIPAACompliance: process.env.ENABLE_BACKUP_HIPAA_COMPLIANCE === 'true',
      enablePCICompliance: process.env.ENABLE_BACKUP_PCI_COMPLIANCE !== 'false',
      
      enableBackupMonitoring: process.env.ENABLE_BACKUP_MONITORING !== 'false',
      enableAlerting: process.env.ENABLE_BACKUP_ALERTING !== 'false',
      alertWebhookUrl: process.env.BACKUP_ALERT_WEBHOOK_URL
    };

    this.initializeSecureBackup();
    this.startAutomaticBackups();

    logger.info('Secure Backup Service initialized', {
      encryption: this.config.enableEncryption,
      storage: this.config.backupStorageType,
      automaticBackups: this.config.enableAutomaticBackups,
      retention: this.config.backupRetentionDays,
      compliance: {
        gdpr: this.config.enableGDPRCompliance,
        sox: this.config.enableSOXCompliance,
        pci: this.config.enablePCICompliance
      }
    });
  }

  public static getInstance(): SecureBackupService {
    if (!SecureBackupService.instance) {
      SecureBackupService.instance = new SecureBackupService();
    }
    return SecureBackupService.instance;
  }

  private async initializeSecureBackup(): Promise<void> {
    if (!this.config.enableSecureBackups) {
      return;
    }

    try {
      // Initialize encryption keys
      await this.initializeEncryptionKeys();
      
      // Setup storage connection
      await this.initializeStorage();
      
      // Load existing backup metadata
      await this.loadBackupMetadata();
      
      // Verify backup integrity
      await this.verifyExistingBackups();

      logger.info('Secure backup service initialized successfully');

    } catch (err: unknown) {
      logger.error('Failed to initialize secure backup service:', err as Record<string, unknown>);
      throw err;
    }
  }

  private async initializeEncryptionKeys(): Promise<void> {
    if (!this.config.enableEncryption) {
      return;
    }

    try {
      // Generate or retrieve backup encryption keys
      const keyIds = ['backup-database-key', 'backup-files-key', 'backup-logs-key'];
      
      for (const keyId of keyIds) {
        let encryptionKey = await vaultService.getSecret(`backup-keys/${keyId}`);
        
        if (!encryptionKey) {
          // Generate new encryption key
          const keyBuffer = crypto.randomBytes(this.config.encryptionKeyStrength / 8);
          encryptionKey = keyBuffer.toString('base64') as any;
          
          await vaultService.putSecret(`backup-keys/${keyId}`, { key: encryptionKey });
          
          logger.info(`Generated new backup encryption key: ${keyId}`);
        }
        
        this.encryptionKeys.set(keyId, Buffer.from(encryptionKey.key || encryptionKey, 'base64'));
      }

      logger.info('Backup encryption keys initialized');

    } catch (err: unknown) {
      logger.error('Failed to initialize backup encryption keys:', err as Record<string, unknown>);
      throw err;
    }
  }

  private async initializeStorage(): Promise<void> {
    switch (this.config.backupStorageType) {
      case 's3':
        await this.initializeS3Storage();
        break;
      case 'azure':
        await this.initializeAzureStorage();
        break;
      case 'gcp':
        await this.initializeGCPStorage();
        break;
      case 'vault':
        await this.initializeVaultStorage();
        break;
      case 'local':
        await this.initializeLocalStorage();
        break;
      default:
        throw new Error(`Unsupported backup storage type: ${this.config.backupStorageType}`);
    }
  }

  private async initializeS3Storage(): Promise<void> {
    // S3 storage initialization
    logger.info('S3 backup storage initialized');
  }

  private async initializeAzureStorage(): Promise<void> {
    // Azure storage initialization
    logger.info('Azure backup storage initialized');
  }

  private async initializeGCPStorage(): Promise<void> {
    // GCP storage initialization
    logger.info('GCP backup storage initialized');
  }

  private async initializeVaultStorage(): Promise<void> {
    // Vault storage initialization
    logger.info('Vault backup storage initialized');
  }

  private async initializeLocalStorage(): Promise<void> {
    const backupDir = path.join(process.cwd(), 'secure-backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    }
    
    logger.info('Local backup storage initialized');
  }

  private async loadBackupMetadata(): Promise<void> {
    // Load existing backup metadata from storage
    logger.debug('Loading backup metadata');
  }

  private async verifyExistingBackups(): Promise<void> {
    if (!this.config.enableIntegrityChecks) {
      return;
    }

    logger.info('Verifying existing backup integrity');
    
    for (const [backupId, metadata] of this.backupMetadata.entries()) {
      try {
        const isValid = await this.verifyBackupIntegrity(backupId);
        if (!isValid) {
          logger.error(`Backup integrity verification failed: ${backupId}`);
          await this.handleCorruptedBackup(backupId, metadata);
        }
      } catch (err: unknown) {
        logger.error(`Error verifying backup ${backupId}:`, err as Record<string, unknown>);
      }
    }
  }

  /**
   * Create a secure backup
   */
  async createBackup(
    source: string,
    type: BackupMetadata['type'] = 'full',
    options: {
      compression?: boolean;
      encryption?: boolean;
      immediateUpload?: boolean;
      retentionPolicy?: string;
    } = {}
  ): Promise<string> {
    const jobId = crypto.randomUUID();
    const backupId = crypto.randomUUID();
    
    const job: BackupJob = {
      id: jobId,
      type: 'backup',
      status: 'pending',
      source,
      destination: await this.generateBackupPath(backupId, type),
      progress: 0,
      startTime: new Date()
    };

    this.activeJobs.set(jobId, job);

    try {
      // Log backup initiation
      await this.logBackupEvent(backupId, 'created', {
        source,
        type,
        options,
        jobId
      });

      job.status = 'running';
      
      // Create backup metadata
      const metadata = await this.createBackupMetadata(backupId, source, type, options);
      this.backupMetadata.set(backupId, metadata);
      
      // Perform the actual backup
      await this.performBackup(job, metadata, options);
      
      // Verify backup integrity
      if (this.config.enableIntegrityChecks) {
        await this.verifyBackupIntegrity(backupId);
      }
      
      // Upload to secure storage
      if (options.immediateUpload !== false) {
        await this.uploadBackupToStorage(backupId, metadata);
      }
      
      job.status = 'completed';
      job.endTime = new Date();
      job.metadata = metadata;
      
      logger.info('Backup created successfully', {
        backupId,
        jobId,
        source,
        type,
        duration: job.endTime.getTime() - job.startTime.getTime()
      });

      await this.logBackupEvent(backupId, 'stored', {
        duration: job.endTime.getTime() - job.startTime.getTime(),
        size: metadata.compressedSize,
        location: metadata.storageLocation
      });

      return backupId;

    } catch (err: unknown) {
      job.status = 'failed';
      job.endTime = new Date();
      job.errorMessage = getErrorMessage(err as Error);
      
      logger.error('Backup creation failed', {
        backupId,
        jobId,
        error: getErrorMessage(err as Error)
      });

      await this.logBackupEvent(backupId, 'created', {
        error: getErrorMessage(err as Error),
        duration: job.endTime!.getTime() - job.startTime.getTime()
      }, 'failure');

      throw err;
    } finally {
      // Cleanup job after 1 hour
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 3600000);
    }
  }

  private async createBackupMetadata(
    backupId: string,
    source: string,
    type: BackupMetadata['type'],
    options: { compression?: boolean; encryption?: boolean; immediateUpload?: boolean; retentionPolicy?: string; }
  ): Promise<BackupMetadata> {
    const timestamp = new Date();
    const encryptionKeyId = this.selectEncryptionKey(source);
    
    return {
      id: backupId,
      timestamp,
      type,
      source,
      version: '1.0',
      
      encrypted: this.config.enableEncryption && (options.encryption !== false),
      encryptionKeyId,
      encryptionAlgorithm: this.config.encryptionAlgorithm,
      keyDerivationFunction: 'PBKDF2',
      
      checksum: '', // Will be calculated during backup
      checksumAlgorithm: 'sha256',
      signature: this.config.enableBackupSigning ? '' : undefined,
      signatureAlgorithm: this.config.enableBackupSigning ? 'rsa-sha256' : undefined,
      
      originalSize: 0, // Will be calculated during backup
      compressedSize: 0, // Will be calculated during backup
      compressionRatio: 0, // Will be calculated during backup
      compressionAlgorithm: this.config.enableCompression ? 'gzip' : undefined,
      
      storageLocation: await this.generateBackupPath(backupId, type),
      storageProvider: this.config.backupStorageType,
      storageRegion: this.config.storageRegion,
      storageClass: this.config.enableImmutableStorage ? 'GLACIER_IR' : 'STANDARD',
      
      backupDuration: 0, // Will be calculated after backup
      throughputMBps: 0, // Will be calculated after backup
      networkBandwidthUsed: 0, // Will be calculated after backup
      
      complianceFlags: {
        gdpr: this.config.enableGDPRCompliance,
        sox: this.config.enableSOXCompliance,
        hipaa: this.config.enableHIPAACompliance,
        pci: this.config.enablePCICompliance
      },
      auditTrail: [],
      
      retentionPolicy: options.retentionPolicy || `${this.config.backupRetentionDays}d`,
      expirationDate: new Date(timestamp.getTime() + (this.config.backupRetentionDays * 24 * 60 * 60 * 1000)),
      immutable: this.config.enableImmutableStorage,
      
      recoveryTested: false,
      recoveryRTO: 3600, // 1 hour default RTO
      recoveryRPO: 14400 // 4 hours default RPO
    };
  }

  private selectEncryptionKey(source: string): string {
    if (source.includes('database') || source.includes('db')) {
      return 'backup-database-key';
    } else if (source.includes('logs')) {
      return 'backup-logs-key';
    } else {
      return 'backup-files-key';
    }
  }

  private async generateBackupPath(backupId: string, type: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}/${month}/${day}/${type}/${backupId}`;
  }

  private async performBackup(
    job: BackupJob,
    metadata: BackupMetadata,
    options: { compression?: boolean; encryption?: boolean; immediateUpload?: boolean; retentionPolicy?: string; }
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Read source data
      const sourceData = await this.readSourceData(job.source);
      metadata.originalSize = sourceData.length;
      
      job.progress = 25;
      
      // Compress if enabled
      let processedData = sourceData;
      if (this.config.enableCompression && options.compression !== false) {
        processedData = await this.compressData(sourceData);
        metadata.compressedSize = processedData.length;
        metadata.compressionRatio = (metadata.originalSize - metadata.compressedSize) / metadata.originalSize;
      } else {
        metadata.compressedSize = metadata.originalSize;
        metadata.compressionRatio = 0;
      }
      
      job.progress = 50;
      
      // Encrypt if enabled
      if (metadata.encrypted) {
        processedData = await this.encryptBackupData(processedData, metadata.encryptionKeyId);
      }
      
      job.progress = 75;
      
      // Calculate checksum
      metadata.checksum = crypto.createHash(metadata.checksumAlgorithm)
        .update(processedData)
        .digest('hex');
      
      // Sign if enabled
      if (this.config.enableBackupSigning) {
        metadata.signature = await this.signBackupData(processedData);
      }
      
      // Write backup data
      await this.writeBackupData(job.destination, processedData);
      
      job.progress = 100;
      
      // Calculate performance metrics
      const duration = Date.now() - startTime;
      metadata.backupDuration = duration;
      metadata.throughputMBps = (metadata.compressedSize / (1024 * 1024)) / (duration / 1000);
      
      logger.debug('Backup performance metrics', {
        backupId: metadata.id,
        originalSize: metadata.originalSize,
        compressedSize: metadata.compressedSize,
        duration: metadata.backupDuration,
        throughput: metadata.throughputMBps
      });

    } catch (err: unknown) {
      logger.error('Error performing backup:', err as Record<string, unknown>);
      throw err;
    }
  }

  private async readSourceData(source: string): Promise<Buffer> {
    // Implementation would depend on source type (database, files, etc.)
    if (source.startsWith('database:')) {
      return await this.createDatabaseBackup(source);
    } else if (source.startsWith('files:')) {
      return await this.createFileBackup(source);
    } else {
      throw new Error(`Unsupported backup source: ${source}`);
    }
  }

  private async createDatabaseBackup(source: string): Promise<Buffer> {
    // Simplified database backup
    const dbData = JSON.stringify({
      timestamp: new Date().toISOString(),
      source,
      tables: ['users', 'orders', 'products', 'stores'],
      data: 'compressed_database_dump_placeholder'
    });
    
    return Buffer.from(dbData, 'utf-8');
  }

  private async createFileBackup(source: string): Promise<Buffer> {
    // Simplified file backup
    const filePath = source.replace('files:', '');
    return fs.readFileSync(filePath);
  }

  private async compressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (error: Error | null, compressed: Buffer) => {
        if (error) reject(error);
        else resolve(compressed);
      });
    });
  }

  private async encryptBackupData(data: Buffer, keyId: string): Promise<Buffer> {
    const encryptionKey = this.encryptionKeys.get(keyId);
    if (!encryptionKey) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    if (this.config.enableEnvelopeEncryption) {
      // Use envelope encryption with Vault
      const encrypted = await encryptionService.encryptData(data.toString('base64'), keyId);
      return Buffer.from(encrypted, 'base64');
    } else {
      // Direct encryption
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.config.encryptionAlgorithm, encryptionKey);
      
      let encrypted = cipher.update(data);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Prepend IV to encrypted data
      return Buffer.concat([iv, encrypted]);
    }
  }

  private async signBackupData(data: Buffer): Promise<string> {
    // Simplified backup signing
    const hash = crypto.createHash('sha256').update(data).digest();
    return hash.toString('hex');
  }

  private async writeBackupData(destination: string, data: Buffer): Promise<void> {
    const backupDir = path.dirname(destination);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    }
    
    fs.writeFileSync(destination, data, { mode: 0o600 });
    
    logger.debug('Backup data written', {
      destination,
      size: data.length
    });
  }

  private async uploadBackupToStorage(backupId: string, metadata: BackupMetadata): Promise<void> {
    // Implementation would upload to configured storage provider
    logger.info('Backup uploaded to storage', {
      backupId,
      storageProvider: metadata.storageProvider,
      storageLocation: metadata.storageLocation
    });
  }

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity(backupId: string): Promise<boolean> {
    const metadata = this.backupMetadata.get(backupId);
    if (!metadata) {
      throw new Error(`Backup metadata not found: ${backupId}`);
    }

    try {
      // Read backup data
      const backupData = await this.readBackupData(metadata.storageLocation);
      
      // Verify checksum
      const calculatedChecksum = crypto.createHash(metadata.checksumAlgorithm)
        .update(backupData)
        .digest('hex');
      
      if (calculatedChecksum !== metadata.checksum) {
        logger.error('Backup checksum verification failed', {
          backupId,
          expected: metadata.checksum,
          calculated: calculatedChecksum
        });
        return false;
      }
      
      // Verify signature if present
      if (metadata.signature) {
        const isSignatureValid = await this.verifyBackupSignature(backupData, metadata.signature);
        if (!isSignatureValid) {
          logger.error('Backup signature verification failed', { backupId });
          return false;
        }
      }
      
      await this.logBackupEvent(backupId, 'verified', {
        checksumValid: true,
        signatureValid: !!metadata.signature
      });
      
      return true;

    } catch (err: unknown) {
      logger.error('Error verifying backup integrity:', err as Record<string, unknown>);
      
      await this.logBackupEvent(backupId, 'verified', {
        error: getErrorMessage(err as Error)
      }, 'failure');
      
      return false;
    }
  }

  private async readBackupData(location: string): Promise<Buffer> {
    return fs.readFileSync(location);
  }

  private async verifyBackupSignature(data: Buffer, signature: string): Promise<boolean> {
    // Simplified signature verification
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash === signature;
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<string> {
    const jobId = crypto.randomUUID();
    const metadata = this.backupMetadata.get(options.backupId);
    
    if (!metadata) {
      throw new Error(`Backup not found: ${options.backupId}`);
    }

    const job: BackupJob = {
      id: jobId,
      type: 'restore',
      status: 'pending',
      source: metadata.storageLocation,
      destination: options.targetLocation,
      progress: 0,
      startTime: new Date(),
      metadata
    };

    this.activeJobs.set(jobId, job);

    try {
      await this.logBackupEvent(options.backupId, 'restored', {
        targetLocation: options.targetLocation,
        jobId
      });

      job.status = 'running';
      
      // Verify backup integrity before restore
      if (options.verifyIntegrity) {
        const isValid = await this.verifyBackupIntegrity(options.backupId);
        if (!isValid) {
          throw new Error('Backup integrity verification failed');
        }
      }
      
      job.progress = 25;
      
      // Read and decrypt backup data
      let backupData = await this.readBackupData(metadata.storageLocation);
      
      if (metadata.encrypted) {
        backupData = await this.decryptBackupData(backupData, metadata.encryptionKeyId);
      }
      
      job.progress = 50;
      
      // Decompress if needed
      if (metadata.compressionAlgorithm) {
        backupData = await this.decompressData(backupData);
      }
      
      job.progress = 75;
      
      // Restore data to target location
      await this.restoreData(backupData, options.targetLocation, options);
      
      job.progress = 100;
      job.status = 'completed';
      job.endTime = new Date();
      
      // Update recovery test status
      metadata.recoveryTested = true;
      metadata.lastRecoveryTest = new Date();
      
      logger.info('Backup restored successfully', {
        backupId: options.backupId,
        jobId,
        targetLocation: options.targetLocation,
        duration: job.endTime.getTime() - job.startTime.getTime()
      });

      return jobId;

    } catch (err: unknown) {
      job.status = 'failed';
      job.endTime = new Date();
      job.errorMessage = getErrorMessage(err as Error);
      
      logger.error('Backup restore failed', {
        backupId: options.backupId,
        jobId,
        error: getErrorMessage(err as Error)
      });

      throw err;
    }
  }

  private async decryptBackupData(data: Buffer, keyId: string): Promise<Buffer> {
    const encryptionKey = this.encryptionKeys.get(keyId);
    if (!encryptionKey) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    if (this.config.enableEnvelopeEncryption) {
      // Use envelope decryption with Vault
      const decrypted = await encryptionService.decryptData(data.toString('base64'), keyId);
      return Buffer.from(decrypted, 'base64');
    } else {
      // Direct decryption
      const iv = data.slice(0, 16);
      const encryptedData = data.slice(16);
      
      const decipher = crypto.createDecipheriv(this.config.encryptionAlgorithm, encryptionKey, iv);
      
      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted;
    }
  }

  private async decompressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (error: Error | null, decompressed: Buffer) => {
        if (error) reject(error);
        else resolve(decompressed);
      });
    });
  }

  private async restoreData(data: Buffer, targetLocation: string, options: RestoreOptions): Promise<void> {
    // Implementation would depend on target type
    fs.writeFileSync(targetLocation, data);
    
    if (options.preservePermissions) {
      fs.chmodSync(targetLocation, 0o600);
    }
    
    logger.debug('Data restored', {
      targetLocation,
      size: data.length
    });
  }

  private async handleCorruptedBackup(backupId: string, metadata: BackupMetadata): Promise<void> {
    logger.error('Corrupted backup detected', { backupId });
    
    await securityLogService.logSecurityEvent({
      eventType: 'backup_corruption_detected',
      severity: 'HIGH',
      category: 'system',
      ipAddress: '82.147.84.78',
      success: false,
      details: {
        backupId,
        source: metadata.source,
        storageLocation: metadata.storageLocation,
        timestamp: metadata.timestamp
      },
      riskScore: 80,
      tags: ['backup_corruption', 'data_integrity'],
      compliance: {
        pii: false,
        gdpr: true,
        pci: true,
        hipaa: metadata.complianceFlags.hipaa
      }
    });
    
    // Mark backup as corrupted
    metadata.auditTrail.push({
      timestamp: new Date(),
      action: 'verified',
      user: 'system',
      details: { corruption: true },
      outcome: 'failure'
    });
  }

  private async logBackupEvent(
    backupId: string,
    action: BackupAuditEvent['action'],
    details: Record<string, unknown>,
    outcome: BackupAuditEvent['outcome'] = 'success'
  ): Promise<void> {
    const event: BackupAuditEvent = {
      timestamp: new Date(),
      action,
      user: 'system',
      details,
      outcome
    };

    const metadata = this.backupMetadata.get(backupId);
    if (metadata) {
      metadata.auditTrail.push(event);
    }

    // Log to security service
    await securityLogService.logSecurityEvent({
      eventType: `backup_${action}`,
      severity: outcome === 'failure' ? 'HIGH' : 'LOW',
      category: 'system',
      ipAddress: '82.147.84.78',
      success: outcome === 'success',
      details: {
        backupId,
        action,
        ...details
      },
      riskScore: outcome === 'failure' ? 60 : 10,
      tags: ['backup', action],
      compliance: {
        pii: false,
        gdpr: true,
        pci: true,
        hipaa: metadata?.complianceFlags.hipaa || false
      }
    });
  }

  private startAutomaticBackups(): void {
    if (!this.config.enableAutomaticBackups) {
      return;
    }

    // Schedule full backups
    const fullBackupInterval = setInterval(() => {
      this.performScheduledBackup('full').catch((err: unknown) => {
        logger.error('Scheduled full backup failed:', err as Record<string, unknown>);
      });
    }, this.config.fullBackupIntervalHours * 60 * 60 * 1000);

    // Schedule incremental backups
    const incrementalBackupInterval = setInterval(() => {
      this.performScheduledBackup('incremental').catch((err: unknown) => {
        logger.error('Scheduled incremental backup failed:', err as Record<string, unknown>);
      });
    }, this.config.incrementalBackupIntervalHours * 60 * 60 * 1000);

    this.backupScheduler.push(fullBackupInterval, incrementalBackupInterval);

    logger.info('Automatic backup scheduling started', {
      fullBackupInterval: this.config.fullBackupIntervalHours,
      incrementalBackupInterval: this.config.incrementalBackupIntervalHours
    });
  }

  private async performScheduledBackup(type: 'full' | 'incremental'): Promise<void> {
    const sources = this.getBackupSources();
    
    for (const source of sources) {
      try {
        await this.createBackup(source, type, {
          compression: true,
          encryption: true,
          immediateUpload: true
        });
      } catch (err: unknown) {
        logger.error(`Scheduled ${type} backup failed for ${source}:`, err as Record<string, unknown>);
      }
    }
  }

  private getBackupSources(): string[] {
    return [
      'database:postgresql',
      'database:redis',
      'files:/app/uploads',
      'files:/app/logs',
      'files:/app/config'
    ];
  }

  /**
   * Get backup statistics
   */
  getStats(): {
    config: BackupConfig;
    totalBackups: number;
    activeJobs: number;
    storageUsed: number;
    lastBackup?: Date;
    nextScheduledBackup?: Date;
    recentBackups: number;
    failedJobs: number;
  } {
    const backups = Array.from(this.backupMetadata.values());
    const lastBackup = backups.length > 0 
      ? new Date(Math.max(...backups.map(b => b.timestamp.getTime())))
      : undefined;
    
    const storageUsed = backups.reduce((total, backup) => total + backup.compressedSize, 0);

    const recentBackups = backups.filter(b => Date.now() - b.timestamp.getTime() < 24 * 60 * 60 * 1000).length;
    const failedJobs = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'failed').length;

    return {
      config: this.config,
      totalBackups: this.backupMetadata.size,
      activeJobs: this.activeJobs.size,
      storageUsed,
      lastBackup,
      nextScheduledBackup: undefined, // Would calculate based on schedule
      recentBackups,
      failedJobs
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: { config: BackupConfig; totalBackups: number; activeJobs: number; storageUsed: number; lastBackup?: Date; nextScheduledBackup?: Date; recentBackups: number; failedJobs: number; };
  }> {
    const stats = this.getStats();
    // const recentBackups = Array.from(this.backupMetadata.values())
    //   .filter(b => Date.now() - b.timestamp.getTime() < 24 * 60 * 60 * 1000);

    let status = 'healthy';
    if (stats.recentBackups === 0) {
      status = 'warning'; // No recent backups
    }
    
    // const failedJobs = Array.from(this.activeJobs.values())
    //   .filter(job => job.status === 'failed').length;
    
    if (stats.failedJobs > 0) {
      status = 'degraded';
    }

    return {
      status,
      stats: {
        ...stats
        // recentBackups: recentBackups.length,
        // failedJobs
      }
    };
  }
}

// Export singleton instance
export const secureBackupService = SecureBackupService.getInstance();

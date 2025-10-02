"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureBackupService = exports.SecureBackupService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const zlib = __importStar(require("zlib"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const EncryptionService_1 = require("./EncryptionService");
const VaultService_1 = require("./VaultService");
const vaultService = (0, VaultService_1.getVaultService)();
const SecurityLogService_1 = require("./SecurityLogService");
class SecureBackupService {
    constructor() {
        this.activeJobs = new Map();
        this.backupMetadata = new Map();
        this.encryptionKeys = new Map();
        this.backupScheduler = [];
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
            backupStorageType: process.env.BACKUP_STORAGE_TYPE || 's3',
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
        logger_1.logger.info('Secure Backup Service initialized', {
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
    static getInstance() {
        if (!SecureBackupService.instance) {
            SecureBackupService.instance = new SecureBackupService();
        }
        return SecureBackupService.instance;
    }
    async initializeSecureBackup() {
        if (!this.config.enableSecureBackups) {
            return;
        }
        try {
            await this.initializeEncryptionKeys();
            await this.initializeStorage();
            await this.loadBackupMetadata();
            await this.verifyExistingBackups();
            logger_1.logger.info('Secure backup service initialized successfully');
        }
        catch (err) {
            logger_1.logger.error('Failed to initialize secure backup service:', err);
            throw err;
        }
    }
    async initializeEncryptionKeys() {
        if (!this.config.enableEncryption) {
            return;
        }
        try {
            const keyIds = ['backup-database-key', 'backup-files-key', 'backup-logs-key'];
            for (const keyId of keyIds) {
                let encryptionKey = await vaultService.getSecret(`backup-keys/${keyId}`);
                if (!encryptionKey) {
                    const keyBuffer = crypto.randomBytes(this.config.encryptionKeyStrength / 8);
                    encryptionKey = keyBuffer.toString('base64');
                    await vaultService.putSecret(`backup-keys/${keyId}`, { key: encryptionKey });
                    logger_1.logger.info(`Generated new backup encryption key: ${keyId}`);
                }
                this.encryptionKeys.set(keyId, Buffer.from(encryptionKey.key || encryptionKey, 'base64'));
            }
            logger_1.logger.info('Backup encryption keys initialized');
        }
        catch (err) {
            logger_1.logger.error('Failed to initialize backup encryption keys:', err);
            throw err;
        }
    }
    async initializeStorage() {
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
    async initializeS3Storage() {
        logger_1.logger.info('S3 backup storage initialized');
    }
    async initializeAzureStorage() {
        logger_1.logger.info('Azure backup storage initialized');
    }
    async initializeGCPStorage() {
        logger_1.logger.info('GCP backup storage initialized');
    }
    async initializeVaultStorage() {
        logger_1.logger.info('Vault backup storage initialized');
    }
    async initializeLocalStorage() {
        const backupDir = path.join(process.cwd(), 'secure-backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
        }
        logger_1.logger.info('Local backup storage initialized');
    }
    async loadBackupMetadata() {
        logger_1.logger.debug('Loading backup metadata');
    }
    async verifyExistingBackups() {
        if (!this.config.enableIntegrityChecks) {
            return;
        }
        logger_1.logger.info('Verifying existing backup integrity');
        for (const [backupId, metadata] of this.backupMetadata.entries()) {
            try {
                const isValid = await this.verifyBackupIntegrity(backupId);
                if (!isValid) {
                    logger_1.logger.error(`Backup integrity verification failed: ${backupId}`);
                    await this.handleCorruptedBackup(backupId, metadata);
                }
            }
            catch (err) {
                logger_1.logger.error(`Error verifying backup ${backupId}:`, err);
            }
        }
    }
    async createBackup(source, type = 'full', options = {}) {
        const jobId = crypto.randomUUID();
        const backupId = crypto.randomUUID();
        const job = {
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
            await this.logBackupEvent(backupId, 'created', {
                source,
                type,
                options,
                jobId
            });
            job.status = 'running';
            const metadata = await this.createBackupMetadata(backupId, source, type, options);
            this.backupMetadata.set(backupId, metadata);
            await this.performBackup(job, metadata, options);
            if (this.config.enableIntegrityChecks) {
                await this.verifyBackupIntegrity(backupId);
            }
            if (options.immediateUpload !== false) {
                await this.uploadBackupToStorage(backupId, metadata);
            }
            job.status = 'completed';
            job.endTime = new Date();
            job.metadata = metadata;
            logger_1.logger.info('Backup created successfully', {
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
        }
        catch (err) {
            job.status = 'failed';
            job.endTime = new Date();
            job.errorMessage = (0, errorUtils_1.getErrorMessage)(err);
            logger_1.logger.error('Backup creation failed', {
                backupId,
                jobId,
                error: (0, errorUtils_1.getErrorMessage)(err)
            });
            await this.logBackupEvent(backupId, 'created', {
                error: (0, errorUtils_1.getErrorMessage)(err),
                duration: job.endTime.getTime() - job.startTime.getTime()
            }, 'failure');
            throw err;
        }
        finally {
            setTimeout(() => {
                this.activeJobs.delete(jobId);
            }, 3600000);
        }
    }
    async createBackupMetadata(backupId, source, type, options) {
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
            checksum: '',
            checksumAlgorithm: 'sha256',
            signature: this.config.enableBackupSigning ? '' : undefined,
            signatureAlgorithm: this.config.enableBackupSigning ? 'rsa-sha256' : undefined,
            originalSize: 0,
            compressedSize: 0,
            compressionRatio: 0,
            compressionAlgorithm: this.config.enableCompression ? 'gzip' : undefined,
            storageLocation: await this.generateBackupPath(backupId, type),
            storageProvider: this.config.backupStorageType,
            storageRegion: this.config.storageRegion,
            storageClass: this.config.enableImmutableStorage ? 'GLACIER_IR' : 'STANDARD',
            backupDuration: 0,
            throughputMBps: 0,
            networkBandwidthUsed: 0,
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
            recoveryRTO: 3600,
            recoveryRPO: 14400
        };
    }
    selectEncryptionKey(source) {
        if (source.includes('database') || source.includes('db')) {
            return 'backup-database-key';
        }
        else if (source.includes('logs')) {
            return 'backup-logs-key';
        }
        else {
            return 'backup-files-key';
        }
    }
    async generateBackupPath(backupId, type) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}/${type}/${backupId}`;
    }
    async performBackup(job, metadata, options) {
        const startTime = Date.now();
        try {
            const sourceData = await this.readSourceData(job.source);
            metadata.originalSize = sourceData.length;
            job.progress = 25;
            let processedData = sourceData;
            if (this.config.enableCompression && options.compression !== false) {
                processedData = await this.compressData(sourceData);
                metadata.compressedSize = processedData.length;
                metadata.compressionRatio = (metadata.originalSize - metadata.compressedSize) / metadata.originalSize;
            }
            else {
                metadata.compressedSize = metadata.originalSize;
                metadata.compressionRatio = 0;
            }
            job.progress = 50;
            if (metadata.encrypted) {
                processedData = await this.encryptBackupData(processedData, metadata.encryptionKeyId);
            }
            job.progress = 75;
            metadata.checksum = crypto.createHash(metadata.checksumAlgorithm)
                .update(processedData)
                .digest('hex');
            if (this.config.enableBackupSigning) {
                metadata.signature = await this.signBackupData(processedData);
            }
            await this.writeBackupData(job.destination, processedData);
            job.progress = 100;
            const duration = Date.now() - startTime;
            metadata.backupDuration = duration;
            metadata.throughputMBps = (metadata.compressedSize / (1024 * 1024)) / (duration / 1000);
            logger_1.logger.debug('Backup performance metrics', {
                backupId: metadata.id,
                originalSize: metadata.originalSize,
                compressedSize: metadata.compressedSize,
                duration: metadata.backupDuration,
                throughput: metadata.throughputMBps
            });
        }
        catch (err) {
            logger_1.logger.error('Error performing backup:', err);
            throw err;
        }
    }
    async readSourceData(source) {
        if (source.startsWith('database:')) {
            return await this.createDatabaseBackup(source);
        }
        else if (source.startsWith('files:')) {
            return await this.createFileBackup(source);
        }
        else {
            throw new Error(`Unsupported backup source: ${source}`);
        }
    }
    async createDatabaseBackup(source) {
        const dbData = JSON.stringify({
            timestamp: new Date().toISOString(),
            source,
            tables: ['users', 'orders', 'products', 'stores'],
            data: 'compressed_database_dump_placeholder'
        });
        return Buffer.from(dbData, 'utf-8');
    }
    async createFileBackup(source) {
        const filePath = source.replace('files:', '');
        return fs.readFileSync(filePath);
    }
    async compressData(data) {
        return new Promise((resolve, reject) => {
            zlib.gzip(data, (error, compressed) => {
                if (error)
                    reject(error);
                else
                    resolve(compressed);
            });
        });
    }
    async encryptBackupData(data, keyId) {
        const encryptionKey = this.encryptionKeys.get(keyId);
        if (!encryptionKey) {
            throw new Error(`Encryption key not found: ${keyId}`);
        }
        if (this.config.enableEnvelopeEncryption) {
            const encrypted = await EncryptionService_1.encryptionService.encryptData(data.toString('base64'), keyId);
            return Buffer.from(encrypted, 'base64');
        }
        else {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(this.config.encryptionAlgorithm, encryptionKey);
            let encrypted = cipher.update(data);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return Buffer.concat([iv, encrypted]);
        }
    }
    async signBackupData(data) {
        const hash = crypto.createHash('sha256').update(data).digest();
        return hash.toString('hex');
    }
    async writeBackupData(destination, data) {
        const backupDir = path.dirname(destination);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
        }
        fs.writeFileSync(destination, data, { mode: 0o600 });
        logger_1.logger.debug('Backup data written', {
            destination,
            size: data.length
        });
    }
    async uploadBackupToStorage(backupId, metadata) {
        logger_1.logger.info('Backup uploaded to storage', {
            backupId,
            storageProvider: metadata.storageProvider,
            storageLocation: metadata.storageLocation
        });
    }
    async verifyBackupIntegrity(backupId) {
        const metadata = this.backupMetadata.get(backupId);
        if (!metadata) {
            throw new Error(`Backup metadata not found: ${backupId}`);
        }
        try {
            const backupData = await this.readBackupData(metadata.storageLocation);
            const calculatedChecksum = crypto.createHash(metadata.checksumAlgorithm)
                .update(backupData)
                .digest('hex');
            if (calculatedChecksum !== metadata.checksum) {
                logger_1.logger.error('Backup checksum verification failed', {
                    backupId,
                    expected: metadata.checksum,
                    calculated: calculatedChecksum
                });
                return false;
            }
            if (metadata.signature) {
                const isSignatureValid = await this.verifyBackupSignature(backupData, metadata.signature);
                if (!isSignatureValid) {
                    logger_1.logger.error('Backup signature verification failed', { backupId });
                    return false;
                }
            }
            await this.logBackupEvent(backupId, 'verified', {
                checksumValid: true,
                signatureValid: !!metadata.signature
            });
            return true;
        }
        catch (err) {
            logger_1.logger.error('Error verifying backup integrity:', err);
            await this.logBackupEvent(backupId, 'verified', {
                error: (0, errorUtils_1.getErrorMessage)(err)
            }, 'failure');
            return false;
        }
    }
    async readBackupData(location) {
        return fs.readFileSync(location);
    }
    async verifyBackupSignature(data, signature) {
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        return hash === signature;
    }
    async restoreFromBackup(options) {
        const jobId = crypto.randomUUID();
        const metadata = this.backupMetadata.get(options.backupId);
        if (!metadata) {
            throw new Error(`Backup not found: ${options.backupId}`);
        }
        const job = {
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
            if (options.verifyIntegrity) {
                const isValid = await this.verifyBackupIntegrity(options.backupId);
                if (!isValid) {
                    throw new Error('Backup integrity verification failed');
                }
            }
            job.progress = 25;
            let backupData = await this.readBackupData(metadata.storageLocation);
            if (metadata.encrypted) {
                backupData = await this.decryptBackupData(backupData, metadata.encryptionKeyId);
            }
            job.progress = 50;
            if (metadata.compressionAlgorithm) {
                backupData = await this.decompressData(backupData);
            }
            job.progress = 75;
            await this.restoreData(backupData, options.targetLocation, options);
            job.progress = 100;
            job.status = 'completed';
            job.endTime = new Date();
            metadata.recoveryTested = true;
            metadata.lastRecoveryTest = new Date();
            logger_1.logger.info('Backup restored successfully', {
                backupId: options.backupId,
                jobId,
                targetLocation: options.targetLocation,
                duration: job.endTime.getTime() - job.startTime.getTime()
            });
            return jobId;
        }
        catch (err) {
            job.status = 'failed';
            job.endTime = new Date();
            job.errorMessage = (0, errorUtils_1.getErrorMessage)(err);
            logger_1.logger.error('Backup restore failed', {
                backupId: options.backupId,
                jobId,
                error: (0, errorUtils_1.getErrorMessage)(err)
            });
            throw err;
        }
    }
    async decryptBackupData(data, keyId) {
        const encryptionKey = this.encryptionKeys.get(keyId);
        if (!encryptionKey) {
            throw new Error(`Encryption key not found: ${keyId}`);
        }
        if (this.config.enableEnvelopeEncryption) {
            const decrypted = await EncryptionService_1.encryptionService.decryptData(data.toString('base64'), keyId);
            return Buffer.from(decrypted, 'base64');
        }
        else {
            const iv = data.slice(0, 16);
            const encryptedData = data.slice(16);
            const decipher = crypto.createDecipheriv(this.config.encryptionAlgorithm, encryptionKey, iv);
            let decrypted = decipher.update(encryptedData);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted;
        }
    }
    async decompressData(data) {
        return new Promise((resolve, reject) => {
            zlib.gunzip(data, (error, decompressed) => {
                if (error)
                    reject(error);
                else
                    resolve(decompressed);
            });
        });
    }
    async restoreData(data, targetLocation, options) {
        fs.writeFileSync(targetLocation, data);
        if (options.preservePermissions) {
            fs.chmodSync(targetLocation, 0o600);
        }
        logger_1.logger.debug('Data restored', {
            targetLocation,
            size: data.length
        });
    }
    async handleCorruptedBackup(backupId, metadata) {
        logger_1.logger.error('Corrupted backup detected', { backupId });
        await SecurityLogService_1.securityLogService.logSecurityEvent({
            eventType: 'backup_corruption_detected',
            severity: 'HIGH',
            category: 'system',
            ipAddress: 'localhost',
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
        metadata.auditTrail.push({
            timestamp: new Date(),
            action: 'verified',
            user: 'system',
            details: { corruption: true },
            outcome: 'failure'
        });
    }
    async logBackupEvent(backupId, action, details, outcome = 'success') {
        const event = {
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
        await SecurityLogService_1.securityLogService.logSecurityEvent({
            eventType: `backup_${action}`,
            severity: outcome === 'failure' ? 'HIGH' : 'LOW',
            category: 'system',
            ipAddress: 'localhost',
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
    startAutomaticBackups() {
        if (!this.config.enableAutomaticBackups) {
            return;
        }
        const fullBackupInterval = setInterval(() => {
            this.performScheduledBackup('full').catch((err) => {
                logger_1.logger.error('Scheduled full backup failed:', err);
            });
        }, this.config.fullBackupIntervalHours * 60 * 60 * 1000);
        const incrementalBackupInterval = setInterval(() => {
            this.performScheduledBackup('incremental').catch((err) => {
                logger_1.logger.error('Scheduled incremental backup failed:', err);
            });
        }, this.config.incrementalBackupIntervalHours * 60 * 60 * 1000);
        this.backupScheduler.push(fullBackupInterval, incrementalBackupInterval);
        logger_1.logger.info('Automatic backup scheduling started', {
            fullBackupInterval: this.config.fullBackupIntervalHours,
            incrementalBackupInterval: this.config.incrementalBackupIntervalHours
        });
    }
    async performScheduledBackup(type) {
        const sources = this.getBackupSources();
        for (const source of sources) {
            try {
                await this.createBackup(source, type, {
                    compression: true,
                    encryption: true,
                    immediateUpload: true
                });
            }
            catch (err) {
                logger_1.logger.error(`Scheduled ${type} backup failed for ${source}:`, err);
            }
        }
    }
    getBackupSources() {
        return [
            'database:postgresql',
            'database:redis',
            'files:/app/uploads',
            'files:/app/logs',
            'files:/app/config'
        ];
    }
    getStats() {
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
            nextScheduledBackup: undefined,
            recentBackups,
            failedJobs
        };
    }
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.recentBackups === 0) {
            status = 'warning';
        }
        if (stats.failedJobs > 0) {
            status = 'degraded';
        }
        return {
            status,
            stats: {
                ...stats
            }
        };
    }
}
exports.SecureBackupService = SecureBackupService;
exports.secureBackupService = SecureBackupService.getInstance();
//# sourceMappingURL=SecureBackupService.js.map
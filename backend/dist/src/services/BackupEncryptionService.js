"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupEncryptionService = exports.BackupEncryptionService = void 0;
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
const EncryptionService_1 = require("./EncryptionService");
const VaultService_1 = require("./VaultService");
class BackupEncryptionService {
    constructor() {
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
    static getInstance() {
        if (!BackupEncryptionService.instance) {
            BackupEncryptionService.instance = new BackupEncryptionService();
        }
        return BackupEncryptionService.instance;
    }
    async initialize() {
        try {
            await this.ensureDirectories();
            await this.verifyEncryption();
            logger_1.logger.info('Backup encryption service initialized', {
                enabled: this.config.enabled,
                compressionEnabled: this.config.compressionEnabled,
                retentionDays: this.config.retentionDays
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize backup encryption service:', error);
            throw error;
        }
    }
    async ensureDirectories() {
        const directories = [
            this.config.backupPath,
            this.config.encryptedBackupPath,
            path_1.default.join(this.config.encryptedBackupPath, 'database'),
            path_1.default.join(this.config.encryptedBackupPath, 'files'),
            path_1.default.join(this.config.encryptedBackupPath, 'logs'),
            path_1.default.join(this.config.encryptedBackupPath, 'metadata')
        ];
        for (const dir of directories) {
            try {
                await promises_1.default.mkdir(dir, { recursive: true });
            }
            catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }
    async verifyEncryption() {
        const testData = Buffer.from('backup-encryption-test');
        const encrypted = await this.encryptData(testData);
        const decrypted = await this.decryptData(encrypted.data, encrypted.keyVersion, encrypted.iv, encrypted.tag);
        if (!testData.equals(decrypted)) {
            throw new Error('Backup encryption verification failed');
        }
    }
    async createEncryptedBackup(sourcePath, backupType, backupName) {
        try {
            if (!this.config.enabled) {
                throw new Error('Backup encryption is disabled');
            }
            const backupId = this.generateBackupId();
            const originalName = backupName || path_1.default.basename(sourcePath);
            logger_1.logger.info('Starting encrypted backup creation', {
                backupId,
                sourcePath,
                backupType,
                originalName
            });
            let sourceData;
            if (this.config.compressionEnabled) {
                sourceData = await this.compressData(sourcePath);
            }
            else {
                sourceData = await promises_1.default.readFile(sourcePath);
            }
            const originalSize = sourceData.length;
            const checksum = crypto_1.default.createHash('sha256').update(sourceData).digest('hex');
            const encrypted = await this.encryptData(sourceData);
            const encryptedName = `${backupId}.backup`;
            const encryptedPath = path_1.default.join(this.config.encryptedBackupPath, backupType, encryptedName);
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
            await promises_1.default.writeFile(encryptedPath, JSON.stringify(encryptedBackupData));
            const encryptedStats = await promises_1.default.stat(encryptedPath);
            const encryptedSize = encryptedStats.size;
            const retentionUntil = new Date();
            retentionUntil.setDate(retentionUntil.getDate() + this.config.retentionDays);
            const metadata = {
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
            await this.storeBackupMetadata(metadata);
            logger_1.logger.info('Encrypted backup created successfully', {
                backupId,
                originalSize,
                encryptedSize,
                compressionRatio: metadata.compressionRatio.toFixed(2)
            });
            return metadata;
        }
        catch (error) {
            logger_1.logger.error('Failed to create encrypted backup:', error);
            throw error;
        }
    }
    async restoreFromBackup(backupId, targetPath) {
        try {
            if (!this.config.enabled) {
                throw new Error('Backup encryption is disabled');
            }
            const metadata = await this.loadBackupMetadata(backupId);
            const encryptedPath = path_1.default.join(this.config.encryptedBackupPath, metadata.backupType, metadata.encryptedName);
            const encryptedContent = await promises_1.default.readFile(encryptedPath, 'utf8');
            const encryptedBackupData = JSON.parse(encryptedContent);
            const iv = Buffer.from(encryptedBackupData.iv, 'base64');
            const tag = Buffer.from(encryptedBackupData.tag, 'base64');
            const data = Buffer.from(encryptedBackupData.data, 'base64');
            let decryptedData = await this.decryptData(data, encryptedBackupData.keyVersion, iv, tag);
            if (encryptedBackupData.compressed) {
                decryptedData = await this.decompressData(decryptedData);
            }
            const checksum = crypto_1.default.createHash('sha256').update(decryptedData).digest('hex');
            if (checksum !== metadata.checksum) {
                throw new Error('Backup integrity check failed');
            }
            await promises_1.default.writeFile(targetPath, decryptedData);
            logger_1.logger.info('Backup restored successfully', {
                backupId,
                targetPath,
                size: decryptedData.length
            });
            return metadata;
        }
        catch (error) {
            logger_1.logger.error('Failed to restore from backup:', error);
            throw error;
        }
    }
    async encryptData(data) {
        try {
            const useVault = process.env.USE_VAULT === 'true';
            if (useVault) {
                const vault = (0, VaultService_1.getVaultService)();
                const encryptedData = await vault.encrypt('backup-key', data.toString('base64'));
                return {
                    data: Buffer.from(encryptedData),
                    keyVersion: 'vault-backup-1',
                    iv: Buffer.alloc(16),
                    tag: Buffer.alloc(16)
                };
            }
            else {
                const key = EncryptionService_1.encryptionService.getEncryptionSecrets().masterKey;
                const iv = crypto_1.default.randomBytes(16);
                const cipher = crypto_1.default.createCipher('aes-256-gcm', Buffer.from(key, 'hex'));
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
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt backup data:', error);
            throw error;
        }
    }
    async decryptData(encryptedData, keyVersion, iv, tag) {
        try {
            if (keyVersion.startsWith('vault-')) {
                const vault = (0, VaultService_1.getVaultService)();
                const decryptedData = await vault.decrypt('backup-key', encryptedData.toString());
                return Buffer.from(decryptedData, 'base64');
            }
            else {
                const key = EncryptionService_1.encryptionService.getEncryptionSecrets().masterKey;
                const decipher = crypto_1.default.createDecipher('aes-256-gcm', Buffer.from(key, 'hex'));
                decipher.setAAD(Buffer.from('backup-encryption', 'utf8'));
                decipher.setAuthTag(tag);
                let decrypted = decipher.update(encryptedData);
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                return decrypted;
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to decrypt backup data:', error);
            throw error;
        }
    }
    async compressData(sourcePath) {
        const { sanitizeFilePath, sanitizeFlagValue } = await import('../utils/commandSanitizer');
        const safePath = sanitizeFilePath(sourcePath);
        const safeCompressionLevel = sanitizeFlagValue(this.config.compressionLevel);
        return new Promise((resolve, reject) => {
            const gzip = (0, child_process_1.spawn)('gzip', ['-c', `-${safeCompressionLevel}`, safePath]);
            const chunks = [];
            gzip.stdout.on('data', (chunk) => {
                chunks.push(chunk);
            });
            gzip.on('close', (code) => {
                if (code === 0) {
                    resolve(Buffer.concat(chunks));
                }
                else {
                    reject(new Error(`Compression failed with code ${code}`));
                }
            });
            gzip.on('error', reject);
        });
    }
    async decompressData(compressedData) {
        return new Promise((resolve, reject) => {
            const gunzip = (0, child_process_1.spawn)('gunzip', ['-c']);
            const chunks = [];
            gunzip.stdout.on('data', (chunk) => {
                chunks.push(chunk);
            });
            gunzip.on('close', (code) => {
                if (code === 0) {
                    resolve(Buffer.concat(chunks));
                }
                else {
                    reject(new Error(`Decompression failed with code ${code}`));
                }
            });
            gunzip.on('error', reject);
            gunzip.stdin.write(compressedData);
            gunzip.stdin.end();
        });
    }
    generateBackupId() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = crypto_1.default.randomBytes(4).toString('hex');
        return `backup-${timestamp}-${random}`;
    }
    async storeBackupMetadata(metadata) {
        const metadataPath = path_1.default.join(this.config.encryptedBackupPath, 'metadata', `${metadata.backupId}.json`);
        await promises_1.default.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }
    async loadBackupMetadata(backupId) {
        const metadataPath = path_1.default.join(this.config.encryptedBackupPath, 'metadata', `${backupId}.json`);
        const metadataContent = await promises_1.default.readFile(metadataPath, 'utf8');
        return JSON.parse(metadataContent);
    }
    async listBackups(backupType) {
        try {
            const metadataDir = path_1.default.join(this.config.encryptedBackupPath, 'metadata');
            const files = await promises_1.default.readdir(metadataDir);
            const metadataFiles = files.filter(file => file.endsWith('.json'));
            const backupList = [];
            for (const metaFile of metadataFiles) {
                try {
                    const backupId = metaFile.replace('.json', '');
                    const metadata = await this.loadBackupMetadata(backupId);
                    if (!backupType || metadata.backupType === backupType) {
                        backupList.push(metadata);
                    }
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to load backup metadata for ${metaFile}:`, error);
                }
            }
            return backupList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        catch (error) {
            logger_1.logger.error('Failed to list backups:', error);
            throw error;
        }
    }
    async cleanupExpiredBackups() {
        try {
            const allBackups = await this.listBackups();
            const now = new Date();
            let deletedCount = 0;
            for (const backup of allBackups) {
                if (backup.retentionUntil < now) {
                    try {
                        await this.deleteBackup(backup.backupId);
                        deletedCount++;
                        logger_1.logger.info('Deleted expired backup', {
                            backupId: backup.backupId,
                            createdAt: backup.createdAt,
                            retentionUntil: backup.retentionUntil
                        });
                    }
                    catch (error) {
                        logger_1.logger.error(`Failed to delete expired backup ${backup.backupId}:`, error);
                    }
                }
            }
            logger_1.logger.info('Backup cleanup completed', { deletedCount });
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup expired backups:', error);
            throw error;
        }
    }
    async deleteBackup(backupId) {
        try {
            const metadata = await this.loadBackupMetadata(backupId);
            const backupPath = path_1.default.join(this.config.encryptedBackupPath, metadata.backupType, metadata.encryptedName);
            const metadataPath = path_1.default.join(this.config.encryptedBackupPath, 'metadata', `${backupId}.json`);
            await Promise.all([
                promises_1.default.unlink(backupPath).catch(() => { }),
                promises_1.default.unlink(metadataPath).catch(() => { })
            ]);
            logger_1.logger.info('Backup deleted successfully', { backupId });
        }
        catch (error) {
            logger_1.logger.error('Failed to delete backup:', error);
            throw error;
        }
    }
    async getBackupStats() {
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get backup statistics:', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            const stats = await this.getBackupStats();
            const directories = {
                backup: await this.directoryExists(this.config.backupPath),
                encrypted: await this.directoryExists(this.config.encryptedBackupPath),
                metadata: await this.directoryExists(path_1.default.join(this.config.encryptedBackupPath, 'metadata'))
            };
            return {
                status: 'healthy',
                enabled: this.config.enabled,
                stats,
                directories
            };
        }
        catch (error) {
            logger_1.logger.error('Backup encryption health check failed:', error);
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
    async directoryExists(dirPath) {
        try {
            const stats = await promises_1.default.stat(dirPath);
            return stats.isDirectory();
        }
        catch (error) {
            return false;
        }
    }
    getConfiguration() {
        return { ...this.config };
    }
}
exports.BackupEncryptionService = BackupEncryptionService;
exports.backupEncryptionService = BackupEncryptionService.getInstance();
//# sourceMappingURL=BackupEncryptionService.js.map
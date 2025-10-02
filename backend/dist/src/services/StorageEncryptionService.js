"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageEncryptionService = exports.StorageEncryptionService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const EncryptionService_1 = require("./EncryptionService");
const VaultService_1 = require("./VaultService");
const logger_1 = require("../utils/logger");
class StorageEncryptionService {
    constructor() {
        this.config = {
            enabled: process.env.STORAGE_ENCRYPTION_ENABLED === 'true',
            encryptionAlgorithm: 'aes-256-gcm',
            keyDerivationIterations: 100000,
            storageBasePath: process.env.STORAGE_BASE_PATH || './storage',
            backupPath: process.env.BACKUP_PATH || './storage/backups',
            tempPath: process.env.TEMP_PATH || './storage/temp'
        };
    }
    static getInstance() {
        if (!StorageEncryptionService.instance) {
            StorageEncryptionService.instance = new StorageEncryptionService();
        }
        return StorageEncryptionService.instance;
    }
    async initialize() {
        try {
            await this.ensureDirectories();
            await this.verifyEncryption();
            logger_1.logger.info('Storage encryption service initialized', {
                enabled: this.config.enabled,
                algorithm: this.config.encryptionAlgorithm
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize storage encryption service:', error);
            throw error;
        }
    }
    async ensureDirectories() {
        const directories = [
            this.config.storageBasePath,
            this.config.backupPath,
            this.config.tempPath,
            path_1.default.join(this.config.storageBasePath, 'uploads'),
            path_1.default.join(this.config.storageBasePath, 'logs'),
            path_1.default.join(this.config.storageBasePath, 'encrypted')
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
        const testData = 'encryption-test-data';
        const encrypted = await this.encryptData(Buffer.from(testData));
        const decrypted = await this.decryptData(encrypted.data, encrypted.key, encrypted.iv, encrypted.tag);
        if (decrypted.toString() !== testData) {
            throw new Error('Encryption verification failed');
        }
    }
    async encryptFile(filePath, originalName, mimeType = 'application/octet-stream') {
        try {
            if (!this.config.enabled) {
                throw new Error('Storage encryption is disabled');
            }
            const originalData = await promises_1.default.readFile(filePath);
            const originalSize = originalData.length;
            const checksum = crypto_1.default.createHash('sha256').update(originalData).digest('hex');
            const encrypted = await this.encryptData(originalData);
            const encryptedName = this.generateEncryptedFilename(originalName);
            const encryptedPath = path_1.default.join(this.config.storageBasePath, 'encrypted', encryptedName);
            const encryptedFileData = {
                version: '1.0',
                algorithm: this.config.encryptionAlgorithm,
                keyVersion: encrypted.keyVersion,
                iv: encrypted.iv.toString('base64'),
                tag: encrypted.tag.toString('base64'),
                data: encrypted.data.toString('base64')
            };
            await promises_1.default.writeFile(encryptedPath, JSON.stringify(encryptedFileData), 'utf8');
            const encryptedStats = await promises_1.default.stat(encryptedPath);
            const encryptedSize = encryptedStats.size;
            const metadata = {
                originalName,
                encryptedName,
                size: originalSize,
                encryptedSize,
                mimeType,
                checksum,
                encryptedAt: new Date(),
                keyVersion: encrypted.keyVersion
            };
            await this.storeMetadata(encryptedName, metadata);
            logger_1.logger.info('File encrypted successfully', {
                originalName,
                encryptedName,
                originalSize,
                encryptedSize,
                compressionRatio: (originalSize / encryptedSize).toFixed(2)
            });
            return metadata;
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt file:', error);
            throw error;
        }
    }
    async decryptFile(encryptedName) {
        try {
            if (!this.config.enabled) {
                throw new Error('Storage encryption is disabled');
            }
            const metadata = await this.loadMetadata(encryptedName);
            const encryptedPath = path_1.default.join(this.config.storageBasePath, 'encrypted', encryptedName);
            const encryptedFileContent = await promises_1.default.readFile(encryptedPath, 'utf8');
            const encryptedFileData = JSON.parse(encryptedFileContent);
            const iv = Buffer.from(encryptedFileData.iv, 'base64');
            const tag = Buffer.from(encryptedFileData.tag, 'base64');
            const data = Buffer.from(encryptedFileData.data, 'base64');
            const decryptedData = await this.decryptData(data, encryptedFileData.keyVersion, iv, tag);
            const checksum = crypto_1.default.createHash('sha256').update(decryptedData).digest('hex');
            if (checksum !== metadata.checksum) {
                throw new Error('File integrity check failed');
            }
            logger_1.logger.debug('File decrypted successfully', {
                encryptedName,
                originalName: metadata.originalName,
                size: decryptedData.length
            });
            return {
                data: decryptedData,
                metadata
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to decrypt file:', error);
            throw error;
        }
    }
    async encryptData(data) {
        try {
            const useVault = process.env.USE_VAULT === 'true';
            if (useVault) {
                const vault = (0, VaultService_1.getVaultService)();
                const encryptedData = await vault.encrypt('file-storage-key', data.toString('base64'));
                return {
                    data: Buffer.from(encryptedData),
                    key: 'vault-managed',
                    iv: Buffer.alloc(16),
                    tag: Buffer.alloc(16),
                    keyVersion: 'vault-1'
                };
            }
            else {
                const key = EncryptionService_1.encryptionService.getEncryptionSecrets().dataEncryptionKey;
                const iv = crypto_1.default.randomBytes(16);
                const cipher = crypto_1.default.createCipher(this.config.encryptionAlgorithm, Buffer.from(key, 'hex'));
                let encrypted = cipher.update(data);
                encrypted = Buffer.concat([encrypted, cipher.final()]);
                const tag = cipher.getAuthTag();
                return {
                    data: encrypted,
                    key,
                    iv,
                    tag,
                    keyVersion: 'local-1'
                };
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt data:', error);
            throw error;
        }
    }
    async decryptData(encryptedData, keyVersion, iv, tag) {
        try {
            if (keyVersion.startsWith('vault-')) {
                const vault = (0, VaultService_1.getVaultService)();
                const decryptedData = await vault.decrypt('file-storage-key', encryptedData.toString());
                return Buffer.from(decryptedData, 'base64');
            }
            else {
                const key = EncryptionService_1.encryptionService.getEncryptionSecrets().dataEncryptionKey;
                const decipher = crypto_1.default.createDecipher(this.config.encryptionAlgorithm, Buffer.from(key, 'hex'));
                decipher.setAuthTag(tag);
                let decrypted = decipher.update(encryptedData);
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                return decrypted;
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to decrypt data:', error);
            throw error;
        }
    }
    async encryptBuffer(data) {
        try {
            const encrypted = await this.encryptData(data);
            return encrypted.data;
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt buffer:', error);
            throw error;
        }
    }
    async decryptBuffer(encryptedData) {
        try {
            const iv = crypto_1.default.randomBytes(16);
            const tag = Buffer.alloc(16);
            const decrypted = await this.decryptData(encryptedData, 'local-v1', iv, tag);
            return decrypted;
        }
        catch (error) {
            logger_1.logger.error('Failed to decrypt buffer:', error);
            throw error;
        }
    }
    generateEncryptedFilename(originalName) {
        const hash = crypto_1.default.createHash('sha256').update(originalName + Date.now()).digest('hex');
        return `${hash.substring(0, 16)}.enc`;
    }
    async storeMetadata(encryptedName, metadata) {
        const metadataPath = path_1.default.join(this.config.storageBasePath, 'encrypted', `${encryptedName}.meta`);
        await promises_1.default.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }
    async loadMetadata(encryptedName) {
        const metadataPath = path_1.default.join(this.config.storageBasePath, 'encrypted', `${encryptedName}.meta`);
        const metadataContent = await promises_1.default.readFile(metadataPath, 'utf8');
        return JSON.parse(metadataContent);
    }
    async deleteFile(encryptedName) {
        try {
            const encryptedPath = path_1.default.join(this.config.storageBasePath, 'encrypted', encryptedName);
            const metadataPath = path_1.default.join(this.config.storageBasePath, 'encrypted', `${encryptedName}.meta`);
            await Promise.all([
                promises_1.default.unlink(encryptedPath).catch(() => { }),
                promises_1.default.unlink(metadataPath).catch(() => { })
            ]);
            logger_1.logger.info('Encrypted file deleted', { encryptedName });
        }
        catch (error) {
            logger_1.logger.error('Failed to delete encrypted file:', error);
            throw error;
        }
    }
    async listFiles() {
        try {
            const encryptedDir = path_1.default.join(this.config.storageBasePath, 'encrypted');
            const files = await promises_1.default.readdir(encryptedDir);
            const metadataFiles = files.filter(file => file.endsWith('.meta'));
            const metadataList = [];
            for (const metaFile of metadataFiles) {
                try {
                    const metadata = await this.loadMetadata(metaFile.replace('.meta', ''));
                    metadataList.push(metadata);
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to load metadata for ${metaFile}:`, error);
                }
            }
            return metadataList;
        }
        catch (error) {
            logger_1.logger.error('Failed to list encrypted files:', error);
            throw error;
        }
    }
    async getStorageStats() {
        try {
            const files = await this.listFiles();
            const totalFiles = files.length;
            const totalSize = files.reduce((sum, file) => sum + file.size, 0);
            const encryptedFiles = files.length;
            const encryptedSize = files.reduce((sum, file) => sum + file.encryptedSize, 0);
            const compressionRatio = totalSize > 0 ? encryptedSize / totalSize : 1;
            return {
                totalFiles,
                totalSize,
                encryptedFiles,
                encryptedSize,
                compressionRatio
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get storage statistics:', error);
            throw error;
        }
    }
    async encryptExistingFiles(sourceDir) {
        try {
            let processedCount = 0;
            const files = await promises_1.default.readdir(sourceDir, { withFileTypes: true });
            for (const file of files) {
                if (file.isFile()) {
                    const filePath = path_1.default.join(sourceDir, file.name);
                    try {
                        await this.encryptFile(filePath, file.name);
                        processedCount++;
                        if (process.env.DELETE_ORIGINAL_AFTER_ENCRYPTION === 'true') {
                            await promises_1.default.unlink(filePath);
                        }
                    }
                    catch (error) {
                        logger_1.logger.error(`Failed to encrypt file ${file.name}:`, error);
                    }
                }
            }
            logger_1.logger.info(`Encrypted ${processedCount} existing files from ${sourceDir}`);
            return processedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt existing files:', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            const stats = await this.getStorageStats();
            const directories = {
                storage: await this.directoryExists(this.config.storageBasePath),
                backup: await this.directoryExists(this.config.backupPath),
                temp: await this.directoryExists(this.config.tempPath),
                encrypted: await this.directoryExists(path_1.default.join(this.config.storageBasePath, 'encrypted'))
            };
            return {
                status: 'healthy',
                enabled: this.config.enabled,
                stats,
                directories
            };
        }
        catch (error) {
            logger_1.logger.error('Storage encryption health check failed:', error);
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
exports.StorageEncryptionService = StorageEncryptionService;
exports.storageEncryptionService = StorageEncryptionService.getInstance();
//# sourceMappingURL=StorageEncryptionService.js.map
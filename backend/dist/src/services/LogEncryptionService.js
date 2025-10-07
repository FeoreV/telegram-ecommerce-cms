"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEncryptionService = exports.LogEncryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const stream_1 = require("stream");
const logger_1 = require("../utils/logger");
const EncryptionService_1 = require("./EncryptionService");
const VaultService_1 = require("./VaultService");
class LogEncryptionService {
    constructor() {
        this.encryptionStreams = new Map();
        this.config = {
            enabled: process.env.LOG_ENCRYPTION_ENABLED === 'true',
            logBasePath: process.env.LOG_BASE_PATH || './storage/logs',
            encryptedLogPath: process.env.ENCRYPTED_LOG_PATH || './storage/logs/encrypted',
            rotationSize: parseInt(process.env.LOG_ROTATION_SIZE || '104857600'),
            rotationInterval: parseInt(process.env.LOG_ROTATION_INTERVAL || '24'),
            retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '90'),
            compressionEnabled: process.env.LOG_COMPRESSION_ENABLED !== 'false',
            realtimeEncryption: process.env.LOG_REALTIME_ENCRYPTION === 'true'
        };
    }
    static getInstance() {
        if (!LogEncryptionService.instance) {
            LogEncryptionService.instance = new LogEncryptionService();
        }
        return LogEncryptionService.instance;
    }
    async initialize() {
        try {
            await this.ensureDirectories();
            if (this.config.enabled) {
                this.setupLogRotation();
            }
            logger_1.logger.info('Log encryption service initialized', {
                enabled: this.config.enabled,
                realtimeEncryption: this.config.realtimeEncryption,
                retentionDays: this.config.retentionDays
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize log encryption service:', error);
            throw error;
        }
    }
    async ensureDirectories() {
        const directories = [
            this.config.logBasePath,
            this.config.encryptedLogPath,
            path_1.default.join(this.config.encryptedLogPath, 'metadata'),
            path_1.default.join(this.config.encryptedLogPath, 'archived')
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
    createEncryptedLogStream(logFile, logLevel = 'info', service = 'backend') {
        if (!this.config.enabled || !this.config.realtimeEncryption) {
            throw new Error('Real-time log encryption is disabled');
        }
        const streamId = `${service}-${logLevel}-${Date.now()}`;
        const stream = new EncryptedLogStream(logFile, logLevel, service, this.config);
        this.encryptionStreams.set(streamId, stream);
        stream.on('end', () => {
            this.encryptionStreams.delete(streamId);
        });
        return stream;
    }
    async encryptLogFile(logFilePath, logLevel = 'info', service = 'backend') {
        try {
            if (!this.config.enabled) {
                throw new Error('Log encryption is disabled');
            }
            const logId = this.generateLogId(service, logLevel);
            const originalFile = path_1.default.basename(logFilePath);
            logger_1.logger.debug('Starting log file encryption', {
                logId,
                logFilePath,
                logLevel,
                service
            });
            const logData = await promises_1.default.readFile(logFilePath);
            const originalSize = logData.length;
            const checksum = crypto_1.default.createHash('sha256').update(logData).digest('hex');
            let processedData = logData;
            if (this.config.compressionEnabled) {
                processedData = await this.compressLogData(logData);
            }
            const encrypted = await this.encryptLogData(processedData);
            const encryptedFile = `${logId}.log.enc`;
            const encryptedPath = path_1.default.join(this.config.encryptedLogPath, encryptedFile);
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
            await promises_1.default.writeFile(encryptedPath, JSON.stringify(encryptedLogData));
            const encryptedStats = await promises_1.default.stat(encryptedPath);
            const encryptedSize = encryptedStats.size;
            const metadata = {
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
            await this.storeLogMetadata(metadata);
            logger_1.logger.info('Log file encrypted successfully', {
                logId,
                originalSize,
                encryptedSize,
                compressionRatio: this.config.compressionEnabled ? originalSize / processedData.length : 1
            });
            return metadata;
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt log file:', error);
            throw error;
        }
    }
    async decryptLogFile(logId, targetPath) {
        try {
            if (!this.config.enabled) {
                throw new Error('Log encryption is disabled');
            }
            const metadata = await this.loadLogMetadata(logId);
            const encryptedPath = path_1.default.join(this.config.encryptedLogPath, metadata.encryptedFile);
            const encryptedContent = await promises_1.default.readFile(encryptedPath, 'utf8');
            const encryptedLogData = JSON.parse(encryptedContent);
            const iv = Buffer.from(encryptedLogData.iv, 'base64');
            const tag = Buffer.from(encryptedLogData.tag, 'base64');
            const data = Buffer.from(encryptedLogData.data, 'base64');
            let decryptedData = await this.decryptLogData(data, encryptedLogData.keyVersion, iv, tag);
            if (encryptedLogData.compressed) {
                decryptedData = await this.decompressLogData(decryptedData);
            }
            const checksum = crypto_1.default.createHash('sha256').update(decryptedData).digest('hex');
            if (checksum !== metadata.checksum) {
                throw new Error('Log integrity check failed');
            }
            if (targetPath) {
                await promises_1.default.writeFile(targetPath, decryptedData);
            }
            logger_1.logger.info('Log file decrypted successfully', {
                logId,
                size: decryptedData.length,
                targetPath
            });
            return {
                data: decryptedData,
                metadata
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to decrypt log file:', error);
            throw error;
        }
    }
    async encryptLogData(data) {
        try {
            const useVault = process.env.USE_VAULT === 'true';
            if (useVault) {
                const vault = (0, VaultService_1.getVaultService)();
                const encryptedData = await vault.encrypt('app-data-key', data.toString('base64'));
                return {
                    data: Buffer.from(encryptedData),
                    keyVersion: 'vault-log-1',
                    iv: Buffer.alloc(16),
                    tag: Buffer.alloc(16)
                };
            }
            else {
                const key = EncryptionService_1.encryptionService.getEncryptionSecrets().dataEncryptionKey;
                const iv = crypto_1.default.randomBytes(16);
                const cipher = crypto_1.default.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
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
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt log data:', error);
            throw error;
        }
    }
    async decryptLogData(encryptedData, keyVersion, iv, tag) {
        try {
            if (keyVersion.startsWith('vault-')) {
                const vault = (0, VaultService_1.getVaultService)();
                const decryptedData = await vault.decrypt('app-data-key', encryptedData.toString());
                return Buffer.from(decryptedData, 'base64');
            }
            else {
                const key = EncryptionService_1.encryptionService.getEncryptionSecrets().dataEncryptionKey;
                const decipher = crypto_1.default.createDecipher('aes-256-gcm', Buffer.from(key, 'hex'));
                decipher.setAAD(Buffer.from('log-encryption', 'utf8'));
                decipher.setAuthTag(tag);
                let decrypted = decipher.update(encryptedData);
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                return decrypted;
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to decrypt log data:', error);
            throw error;
        }
    }
    async compressLogData(data) {
        const zlib = await import('zlib');
        return new Promise((resolve, reject) => {
            zlib.gzip(data, { level: 6 }, (error, compressed) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(compressed);
                }
            });
        });
    }
    async decompressLogData(compressedData) {
        const zlib = await import('zlib');
        return new Promise((resolve, reject) => {
            zlib.gunzip(compressedData, (error, decompressed) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(decompressed);
                }
            });
        });
    }
    generateLogId(service, logLevel) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = crypto_1.default.randomBytes(4).toString('hex');
        return `log-${service}-${logLevel}-${timestamp}-${random}`;
    }
    async storeLogMetadata(metadata) {
        const metadataPath = path_1.default.join(this.config.encryptedLogPath, 'metadata', `${metadata.logId}.json`);
        await promises_1.default.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }
    async loadLogMetadata(logId) {
        const metadataPath = path_1.default.join(this.config.encryptedLogPath, 'metadata', `${logId}.json`);
        const metadataContent = await promises_1.default.readFile(metadataPath, 'utf8');
        return JSON.parse(metadataContent);
    }
    setupLogRotation() {
        setInterval(() => {
            this.rotateLogsIfNeeded().catch(error => {
                logger_1.logger.error('Log rotation failed:', error);
            });
        }, 60 * 60 * 1000);
        setInterval(() => {
            this.cleanupOldLogs().catch(error => {
                logger_1.logger.error('Log cleanup failed:', error);
            });
        }, 24 * 60 * 60 * 1000);
    }
    async rotateLogsIfNeeded() {
        try {
            const logFiles = await promises_1.default.readdir(this.config.logBasePath);
            for (const logFile of logFiles) {
                if (logFile.endsWith('.log')) {
                    const logPath = path_1.default.join(this.config.logBasePath, logFile);
                    const stats = await promises_1.default.stat(logPath);
                    const needsRotation = stats.size > this.config.rotationSize ||
                        (Date.now() - stats.mtime.getTime()) > (this.config.rotationInterval * 60 * 60 * 1000);
                    if (needsRotation) {
                        await this.encryptLogFile(logPath);
                        const archivedPath = path_1.default.join(this.config.encryptedLogPath, 'archived', `${logFile}.${Date.now()}`);
                        await promises_1.default.rename(logPath, archivedPath);
                        logger_1.logger.info('Log file rotated and encrypted', {
                            originalFile: logFile,
                            size: stats.size
                        });
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to rotate logs:', error);
        }
    }
    async cleanupOldLogs() {
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
                    }
                    catch (error) {
                        logger_1.logger.error(`Failed to delete old log ${log.logId}:`, error);
                    }
                }
            }
            logger_1.logger.info('Old logs cleanup completed', { deletedCount });
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup old logs:', error);
            throw error;
        }
    }
    async listLogs(service, logLevel) {
        try {
            const metadataDir = path_1.default.join(this.config.encryptedLogPath, 'metadata');
            const files = await promises_1.default.readdir(metadataDir);
            const metadataFiles = files.filter(file => file.endsWith('.json'));
            const logList = [];
            for (const metaFile of metadataFiles) {
                try {
                    const logId = metaFile.replace('.json', '');
                    const metadata = await this.loadLogMetadata(logId);
                    if ((!service || metadata.service === service) &&
                        (!logLevel || metadata.logLevel === logLevel)) {
                        logList.push(metadata);
                    }
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to load log metadata for ${metaFile}:`, error);
                }
            }
            return logList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        catch (error) {
            logger_1.logger.error('Failed to list logs:', error);
            throw error;
        }
    }
    async deleteLog(logId) {
        try {
            const metadata = await this.loadLogMetadata(logId);
            const logPath = path_1.default.join(this.config.encryptedLogPath, metadata.encryptedFile);
            const metadataPath = path_1.default.join(this.config.encryptedLogPath, 'metadata', `${logId}.json`);
            await Promise.all([
                promises_1.default.unlink(logPath).catch(() => { }),
                promises_1.default.unlink(metadataPath).catch(() => { })
            ]);
            logger_1.logger.debug('Encrypted log deleted', { logId });
        }
        catch (error) {
            logger_1.logger.error('Failed to delete encrypted log:', error);
            throw error;
        }
    }
    async getLogStats() {
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
            const logsByLevel = {};
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get log statistics:', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            const stats = await this.getLogStats();
            return {
                status: 'healthy',
                enabled: this.config.enabled,
                realtimeEncryption: this.config.realtimeEncryption,
                stats,
                activeStreams: this.encryptionStreams.size
            };
        }
        catch (error) {
            logger_1.logger.error('Log encryption health check failed:', error);
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
    getConfiguration() {
        return { ...this.config };
    }
}
exports.LogEncryptionService = LogEncryptionService;
class EncryptedLogStream extends stream_1.Transform {
    constructor(logFile, logLevel, service, config) {
        super({ objectMode: false });
        this.buffer = Buffer.alloc(0);
        this.logFile = logFile;
        this.logLevel = logLevel;
        this.service = service;
        this.config = config;
    }
    _transform(chunk, encoding, callback) {
        try {
            this.buffer = Buffer.concat([this.buffer, chunk]);
            const lines = this.buffer.toString().split('\n');
            this.buffer = Buffer.from(lines.pop() || '');
            for (const line of lines) {
                if (line.trim()) {
                    const encryptedLine = this.encryptLogLine(line + '\n');
                    this.push(encryptedLine);
                }
            }
            callback();
        }
        catch (error) {
            callback(error);
        }
    }
    _flush(callback) {
        try {
            if (this.buffer.length > 0) {
                const encryptedLine = this.encryptLogLine(this.buffer.toString());
                this.push(encryptedLine);
            }
            callback();
        }
        catch (error) {
            callback(error);
        }
    }
    encryptLogLine(line) {
        const key = EncryptionService_1.encryptionService.getEncryptionSecrets().dataEncryptionKey;
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv('aes-256-ctr', key, iv);
        let encrypted = cipher.update(line, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted + '\n';
    }
}
exports.logEncryptionService = LogEncryptionService.getInstance();
//# sourceMappingURL=LogEncryptionService.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseEncryptionService = exports.DatabaseEncryptionService = void 0;
const database_1 = require("../lib/database");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
const EncryptionService_1 = require("./EncryptionService");
class DatabaseEncryptionService {
    constructor() {
        this.config = {
            enableFieldLevelEncryption: process.env.ENABLE_FIELD_ENCRYPTION === 'true',
            encryptionKeyRotationDays: parseInt(process.env.ENCRYPTION_KEY_ROTATION_DAYS || '90'),
            auditRetentionDays: parseInt(process.env.ENCRYPTION_AUDIT_RETENTION_DAYS || '365'),
            encryptedFields: {
                users: ['email', 'phone', 'firstName', 'lastName'],
                orders: ['customerInfo', 'notes'],
                stores: ['contactInfo', 'botToken']
            }
        };
    }
    static getInstance() {
        if (!DatabaseEncryptionService.instance) {
            DatabaseEncryptionService.instance = new DatabaseEncryptionService();
        }
        return DatabaseEncryptionService.instance;
    }
    async initialize() {
        try {
            const schemaExists = await this.checkEncryptionSchema();
            if (!schemaExists) {
                logger_1.logger.warn('Database encryption schema not found. Run migration first.');
                return;
            }
            await this.setupEncryptionKeys();
            await this.healthCheck();
            logger_1.logger.info('Database encryption service initialized successfully', {
                fieldLevelEncryption: this.config.enableFieldLevelEncryption,
                encryptedTables: Object.keys(this.config.encryptedFields).length
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize database encryption service:', error);
            throw error;
        }
    }
    async checkEncryptionSchema() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.schemata
          WHERE schema_name = 'encryption'
        ) as exists
      `;
            return result[0]?.exists || false;
        }
        catch (error) {
            logger_1.logger.error('Failed to check encryption schema:', error);
            return false;
        }
    }
    async setupEncryptionKeys() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const encryptionSecrets = EncryptionService_1.encryptionService.getEncryptionSecrets();
            const keyMappings = [
                { name: 'user_pii', key: encryptionSecrets.dataEncryptionKey },
                { name: 'order_data', key: encryptionSecrets.dataEncryptionKey },
                { name: 'store_data', key: encryptionSecrets.dataEncryptionKey },
                { name: 'store_secrets', key: encryptionSecrets.masterKey },
                { name: 'default', key: encryptionSecrets.dataEncryptionKey }
            ];
            for (const mapping of keyMappings) {
                await prisma.$executeRaw `
          SELECT set_config(${'encryption.key_' + mapping.name}, ${mapping.key}, false)
        `;
            }
            logger_1.logger.debug('Encryption keys configured in database session');
        }
        catch (error) {
            logger_1.logger.error('Failed to setup encryption keys:', error);
            throw error;
        }
    }
    async encryptExistingData(tableName, batchSize = 1000) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            let totalProcessed = 0;
            const encryptedFields = this.config.encryptedFields[tableName];
            if (!encryptedFields) {
                throw new Error(`No encrypted fields configured for table: ${tableName}`);
            }
            logger_1.logger.info(`Starting encryption of existing data in ${tableName}`, {
                fields: encryptedFields,
                batchSize
            });
            let offset = 0;
            let hasMore = true;
            while (hasMore) {
                const query = `
          SELECT id FROM ${tableName}
          WHERE ${encryptedFields.map(field => `${field}_encrypted IS NULL AND ${field} IS NOT NULL`).join(' OR ')}
          LIMIT ${batchSize} OFFSET ${offset}
        `;
                const records = await prisma.$queryRawUnsafe(query);
                if (records.length === 0) {
                    hasMore = false;
                    break;
                }
                for (const record of records) {
                    await this.encryptRecord(tableName, record.id);
                    totalProcessed++;
                }
                offset += batchSize;
                logger_1.logger.info(`Processed ${totalProcessed} records in ${(0, sanitizer_1.sanitizeForLog)(tableName)}`);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            logger_1.logger.info(`Completed encryption of existing data in ${(0, sanitizer_1.sanitizeForLog)(tableName)}`, {
                totalProcessed
            });
            return totalProcessed;
        }
        catch (error) {
            logger_1.logger.error(`Failed to encrypt existing data in ${(0, sanitizer_1.sanitizeForLog)(tableName)}:`, error);
            throw error;
        }
    }
    async encryptRecord(tableName, recordId) {
        const prisma = database_1.databaseService.getPrisma();
        const encryptedFields = this.config.encryptedFields[tableName];
        const updateFields = encryptedFields.map(field => {
            const keyName = this.getKeyNameForTable(tableName);
            return `${field}_encrypted = CASE
        WHEN ${field} IS NOT NULL AND ${field}_encrypted IS NULL
        THEN encryption.encrypt_data(${field}, '${keyName}')
        ELSE ${field}_encrypted
      END`;
        }).join(', ');
        const query = `
      UPDATE ${tableName}
      SET ${updateFields}
      WHERE id = $1
    `;
        await prisma.$executeRawUnsafe(query, recordId);
    }
    getKeyNameForTable(tableName) {
        const keyMappings = {
            users: 'user_pii',
            orders: 'order_data',
            stores: 'store_data'
        };
        return keyMappings[tableName] || 'default';
    }
    async rotateEncryptionKeys() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const results = {};
            logger_1.logger.info('Starting encryption key rotation');
            for (const [tableName, fields] of Object.entries(this.config.encryptedFields)) {
                const keyName = this.getKeyNameForTable(tableName);
                const newKeyName = `${keyName}_new`;
                const encryptionSecrets = EncryptionService_1.encryptionService.getEncryptionSecrets();
                await prisma.$executeRaw `
          SELECT set_config(${`encryption.key_${newKeyName}`}, ${encryptionSecrets.dataEncryptionKey}, false)
        `;
                let totalRotated = 0;
                for (const field of fields) {
                    const result = await prisma.$queryRaw `
            SELECT encryption.rotate_encryption_key(
              ${keyName},
              ${newKeyName},
              ${tableName},
              ${field}
            ) as rotate_encryption_key
          `;
                    const rotated = result[0]?.rotate_encryption_key || 0;
                    totalRotated += rotated;
                    logger_1.logger.info(`Rotated encryption key for ${tableName}.${field}`, {
                        recordsRotated: rotated
                    });
                }
                results[tableName] = totalRotated;
            }
            logger_1.logger.info('Encryption key rotation completed', { results });
            return results;
        }
        catch (error) {
            logger_1.logger.error('Failed to rotate encryption keys:', error);
            throw error;
        }
    }
    async getEncryptionStats() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            let totalEncryptedRecords = 0;
            for (const [tableName, fields] of Object.entries(this.config.encryptedFields)) {
                for (const field of fields) {
                    const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${tableName} WHERE ${field}_encrypted IS NOT NULL`);
                    totalEncryptedRecords += result[0]?.count || 0;
                }
            }
            const auditResult = await prisma.$queryRaw `
        SELECT COUNT(*) as count FROM encryption.audit_log
      `;
            const auditLogSize = auditResult[0]?.count || 0;
            const lastRotationResult = await prisma.$queryRaw `
        SELECT MAX(timestamp) as timestamp
        FROM encryption.audit_log
        WHERE operation = 'KEY_ROTATION'
      `;
            const lastKeyRotation = lastRotationResult[0]?.timestamp || null;
            return {
                totalEncryptedRecords,
                encryptedTables: Object.keys(this.config.encryptedFields).length,
                lastKeyRotation,
                auditLogSize
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get encryption statistics:', error);
            throw error;
        }
    }
    async cleanupAuditLogs() {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT encryption.cleanup_audit_logs(${this.config.auditRetentionDays}) as cleanup_audit_logs
      `;
            const deletedCount = result[0]?.cleanup_audit_logs || 0;
            logger_1.logger.info('Audit log cleanup completed', {
                deletedRecords: deletedCount,
                retentionDays: this.config.auditRetentionDays
            });
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup audit logs:', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            const schemaExists = await this.checkEncryptionSchema();
            const stats = await this.getEncryptionStats();
            return {
                status: 'healthy',
                encryptionEnabled: this.config.enableFieldLevelEncryption,
                schemaExists,
                stats
            };
        }
        catch (error) {
            logger_1.logger.error('Database encryption health check failed:', error);
            return {
                status: 'error',
                encryptionEnabled: false,
                schemaExists: false,
                stats: {
                    totalEncryptedRecords: 0,
                    encryptedTables: 0,
                    lastKeyRotation: null,
                    auditLogSize: 0
                }
            };
        }
    }
    getConfiguration() {
        return { ...this.config };
    }
}
exports.DatabaseEncryptionService = DatabaseEncryptionService;
exports.databaseEncryptionService = DatabaseEncryptionService.getInstance();
//# sourceMappingURL=DatabaseEncryptionService.js.map
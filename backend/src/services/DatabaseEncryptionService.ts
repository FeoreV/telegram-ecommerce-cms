import { databaseService } from '../lib/database';
import { logger } from '../utils/logger';
import { sanitizeForLog } from '../utils/sanitizer';
import { encryptionService } from './EncryptionService';

export interface EncryptionConfig {
  enableFieldLevelEncryption: boolean;
  encryptionKeyRotationDays: number;
  auditRetentionDays: number;
  encryptedFields: {
    [tableName: string]: string[];
  };
}

export interface EncryptionStats {
  totalEncryptedRecords: number;
  encryptedTables: number;
  lastKeyRotation: Date | null;
  auditLogSize: number;
}

export class DatabaseEncryptionService {
  private static instance: DatabaseEncryptionService;
  private config: EncryptionConfig;

  private constructor() {
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

  public static getInstance(): DatabaseEncryptionService {
    if (!DatabaseEncryptionService.instance) {
      DatabaseEncryptionService.instance = new DatabaseEncryptionService();
    }
    return DatabaseEncryptionService.instance;
  }

  /**
   * Initialize database encryption
   */
  async initialize(): Promise<void> {
    try {
      // const _prisma = databaseService.getPrisma();
 // Unused variable removed

      // Check if encryption schema exists
      const schemaExists = await this.checkEncryptionSchema();

      if (!schemaExists) {
        logger.warn('Database encryption schema not found. Run migration first.');
        return;
      }

      // Set up encryption keys in database session
      await this.setupEncryptionKeys();

      // Perform health check
      await this.healthCheck();

      logger.info('Database encryption service initialized successfully', {
        fieldLevelEncryption: this.config.enableFieldLevelEncryption,
        encryptedTables: Object.keys(this.config.encryptedFields).length
      });

    } catch (error) {
      logger.error('Failed to initialize database encryption service:', error);
      throw error;
    }
  }

  /**
   * Check if encryption schema exists
   */
  private async checkEncryptionSchema(): Promise<boolean> {
    try {
      const prisma = databaseService.getPrisma();

      const result = await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.schemata
          WHERE schema_name = 'encryption'
        ) as exists
      `;

      return result[0]?.exists || false;
    } catch (error) {
      logger.error('Failed to check encryption schema:', error);
      return false;
    }
  }

  /**
   * Set up encryption keys in database session
   */
  private async setupEncryptionKeys(): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();
      const encryptionSecrets = encryptionService.getEncryptionSecrets();

      // Set encryption keys for different data types
      const keyMappings = [
        { name: 'user_pii', key: encryptionSecrets.dataEncryptionKey },
        { name: 'order_data', key: encryptionSecrets.dataEncryptionKey },
        { name: 'store_data', key: encryptionSecrets.dataEncryptionKey },
        { name: 'store_secrets', key: encryptionSecrets.masterKey },
        { name: 'default', key: encryptionSecrets.dataEncryptionKey }
      ];

      for (const mapping of keyMappings) {
        await prisma.$executeRaw`
          SELECT set_config(${'encryption.key_' + mapping.name}, ${mapping.key}, false)
        `;
      }

      logger.debug('Encryption keys configured in database session');
    } catch (error) {
      logger.error('Failed to setup encryption keys:', error);
      throw error;
    }
  }

  /**
   * Encrypt existing data in database
   */
  async encryptExistingData(tableName: string, batchSize: number = 1000): Promise<number> {
    try {
      const prisma = databaseService.getPrisma();
      let totalProcessed = 0;

      const encryptedFields = this.config.encryptedFields[tableName];
      if (!encryptedFields) {
        throw new Error(`No encrypted fields configured for table: ${tableName}`);
      }

      logger.info(`Starting encryption of existing data in ${tableName}`, {
        fields: encryptedFields,
        batchSize
      });

      // Process in batches to avoid memory issues
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        // Get batch of records that need encryption
        const query = `
          SELECT id FROM ${tableName}
          WHERE ${encryptedFields.map(field => `${field}_encrypted IS NULL AND ${field} IS NOT NULL`).join(' OR ')}
          LIMIT ${batchSize} OFFSET ${offset}
        `;

        const records = await prisma.$queryRawUnsafe<{ id: string }[]>(query);

        if (records.length === 0) {
          hasMore = false;
          break;
        }

        // Process each record
        for (const record of records) {
          await this.encryptRecord(tableName, record.id);
          totalProcessed++;
        }

        offset += batchSize;

        logger.info(`Processed ${totalProcessed} records in ${sanitizeForLog(tableName)}`);

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`Completed encryption of existing data in ${sanitizeForLog(tableName)}`, {
        totalProcessed
      });

      return totalProcessed;

    } catch (error) {
      logger.error(`Failed to encrypt existing data in ${sanitizeForLog(tableName)}:`, error);
      throw error;
    }
  }

  /**
   * Encrypt a specific record
   */
  private async encryptRecord(tableName: string, recordId: string): Promise<void> {
    const prisma = databaseService.getPrisma();
    const encryptedFields = this.config.encryptedFields[tableName];

    // Build update query for encrypted fields
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

  /**
   * Get encryption key name for table
   */
  private getKeyNameForTable(tableName: string): string {
    const keyMappings: { [key: string]: string } = {
      users: 'user_pii',
      orders: 'order_data',
      stores: 'store_data'
    };

    return keyMappings[tableName] || 'default';
  }

  /**
   * Rotate encryption keys
   */
  async rotateEncryptionKeys(): Promise<{ [tableName: string]: number }> {
    try {
      const prisma = databaseService.getPrisma();
      const results: { [tableName: string]: number } = {};

      logger.info('Starting encryption key rotation');

      for (const [tableName, fields] of Object.entries(this.config.encryptedFields)) {
        const keyName = this.getKeyNameForTable(tableName);
        const newKeyName = `${keyName}_new`;

        // Set new key in session
        const encryptionSecrets = encryptionService.getEncryptionSecrets();
        await prisma.$executeRaw`
          SELECT set_config(${`encryption.key_${newKeyName}`}, ${encryptionSecrets.dataEncryptionKey}, false)
        `;

        let totalRotated = 0;

        // Rotate each encrypted field
        for (const field of fields) {
          const result = await prisma.$queryRaw<{ rotate_encryption_key: number }[]>`
            SELECT encryption.rotate_encryption_key(
              ${keyName},
              ${newKeyName},
              ${tableName},
              ${field}
            ) as rotate_encryption_key
          `;

          const rotated = result[0]?.rotate_encryption_key || 0;
          totalRotated += rotated;

          logger.info(`Rotated encryption key for ${tableName}.${field}`, {
            recordsRotated: rotated
          });
        }

        results[tableName] = totalRotated;
      }

      logger.info('Encryption key rotation completed', { results });
      return results;

    } catch (error) {
      logger.error('Failed to rotate encryption keys:', error);
      throw error;
    }
  }

  /**
   * Get encryption statistics
   */
  async getEncryptionStats(): Promise<EncryptionStats> {
    try {
      const prisma = databaseService.getPrisma();

      // Count encrypted records across all tables
      let totalEncryptedRecords = 0;

      for (const [tableName, fields] of Object.entries(this.config.encryptedFields)) {
        for (const field of fields) {
          const result = await prisma.$queryRawUnsafe<{ count: number }[]>(
            `SELECT COUNT(*) as count FROM ${tableName} WHERE ${field}_encrypted IS NOT NULL`
          );
          totalEncryptedRecords += result[0]?.count || 0;
        }
      }

      // Get audit log size
      const auditResult = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count FROM encryption.audit_log
      `;
      const auditLogSize = auditResult[0]?.count || 0;

      // Get last key rotation date
      const lastRotationResult = await prisma.$queryRaw<{ timestamp: Date }[]>`
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

    } catch (error) {
      logger.error('Failed to get encryption statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupAuditLogs(): Promise<number> {
    try {
      const prisma = databaseService.getPrisma();

      const result = await prisma.$queryRaw<{ cleanup_audit_logs: number }[]>`
        SELECT encryption.cleanup_audit_logs(${this.config.auditRetentionDays}) as cleanup_audit_logs
      `;

      const deletedCount = result[0]?.cleanup_audit_logs || 0;

      logger.info('Audit log cleanup completed', {
        deletedRecords: deletedCount,
        retentionDays: this.config.auditRetentionDays
      });

      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup audit logs:', error);
      throw error;
    }
  }

  /**
   * Health check for encryption service
   */
  async healthCheck(): Promise<{
    status: string;
    encryptionEnabled: boolean;
    schemaExists: boolean;
    stats: EncryptionStats;
  }> {
    try {
      const schemaExists = await this.checkEncryptionSchema();
      const stats = await this.getEncryptionStats();

      return {
        status: 'healthy',
        encryptionEnabled: this.config.enableFieldLevelEncryption,
        schemaExists,
        stats
      };

    } catch (error) {
      logger.error('Database encryption health check failed:', error);
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

  /**
   * Get configuration
   */
  getConfiguration(): EncryptionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const databaseEncryptionService = DatabaseEncryptionService.getInstance();

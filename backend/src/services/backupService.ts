import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../lib/prisma';
import { AuditAction, AuditLogService } from '../middleware/auditLog';
import { sanitizeForLog } from '../utils/inputSanitizer';
import { logger } from '../utils/logger';
import { NotificationService } from './notificationService';

export interface BackupOptions {
  includeUploads?: boolean;
  includeAuditLogs?: boolean;
  compression?: boolean;
}

export interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  createdAt: Date;
  type: 'manual' | 'scheduled';
  status: 'creating' | 'completed' | 'failed';
  options: BackupOptions;
  metadata: {
    version: string;
    recordCounts: Record<string, number>;
  };
}

export class BackupService {
  private static backupsDir = path.join(process.cwd(), 'backups');
  private static uploadsDir = path.join(process.cwd(), 'uploads');

  /**
   * Sanitize filename to prevent path traversal attacks
   */
  private static sanitizeFilename(filename: string): string {
    // Remove any path separators and only keep the basename
    const basename = path.basename(filename);
    // Remove any non-alphanumeric characters except dots, dashes, and underscores
    return basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * Validate that a path is within the allowed directory
   */
  private static validatePath(filePath: string, allowedDir: string): void {
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(allowedDir);
    if (!resolvedPath.startsWith(resolvedDir)) {
      throw new Error('Invalid file path: Path traversal detected');
    }
  }

  static async initialize() {
    // Ensure backups directory exists
    try {
      await fs.mkdir(this.backupsDir, { recursive: true });
      logger.info('Backup service initialized');
    } catch (error) {
      logger.error('Failed to initialize backup service:', error);
      throw error;
    }
  }

  // Create full database backup
  static async createBackup(
    adminId: string,
    options: BackupOptions = {},
    type: 'manual' | 'scheduled' = 'manual'
  ): Promise<BackupInfo> {
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${backupId}_${timestamp}.json`;
    const backupPath = path.join(this.backupsDir, filename);

    logger.info('Creating backup', { backupId: sanitizeForLog(backupId), adminId, options, type });

    try {
      // Get database statistics
      const recordCounts = await this.getDatabaseStats();

      const backupInfo: BackupInfo = {
        id: backupId,
        filename,
        size: 0,
        createdAt: new Date(),
        type,
        status: 'creating',
        options,
        metadata: {
          version: '1.0.0',
          recordCounts,
        },
      };

      // Export database data
      const data = await this.exportDatabaseData(options);

      // Include uploads if requested
      if (options.includeUploads) {
        data.uploads = await this.exportUploads();
      }

      // Validate backup path to prevent path traversal
      this.validatePath(backupPath, this.backupsDir);

      // Write backup file
      const backupContent = JSON.stringify(data, null, 2);
      await fs.writeFile(backupPath, backupContent);

      // Compress if requested
      if (options.compression) {
        await this.compressBackup(backupPath);
      }

      // Get final file size
      const stats = await fs.stat(backupPath);
      backupInfo.size = stats.size;
      backupInfo.status = 'completed';

      // Audit log
      await AuditLogService.log(adminId, {
        action: AuditAction.SYSTEM_BACKUP,
        details: {
          backupId,
          filename,
          size: backupInfo.size,
          options,
          recordCounts,
        },
      });

      logger.info('Backup created successfully', { backupId: sanitizeForLog(backupId),
        filename,
        size: backupInfo.size,
        recordCounts,
      });

      return backupInfo;
    } catch (error) {
      logger.error('Backup creation failed', { backupId: sanitizeForLog(backupId), error });

      // Cleanup failed backup file
      try {
        await fs.unlink(backupPath);
      } catch (cleanupError) {
        logger.error('Failed to cleanup incomplete backup file:', cleanupError);
      }

      // Notify about backup failure
      await NotificationService.notifySystemError(
        `Backup creation failed: ${backupId}`,
        { error: error instanceof Error ? error.message : 'Unknown error', adminId }
      );

      throw error;
    }
  }

  // Export all database data
  private static async exportDatabaseData(options: BackupOptions) {
    const data: any = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      options,
      tables: {},
    };

    try {
      // Export all main tables
      const tables = [
        'users',
        'stores',
        'storeAdmins',
        'categories',
        'products',
        'productVariants',
        'orders',
        'orderItems',
        'integrationMappings',
      ];

      // Add audit logs if requested
      if (options.includeAuditLogs) {
        tables.push('adminLogs');
      }

      for (const table of tables) {
        logger.info('Exporting table', { table: sanitizeForLog(table) });

        // Use Prisma to get data safely
        switch (table) {
          case 'users':
            data.tables.users = await prisma.user.findMany();
            break;
          case 'stores':
            data.tables.stores = await prisma.store.findMany();
            break;
          case 'storeAdmins':
            data.tables.storeAdmins = await prisma.storeAdmin.findMany();
            break;
          case 'categories':
            data.tables.categories = await prisma.category.findMany();
            break;
          case 'products':
            data.tables.products = await prisma.product.findMany();
            break;
          case 'productVariants':
            data.tables.productVariants = await prisma.productVariant.findMany();
            break;
          case 'orders':
            data.tables.orders = await prisma.order.findMany();
            break;
          case 'orderItems':
            data.tables.orderItems = await prisma.orderItem.findMany();
            break;
          case 'integrationMappings':
            data.tables.integrationMappings = await prisma.integrationMapping.findMany();
            break;
          case 'adminLogs':
            data.tables.adminLogs = await prisma.adminLog.findMany();
            break;
        }
      }

      return data;
    } catch (error) {
      logger.error('Failed to export database data:', error);
      throw error;
    }
  }

  // Export uploads directory
  private static async exportUploads(): Promise<any> {
    try {
      const uploads: any = {};

      // Check if uploads directory exists
      try {
        const uploadStats = await fs.stat(this.uploadsDir);
        if (uploadStats.isDirectory()) {
          // Get list of upload files
          const files = await fs.readdir(this.uploadsDir, { withFileTypes: true });

          for (const file of files) {
            if (file.isFile()) {
              const filePath = path.join(this.uploadsDir, file.name);
              const fileContent = await fs.readFile(filePath);
              uploads[file.name] = {
                content: fileContent.toString('base64'),
                size: fileContent.length,
                type: path.extname(file.name),
              };
            }
          }
        }
      } catch (error) {
        logger.warn('Uploads directory not found, skipping uploads backup');
      }

      return uploads;
    } catch (error) {
      logger.error('Failed to export uploads:', error);
      throw error;
    }
  }

  // Compress backup file
  private static async compressBackup(backupPath: string): Promise<void> {
    // Validate and sanitize path to prevent command injection (CWE-94, CWE-78)
    const { sanitizeFilePath, prepareSafeCommand } = await import('../utils/commandSanitizer.js');
    const safePath = sanitizeFilePath(backupPath);

    // Validate command and arguments
    const { command, args } = prepareSafeCommand('gzip', ['-f', safePath]);

    return new Promise((resolve, reject) => {
      const gzip = spawn(command, args);

      gzip.on('close', (code) => {
        if (code === 0) {
          logger.info('Backup compressed successfully');
          resolve();
        } else {
          reject(new Error(`Compression failed with code ${code}`));
        }
      });

      gzip.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Restore from backup
  static async restoreFromBackup(
    backupFilename: string,
    adminId: string,
    options: {
      restoreUploads?: boolean;
      skipExisting?: boolean;
    } = {}
  ): Promise<void> {
    // SECURITY FIX: Sanitize filename to prevent path traversal (CWE-22)
    const sanitizedFilename = this.sanitizeFilename(backupFilename);
    const backupPath = path.join(this.backupsDir, sanitizedFilename);

    logger.info('Starting restore from backup', { filename: sanitizeForLog(sanitizedFilename), adminId, options });

    try {
      // SECURITY FIX: Validate backup path to prevent path traversal (CWE-22)
      this.validatePath(backupPath, this.backupsDir);

      // Verify backup file exists
      await fs.access(backupPath);

      // Read backup data
      const backupContent = await fs.readFile(backupPath, 'utf8');
      const backupData = JSON.parse(backupContent);

      // Validate backup format
      if (!backupData.version || !backupData.tables) {
        throw new Error('Invalid backup format');
      }

      // Start transaction for database restore
      await prisma.$transaction(async (tx) => {
        // Disable foreign key checks temporarily
        await tx.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');

        try {
          // Restore tables in correct order (dependencies first)
          const restoreOrder = [
            'users',
            'categories',
            'stores',
            'storeAdmins',
            'products',
            'productVariants',
            'orders',
            'orderItems',
            'integrationMappings',
            'adminLogs',
          ];

          for (const tableName of restoreOrder) {
            if (backupData.tables[tableName]) {
              await this.restoreTable(tx, tableName, backupData.tables[tableName], options);
            }
          }

          // Re-enable foreign key checks
          await tx.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
        } catch (error) {
          // Re-enable foreign key checks even on error
          await tx.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
          throw error;
        }
      });

      // Restore uploads if requested
      if (options.restoreUploads && backupData.uploads) {
        await this.restoreUploads(backupData.uploads);
      }

      // Audit log
      await AuditLogService.log(adminId, {
        action: AuditAction.SYSTEM_RESTORE,
        details: {
          backupFilename,
          options,
          restoredTables: Object.keys(backupData.tables),
        },
      });

      logger.info('Restore completed successfully', { filename: sanitizeForLog(backupFilename) });
    } catch (error) {
      logger.error('Restore failed', { filename: sanitizeForLog(backupFilename), error });

      // Notify about restore failure
      await NotificationService.notifySystemError(
        `Database restore failed: ${sanitizeForLog(backupFilename)}`,
        { error: error instanceof Error ? error.message : 'Unknown error', adminId }
      );

      throw error;
    }
  }

  // Restore specific table
  private static async restoreTable(
    tx: any,
    tableName: string,
    data: any[],
    options: { skipExisting?: boolean } = {}
  ): Promise<void> {
    if (!data || data.length === 0) {
      logger.info('No data to restore for table', { table: sanitizeForLog(tableName) });
      return;
    }

    logger.info('Restoring table', { table: sanitizeForLog(tableName), records: data.length });

    try {
      for (const record of data) {
        // Skip existing records if requested
        if (options.skipExisting) {
          const existing = await this.checkRecordExists(tx, tableName, record);
          if (existing) {
            continue;
          }
        }

        // Insert record using appropriate Prisma method
        await this.insertRecord(tx, tableName, record);
      }
    } catch (error) {
      logger.error('Failed to restore table', { table: sanitizeForLog(tableName), error });
      throw error;
    }
  }

  // Check if record exists
  private static async checkRecordExists(tx: any, tableName: string, record: any): Promise<boolean> {
    try {
      switch (tableName) {
        case 'users':
          return !!(await tx.user.findUnique({ where: { id: record.id } }));
        case 'stores':
          return !!(await tx.store.findUnique({ where: { id: record.id } }));
        case 'products':
          return !!(await tx.product.findUnique({ where: { id: record.id } }));
        // Add other tables as needed
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  // Insert record
  private static async insertRecord(tx: any, tableName: string, record: any): Promise<void> {
    switch (tableName) {
      case 'users':
        await tx.user.create({ data: record });
        break;
      case 'stores':
        await tx.store.create({ data: record });
        break;
      case 'storeAdmins':
        await tx.storeAdmin.create({ data: record });
        break;
      case 'categories':
        await tx.category.create({ data: record });
        break;
      case 'products':
        await tx.product.create({ data: record });
        break;
      case 'productVariants':
        await tx.productVariant.create({ data: record });
        break;
      case 'orders':
        await tx.order.create({ data: record });
        break;
      case 'orderItems':
        await tx.orderItem.create({ data: record });
        break;
      case 'integrationMappings':
        await tx.integrationMapping.create({ data: record });
        break;
      case 'adminLogs':
        await tx.adminLog.create({ data: record });
        break;
    }
  }

  // Restore uploads
  private static async restoreUploads(uploadsData: any): Promise<void> {
    try {
      // Ensure uploads directory exists
      await fs.mkdir(this.uploadsDir, { recursive: true });

      for (const [filename, fileData] of Object.entries(uploadsData)) {
        const sanitizedFilename = this.sanitizeFilename(filename);
        const filePath = path.join(this.uploadsDir, sanitizedFilename);

        // Validate file path to prevent path traversal
        this.validatePath(filePath, this.uploadsDir);

        const content = Buffer.from((fileData as any).content, 'base64');
        await fs.writeFile(filePath, content);
      }

      logger.info('Restored upload files', { count: Object.keys(uploadsData).length });
    } catch (error) {
      logger.error('Failed to restore uploads:', error);
      throw error;
    }
  }

  // Get database statistics
  private static async getDatabaseStats(): Promise<Record<string, number>> {
    try {
      const [
        userCount,
        storeCount,
        productCount,
        orderCount,
        categoryCount,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.store.count(),
        prisma.product.count(),
        prisma.order.count(),
        prisma.category.count(),
      ]);

      return {
        users: userCount,
        stores: storeCount,
        products: productCount,
        orders: orderCount,
        categories: categoryCount,
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      return {};
    }
  }

  // List available backups
  static async listBackups(): Promise<BackupInfo[]> {
    try {
      const files = await fs.readdir(this.backupsDir);
      const backups: BackupInfo[] = [];

      for (const filename of files) {
        if (filename.endsWith('.json') || filename.endsWith('.gz')) {
          const filePath = path.join(this.backupsDir, filename);
          const stats = await fs.stat(filePath);

          // Try to extract backup info from filename
          const match = filename.match(/backup_(\d+)_/);
          const timestamp = match ? new Date(parseInt(match[1])) : stats.birthtime;

          backups.push({
            id: path.basename(filename, path.extname(filename)),
            filename,
            size: stats.size,
            createdAt: timestamp,
            type: 'manual', // Default assumption
            status: 'completed',
            options: {},
            metadata: {
              version: '1.0.0',
              recordCounts: {},
            },
          });
        }
      }

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      logger.error('Failed to list backups:', error);
      return [];
    }
  }

  // Delete backup
  static async deleteBackup(filename: string, adminId: string): Promise<void> {
    // SECURITY FIX: Sanitize filename to prevent path traversal (CWE-22)
    const sanitizedFilename = this.sanitizeFilename(filename);
    const backupPath = path.join(this.backupsDir, sanitizedFilename);

    // SECURITY FIX: Validate path to prevent directory traversal
    this.validatePath(backupPath, this.backupsDir);

    try {
      await fs.unlink(backupPath);

      // Audit log
      await AuditLogService.log(adminId, {
        action: AuditAction.BULK_DELETE,
        details: {
          type: 'backup',
          filename,
        },
      });

      logger.info('Backup deleted', { filename: sanitizeForLog(filename), adminId });
    } catch (error) {
      logger.error('Failed to delete backup', { filename: sanitizeForLog(filename), error });
      throw error;
    }
  }

  // Schedule automatic backup
  static async scheduleBackup(cronExpression: string, options: BackupOptions): Promise<void> {
    // This would integrate with a job scheduler like node-cron
    // For now, we'll just log the intent
    logger.info('Backup scheduling requested', { cronExpression, options });

    // Implementation would depend on chosen scheduler
    // Example: cron.schedule(cronExpression, () => this.createBackup('system', options, 'scheduled'));
  }
}

export default BackupService;

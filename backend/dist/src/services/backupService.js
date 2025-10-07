"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const child_process_1 = require("child_process");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const prisma_1 = require("../lib/prisma");
const auditLog_1 = require("../middleware/auditLog");
const inputSanitizer_1 = require("../utils/inputSanitizer");
const logger_1 = require("../utils/logger");
const notificationService_1 = require("./notificationService");
class BackupService {
    static sanitizeFilename(filename) {
        const basename = path_1.default.basename(filename);
        return basename.replace(/[^a-zA-Z0-9._-]/g, '_');
    }
    static validatePath(filePath, allowedDir) {
        const resolvedPath = path_1.default.resolve(filePath);
        const resolvedDir = path_1.default.resolve(allowedDir);
        if (!resolvedPath.startsWith(resolvedDir)) {
            throw new Error('Invalid file path: Path traversal detected');
        }
    }
    static async initialize() {
        try {
            await promises_1.default.mkdir(this.backupsDir, { recursive: true });
            logger_1.logger.info('Backup service initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize backup service:', error);
            throw error;
        }
    }
    static async createBackup(adminId, options = {}, type = 'manual') {
        const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${backupId}_${timestamp}.json`;
        const backupPath = path_1.default.join(this.backupsDir, filename);
        logger_1.logger.info('Creating backup', { backupId: (0, inputSanitizer_1.sanitizeForLog)(backupId), adminId, options, type });
        try {
            const recordCounts = await this.getDatabaseStats();
            const backupInfo = {
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
            const data = await this.exportDatabaseData(options);
            if (options.includeUploads) {
                data.uploads = await this.exportUploads();
            }
            this.validatePath(backupPath, this.backupsDir);
            const backupContent = JSON.stringify(data, null, 2);
            await promises_1.default.writeFile(backupPath, backupContent);
            if (options.compression) {
                await this.compressBackup(backupPath);
            }
            const stats = await promises_1.default.stat(backupPath);
            backupInfo.size = stats.size;
            backupInfo.status = 'completed';
            await auditLog_1.AuditLogService.log(adminId, {
                action: auditLog_1.AuditAction.SYSTEM_BACKUP,
                details: {
                    backupId,
                    filename,
                    size: backupInfo.size,
                    options,
                    recordCounts,
                },
            });
            logger_1.logger.info('Backup created successfully', { backupId: (0, inputSanitizer_1.sanitizeForLog)(backupId),
                filename,
                size: backupInfo.size,
                recordCounts,
            });
            return backupInfo;
        }
        catch (error) {
            logger_1.logger.error('Backup creation failed', { backupId: (0, inputSanitizer_1.sanitizeForLog)(backupId), error });
            try {
                await promises_1.default.unlink(backupPath);
            }
            catch (cleanupError) {
                logger_1.logger.error('Failed to cleanup incomplete backup file:', cleanupError);
            }
            await notificationService_1.NotificationService.notifySystemError(`Backup creation failed: ${backupId}`, { error: error instanceof Error ? error.message : 'Unknown error', adminId });
            throw error;
        }
    }
    static async exportDatabaseData(options) {
        const data = {
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            options,
            tables: {},
        };
        try {
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
            if (options.includeAuditLogs) {
                tables.push('adminLogs');
            }
            for (const table of tables) {
                logger_1.logger.info('Exporting table', { table: (0, inputSanitizer_1.sanitizeForLog)(table) });
                switch (table) {
                    case 'users':
                        data.tables.users = await prisma_1.prisma.user.findMany();
                        break;
                    case 'stores':
                        data.tables.stores = await prisma_1.prisma.store.findMany();
                        break;
                    case 'storeAdmins':
                        data.tables.storeAdmins = await prisma_1.prisma.storeAdmin.findMany();
                        break;
                    case 'categories':
                        data.tables.categories = await prisma_1.prisma.category.findMany();
                        break;
                    case 'products':
                        data.tables.products = await prisma_1.prisma.product.findMany();
                        break;
                    case 'productVariants':
                        data.tables.productVariants = await prisma_1.prisma.productVariant.findMany();
                        break;
                    case 'orders':
                        data.tables.orders = await prisma_1.prisma.order.findMany();
                        break;
                    case 'orderItems':
                        data.tables.orderItems = await prisma_1.prisma.orderItem.findMany();
                        break;
                    case 'integrationMappings':
                        data.tables.integrationMappings = await prisma_1.prisma.integrationMapping.findMany();
                        break;
                    case 'adminLogs':
                        data.tables.adminLogs = await prisma_1.prisma.adminLog.findMany();
                        break;
                }
            }
            return data;
        }
        catch (error) {
            logger_1.logger.error('Failed to export database data:', error);
            throw error;
        }
    }
    static async exportUploads() {
        try {
            const uploads = {};
            try {
                const uploadStats = await promises_1.default.stat(this.uploadsDir);
                if (uploadStats.isDirectory()) {
                    const files = await promises_1.default.readdir(this.uploadsDir, { withFileTypes: true });
                    for (const file of files) {
                        if (file.isFile()) {
                            const filePath = path_1.default.join(this.uploadsDir, file.name);
                            const fileContent = await promises_1.default.readFile(filePath);
                            uploads[file.name] = {
                                content: fileContent.toString('base64'),
                                size: fileContent.length,
                                type: path_1.default.extname(file.name),
                            };
                        }
                    }
                }
            }
            catch (error) {
                logger_1.logger.warn('Uploads directory not found, skipping uploads backup');
            }
            return uploads;
        }
        catch (error) {
            logger_1.logger.error('Failed to export uploads:', error);
            throw error;
        }
    }
    static async compressBackup(backupPath) {
        const { sanitizeFilePath, prepareSafeCommand } = await import('../utils/commandSanitizer.js');
        const safePath = sanitizeFilePath(backupPath);
        const { command, args } = prepareSafeCommand('gzip', ['-f', safePath]);
        return new Promise((resolve, reject) => {
            const gzip = (0, child_process_1.spawn)(command, args);
            gzip.on('close', (code) => {
                if (code === 0) {
                    logger_1.logger.info('Backup compressed successfully');
                    resolve();
                }
                else {
                    reject(new Error(`Compression failed with code ${code}`));
                }
            });
            gzip.on('error', (error) => {
                reject(error);
            });
        });
    }
    static async restoreFromBackup(backupFilename, adminId, options = {}) {
        const sanitizedFilename = this.sanitizeFilename(backupFilename);
        const backupPath = path_1.default.join(this.backupsDir, sanitizedFilename);
        logger_1.logger.info('Starting restore from backup', { filename: (0, inputSanitizer_1.sanitizeForLog)(sanitizedFilename), adminId, options });
        try {
            this.validatePath(backupPath, this.backupsDir);
            await promises_1.default.access(backupPath);
            const backupContent = await promises_1.default.readFile(backupPath, 'utf8');
            const backupData = JSON.parse(backupContent);
            if (!backupData.version || !backupData.tables) {
                throw new Error('Invalid backup format');
            }
            await prisma_1.prisma.$transaction(async (tx) => {
                await tx.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
                try {
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
                    await tx.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
                }
                catch (error) {
                    await tx.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
                    throw error;
                }
            });
            if (options.restoreUploads && backupData.uploads) {
                await this.restoreUploads(backupData.uploads);
            }
            await auditLog_1.AuditLogService.log(adminId, {
                action: auditLog_1.AuditAction.SYSTEM_RESTORE,
                details: {
                    backupFilename,
                    options,
                    restoredTables: Object.keys(backupData.tables),
                },
            });
            logger_1.logger.info('Restore completed successfully', { filename: (0, inputSanitizer_1.sanitizeForLog)(backupFilename) });
        }
        catch (error) {
            logger_1.logger.error('Restore failed', { filename: (0, inputSanitizer_1.sanitizeForLog)(backupFilename), error });
            await notificationService_1.NotificationService.notifySystemError(`Database restore failed: ${(0, inputSanitizer_1.sanitizeForLog)(backupFilename)}`, { error: error instanceof Error ? error.message : 'Unknown error', adminId });
            throw error;
        }
    }
    static async restoreTable(tx, tableName, data, options = {}) {
        if (!data || data.length === 0) {
            logger_1.logger.info('No data to restore for table', { table: (0, inputSanitizer_1.sanitizeForLog)(tableName) });
            return;
        }
        logger_1.logger.info('Restoring table', { table: (0, inputSanitizer_1.sanitizeForLog)(tableName), records: data.length });
        try {
            for (const record of data) {
                if (options.skipExisting) {
                    const existing = await this.checkRecordExists(tx, tableName, record);
                    if (existing) {
                        continue;
                    }
                }
                await this.insertRecord(tx, tableName, record);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to restore table', { table: (0, inputSanitizer_1.sanitizeForLog)(tableName), error });
            throw error;
        }
    }
    static async checkRecordExists(tx, tableName, record) {
        try {
            switch (tableName) {
                case 'users':
                    return !!(await tx.user.findUnique({ where: { id: record.id } }));
                case 'stores':
                    return !!(await tx.store.findUnique({ where: { id: record.id } }));
                case 'products':
                    return !!(await tx.product.findUnique({ where: { id: record.id } }));
                default:
                    return false;
            }
        }
        catch (error) {
            return false;
        }
    }
    static async insertRecord(tx, tableName, record) {
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
    static async restoreUploads(uploadsData) {
        try {
            await promises_1.default.mkdir(this.uploadsDir, { recursive: true });
            for (const [filename, fileData] of Object.entries(uploadsData)) {
                const sanitizedFilename = this.sanitizeFilename(filename);
                const filePath = path_1.default.join(this.uploadsDir, sanitizedFilename);
                this.validatePath(filePath, this.uploadsDir);
                const content = Buffer.from(fileData.content, 'base64');
                await promises_1.default.writeFile(filePath, content);
            }
            logger_1.logger.info('Restored upload files', { count: Object.keys(uploadsData).length });
        }
        catch (error) {
            logger_1.logger.error('Failed to restore uploads:', error);
            throw error;
        }
    }
    static async getDatabaseStats() {
        try {
            const [userCount, storeCount, productCount, orderCount, categoryCount,] = await Promise.all([
                prisma_1.prisma.user.count(),
                prisma_1.prisma.store.count(),
                prisma_1.prisma.product.count(),
                prisma_1.prisma.order.count(),
                prisma_1.prisma.category.count(),
            ]);
            return {
                users: userCount,
                stores: storeCount,
                products: productCount,
                orders: orderCount,
                categories: categoryCount,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get database stats:', error);
            return {};
        }
    }
    static async listBackups() {
        try {
            const files = await promises_1.default.readdir(this.backupsDir);
            const backups = [];
            for (const filename of files) {
                if (filename.endsWith('.json') || filename.endsWith('.gz')) {
                    const filePath = path_1.default.join(this.backupsDir, filename);
                    const stats = await promises_1.default.stat(filePath);
                    const match = filename.match(/backup_(\d+)_/);
                    const timestamp = match ? new Date(parseInt(match[1])) : stats.birthtime;
                    backups.push({
                        id: path_1.default.basename(filename, path_1.default.extname(filename)),
                        filename,
                        size: stats.size,
                        createdAt: timestamp,
                        type: 'manual',
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
        }
        catch (error) {
            logger_1.logger.error('Failed to list backups:', error);
            return [];
        }
    }
    static async deleteBackup(filename, adminId) {
        const sanitizedFilename = this.sanitizeFilename(filename);
        const backupPath = path_1.default.join(this.backupsDir, sanitizedFilename);
        this.validatePath(backupPath, this.backupsDir);
        try {
            await promises_1.default.unlink(backupPath);
            await auditLog_1.AuditLogService.log(adminId, {
                action: auditLog_1.AuditAction.BULK_DELETE,
                details: {
                    type: 'backup',
                    filename,
                },
            });
            logger_1.logger.info('Backup deleted', { filename: (0, inputSanitizer_1.sanitizeForLog)(filename), adminId });
        }
        catch (error) {
            logger_1.logger.error('Failed to delete backup', { filename: (0, inputSanitizer_1.sanitizeForLog)(filename), error });
            throw error;
        }
    }
    static async scheduleBackup(cronExpression, options) {
        logger_1.logger.info('Backup scheduling requested', { cronExpression, options });
    }
}
exports.BackupService = BackupService;
BackupService.backupsDir = path_1.default.join(process.cwd(), 'backups');
BackupService.uploadsDir = path_1.default.join(process.cwd(), 'uploads');
exports.default = BackupService;
//# sourceMappingURL=backupService.js.map
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
exports.scheduleBackups = exports.getBackupStatus = exports.deleteBackup = exports.restoreBackup = exports.downloadBackup = exports.listBackups = exports.createBackup = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const errorHandler_1 = require("../middleware/errorHandler");
const backupService_1 = require("../services/backupService");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
exports.createBackup = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can create backups', 403);
    }
    const { includeUploads = true, includeAuditLogs = true, compression = true, } = req.body;
    try {
        const backupInfo = await backupService_1.BackupService.createBackup(req.user.id, {
            includeUploads,
            includeAuditLogs,
            compression,
        }, 'manual');
        res.json({
            message: 'Backup created successfully',
            backup: backupInfo,
        });
    }
    catch (error) {
        logger_1.logger.error('Backup creation failed:', error);
        throw new errorHandler_1.AppError('Failed to create backup', 500);
    }
});
exports.listBackups = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    try {
        const backups = await backupService_1.BackupService.listBackups();
        res.json({
            backups,
            total: backups.length,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to list backups:', error);
        throw new errorHandler_1.AppError('Failed to list backups', 500);
    }
});
exports.downloadBackup = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    const { filename } = req.params;
    if (!filename) {
        throw new errorHandler_1.AppError('Filename is required', 400);
    }
    try {
        const backupsDir = path.join(process.cwd(), 'backups');
        const backupPath = (0, sanitizer_1.sanitizePath)(filename, backupsDir);
        await fs.promises.access(backupPath);
        const safeFilename = path.basename(backupPath);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.sendFile(backupPath);
    }
    catch (error) {
        logger_1.logger.error('Failed to download backup', { filename: (0, sanitizer_1.sanitizeForLog)(filename), error });
        throw new errorHandler_1.AppError('Backup file not found', 404);
    }
});
exports.restoreBackup = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can restore backups', 403);
    }
    const { filename } = req.params;
    const { restoreUploads = false, skipExisting = true, confirmRestore = false, } = req.body;
    if (!filename) {
        throw new errorHandler_1.AppError('Filename is required', 400);
    }
    if (!confirmRestore) {
        throw new errorHandler_1.AppError('Restore confirmation is required', 400);
    }
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new errorHandler_1.AppError('Invalid filename', 400);
    }
    try {
        const { sanitizeForLog } = require('../utils/sanitizer');
        logger_1.logger.warn('DANGEROUS: Database restore initiated', { userId: sanitizeForLog(req.user.id),
            filename: sanitizeForLog(filename),
            options: { restoreUploads, skipExisting },
        });
        await backupService_1.BackupService.restoreFromBackup(filename, req.user.id, {
            restoreUploads,
            skipExisting,
        });
        res.json({
            message: 'Database restored successfully',
            filename: sanitizeForLog(filename),
            options: { restoreUploads, skipExisting },
            warning: 'Database has been restored. Some users may need to re-login.',
        });
    }
    catch (error) {
        const { sanitizeForLog } = require('../utils/sanitizer');
        logger_1.logger.error('Failed to restore backup', { filename: sanitizeForLog(filename), error });
        throw new errorHandler_1.AppError(`Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
});
exports.deleteBackup = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can delete backups', 403);
    }
    const { filename } = req.params;
    if (!filename) {
        throw new errorHandler_1.AppError('Filename is required', 400);
    }
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new errorHandler_1.AppError('Invalid filename', 400);
    }
    try {
        await backupService_1.BackupService.deleteBackup(filename, req.user.id);
        res.json({
            message: 'Backup deleted successfully',
            filename,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete backup', { filename: (0, sanitizer_1.sanitizeForLog)(filename), error });
        throw new errorHandler_1.AppError('Failed to delete backup', 500);
    }
});
exports.getBackupStatus = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    try {
        const backups = await backupService_1.BackupService.listBackups();
        const latestBackup = backups[0];
        const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
        const backupsDir = path.join(process.cwd(), 'backups');
        let availableSpace = 0;
        try {
            await fs.promises.stat(backupsDir);
            availableSpace = 1024 * 1024 * 1024;
        }
        catch {
            logger_1.logger.warn('Could not check available disk space');
        }
        const status = {
            totalBackups: backups.length,
            totalSize,
            latestBackup: latestBackup ? {
                filename: latestBackup.filename,
                createdAt: latestBackup.createdAt,
                size: latestBackup.size,
                status: latestBackup.status,
            } : null,
            diskSpace: {
                used: totalSize,
                available: availableSpace,
                usagePercentage: availableSpace > 0 ? (totalSize / availableSpace) * 100 : 0,
            },
            recommendations: [
                ...(backups.length === 0 ? ['Create your first backup to protect your data'] : []),
                ...(backups.length > 10 ? ['Consider deleting old backups to save disk space'] : []),
                ...(!latestBackup || (Date.now() - latestBackup.createdAt.getTime()) > 7 * 24 * 60 * 60 * 1000 ?
                    ['Latest backup is over a week old - consider creating a new backup'] : []),
            ],
        };
        res.json(status);
    }
    catch (error) {
        logger_1.logger.error('Failed to get backup status:', error);
        throw new errorHandler_1.AppError('Failed to get backup status', 500);
    }
});
exports.scheduleBackups = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can schedule backups', 403);
    }
    const { enabled, schedule, options = {}, } = req.body;
    if (!schedule && enabled) {
        throw new errorHandler_1.AppError('Schedule is required when enabled', 400);
    }
    try {
        if (enabled) {
            await backupService_1.BackupService.scheduleBackup(schedule, options);
        }
        res.json({
            message: enabled ? 'Backup scheduling enabled' : 'Backup scheduling disabled',
            schedule: enabled ? schedule : null,
            options: enabled ? options : null,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to schedule backups:', error);
        throw new errorHandler_1.AppError('Failed to schedule backups', 500);
    }
});
exports.default = {
    createBackup: exports.createBackup,
    listBackups: exports.listBackups,
    downloadBackup: exports.downloadBackup,
    restoreBackup: exports.restoreBackup,
    deleteBackup: exports.deleteBackup,
    getBackupStatus: exports.getBackupStatus,
    scheduleBackups: exports.scheduleBackups,
};
//# sourceMappingURL=backupController.js.map
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { BackupService, BackupOptions } from '../services/backupService';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

// Create new backup
export const createBackup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'OWNER') {
    throw new AppError('Only owners can create backups', 403);
  }

  const {
    includeUploads = true,
    includeAuditLogs = true,
    compression = true,
  }: BackupOptions = req.body;

  try {
    const backupInfo = await BackupService.createBackup(
      req.user.id,
      {
        includeUploads,
        includeAuditLogs,
        compression,
      },
      'manual'
    );

    res.json({
      message: 'Backup created successfully',
      backup: backupInfo,
    });
  } catch (error) {
    logger.error('Backup creation failed:', error);
    throw new AppError('Failed to create backup', 500);
  }
});

// List all backups
export const listBackups = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  try {
    const backups = await BackupService.listBackups();
    
    res.json({
      backups,
      total: backups.length,
    });
  } catch (error) {
    logger.error('Failed to list backups:', error);
    throw new AppError('Failed to list backups', 500);
  }
});

// Download backup file
export const downloadBackup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  const { filename } = req.params;

  if (!filename) {
    throw new AppError('Filename is required', 400);
  }

  // Validate filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new AppError('Invalid filename', 400);
  }

  try {
    const backupPath = path.join(process.cwd(), 'backups', filename);
    
    // Check if file exists
    await fs.promises.access(backupPath);

    // Set appropriate headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send file
    res.sendFile(backupPath);
  } catch (error) {
    logger.error(`Failed to download backup: ${filename}`, error);
    throw new AppError('Backup file not found', 404);
  }
});

// Restore from backup
export const restoreBackup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'OWNER') {
    throw new AppError('Only owners can restore backups', 403);
  }

  const { filename } = req.params;
  const { 
    restoreUploads = false,
    skipExisting = true,
    confirmRestore = false,
  } = req.body;

  if (!filename) {
    throw new AppError('Filename is required', 400);
  }

  if (!confirmRestore) {
    throw new AppError('Restore confirmation is required', 400);
  }

  // Validate filename
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new AppError('Invalid filename', 400);
  }

  try {
    logger.warn(`DANGEROUS: Database restore initiated by ${req.user.id}`, {
      filename,
      options: { restoreUploads, skipExisting },
    });

    await BackupService.restoreFromBackup(
      filename,
      req.user.id,
      {
        restoreUploads,
        skipExisting,
      }
    );

    res.json({
      message: 'Database restored successfully',
      filename,
      options: { restoreUploads, skipExisting },
      warning: 'Database has been restored. Some users may need to re-login.',
    });
  } catch (error) {
    logger.error(`Failed to restore backup: ${filename}`, error);
    throw new AppError(
      `Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
});

// Delete backup
export const deleteBackup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'OWNER') {
    throw new AppError('Only owners can delete backups', 403);
  }

  const { filename } = req.params;

  if (!filename) {
    throw new AppError('Filename is required', 400);
  }

  // Validate filename
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new AppError('Invalid filename', 400);
  }

  try {
    await BackupService.deleteBackup(filename, req.user.id);
    
    res.json({
      message: 'Backup deleted successfully',
      filename,
    });
  } catch (error) {
    logger.error(`Failed to delete backup: ${filename}`, error);
    throw new AppError('Failed to delete backup', 500);
  }
});

// Get backup system status
export const getBackupStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  try {
    const backups = await BackupService.listBackups();
    const latestBackup = backups[0];
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    
    // Check backup directory size and available space
    const backupsDir = path.join(process.cwd(), 'backups');
    let availableSpace = 0;
    
    try {
      await fs.promises.stat(backupsDir); // Check if directory exists
      // This is a simplified check - in production you'd use statvfs or similar
      availableSpace = 1024 * 1024 * 1024; // 1GB placeholder
    } catch (error) {
      logger.warn('Could not check available disk space');
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
  } catch (error) {
    logger.error('Failed to get backup status:', error);
    throw new AppError('Failed to get backup status', 500);
  }
});

// Schedule automatic backups
export const scheduleBackups = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'OWNER') {
    throw new AppError('Only owners can schedule backups', 403);
  }

  const { 
    enabled,
    schedule, // cron expression
    options = {},
  } = req.body;

  if (!schedule && enabled) {
    throw new AppError('Schedule is required when enabled', 400);
  }

  try {
    if (enabled) {
      await BackupService.scheduleBackup(schedule, options);
    }

    res.json({
      message: enabled ? 'Backup scheduling enabled' : 'Backup scheduling disabled',
      schedule: enabled ? schedule : null,
      options: enabled ? options : null,
    });
  } catch (error) {
    logger.error('Failed to schedule backups:', error);
    throw new AppError('Failed to schedule backups', 500);
  }
});

export default {
  createBackup,
  listBackups,
  downloadBackup,
  restoreBackup,
  deleteBackup,
  getBackupStatus,
  scheduleBackups,
};

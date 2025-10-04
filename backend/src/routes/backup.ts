import { Router } from 'express';
import { body, param } from 'express-validator';
import {
    createBackup,
    deleteBackup,
    downloadBackup,
    getBackupStatus,
    listBackups,
    restoreBackup,
    scheduleBackups,
} from '../controllers/backupController';
import { authMiddleware, requireRole } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { validate } from '../middleware/validation';
import { UserRole } from '../utils/jwt';

const router = Router();

// All backup routes require authentication
router.use(authMiddleware);

// Get backup system status
router.get('/status', requireRole([UserRole.OWNER, UserRole.ADMIN]), getBackupStatus);

// List all backups
router.get('/', requireRole([UserRole.OWNER, UserRole.ADMIN]), listBackups);

// Create new backup (SECURITY: CSRF protected)
router.post(
  '/',
  csrfProtection,
  requireRole([UserRole.OWNER]),
  [
    body('includeUploads').optional().isBoolean().withMessage('includeUploads must be boolean'),
    body('includeAuditLogs').optional().isBoolean().withMessage('includeAuditLogs must be boolean'),
    body('compression').optional().isBoolean().withMessage('compression must be boolean'),
  ],
  validate,
  createBackup
);

// Download backup file
router.get(
  '/download/:filename',
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [
    param('filename').isString().notEmpty().withMessage('Filename is required'),
  ],
  validate,
  downloadBackup
);

// Restore from backup (DANGEROUS - OWNER only) (SECURITY: CSRF protected)
router.post(
  '/restore/:filename',
  csrfProtection,
  requireRole([UserRole.OWNER]),
  [
    param('filename').isString().notEmpty().withMessage('Filename is required'),
    body('restoreUploads').optional().isBoolean().withMessage('restoreUploads must be boolean'),
    body('skipExisting').optional().isBoolean().withMessage('skipExisting must be boolean'),
    body('confirmRestore').isBoolean().custom((value) => {
      if (value !== true) {
        throw new Error('You must confirm the restore operation by setting confirmRestore to true');
      }
      return true;
    }),
  ],
  validate,
  restoreBackup
);

// Delete backup (SECURITY: CSRF protected)
router.delete(
  '/:filename',
  csrfProtection,
  requireRole([UserRole.OWNER]),
  [
    param('filename').isString().notEmpty().withMessage('Filename is required'),
  ],
  validate,
  deleteBackup
);

// Schedule automatic backups (SECURITY: CSRF protected)
router.put(
  '/schedule',
  csrfProtection,
  requireRole([UserRole.OWNER]),
  [
    body('enabled').isBoolean().withMessage('enabled must be boolean'),
    body('schedule').optional().isString().withMessage('schedule must be a cron expression'),
    body('options').optional().isObject().withMessage('options must be an object'),
  ],
  validate,
  scheduleBackups
);

export default router;

import { Router } from 'express';
import { param, query } from 'express-validator';
import {
    deleteNotification,
    getNotifications,
    getNotificationStats,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '../controllers/notificationController';
import { authMiddleware } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { validate } from '../middleware/validation';

const router = Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Get user notifications
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('unreadOnly').optional().isBoolean().withMessage('UnreadOnly must be a boolean'),
    query('type').optional().isString().withMessage('Type must be a string'),
    query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Invalid priority'),
  ],
  validate,
  getNotifications
);

// Get notification statistics
router.get('/stats', getNotificationStats);

// Mark notification as read (SECURITY: CSRF protected)
router.patch(
  '/:id/read',
  csrfProtection,
  [param('id').isString().withMessage('Valid notification ID required')],
  validate,
  markNotificationAsRead
);

// Mark all notifications as read (SECURITY: CSRF protected)
router.patch('/read-all', csrfProtection, markAllNotificationsAsRead);

// Delete notification (SECURITY: CSRF protected)
router.delete(
  '/:id',
  csrfProtection,
  [param('id').isString().withMessage('Valid notification ID required')],
  validate,
  deleteNotification
);

export default router;

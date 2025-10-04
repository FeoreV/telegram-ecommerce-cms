import { NextFunction, Request, Response, Router } from 'express';
import { body, param } from 'express-validator';
import {
    cancelOrder,
    confirmPayment,
    createOrder,
    deliverOrder,
    exportOrders,
    getOrder,
    getOrders,
    getOrderStats,
    getPaymentProof,
    rejectOrder,
    shipOrder,
    uploadOrderPaymentProof,
} from '../controllers/orderController';
import { AuditAction, auditOrderAction } from '../middleware/auditLog';
import { requireRole } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { uploadPaymentProof } from '../middleware/uploadPaymentProof';
import { getUploadStats, uploadRateLimitMiddleware } from '../middleware/uploadRateLimit';
import { validate } from '../middleware/validation';
import { UserRole } from '../utils/jwt';

const router = Router();

// Get all orders (with filtering)
router.get('/', getOrders);

// Get order statistics
router.get('/stats', getOrderStats);

// Export orders to CSV
router.get('/export', exportOrders);

// Get single order
router.get(
  '/:id',
  [param('id').isString().withMessage('Valid order ID required')],
  validate,
  getOrder
);

// Create order (SECURITY: CSRF protected)
router.post(
  '/',
  csrfProtection,
  [
    body('storeId').isString().withMessage('Store ID is required'),
    body('items').isArray({ min: 1 }).withMessage('Order items are required'),
    body('items.*.productId').isString().withMessage('Product ID is required for each item'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required for each item'),
    body('items.*.variantId').optional().isString(),
    body('customerInfo').isObject().withMessage('Customer info is required'),
    body('notes').optional().isString(),
  ],
  validate,
  createOrder
);

// Confirm payment (Admin only) - with audit logging (SECURITY: CSRF protected)
router.post(
  '/:id/confirm-payment',
  csrfProtection,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [param('id').isString().withMessage('Valid order ID required')],
  validate,
  auditOrderAction(AuditAction.ORDER_CONFIRMED),
  confirmPayment
);

// Reject order (Admin only) - with audit logging (SECURITY: CSRF protected)
router.post(
  '/:id/reject',
  csrfProtection,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [
    param('id').isString().withMessage('Valid order ID required'),
    body('reason').notEmpty().withMessage('Rejection reason is required'),
  ],
  validate,
  auditOrderAction(AuditAction.ORDER_REJECTED),
  rejectOrder
);

// Upload payment proof (Customer only) with rate limiting (SECURITY: CSRF protected)
router.post(
  '/:id/payment-proof',
  csrfProtection,
  uploadRateLimitMiddleware, // Apply rate limiting first
  [param('id').isString().withMessage('Valid order ID required')],
  validate,
  (req: Request, res: Response, next: NextFunction) => {
    uploadPaymentProof.single('paymentProof')(req, res, next);
  },
  uploadOrderPaymentProof
);

// Ship order (Admin only) - with audit logging (SECURITY: CSRF protected)
router.post(
  '/:id/ship',
  csrfProtection,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [
    param('id').isString().withMessage('Valid order ID required'),
    body('trackingNumber').optional().isString().withMessage('Tracking number must be a string'),
    body('carrier').optional().isString().withMessage('Carrier must be a string'),
  ],
  validate,
  auditOrderAction(AuditAction.ORDER_STATUS_CHANGED),
  shipOrder
);

// Mark order as delivered (Admin only) - with audit logging (SECURITY: CSRF protected)
router.post(
  '/:id/deliver',
  csrfProtection,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [
    param('id').isString().withMessage('Valid order ID required'),
    body('deliveryNotes').optional().isString().withMessage('Delivery notes must be a string'),
  ],
  validate,
  auditOrderAction(AuditAction.ORDER_STATUS_CHANGED),
  deliverOrder
);

// Cancel order (Admin only) - with audit logging (SECURITY: CSRF protected)
router.post(
  '/:id/cancel',
  csrfProtection,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [
    param('id').isString().withMessage('Valid order ID required'),
    body('reason').isString().isLength({ min: 1 }).withMessage('Cancellation reason is required'),
  ],
  validate,
  auditOrderAction(AuditAction.ORDER_STATUS_CHANGED),
  cancelOrder
);

// Get payment proof file (with access control)
router.get(
  '/:id/payment-proof',
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER]), // All authenticated users can access their own orders
  [param('id').isString().withMessage('Valid order ID required')],
  validate,
  getPaymentProof
);

// Get upload statistics (Owner only)
router.get(
  '/upload-stats',
  requireRole([UserRole.OWNER]),
  getUploadStats
);

export default router;

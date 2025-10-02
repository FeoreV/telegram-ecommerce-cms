"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const jwt_1 = require("../utils/jwt");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const auditLog_1 = require("../middleware/auditLog");
const uploadRateLimit_1 = require("../middleware/uploadRateLimit");
const uploadPaymentProof_1 = require("../middleware/uploadPaymentProof");
const orderController_1 = require("../controllers/orderController");
const router = (0, express_1.Router)();
router.get('/', orderController_1.getOrders);
router.get('/stats', orderController_1.getOrderStats);
router.get('/:id', [(0, express_validator_1.param)('id').isString().withMessage('Valid order ID required')], validation_1.validate, orderController_1.getOrder);
router.post('/', [
    (0, express_validator_1.body)('storeId').isString().withMessage('Store ID is required'),
    (0, express_validator_1.body)('items').isArray({ min: 1 }).withMessage('Order items are required'),
    (0, express_validator_1.body)('items.*.productId').isString().withMessage('Product ID is required for each item'),
    (0, express_validator_1.body)('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required for each item'),
    (0, express_validator_1.body)('items.*.variantId').optional().isString(),
    (0, express_validator_1.body)('customerInfo').isObject().withMessage('Customer info is required'),
    (0, express_validator_1.body)('notes').optional().isString(),
], validation_1.validate, orderController_1.createOrder);
router.post('/:id/confirm-payment', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [(0, express_validator_1.param)('id').isString().withMessage('Valid order ID required')], validation_1.validate, (0, auditLog_1.auditOrderAction)(auditLog_1.AuditAction.ORDER_CONFIRMED), orderController_1.confirmPayment);
router.post('/:id/reject', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [
    (0, express_validator_1.param)('id').isString().withMessage('Valid order ID required'),
    (0, express_validator_1.body)('reason').notEmpty().withMessage('Rejection reason is required'),
], validation_1.validate, (0, auditLog_1.auditOrderAction)(auditLog_1.AuditAction.ORDER_REJECTED), orderController_1.rejectOrder);
router.post('/:id/payment-proof', uploadRateLimit_1.uploadRateLimitMiddleware, [(0, express_validator_1.param)('id').isString().withMessage('Valid order ID required')], validation_1.validate, (req, res, next) => {
    uploadPaymentProof_1.uploadPaymentProof.single('paymentProof')(req, res, next);
}, orderController_1.uploadOrderPaymentProof);
router.post('/:id/ship', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [
    (0, express_validator_1.param)('id').isString().withMessage('Valid order ID required'),
    (0, express_validator_1.body)('trackingNumber').optional().isString().withMessage('Tracking number must be a string'),
    (0, express_validator_1.body)('carrier').optional().isString().withMessage('Carrier must be a string'),
], validation_1.validate, (0, auditLog_1.auditOrderAction)(auditLog_1.AuditAction.ORDER_STATUS_CHANGED), orderController_1.shipOrder);
router.post('/:id/deliver', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [
    (0, express_validator_1.param)('id').isString().withMessage('Valid order ID required'),
    (0, express_validator_1.body)('deliveryNotes').optional().isString().withMessage('Delivery notes must be a string'),
], validation_1.validate, (0, auditLog_1.auditOrderAction)(auditLog_1.AuditAction.ORDER_STATUS_CHANGED), orderController_1.deliverOrder);
router.post('/:id/cancel', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [
    (0, express_validator_1.param)('id').isString().withMessage('Valid order ID required'),
    (0, express_validator_1.body)('reason').isString().isLength({ min: 1 }).withMessage('Cancellation reason is required'),
], validation_1.validate, (0, auditLog_1.auditOrderAction)(auditLog_1.AuditAction.ORDER_STATUS_CHANGED), orderController_1.cancelOrder);
router.get('/:id/payment-proof', [(0, express_validator_1.param)('id').isString().withMessage('Valid order ID required')], validation_1.validate, orderController_1.getPaymentProof);
router.get('/upload-stats', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), uploadRateLimit_1.getUploadStats);
exports.default = router;
//# sourceMappingURL=orders.js.map
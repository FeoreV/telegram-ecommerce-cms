"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const notificationController_1 = require("../controllers/notificationController");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('unreadOnly').optional().isBoolean().withMessage('UnreadOnly must be a boolean'),
    (0, express_validator_1.query)('type').optional().isString().withMessage('Type must be a string'),
    (0, express_validator_1.query)('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Invalid priority'),
], validation_1.validate, notificationController_1.getNotifications);
router.get('/stats', notificationController_1.getNotificationStats);
router.patch('/:id/read', [(0, express_validator_1.param)('id').isString().withMessage('Valid notification ID required')], validation_1.validate, notificationController_1.markNotificationAsRead);
router.patch('/read-all', notificationController_1.markAllNotificationsAsRead);
router.delete('/:id', [(0, express_validator_1.param)('id').isString().withMessage('Valid notification ID required')], validation_1.validate, notificationController_1.deleteNotification);
exports.default = router;
//# sourceMappingURL=notifications.js.map
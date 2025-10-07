"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const bulkController_1 = require("../controllers/bulkController");
const auth_1 = require("../middleware/auth");
const csrfProtection_1 = require("../middleware/csrfProtection");
const permissions_1 = require("../middleware/permissions");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/template', [(0, express_validator_1.query)('type').optional().isIn(['products']).withMessage('Invalid template type')], validation_1.validate, bulkController_1.getBulkTemplate);
router.post('/import/products', (0, csrfProtection_1.csrfProtection)(), (0, permissions_1.requirePermission)(permissions_1.Permission.PRODUCT_CREATE), bulkController_1.upload.single('csv'), [
    (0, express_validator_1.body)('storeId').isString().withMessage('Store ID is required'),
    (0, express_validator_1.body)('dryRun').optional().isBoolean().withMessage('Dry run must be boolean'),
], validation_1.validate, bulkController_1.importProducts);
router.get('/export/products', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_EXPORT), [
    (0, express_validator_1.query)('storeId').isString().withMessage('Store ID is required'),
    (0, express_validator_1.query)('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
], validation_1.validate, bulkController_1.exportProducts);
router.patch('/update/products', (0, csrfProtection_1.csrfProtection)(), (0, permissions_1.requirePermission)(permissions_1.Permission.PRODUCT_UPDATE), [
    (0, express_validator_1.body)('storeId').isString().withMessage('Store ID is required'),
    (0, express_validator_1.body)('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    (0, express_validator_1.body)('productIds.*').isString().withMessage('Each product ID must be a string'),
    (0, express_validator_1.body)('updates').isObject().withMessage('Updates object is required'),
], validation_1.validate, bulkController_1.bulkUpdateProducts);
router.delete('/delete/products', (0, csrfProtection_1.csrfProtection)(), (0, permissions_1.requirePermission)(permissions_1.Permission.PRODUCT_DELETE), [
    (0, express_validator_1.body)('storeId').isString().withMessage('Store ID is required'),
    (0, express_validator_1.body)('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    (0, express_validator_1.body)('productIds.*').isString().withMessage('Each product ID must be a string'),
], validation_1.validate, bulkController_1.bulkDeleteProducts);
exports.default = router;
//# sourceMappingURL=bulk.js.map
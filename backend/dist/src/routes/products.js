"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const jwt_1 = require("../utils/jwt");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const productController_1 = require("../controllers/productController");
const router = (0, express_1.Router)();
router.get('/categories', productController_1.getCategories);
router.get('/', productController_1.getProducts);
router.get('/:id', [(0, express_validator_1.param)('id').isString().withMessage('Valid product ID required')], validation_1.validate, productController_1.getProduct);
router.post('/', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN, jwt_1.UserRole.VENDOR]), [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Product name is required'),
    (0, express_validator_1.body)('price').isNumeric().withMessage('Valid price is required'),
    (0, express_validator_1.body)('stock').isInt({ min: 0 }).withMessage('Valid stock quantity required'),
    (0, express_validator_1.body)('storeId').isString().withMessage('Store ID is required'),
    (0, express_validator_1.body)('sku').optional().isString(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('images').optional().isArray(),
    (0, express_validator_1.body)('categoryId').optional().isString(),
    (0, express_validator_1.body)('variants').optional().isArray(),
], validation_1.validate, productController_1.createProduct);
router.put('/:id', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN, jwt_1.UserRole.VENDOR]), [
    (0, express_validator_1.param)('id').isString().withMessage('Valid product ID required'),
    (0, express_validator_1.body)('name').optional().notEmpty().withMessage('Product name cannot be empty'),
    (0, express_validator_1.body)('price').optional().isNumeric().withMessage('Valid price required'),
    (0, express_validator_1.body)('stock').optional().isInt({ min: 0 }).withMessage('Valid stock quantity required'),
    (0, express_validator_1.body)('sku').optional().isString(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('images').optional().isArray(),
    (0, express_validator_1.body)('categoryId').optional().isString(),
    (0, express_validator_1.body)('isActive').optional().isBoolean(),
], validation_1.validate, productController_1.updateProduct);
router.delete('/:id', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN, jwt_1.UserRole.VENDOR]), [(0, express_validator_1.param)('id').isString().withMessage('Valid product ID required')], validation_1.validate, productController_1.deleteProduct);
router.patch('/bulk', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN, jwt_1.UserRole.VENDOR]), [
    (0, express_validator_1.body)('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    (0, express_validator_1.body)('updates').isObject().withMessage('Updates object is required'),
    (0, express_validator_1.body)('updates.isActive').optional().isBoolean(),
    (0, express_validator_1.body)('updates.stock').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('updates.price').optional().isNumeric(),
], validation_1.validate, productController_1.bulkUpdateProducts);
exports.default = router;
//# sourceMappingURL=products.js.map
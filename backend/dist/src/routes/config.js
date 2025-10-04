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
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const csrfProtection_1 = require("../middleware/csrfProtection");
const errorHandler_1 = require("../middleware/errorHandler");
const currency_1 = require("../utils/currency");
const inventoryConfig_1 = __importStar(require("../utils/inventoryConfig"));
const jwt_1 = require("../utils/jwt");
const loggerEnhanced_1 = require("../utils/loggerEnhanced");
const sanitizer_1 = require("../utils/sanitizer");
const router = (0, express_1.Router)();
router.get('/currencies', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const currencies = (0, currency_1.getSupportedCurrencies)();
    res.json({
        success: true,
        currencies: currencies.map(currency => ({
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            decimals: currency.decimals
        }))
    });
}));
router.get('/currencies/:code', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { code } = req.params;
    if (!(0, currency_1.isValidCurrencyCode)(code)) {
        throw new errorHandler_1.AppError(`Unsupported currency: ${code}`, 400);
    }
    const config = (0, currency_1.getCurrencyConfig)(code);
    res.json({
        success: true,
        currency: config
    });
}));
router.post('/currencies/:code/format', csrfProtection_1.csrfProtection, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { code } = req.params;
    const { amount, showDecimals, useLocale, customSymbol } = req.body;
    if (!(0, currency_1.isValidCurrencyCode)(code)) {
        throw new errorHandler_1.AppError(`Unsupported currency: ${(0, sanitizer_1.sanitizeInput)(code)}`, 400);
    }
    if (typeof amount !== 'number') {
        throw new errorHandler_1.AppError('Amount must be a number', 400);
    }
    const safeCustomSymbol = customSymbol ? (0, sanitizer_1.sanitizeInput)(customSymbol) : undefined;
    const formatted = (0, currency_1.formatCurrency)(amount, code, {
        showDecimals,
        useLocale,
        customSymbol: safeCustomSymbol
    });
    const displayFormatted = (0, currency_1.getDisplayPrice)(amount, code, {
        showDecimals,
        useSymbol: true
    });
    res.json({
        success: true,
        formatted,
        displayFormatted,
        amount,
        currency: code
    });
}));
router.get('/inventory/stores/:storeId', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    if (req.user.role !== 'OWNER') {
        const hasAccess = await prisma_1.prisma.store.findFirst({
            where: {
                id: storeId,
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            }
        });
        if (!hasAccess) {
            throw new errorHandler_1.AppError('No access to this store', 403);
        }
    }
    const config = inventoryConfig_1.default.getStoreConfig(storeId);
    res.json({
        success: true,
        config
    });
}));
router.put('/inventory/stores/:storeId', csrfProtection_1.csrfProtection, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    const updates = req.body;
    if (req.user.role !== 'OWNER') {
        const hasAccess = await prisma_1.prisma.store.findFirst({
            where: {
                id: storeId,
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            }
        });
        if (!hasAccess) {
            throw new errorHandler_1.AppError('No access to this store', 403);
        }
    }
    const allowedFields = [
        'enableStockAlerts',
        'enableAutoReorder',
        'thresholds',
        'alertChannels',
        'alertFrequency',
        'currency',
        'timezone'
    ];
    const filteredUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
    }, {});
    if (Object.keys(filteredUpdates).length === 0) {
        throw new errorHandler_1.AppError('No valid updates provided', 400);
    }
    if (filteredUpdates.currency && !(0, currency_1.isValidCurrencyCode)(filteredUpdates.currency)) {
        throw new errorHandler_1.AppError(`Unsupported currency: ${filteredUpdates.currency}`, 400);
    }
    const updatedConfig = inventoryConfig_1.default.updateStoreConfig(storeId, filteredUpdates);
    try {
        await prisma_1.prisma.store.update({
            where: { id: storeId },
            data: {
                currency: updatedConfig.currency,
                lowStockThreshold: updatedConfig.thresholds?.lowStock,
                criticalStockThreshold: updatedConfig.thresholds?.criticalStock,
                enableStockAlerts: updatedConfig.enableStockAlerts
            }
        });
    }
    catch (dbError) {
        loggerEnhanced_1.logger.warn('Failed to update store in database', { storeId, error: dbError });
    }
    loggerEnhanced_1.logger.info('Store inventory configuration updated', {
        storeId,
        userId: req.user.id,
        updates: Object.keys(filteredUpdates)
    });
    res.json({
        success: true,
        message: 'Store inventory configuration updated',
        config: updatedConfig
    });
}));
router.get('/inventory/products/:productId', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN, jwt_1.UserRole.VENDOR]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { productId } = req.params;
    const { variantId } = req.query;
    if (req.user.role !== 'OWNER') {
        const product = await prisma_1.prisma.product.findFirst({
            where: {
                id: productId,
                store: {
                    OR: [
                        { ownerId: req.user.id },
                        { admins: { some: { userId: req.user.id } } },
                        { vendors: { some: { userId: req.user.id } } }
                    ]
                }
            }
        });
        if (!product) {
            throw new errorHandler_1.AppError('Product not found or no access', 404);
        }
    }
    const config = inventoryConfig_1.default.getProductConfig(productId, variantId);
    res.json({
        success: true,
        config
    });
}));
router.put('/inventory/products/:productId', csrfProtection_1.csrfProtection, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN, jwt_1.UserRole.VENDOR]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { productId } = req.params;
    const { variantId } = req.query;
    const updates = req.body;
    if (req.user.role !== 'OWNER') {
        const product = await prisma_1.prisma.product.findFirst({
            where: {
                id: productId,
                store: {
                    OR: [
                        { ownerId: req.user.id },
                        { admins: { some: { userId: req.user.id } } },
                        { vendors: { some: { userId: req.user.id } } }
                    ]
                }
            }
        });
        if (!product) {
            throw new errorHandler_1.AppError('Product not found or no access', 404);
        }
    }
    const allowedFields = [
        'customThresholds',
        'trackStock',
        'allowNegativeStock',
        'autoReorder',
        'reorderQuantity',
        'supplierId',
        'leadTimeDays'
    ];
    const filteredUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
    }, {});
    if (Object.keys(filteredUpdates).length === 0) {
        throw new errorHandler_1.AppError('No valid updates provided', 400);
    }
    const updatedConfig = inventoryConfig_1.default.updateProductConfig(productId, filteredUpdates, variantId);
    loggerEnhanced_1.logger.info('Product inventory configuration updated', {
        productId,
        variantId,
        userId: req.user.id,
        updates: Object.keys(filteredUpdates)
    });
    res.json({
        success: true,
        message: 'Product inventory configuration updated',
        config: updatedConfig
    });
}));
router.get('/inventory/thresholds/:storeId/:productId', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN, jwt_1.UserRole.VENDOR]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId, productId } = req.params;
    const { variantId } = req.query;
    if (req.user.role !== 'OWNER') {
        const product = await prisma_1.prisma.product.findFirst({
            where: {
                id: productId,
                storeId,
                store: {
                    OR: [
                        { ownerId: req.user.id },
                        { admins: { some: { userId: req.user.id } } },
                        { vendors: { some: { userId: req.user.id } } }
                    ]
                }
            }
        });
        if (!product) {
            throw new errorHandler_1.AppError('Product not found or no access', 404);
        }
    }
    const thresholds = inventoryConfig_1.default.getEffectiveThresholds(storeId, productId, variantId);
    res.json({
        success: true,
        thresholds,
        storeId,
        productId,
        variantId: variantId || null
    });
}));
router.get('/inventory/templates', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json({
        success: true,
        templates: inventoryConfig_1.DEFAULT_THRESHOLDS,
        description: {
            small: 'For small stores with limited inventory (< 100 products)',
            medium: 'For medium stores with moderate inventory (100-1000 products)',
            large: 'For large stores with extensive inventory (1000-10000 products)',
            enterprise: 'For enterprise stores with massive inventory (10000+ products)'
        }
    });
}));
router.get('/inventory/health/:storeId/:productId', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN, jwt_1.UserRole.VENDOR]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId, productId } = req.params;
    const { variantId } = req.query;
    const product = await prisma_1.prisma.product.findFirst({
        where: {
            id: productId,
            storeId,
            ...(req.user.role !== 'OWNER' ? {
                store: {
                    OR: [
                        { ownerId: req.user.id },
                        { admins: { some: { userId: req.user.id } } },
                        { vendors: { some: { userId: req.user?.id } } }
                    ]
                }
            } : {})
        },
        include: {
            variants: variantId ? {
                where: { id: variantId }
            } : undefined,
            _count: {
                select: {
                    orderItems: {
                        where: {
                            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                            order: { status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } }
                        }
                    }
                }
            }
        }
    });
    if (!product) {
        throw new errorHandler_1.AppError('Product not found or no access', 404);
    }
    const currentStock = variantId
        ? (product.variants[0]?.stock || 0)
        : product.stock;
    const thresholds = inventoryConfig_1.default.getEffectiveThresholds(storeId, productId, variantId);
    const recentSales = product._count.orderItems;
    const salesVelocity = recentSales / 30;
    const daysInStock = salesVelocity > 0 ? currentStock / salesVelocity : 0;
    const healthScore = inventoryConfig_1.default.calculateInventoryHealthScore(currentStock, thresholds, salesVelocity, daysInStock);
    const severity = inventoryConfig_1.default.determineAlertSeverity(currentStock, thresholds);
    const reorderQuantity = inventoryConfig_1.default.calculateReorderQuantity(currentStock, thresholds, salesVelocity);
    res.json({
        success: true,
        healthData: {
            productId,
            variantId: variantId || null,
            currentStock,
            healthScore,
            severity,
            salesVelocity,
            daysInStock: Math.round(daysInStock),
            reorderQuantity,
            thresholds,
            recommendations: {
                action: healthScore < 30 ? 'immediate_reorder' :
                    healthScore < 60 ? 'monitor_closely' :
                        healthScore < 80 ? 'normal_monitoring' : 'optimal',
                message: healthScore < 30 ? 'Immediate attention required - stock critically low' :
                    healthScore < 60 ? 'Monitor stock levels closely' :
                        healthScore < 80 ? 'Normal monitoring required' :
                            'Stock levels are optimal'
            }
        }
    });
}));
router.get('/export', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const configurations = inventoryConfig_1.default.exportConfigurations();
    res.json({
        success: true,
        configurations,
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.id
    });
}));
exports.default = router;
//# sourceMappingURL=config.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setStockAlertsConfig = exports.getStockHistory = exports.updateStock = exports.getInventoryAlerts = void 0;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const notificationService_1 = require("../services/notificationService");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
exports.getInventoryAlerts = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId, severity, limit = 50 } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    let storeFilter = {};
    if (req.user.role !== 'OWNER') {
        const accessibleStores = await prisma_1.prisma.store.findMany({
            where: {
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } },
                    { vendors: { some: { userId: req.user.id } } }
                ]
            },
            select: { id: true }
        });
        const storeIds = accessibleStores.map(store => store.id);
        storeFilter = { storeId: { in: storeIds } };
    }
    if (storeId) {
        storeFilter.storeId = storeId;
    }
    try {
        const lowStockProducts = await prisma_1.prisma.product.findMany({
            where: {
                ...storeFilter,
                OR: [
                    {
                        stock: { lte: 10, gte: 0 },
                        trackStock: true
                    },
                    {
                        variants: {
                            some: {
                                stock: { lte: 10, gte: 0 }
                            }
                        }
                    }
                ]
            },
            include: {
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                },
                variants: {
                    where: {
                        stock: { lte: 10, gte: 0 }
                    },
                    select: {
                        id: true,
                        name: true,
                        value: true,
                        stock: true,
                        sku: true
                    }
                },
                _count: {
                    select: {
                        orderItems: {
                            where: {
                                order: {
                                    createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                                    status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: [
                { stock: 'asc' },
                { createdAt: 'desc' }
            ],
            take: Number(limit)
        });
        const outOfStockProducts = await prisma_1.prisma.product.findMany({
            where: {
                ...storeFilter,
                OR: [
                    {
                        stock: { lte: 0 },
                        trackStock: true
                    },
                    {
                        variants: {
                            some: {
                                stock: { lte: 0 }
                            }
                        }
                    }
                ]
            },
            include: {
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                },
                variants: {
                    where: {
                        stock: { lte: 0 }
                    },
                    select: {
                        id: true,
                        name: true,
                        value: true,
                        stock: true,
                        sku: true
                    }
                }
            },
            take: Number(limit)
        });
        const alerts = [
            ...lowStockProducts.map(product => ({
                type: 'LOW_STOCK',
                severity: product.stock === 0 ? 'CRITICAL' : product.stock <= 5 ? 'HIGH' : 'MEDIUM',
                product: {
                    id: product.id,
                    name: product.name,
                    sku: product.sku,
                    stock: product.stock,
                    images: product.images,
                    trackStock: product.trackStock
                },
                store: product.store,
                variants: product.variants,
                recentSales: product._count.orderItems,
                message: product.stock === 0
                    ? `Товар "${product.name}" закончился на складе`
                    : `Осталось ${product.stock} шт. товара "${product.name}"`,
                recommendedAction: product.stock === 0
                    ? 'Пополните запасы немедленно'
                    : 'Рекомендуем пополнить запасы',
                createdAt: new Date().toISOString()
            })),
            ...outOfStockProducts.map(product => ({
                type: 'OUT_OF_STOCK',
                severity: 'CRITICAL',
                product: {
                    id: product.id,
                    name: product.name,
                    sku: product.sku,
                    stock: product.stock,
                    images: product.images,
                    trackStock: product.trackStock
                },
                store: product.store,
                message: `Товар "${product.name}" отсутствует на складе`,
                recommendedAction: 'Срочно пополните запасы',
                createdAt: new Date().toISOString()
            }))
        ];
        const filteredAlerts = severity
            ? alerts.filter(alert => alert.severity === severity)
            : alerts;
        const sortedAlerts = filteredAlerts.sort((a, b) => {
            const severityOrder = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
            const severityDiff = severityOrder[b.severity] -
                severityOrder[a.severity];
            if (severityDiff !== 0)
                return severityDiff;
            return (a.product.stock || 0) - (b.product.stock || 0);
        });
        res.json({
            success: true,
            alerts: sortedAlerts,
            summary: {
                total: sortedAlerts.length,
                critical: sortedAlerts.filter(a => a.severity === 'CRITICAL').length,
                high: sortedAlerts.filter(a => a.severity === 'HIGH').length,
                medium: sortedAlerts.filter(a => a.severity === 'MEDIUM').length,
                outOfStock: outOfStockProducts.length,
                lowStock: lowStockProducts.length
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching inventory alerts:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to fetch inventory alerts', 500);
    }
});
exports.updateStock = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { productId, variantId, stock, reason } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (typeof stock !== 'number' || stock < 0) {
        throw new errorHandler_1.AppError('Stock must be a non-negative number', 400);
    }
    try {
        let updatedItem;
        let productName = '';
        let storeId = '';
        let oldStock = 0;
        if (variantId) {
            const variant = await prisma_1.prisma.productVariant.findUnique({
                where: { id: variantId },
                include: {
                    product: {
                        include: {
                            store: true
                        }
                    }
                }
            });
            if (!variant) {
                throw new errorHandler_1.AppError('Product variant not found', 404);
            }
            if (req.user.role !== 'OWNER') {
                const hasAccess = await prisma_1.prisma.store.findFirst({
                    where: {
                        id: variant.product.storeId,
                        OR: [
                            { ownerId: req.user.id },
                            { admins: { some: { userId: req.user.id } } },
                            { vendors: { some: { userId: req.user.id } } }
                        ]
                    }
                });
                if (!hasAccess) {
                    throw new errorHandler_1.AppError('No access to this store', 403);
                }
            }
            oldStock = variant.stock || 0;
            productName = `${variant.product.name} (${variant.name}: ${variant.value})`;
            storeId = variant.product.storeId;
            updatedItem = await prisma_1.prisma.productVariant.update({
                where: { id: variantId },
                data: { stock },
                include: {
                    product: {
                        include: {
                            store: true
                        }
                    }
                }
            });
        }
        else {
            const product = await prisma_1.prisma.product.findUnique({
                where: { id: productId },
                include: {
                    store: true
                }
            });
            if (!product) {
                throw new errorHandler_1.AppError('Product not found', 404);
            }
            if (req.user.role !== 'OWNER') {
                const hasAccess = await prisma_1.prisma.store.findFirst({
                    where: {
                        id: product.storeId,
                        OR: [
                            { ownerId: req.user.id },
                            { admins: { some: { userId: req.user.id } } },
                            { vendors: { some: { userId: req.user.id } } }
                        ]
                    }
                });
                if (!hasAccess) {
                    throw new errorHandler_1.AppError('No access to this store', 403);
                }
            }
            oldStock = product.stock || 0;
            productName = product.name;
            storeId = product.storeId;
            updatedItem = await prisma_1.prisma.product.update({
                where: { id: productId },
                data: { stock },
                include: {
                    store: true
                }
            });
        }
        await prisma_1.prisma.stockLog.create({
            data: {
                productId: updatedItem.productId || updatedItem.id,
                storeId,
                variantId: variantId || null,
                changeType: 'MANUAL_ADJUSTMENT',
                previousQty: oldStock,
                newQty: stock,
                changeQty: stock - oldStock,
                reason: reason || 'Manual update',
                userId: req.user.id,
            }
        });
        await checkStockAlerts(variantId ? updatedItem.product : updatedItem, variantId ? updatedItem : null, oldStock, stock, storeId);
        const { SocketRoomService } = await import('../services/socketRoomService.js');
        SocketRoomService.notifyStore(storeId, 'inventory:stock_updated', {
            productId: variantId ? updatedItem.productId : updatedItem.id,
            variantId: variantId || null,
            productName,
            oldStock,
            newStock: stock,
            change: stock - oldStock,
            updatedBy: req.user.id
        });
        logger_1.logger.info('Stock updated', { product: (0, sanitizer_1.sanitizeForLog)(productName), oldStock, newStock: stock, userId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
        res.json({
            success: true,
            message: 'Stock updated successfully',
            data: {
                productId: variantId ? updatedItem.productId : updatedItem.id,
                variantId: variantId || null,
                productName,
                oldStock,
                newStock: stock,
                change: stock - oldStock
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating stock:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to update stock', 500);
    }
});
exports.getStockHistory = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { productId, variantId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const skip = (Number(page) - 1) * Number(limit);
    try {
        const whereClause = {};
        if (variantId) {
            whereClause.variantId = variantId;
        }
        else if (productId) {
            whereClause.productId = productId;
            whereClause.variantId = null;
        }
        else {
            throw new errorHandler_1.AppError('Product ID or Variant ID required', 400);
        }
        if (req.user.role !== 'OWNER') {
            const product = await prisma_1.prisma.product.findUnique({
                where: { id: productId },
                select: { storeId: true }
            });
            if (!product) {
                throw new errorHandler_1.AppError('Product not found', 404);
            }
            const hasAccess = await prisma_1.prisma.store.findFirst({
                where: {
                    id: product.storeId,
                    OR: [
                        { ownerId: req.user.id },
                        { admins: { some: { userId: req.user.id } } },
                        { vendors: { some: { userId: req.user.id } } }
                    ]
                }
            });
            if (!hasAccess) {
                throw new errorHandler_1.AppError('No access to this store', 403);
            }
        }
        const [stockLogs, total] = await Promise.all([
            prisma_1.prisma.stockLog.findMany({
                where: whereClause,
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            sku: true
                        }
                    },
                    variant: {
                        select: {
                            id: true,
                            name: true,
                            value: true,
                            sku: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: Number(limit)
            }),
            prisma_1.prisma.stockLog.count({ where: whereClause })
        ]);
        res.json({
            success: true,
            stockLogs,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching stock history:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to fetch stock history', 500);
    }
});
exports.setStockAlertsConfig = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId, lowStockThreshold, criticalStockThreshold, enableAlerts } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
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
    try {
        const updatedStore = await prisma_1.prisma.store.update({
            where: { id: storeId },
            data: {
                lowStockThreshold: lowStockThreshold || 10,
                criticalStockThreshold: criticalStockThreshold || 5,
                enableStockAlerts: enableAlerts !== false
            }
        });
        logger_1.logger.info('Stock alerts config updated', { storeId: (0, sanitizer_1.sanitizeForLog)(storeId), userId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
        res.json({
            success: true,
            message: 'Stock alerts configuration updated',
            config: {
                lowStockThreshold: updatedStore.lowStockThreshold,
                criticalStockThreshold: updatedStore.criticalStockThreshold,
                enableStockAlerts: updatedStore.enableStockAlerts
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating stock alerts config:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to update stock alerts configuration', 500);
    }
});
async function checkStockAlerts(product, variant, oldStock, newStock, storeId) {
    try {
        const store = await prisma_1.prisma.store.findUnique({
            where: { id: storeId },
            select: {
                id: true,
                name: true,
                lowStockThreshold: true,
                criticalStockThreshold: true,
                enableStockAlerts: true,
                ownerId: true
            }
        });
        if (!store) {
            return;
        }
        if (!store.enableStockAlerts) {
            return;
        }
        const lowThreshold = store.lowStockThreshold || 10;
        const criticalThreshold = store.criticalStockThreshold || 5;
        const itemName = variant
            ? `${product.name} (${variant.name}: ${variant.value})`
            : product.name;
        let shouldNotify = false;
        let notificationType = notificationService_1.NotificationType.LOW_STOCK;
        let priority = notificationService_1.NotificationPriority.MEDIUM;
        let message = '';
        if (newStock <= criticalThreshold && oldStock > criticalThreshold) {
            shouldNotify = true;
            notificationType = notificationService_1.NotificationType.OUT_OF_STOCK;
            priority = notificationService_1.NotificationPriority.CRITICAL;
            message = newStock === 0
                ? `🚨 Товар "${itemName}" закончился на складе магазина "${store.name}"`
                : `⚠️ Критически низкий остаток товара "${itemName}": ${newStock} шт.`;
        }
        else if (newStock <= lowThreshold && oldStock > lowThreshold) {
            shouldNotify = true;
            priority = notificationService_1.NotificationPriority.HIGH;
            message = `📦 Низкий остаток товара "${itemName}": ${newStock} шт. в магазине "${store.name}"`;
        }
        if (shouldNotify) {
            const storeAdmins = await prisma_1.prisma.storeAdmin.findMany({
                where: { storeId },
                select: { userId: true }
            });
            const recipients = [store.ownerId, ...storeAdmins.map(admin => admin.userId)];
            await notificationService_1.NotificationService.send({
                title: newStock === 0 ? 'Товар закончился' : 'Низкий остаток',
                message,
                type: notificationType,
                priority,
                recipients,
                channels: [notificationService_1.NotificationChannel.SOCKET, notificationService_1.NotificationChannel.TELEGRAM],
                data: {
                    productId: product.id,
                    variantId: variant?.id || null,
                    productName: itemName,
                    storeId,
                    storeName: store.name,
                    oldStock,
                    newStock,
                    threshold: newStock <= criticalThreshold ? criticalThreshold : lowThreshold
                }
            });
            const { SocketRoomService } = await import('../services/socketRoomService.js');
            SocketRoomService.notifyStore(storeId, 'inventory:alert', {
                type: newStock === 0 ? 'out_of_stock' : 'low_stock',
                severity: newStock <= criticalThreshold ? 'critical' : 'high',
                productId: product.id,
                variantId: variant?.id || null,
                productName: itemName,
                stock: newStock,
                threshold: newStock <= criticalThreshold ? criticalThreshold : lowThreshold
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Error checking stock alerts:', (0, logger_1.toLogMetadata)(error));
    }
}
//# sourceMappingURL=inventoryController.js.map
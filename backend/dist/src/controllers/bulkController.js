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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBulkTemplate = exports.bulkDeleteProducts = exports.bulkUpdateProducts = exports.exportProducts = exports.importProducts = exports.upload = void 0;
const csv_parser_1 = __importDefault(require("csv-parser"));
const fs_1 = require("fs");
const multer_1 = __importDefault(require("multer"));
const path = __importStar(require("path"));
const prisma_1 = require("../lib/prisma");
const auditLog_1 = require("../middleware/auditLog");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${safeName}`;
        cb(null, uniqueName);
    }
});
exports.upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        }
        else {
            cb(new errorHandler_1.AppError('Only CSV files are allowed', 400));
        }
    }
});
exports.importProducts = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        throw new errorHandler_1.AppError('CSV file is required', 400);
    }
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const { storeId, dryRun = false } = req.body;
    if (!storeId) {
        throw new errorHandler_1.AppError('Store ID is required', 400);
    }
    const store = await prisma_1.prisma.store.findFirst({
        where: {
            id: storeId,
            OR: req.user?.role === 'OWNER' ? undefined : [
                { ownerId: req.user?.id },
                { admins: { some: { userId: req.user?.id } } }
            ]
        }
    });
    if (!store) {
        throw new errorHandler_1.AppError('Store not found or access denied', 404);
    }
    const csvPath = req.file.path;
    const products = [];
    const errors = [];
    try {
        (0, fs_1.createReadStream)(csvPath)
            .pipe((0, csv_parser_1.default)())
            .on('data', (data) => {
            if (!data.name || !data.price) {
                errors.push(`Row ${products.length + 1}: Name and price are required`);
                return;
            }
            products.push({
                name: data.name.trim(),
                description: data.description?.trim() || null,
                sku: data.sku?.trim() || null,
                price: parseFloat(data.price),
                stock: parseInt(data.stock) || 0,
                isActive: data.isActive === 'true' || data.isActive === '1',
                categoryName: data.category?.trim() || null,
                images: data.images?.trim() || null,
            });
        })
            .on('end', async () => {
            if (errors.length > 0) {
                return res.status(400).json({
                    error: 'CSV validation failed',
                    errors,
                    processed: 0
                });
            }
            let processed = 0;
            let skipped = 0;
            if (!dryRun) {
                for (const productData of products) {
                    try {
                        let categoryId = null;
                        if (productData.categoryName) {
                            let category = await prisma_1.prisma.category.findFirst({
                                where: { name: productData.categoryName }
                            });
                            if (!category) {
                                const slug = productData.categoryName
                                    .toLowerCase()
                                    .replace(/[^a-z0-9]+/g, '-')
                                    .replace(/^-+|-+$/g, '');
                                category = await prisma_1.prisma.category.create({
                                    data: {
                                        name: productData.categoryName,
                                        slug,
                                    }
                                });
                            }
                            categoryId = category.id;
                        }
                        let existingProduct = null;
                        if (productData.sku) {
                            existingProduct = await prisma_1.prisma.product.findFirst({
                                where: { storeId, sku: productData.sku }
                            });
                        }
                        else {
                            existingProduct = await prisma_1.prisma.product.findFirst({
                                where: { storeId, name: productData.name }
                            });
                        }
                        if (existingProduct) {
                            await prisma_1.prisma.product.update({
                                where: { id: existingProduct.id },
                                data: {
                                    description: productData.description,
                                    price: productData.price,
                                    stock: productData.stock,
                                    isActive: productData.isActive,
                                    images: productData.images,
                                    categoryId,
                                }
                            });
                        }
                        else {
                            await prisma_1.prisma.product.create({
                                data: {
                                    ...productData,
                                    storeId,
                                    categoryId,
                                }
                            });
                        }
                        processed++;
                    }
                    catch (error) {
                        logger_1.logger.error(`Failed to process product: ${productData.name}`, error);
                        skipped++;
                    }
                }
                await auditLog_1.AuditLogService.log(req.user.id, {
                    action: auditLog_1.AuditAction.BULK_IMPORT,
                    storeId,
                    details: {
                        type: 'products',
                        processed,
                        skipped,
                        total: products.length,
                    }
                }, req);
            }
            res.json({
                message: dryRun ? 'Dry run completed' : 'Import completed',
                total: products.length,
                processed,
                skipped,
                errors: errors.length,
                preview: dryRun ? products.slice(0, 5) : undefined,
            });
        })
            .on('error', (error) => {
            logger_1.logger.error('CSV parsing error:', (0, logger_1.toLogMetadata)(error));
            res.status(500).json({ error: 'Failed to parse CSV file' });
        });
    }
    catch (error) {
        logger_1.logger.error('Import error:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to import products', 500);
    }
    finally {
        try {
            (0, fs_1.unlinkSync)(csvPath);
        }
        catch (error) {
            logger_1.logger.warn('Failed to delete uploaded file:', error);
        }
    }
});
exports.exportProducts = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId, format = 'csv' } = req.query;
    if (!storeId) {
        throw new errorHandler_1.AppError('Store ID is required', 400);
    }
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const store = await prisma_1.prisma.store.findFirst({
        where: {
            id: storeId,
            OR: req.user?.role === 'OWNER' ? undefined : [
                { ownerId: req.user?.id },
                { admins: { some: { userId: req.user?.id } } }
            ]
        }
    });
    if (!store) {
        throw new errorHandler_1.AppError('Store not found or access denied', 404);
    }
    const products = await prisma_1.prisma.product.findMany({
        where: { storeId: storeId },
        include: {
            category: { select: { name: true } },
            variants: true,
        },
        orderBy: { createdAt: 'desc' }
    });
    if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="products-${store.name}-${Date.now()}.json"`);
        await auditLog_1.AuditLogService.log(req.user.id, {
            action: auditLog_1.AuditAction.BULK_EXPORT,
            storeId: storeId,
            details: {
                type: 'products',
                format: 'json',
                count: products.length,
            }
        }, req);
        res.json(products);
    }
    else {
        const csvHeader = 'name,description,sku,price,stock,isActive,category,images,variants\n';
        const csvRows = products.map(product => {
            const variants = product.variants.map(v => `${v.name}:${v.value}:${v.price || 'N/A'}:${v.stock || 'N/A'}`).join(';');
            return [
                `"${product.name.replace(/"/g, '""')}"`,
                `"${(product.description || '').replace(/"/g, '""')}"`,
                `"${product.sku || ''}"`,
                product.price,
                product.stock,
                product.isActive,
                `"${product.category?.name || ''}"`,
                `"${product.images || ''}"`,
                `"${variants}"`
            ].join(',');
        }).join('\n');
        const csvContent = csvHeader + csvRows;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="products-${store.name}-${Date.now()}.csv"`);
        await auditLog_1.AuditLogService.log(req.user.id, {
            action: auditLog_1.AuditAction.BULK_EXPORT,
            storeId: storeId,
            details: {
                type: 'products',
                format: 'csv',
                count: products.length,
            }
        }, req);
        res.send(csvContent);
    }
});
exports.bulkUpdateProducts = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId, updates, productIds } = req.body;
    if (!storeId || !updates || !productIds || !Array.isArray(productIds)) {
        throw new errorHandler_1.AppError('Store ID, product IDs, and updates are required', 400);
    }
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const store = await prisma_1.prisma.store.findFirst({
        where: {
            id: storeId,
            OR: req.user?.role === 'OWNER' ? undefined : [
                { ownerId: req.user?.id },
                { admins: { some: { userId: req.user?.id } } }
            ]
        }
    });
    if (!store) {
        throw new errorHandler_1.AppError('Store not found or access denied', 404);
    }
    const allowedFields = ['price', 'stock', 'isActive', 'description'];
    const updateData = {};
    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            updateData[key] = updates[key];
        }
    });
    if (Object.keys(updateData).length === 0) {
        throw new errorHandler_1.AppError('No valid update fields provided', 400);
    }
    const result = await prisma_1.prisma.product.updateMany({
        where: {
            id: { in: productIds },
            storeId,
        },
        data: updateData,
    });
    await auditLog_1.AuditLogService.log(req.user.id, {
        action: auditLog_1.AuditAction.BULK_UPDATE,
        storeId,
        details: {
            type: 'products',
            affected: result.count,
            updates: updateData,
            productIds,
        }
    }, req);
    res.json({
        message: 'Bulk update completed',
        affected: result.count,
        updates: updateData,
    });
});
exports.bulkDeleteProducts = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId, productIds } = req.body;
    if (!storeId || !productIds || !Array.isArray(productIds)) {
        throw new errorHandler_1.AppError('Store ID and product IDs are required', 400);
    }
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const store = await prisma_1.prisma.store.findFirst({
        where: {
            id: storeId,
            OR: req.user?.role === 'OWNER' ? undefined : [
                { ownerId: req.user?.id },
                { admins: { some: { userId: req.user?.id } } }
            ]
        }
    });
    if (!store) {
        throw new errorHandler_1.AppError('Store not found or access denied', 404);
    }
    const productsWithOrders = await prisma_1.prisma.product.findMany({
        where: {
            id: { in: productIds },
            storeId,
            orderItems: {
                some: {}
            }
        },
        select: { id: true, name: true }
    });
    if (productsWithOrders.length > 0) {
        const deactivated = await prisma_1.prisma.product.updateMany({
            where: {
                id: { in: productsWithOrders.map(p => p.id) },
                storeId,
            },
            data: { isActive: false }
        });
        const productsToDelete = productIds.filter(id => !productsWithOrders.some(p => p.id === id));
        let deleted = 0;
        if (productsToDelete.length > 0) {
            const deleteResult = await prisma_1.prisma.product.deleteMany({
                where: {
                    id: { in: productsToDelete },
                    storeId,
                }
            });
            deleted = deleteResult.count;
        }
        await auditLog_1.AuditLogService.log(req.user.id, {
            action: auditLog_1.AuditAction.BULK_DELETE,
            storeId,
            details: {
                type: 'products',
                deleted,
                deactivated: deactivated.count,
                total: productIds.length,
                productsWithOrders: productsWithOrders.map(p => p.name),
            }
        }, req);
        res.json({
            message: 'Bulk delete completed',
            deleted,
            deactivated: deactivated.count,
            total: productIds.length,
            warning: `${productsWithOrders.length} products were deactivated instead of deleted because they have associated orders`,
        });
    }
    else {
        const result = await prisma_1.prisma.product.deleteMany({
            where: {
                id: { in: productIds },
                storeId,
            }
        });
        await auditLog_1.AuditLogService.log(req.user.id, {
            action: auditLog_1.AuditAction.BULK_DELETE,
            storeId,
            details: {
                type: 'products',
                deleted: result.count,
                total: productIds.length,
            }
        }, req);
        res.json({
            message: 'Bulk delete completed',
            deleted: result.count,
        });
    }
});
exports.getBulkTemplate = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { type = 'products' } = req.query;
    if (type === 'products') {
        const csvTemplate = [
            'name,description,sku,price,stock,isActive,category,images',
            'Example Product,Product description,SKU001,99.99,10,true,Electronics,https://example.com/image.jpg',
            'Another Product,Another description,SKU002,49.99,5,false,Books,',
        ].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="products-import-template.csv"');
        res.send(csvTemplate);
    }
    else {
        throw new errorHandler_1.AppError('Invalid template type', 400);
    }
});
exports.default = {
    upload: exports.upload,
    importProducts: exports.importProducts,
    exportProducts: exports.exportProducts,
    bulkUpdateProducts: exports.bulkUpdateProducts,
    bulkDeleteProducts: exports.bulkDeleteProducts,
    getBulkTemplate: exports.getBulkTemplate,
};
//# sourceMappingURL=bulkController.js.map
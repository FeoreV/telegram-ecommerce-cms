"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkUpdateProducts = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProduct = exports.getProducts = exports.getCategories = void 0;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
exports.getCategories = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.query;
    let whereClause = {};
    if (req.user?.role !== 'OWNER') {
        const userStores = await prisma_1.prisma.store.findMany({
            where: {
                OR: [
                    { ownerId: req.user?.id },
                    { admins: { some: { userId: req.user?.id } } }
                ]
            },
            select: { id: true }
        });
        const storeIds = userStores.map(store => store.id);
        whereClause = {
            products: {
                some: {
                    storeId: { in: storeIds },
                    isActive: true
                }
            }
        };
        if (storeId) {
            whereClause = {
                products: {
                    some: {
                        storeId: storeId,
                        isActive: true
                    }
                }
            };
        }
    }
    else {
        if (storeId) {
            whereClause = {
                products: {
                    some: {
                        storeId: storeId,
                        isActive: true
                    }
                }
            };
        }
    }
    const categories = await prisma_1.prisma.category.findMany({
        where: whereClause,
        include: {
            _count: {
                select: {
                    products: {
                        where: {
                            ...(storeId && { storeId: storeId }),
                            isActive: true
                        }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    });
    const sanitizedCategories = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parentId: cat.parentId,
        productCount: cat._count?.products || 0,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt
    }));
    res.json({ categories: sanitizedCategories });
});
exports.getProducts = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, search, storeId, categoryId, isActive, minPrice, maxPrice } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const whereClause = {};
    if (storeId) {
        whereClause.storeId = storeId;
    }
    if (req.user?.role !== 'OWNER') {
        const userStores = await prisma_1.prisma.store.findMany({
            where: {
                OR: [
                    { ownerId: req.user?.id },
                    { admins: { some: { userId: req.user?.id } } }
                ]
            },
            select: { id: true }
        });
        const storeIds = userStores.map(store => store.id);
        if (whereClause.storeId) {
            if (!storeIds.includes(whereClause.storeId)) {
                throw new errorHandler_1.AppError('No access to this store', 403);
            }
        }
        else {
            whereClause.storeId = { in: storeIds };
        }
    }
    if (search) {
        whereClause.OR = [
            { name: { contains: search } },
            { description: { contains: search } },
            { sku: { contains: search } }
        ];
    }
    if (categoryId) {
        whereClause.categoryId = categoryId;
    }
    if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
    }
    if (minPrice || maxPrice) {
        whereClause.price = {};
        if (minPrice)
            whereClause.price.gte = parseFloat(minPrice);
        if (maxPrice)
            whereClause.price.lte = parseFloat(maxPrice);
    }
    const [products, total] = await Promise.all([
        prisma_1.prisma.product.findMany({
            where: whereClause,
            include: {
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                variants: true,
                _count: {
                    select: {
                        orderItems: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: Number(limit),
        }),
        prisma_1.prisma.product.count({ where: whereClause }),
    ]);
    const transformedProducts = products.map(product => ({
        ...product,
        images: product.images ? JSON.parse(product.images) : []
    }));
    res.json({
        items: transformedProducts,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
        },
    });
});
exports.getProduct = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const product = await prisma_1.prisma.product.findUnique({
        where: { id },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            category: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            variants: true,
        },
    });
    if (!product) {
        throw new errorHandler_1.AppError('Product not found', 404);
    }
    const transformedProduct = {
        ...product,
        images: product.images ? JSON.parse(product.images) : []
    };
    res.json({ product: transformedProduct });
});
exports.createProduct = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, description, sku, price, stock, images, storeId, categoryId, variants, } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (sku) {
        const existingProduct = await prisma_1.prisma.product.findUnique({
            where: {
                storeId_sku: {
                    storeId,
                    sku,
                },
            },
        });
        if (existingProduct) {
            throw new errorHandler_1.AppError('SKU already exists in this store', 409);
        }
    }
    const product = await prisma_1.prisma.product.create({
        data: {
            name,
            description,
            sku,
            price: parseFloat(price),
            stock: parseInt(stock),
            images: images && images.length > 0 ? JSON.stringify(images) : null,
            storeId,
            categoryId: categoryId && categoryId.trim() !== '' ? categoryId : null,
            variants: {
                create: variants?.map((variant) => ({
                    name: variant.name,
                    value: variant.value,
                    price: variant.price ? parseFloat(variant.price) : null,
                    stock: variant.stock ? parseInt(variant.stock) : null,
                    sku: variant.sku,
                })) || [],
            },
        },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            category: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            variants: true,
        },
    });
    logger_1.logger.info(`Product created: ${(0, sanitizer_1.sanitizeForLog)(product.id)} by user ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
    const transformedProduct = {
        ...product,
        images: product.images ? JSON.parse(product.images) : []
    };
    res.status(201).json({ product: transformedProduct });
});
exports.updateProduct = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name, description, sku, price, stock, images, categoryId, isActive, } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (sku) {
        const existingProduct = await prisma_1.prisma.product.findFirst({
            where: {
                sku,
                storeId: (await prisma_1.prisma.product.findUnique({ where: { id }, select: { storeId: true } }))?.storeId,
                NOT: { id },
            },
        });
        if (existingProduct) {
            throw new errorHandler_1.AppError('SKU already exists in this store', 409);
        }
    }
    const product = await prisma_1.prisma.product.update({
        where: { id },
        data: {
            name,
            description,
            sku,
            price: price ? parseFloat(price) : undefined,
            stock: stock !== undefined ? parseInt(stock) : undefined,
            images: images !== undefined ? (images && images.length > 0 ? JSON.stringify(images) : null) : undefined,
            categoryId: categoryId !== undefined ? (categoryId && categoryId.trim() !== '' ? categoryId : null) : undefined,
            isActive,
        },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            category: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            variants: true,
        },
    });
    logger_1.logger.info(`Product updated: ${(0, sanitizer_1.sanitizeForLog)(product.id)} by user ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
    const transformedProduct = {
        ...product,
        images: product.images ? JSON.parse(product.images) : []
    };
    res.json({ product: transformedProduct });
});
exports.deleteProduct = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    await prisma_1.prisma.product.delete({
        where: { id },
    });
    logger_1.logger.info(`Product deleted: ${(0, sanitizer_1.sanitizeForLog)(id)} by user ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
    res.json({ message: 'Product deleted successfully' });
});
exports.bulkUpdateProducts = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { productIds, updates } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new errorHandler_1.AppError('Product IDs array is required', 400);
    }
    const updateData = {};
    if (updates.isActive !== undefined)
        updateData.isActive = updates.isActive;
    if (updates.stock !== undefined)
        updateData.stock = parseInt(updates.stock);
    if (updates.price !== undefined)
        updateData.price = parseFloat(updates.price);
    const result = await prisma_1.prisma.product.updateMany({
        where: {
            id: {
                in: productIds,
            },
        },
        data: updateData,
    });
    logger_1.logger.info(`Bulk update: ${result.count} products updated by user ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
    res.json({
        message: `${result.count} products updated successfully`,
        count: result.count
    });
});
//# sourceMappingURL=productController.js.map
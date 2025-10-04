"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserStores = exports.removeStoreAdmin = exports.addStoreAdmin = exports.deleteStore = exports.updateStore = exports.checkSlugAvailability = exports.createStore = exports.getStore = exports.getStores = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const notificationService_1 = require("../services/notificationService");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const removeEmptyValues = (value) => {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
        const cleanedArray = value
            .map((item) => removeEmptyValues(item))
            .filter((item) => item !== undefined);
        return cleanedArray.length ? cleanedArray : undefined;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value)
            .map(([key, item]) => [key, removeEmptyValues(item)])
            .filter(([, item]) => item !== undefined);
        if (!entries.length) {
            return undefined;
        }
        return entries.reduce((acc, [key, item]) => {
            acc[key] = item;
            return acc;
        }, {});
    }
    return value;
};
const normalizeJsonField = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        try {
            const parsed = JSON.parse(trimmed);
            const cleaned = removeEmptyValues(parsed);
            if (cleaned === undefined) {
                return null;
            }
            return JSON.stringify(cleaned);
        }
        catch {
            return trimmed;
        }
    }
    const cleaned = removeEmptyValues(value);
    if (cleaned === undefined) {
        return null;
    }
    return JSON.stringify(cleaned);
};
const normalizeContactInfoInput = (contactInfo, legacy = {}) => {
    const info = {};
    const apply = (input, key) => {
        if (isNonEmptyString(input)) {
            info[key] = input.trim();
        }
    };
    if (contactInfo && typeof contactInfo === 'object') {
        const candidate = contactInfo;
        apply(candidate['phone'], 'phone');
        apply(candidate['email'], 'email');
        apply(candidate['address'], 'address');
    }
    apply(legacy.contactPhone, 'phone');
    apply(legacy.contactEmail, 'email');
    apply(legacy.contactAddress, 'address');
    const hasData = Object.keys(info).length > 0;
    return {
        serialized: hasData ? JSON.stringify(info) : null,
        primaryPhone: info.phone ?? null,
    };
};
const parseJsonField = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'object') {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        try {
            return JSON.parse(trimmed);
        }
        catch (_error) {
            return trimmed;
        }
    }
    return value;
};
const transformStore = (store) => {
    if (!store) {
        return store;
    }
    const transformed = { ...store };
    if ('contactInfo' in transformed) {
        transformed.contactInfo = parseJsonField(transformed.contactInfo);
    }
    if ('settings' in transformed) {
        transformed.settings = parseJsonField(transformed.settings);
    }
    return transformed;
};
exports.getStores = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const whereClause = {};
    if (req.user?.role === 'OWNER') {
    }
    else if (req.user?.role === 'VENDOR') {
        whereClause.ownerId = req.user.id;
    }
    else if (req.user?.role === 'ADMIN') {
        whereClause.OR = [
            { ownerId: req.user.id },
            { admins: { some: { userId: req.user.id } } }
        ];
    }
    else {
        whereClause.id = 'non-existent-id';
    }
    if (typeof search === 'string' && search.trim().length > 0) {
        const searchTerm = search.trim();
        whereClause.OR = [
            ...(whereClause.OR || []),
            { name: { contains: searchTerm } },
            { description: { contains: searchTerm } }
        ];
    }
    if (typeof status === 'string') {
        whereClause.status = status;
    }
    const [stores, total] = await Promise.all([
        prisma_1.prisma.store.findMany({
            where: whereClause,
            include: {
                owner: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                admins: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        products: true,
                        orders: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: Number(limit),
        }),
        prisma_1.prisma.store.count({ where: whereClause }),
    ]);
    res.json({
        items: stores.map((store) => transformStore(store)),
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
        },
    });
});
exports.getStore = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const store = await prisma_1.prisma.store.findUnique({
        where: { id },
        include: {
            owner: {
                select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                },
            },
            admins: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    products: true,
                    orders: true,
                },
            },
        },
    });
    if (!store) {
        throw new errorHandler_1.AppError('Store not found', 404);
    }
    res.json({ store: transformStore(store) });
});
exports.createStore = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, description, slug, currency, domain, status, contactPhone, contactEmail, contactAddress, contactInfo, settings, } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions to create stores', 403);
    }
    if (!name || !description || !slug || !currency) {
        throw new errorHandler_1.AppError('Name, description, slug, and currency are required', 400);
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new errorHandler_1.AppError('Slug can only contain lowercase letters, numbers, and hyphens', 400);
    }
    const supportedCurrencies = ['USD', 'EUR', 'RUB', 'UAH'];
    if (!supportedCurrencies.includes(currency)) {
        throw new errorHandler_1.AppError('Unsupported currency', 400);
    }
    const existingStoreBySlug = await prisma_1.prisma.store.findUnique({
        where: { slug },
    });
    if (existingStoreBySlug) {
        throw new errorHandler_1.AppError('Store with this slug already exists', 400);
    }
    const existingStoreByName = await prisma_1.prisma.store.findFirst({
        where: {
            name: {
                equals: name
            }
        }
    });
    if (existingStoreByName) {
        throw new errorHandler_1.AppError('Store with this name already exists', 400);
    }
    try {
        const { serialized: normalizedContactInfo, primaryPhone } = normalizeContactInfoInput(contactInfo, {
            contactPhone,
            contactEmail,
            contactAddress,
        });
        const store = await prisma_1.prisma.store.create({
            data: {
                name: name.trim(),
                description: description.trim(),
                slug: slug.toLowerCase(),
                currency,
                domain: domain?.trim() || null,
                status: status || 'ACTIVE',
                contactPhone: primaryPhone,
                contactInfo: normalizedContactInfo,
                settings: normalizeJsonField(settings),
                ownerId: req.user.id,
                lowStockThreshold: 10,
                criticalStockThreshold: 5,
                enableStockAlerts: true,
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                _count: {
                    select: {
                        products: true,
                        orders: true,
                    }
                }
            },
        });
        if (req.user.role === 'ADMIN') {
            await prisma_1.prisma.storeAdmin.create({
                data: {
                    userId: req.user.id,
                    storeId: store.id,
                    assignedBy: req.user.id
                }
            });
        }
        const { NotificationService } = await import('../services/notificationService.js');
        await NotificationService.send({
            title: 'Новый магазин создан',
            message: `Магазин "${store.name}" успешно создан`,
            type: notificationService_1.NotificationType.STORE_CREATED,
            priority: notificationService_1.NotificationPriority.MEDIUM,
            recipients: [req.user.id],
            channels: [notificationService_1.NotificationChannel.SOCKET, notificationService_1.NotificationChannel.TELEGRAM],
            data: {
                storeId: store.id,
                storeName: store.name,
                storeSlug: store.slug,
                createdBy: req.user.id
            }
        });
        logger_1.logger.info(`Store created: ${(0, sanitizer_1.sanitizeForLog)(store.id)} (${(0, sanitizer_1.sanitizeForLog)(store.name)}) by user ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
        res.status(201).json({
            success: true,
            store: transformStore(store),
            message: 'Store created successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating store:', (0, logger_1.toLogMetadata)(error));
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const field = Array.isArray(error.meta?.target) ? error.meta?.target[0] : undefined;
            if (field === 'slug') {
                throw new errorHandler_1.AppError('Store with this slug already exists', 400);
            }
            else if (field === 'name') {
                throw new errorHandler_1.AppError('Store with this name already exists', 400);
            }
        }
        throw new errorHandler_1.AppError('Failed to create store', 500);
    }
});
exports.checkSlugAvailability = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const slugParam = typeof req.params.slug === 'string'
        ? req.params.slug
        : undefined;
    const slugQuery = typeof req.query.slug === 'string'
        ? req.query.slug
        : undefined;
    const excludeId = typeof req.query.excludeId === 'string'
        ? req.query.excludeId
        : undefined;
    const slug = (slugParam || slugQuery || '').toLowerCase();
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!slug) {
        throw new errorHandler_1.AppError('Valid slug required', 400);
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new errorHandler_1.AppError('Slug can only contain lowercase letters, numbers, and hyphens', 400);
    }
    const existingStore = await prisma_1.prisma.store.findFirst({
        where: excludeId
            ? { slug, NOT: { id: excludeId } }
            : { slug },
    });
    res.json({
        available: !existingStore,
        slug
    });
});
exports.updateStore = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name, description, slug, currency, domain, contactInfo, settings, status, contactPhone, contactEmail, contactAddress, } = req.body;
    let normalizedSlug = undefined;
    if (slug) {
        normalizedSlug = String(slug).toLowerCase();
        if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
            throw new errorHandler_1.AppError('Slug can only contain lowercase letters, numbers, and hyphens', 400);
        }
        const existingStore = await prisma_1.prisma.store.findFirst({
            where: {
                slug: normalizedSlug,
                NOT: { id },
            },
        });
        if (existingStore) {
            throw new errorHandler_1.AppError('Store slug already exists', 409);
        }
    }
    const updateData = {};
    if (name !== undefined) {
        updateData.name = typeof name === 'string' ? name.trim() : name;
    }
    if (description !== undefined) {
        updateData.description = typeof description === 'string' ? description.trim() : description;
    }
    if (normalizedSlug !== undefined) {
        updateData.slug = normalizedSlug;
    }
    if (currency !== undefined) {
        updateData.currency = currency;
    }
    if (domain !== undefined) {
        const trimmedDomain = typeof domain === 'string' ? domain.trim() : domain;
        updateData.domain = trimmedDomain ? trimmedDomain : null;
    }
    if (status !== undefined) {
        updateData.status = status;
    }
    if (contactInfo !== undefined ||
        contactPhone !== undefined ||
        contactEmail !== undefined ||
        contactAddress !== undefined) {
        const { serialized: normalizedContactInfo, primaryPhone } = normalizeContactInfoInput(contactInfo, {
            contactPhone,
            contactEmail,
            contactAddress,
        });
        updateData.contactInfo = normalizedContactInfo;
        updateData.contactPhone = primaryPhone;
    }
    if (settings !== undefined) {
        updateData.settings = normalizeJsonField(settings);
    }
    const store = await prisma_1.prisma.store.update({
        where: { id },
        data: updateData,
        include: {
            owner: {
                select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                },
            },
        },
    });
    logger_1.logger.info(`Store updated: ${(0, sanitizer_1.sanitizeForLog)(store.id)} by user ${(0, sanitizer_1.sanitizeForLog)(req.user?.id)}`);
    res.json({ store: transformStore(store) });
});
exports.deleteStore = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await prisma_1.prisma.store.delete({
        where: { id },
    });
    logger_1.logger.info(`Store deleted: ${(0, sanitizer_1.sanitizeForLog)(id)} by user ${(0, sanitizer_1.sanitizeForLog)(req.user?.id)}`);
    res.json({ message: 'Store deleted successfully' });
});
exports.addStoreAdmin = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
    });
    if (!user || user.role !== 'ADMIN') {
        throw new errorHandler_1.AppError('User not found or not an admin', 400);
    }
    const existingAdmin = await prisma_1.prisma.storeAdmin.findUnique({
        where: {
            storeId_userId: {
                storeId: id,
                userId,
            },
        },
    });
    if (existingAdmin) {
        throw new errorHandler_1.AppError('User is already an admin of this store', 409);
    }
    await prisma_1.prisma.storeAdmin.create({
        data: {
            storeId: id,
            userId,
        },
    });
    logger_1.logger.info(`Admin added to store: ${(0, sanitizer_1.sanitizeForLog)(id)}, user: ${(0, sanitizer_1.sanitizeForLog)(userId)} by ${(0, sanitizer_1.sanitizeForLog)(req.user?.id)}`);
    res.json({ message: 'Admin added successfully' });
});
exports.removeStoreAdmin = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id, userId } = req.params;
    await prisma_1.prisma.storeAdmin.delete({
        where: {
            storeId_userId: {
                storeId: id,
                userId,
            },
        },
    });
    logger_1.logger.info(`Admin removed from store: ${(0, sanitizer_1.sanitizeForLog)(id)}, user: ${(0, sanitizer_1.sanitizeForLog)(userId)} by ${(0, sanitizer_1.sanitizeForLog)(req.user?.id)}`);
    res.json({ message: 'Admin removed successfully' });
});
exports.getUserStores = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const whereClause = {};
    if (req.user.role === 'OWNER') {
    }
    else if (req.user.role === 'VENDOR') {
        whereClause.ownerId = req.user.id;
    }
    else if (req.user.role === 'ADMIN') {
        whereClause.OR = [
            { ownerId: req.user.id },
            { admins: { some: { userId: req.user.id } } }
        ];
    }
    else {
        throw new errorHandler_1.AppError('Insufficient permissions to access stores', 403);
    }
    const stores = await prisma_1.prisma.store.findMany({
        where: {
            ...whereClause,
            status: 'ACTIVE'
        },
        select: {
            id: true,
            name: true,
            description: true,
            slug: true,
            status: true,
            currency: true,
            createdAt: true,
            updatedAt: true,
            botToken: true,
            botUsername: true,
            botStatus: true,
            botCreatedAt: true,
            botLastActive: true,
            owner: {
                select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                },
            },
            _count: {
                select: {
                    products: {
                        where: { isActive: true }
                    },
                    orders: true,
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
    const storesWithBotInfo = stores.map((store) => {
        const transformed = transformStore(store);
        const { _count, ...rest } = transformed;
        return {
            ...rest,
            hasBot: Boolean(rest.botUsername),
            productCount: _count?.products ?? 0,
            orderCount: _count?.orders ?? 0,
        };
    });
    res.json({
        success: true,
        stores: storesWithBotInfo,
        total: storesWithBotInfo.length
    });
    logger_1.logger.info(`User stores retrieved: ${storesWithBotInfo.length} stores for user ${(0, sanitizer_1.sanitizeForLog)(req.user.id)}`);
});
//# sourceMappingURL=storeController.js.map
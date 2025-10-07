"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeSchemaOutput = exports.createSchemaWithErrors = exports.validationSchemas = exports.responseSchemas = exports.querySchemas = exports.adminSchemas = exports.telegramSchemas = exports.orderSchemas = exports.productSchemas = exports.storeSchemas = exports.userSchemas = exports.commonSchemas = void 0;
const zod_1 = require("zod");
exports.commonSchemas = {
    uuid: zod_1.z.string().uuid('Invalid UUID format'),
    email: zod_1.z.string().email('Invalid email format').max(320),
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
    url: zod_1.z.string().url('Invalid URL format').max(2048),
    username: zod_1.z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must not exceed 128 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    shortText: zod_1.z.string().max(255, 'Text must not exceed 255 characters').trim(),
    mediumText: zod_1.z.string().max(1000, 'Text must not exceed 1000 characters').trim(),
    longText: zod_1.z.string().max(10000, 'Text must not exceed 10000 characters').trim(),
    positiveInt: zod_1.z.number().int().positive('Must be a positive integer'),
    nonNegativeInt: zod_1.z.number().int().min(0, 'Must be a non-negative integer'),
    price: zod_1.z.number().min(0, 'Price must be non-negative').max(999999.99, 'Price too large'),
    pastDate: zod_1.z.date().max(new Date(), 'Date cannot be in the future'),
    futureDate: zod_1.z.date().min(new Date(), 'Date cannot be in the past'),
    fileUpload: zod_1.z.object({
        filename: zod_1.z.string().max(255, 'Filename too long'),
        mimetype: zod_1.z.string().regex(/^[a-z]+\/[a-z0-9\-+.]+$/i, 'Invalid MIME type'),
        size: zod_1.z.number().max(10 * 1024 * 1024, 'File size must not exceed 10MB')
    })
};
exports.userSchemas = {
    register: zod_1.z.object({
        username: exports.commonSchemas.username,
        email: exports.commonSchemas.email,
        password: exports.commonSchemas.password,
        firstName: exports.commonSchemas.shortText.optional(),
        lastName: exports.commonSchemas.shortText.optional(),
        phone: exports.commonSchemas.phone.optional(),
        acceptTerms: zod_1.z.boolean().refine(val => val === true, 'Must accept terms and conditions')
    }),
    login: zod_1.z.object({
        email: exports.commonSchemas.email,
        password: zod_1.z.string().min(1, 'Password is required')
    }),
    updateProfile: zod_1.z.object({
        firstName: exports.commonSchemas.shortText.optional(),
        lastName: exports.commonSchemas.shortText.optional(),
        phone: exports.commonSchemas.phone.optional(),
        bio: exports.commonSchemas.mediumText.optional()
    }),
    changePassword: zod_1.z.object({
        currentPassword: zod_1.z.string().min(1, 'Current password is required'),
        newPassword: exports.commonSchemas.password,
        confirmPassword: zod_1.z.string()
    }).refine(data => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"]
    }),
    telegramAuth: zod_1.z.object({
        telegramId: zod_1.z.string()
            .regex(/^\d+$/, 'Invalid Telegram ID format')
            .min(1, 'Telegram ID is required'),
        username: zod_1.z.string()
            .max(32, 'Username must not exceed 32 characters')
            .optional(),
        firstName: zod_1.z.string()
            .max(64, 'First name must not exceed 64 characters')
            .optional(),
        lastName: zod_1.z.string()
            .max(64, 'Last name must not exceed 64 characters')
            .optional(),
        photoUrl: exports.commonSchemas.url.optional(),
        authDate: zod_1.z.string()
            .regex(/^\d+$/, 'Invalid auth date format')
            .refine((val) => {
            const timestamp = parseInt(val);
            return timestamp > 0 && timestamp <= Math.floor(Date.now() / 1000) + 60;
        }, 'Invalid auth date'),
        hash: zod_1.z.string()
            .length(64, 'Invalid hash length - must be 64 characters')
            .regex(/^[a-f0-9]{64}$/, 'Hash must be a valid hex string'),
        sessionId: zod_1.z.string().uuid().optional()
    })
};
exports.storeSchemas = {
    create: zod_1.z.object({
        name: exports.commonSchemas.shortText.min(1, 'Store name is required'),
        description: exports.commonSchemas.mediumText.optional(),
        currency: zod_1.z.string().length(3, 'Currency must be 3-letter code').toUpperCase(),
        timezone: zod_1.z.string().max(50, 'Timezone too long'),
        language: zod_1.z.string().length(2, 'Language must be 2-letter code').toLowerCase(),
        settings: zod_1.z.object({
            allowGuestOrders: zod_1.z.boolean().default(false),
            requirePhoneVerification: zod_1.z.boolean().default(true),
            enableInventoryTracking: zod_1.z.boolean().default(true),
            autoApproveOrders: zod_1.z.boolean().default(false)
        }).optional()
    }),
    update: zod_1.z.object({
        name: exports.commonSchemas.shortText.optional(),
        description: exports.commonSchemas.mediumText.optional(),
        currency: zod_1.z.string().length(3, 'Currency must be 3-letter code').toUpperCase().optional(),
        timezone: zod_1.z.string().max(50, 'Timezone too long').optional(),
        language: zod_1.z.string().length(2, 'Language must be 2-letter code').toLowerCase().optional(),
        isActive: zod_1.z.boolean().optional(),
        settings: zod_1.z.object({
            allowGuestOrders: zod_1.z.boolean().optional(),
            requirePhoneVerification: zod_1.z.boolean().optional(),
            enableInventoryTracking: zod_1.z.boolean().optional(),
            autoApproveOrders: zod_1.z.boolean().optional()
        }).optional()
    }),
    telegramBot: zod_1.z.object({
        botToken: zod_1.z.string()
            .regex(/^\d{8,10}:[A-Za-z0-9_-]{35}$/, 'Invalid bot token format'),
        webhookUrl: exports.commonSchemas.url.optional(),
        secretToken: zod_1.z.string().min(1, 'Secret token is required').max(256),
        settings: zod_1.z.object({
            enableNotifications: zod_1.z.boolean().default(true),
            enableOrderUpdates: zod_1.z.boolean().default(true),
            enableInventoryAlerts: zod_1.z.boolean().default(true),
            enablePaymentNotifications: zod_1.z.boolean().default(true)
        }).optional()
    })
};
exports.productSchemas = {
    create: zod_1.z.object({
        name: exports.commonSchemas.shortText.min(1, 'Product name is required'),
        description: exports.commonSchemas.longText.optional(),
        price: exports.commonSchemas.price,
        compareAtPrice: exports.commonSchemas.price.optional(),
        sku: zod_1.z.string().max(100, 'SKU too long').optional(),
        barcode: zod_1.z.string().max(50, 'Barcode too long').optional(),
        weight: zod_1.z.number().min(0, 'Weight must be non-negative').optional(),
        dimensions: zod_1.z.object({
            length: zod_1.z.number().positive().optional(),
            width: zod_1.z.number().positive().optional(),
            height: zod_1.z.number().positive().optional()
        }).optional(),
        category: exports.commonSchemas.shortText.optional(),
        tags: zod_1.z.array(exports.commonSchemas.shortText).max(20, 'Too many tags').optional(),
        isActive: zod_1.z.boolean().default(true),
        trackQuantity: zod_1.z.boolean().default(true),
        quantity: exports.commonSchemas.nonNegativeInt.optional(),
        lowStockThreshold: exports.commonSchemas.nonNegativeInt.optional(),
        images: zod_1.z.array(exports.commonSchemas.url).max(10, 'Too many images').optional()
    }),
    update: zod_1.z.object({
        name: exports.commonSchemas.shortText.optional(),
        description: exports.commonSchemas.longText.optional(),
        price: exports.commonSchemas.price.optional(),
        compareAtPrice: exports.commonSchemas.price.optional(),
        sku: zod_1.z.string().max(100, 'SKU too long').optional(),
        barcode: zod_1.z.string().max(50, 'Barcode too long').optional(),
        weight: zod_1.z.number().min(0, 'Weight must be non-negative').optional(),
        dimensions: zod_1.z.object({
            length: zod_1.z.number().positive().optional(),
            width: zod_1.z.number().positive().optional(),
            height: zod_1.z.number().positive().optional()
        }).optional(),
        category: exports.commonSchemas.shortText.optional(),
        tags: zod_1.z.array(exports.commonSchemas.shortText).max(20, 'Too many tags').optional(),
        isActive: zod_1.z.boolean().optional(),
        trackQuantity: zod_1.z.boolean().optional(),
        quantity: exports.commonSchemas.nonNegativeInt.optional(),
        lowStockThreshold: exports.commonSchemas.nonNegativeInt.optional(),
        images: zod_1.z.array(exports.commonSchemas.url).max(10, 'Too many images').optional()
    }),
    variant: zod_1.z.object({
        name: exports.commonSchemas.shortText.min(1, 'Variant name is required'),
        price: exports.commonSchemas.price.optional(),
        sku: zod_1.z.string().max(100, 'SKU too long').optional(),
        barcode: zod_1.z.string().max(50, 'Barcode too long').optional(),
        weight: zod_1.z.number().min(0, 'Weight must be non-negative').optional(),
        quantity: exports.commonSchemas.nonNegativeInt.optional(),
        options: zod_1.z.record(zod_1.z.string().max(100), exports.commonSchemas.shortText).optional()
    })
};
exports.orderSchemas = {
    create: zod_1.z.object({
        customerId: exports.commonSchemas.uuid.optional(),
        customerInfo: zod_1.z.object({
            firstName: exports.commonSchemas.shortText.min(1, 'First name is required'),
            lastName: exports.commonSchemas.shortText.optional(),
            email: exports.commonSchemas.email.optional(),
            phone: exports.commonSchemas.phone.min(1, 'Phone is required'),
            telegramId: zod_1.z.number().positive().optional()
        }),
        items: zod_1.z.array(zod_1.z.object({
            productId: exports.commonSchemas.uuid,
            variantId: exports.commonSchemas.uuid.optional(),
            quantity: exports.commonSchemas.positiveInt,
            price: exports.commonSchemas.price,
            name: exports.commonSchemas.shortText.min(1, 'Item name is required')
        })).min(1, 'Order must contain at least one item'),
        shippingAddress: zod_1.z.object({
            street: exports.commonSchemas.shortText.min(1, 'Street is required'),
            city: exports.commonSchemas.shortText.min(1, 'City is required'),
            state: exports.commonSchemas.shortText.optional(),
            postalCode: zod_1.z.string().max(20, 'Postal code too long').optional(),
            country: zod_1.z.string().length(2, 'Country must be 2-letter code').toUpperCase(),
            additionalInfo: exports.commonSchemas.mediumText.optional()
        }),
        paymentMethod: zod_1.z.enum(['cash', 'card', 'bank_transfer', 'crypto', 'other']).refine(val => ['cash', 'card', 'bank_transfer', 'crypto', 'other'].includes(val), {
            message: 'Invalid payment method'
        }),
        notes: exports.commonSchemas.mediumText.optional(),
        discountCode: zod_1.z.string().max(50, 'Discount code too long').optional()
    }),
    updateStatus: zod_1.z.object({
        status: zod_1.z.enum(['PENDING_ADMIN', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']).refine(val => ['PENDING_ADMIN', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(val), {
            message: 'Invalid order status'
        }),
        notes: exports.commonSchemas.mediumText.optional(),
        trackingNumber: zod_1.z.string().max(100, 'Tracking number too long').optional()
    }),
    paymentProof: zod_1.z.object({
        paymentMethod: zod_1.z.enum(['cash', 'card', 'bank_transfer', 'crypto', 'other']),
        transactionId: zod_1.z.string().max(255, 'Transaction ID too long').optional(),
        amount: exports.commonSchemas.price,
        currency: zod_1.z.string().length(3, 'Currency must be 3-letter code').toUpperCase(),
        proofImages: zod_1.z.array(exports.commonSchemas.url).max(5, 'Too many proof images').optional(),
        notes: exports.commonSchemas.mediumText.optional()
    })
};
exports.telegramSchemas = {
    webhook: zod_1.z.object({
        update_id: zod_1.z.number().positive('Invalid update ID'),
        message: zod_1.z.object({
            message_id: zod_1.z.number().positive(),
            from: zod_1.z.object({
                id: zod_1.z.number().positive(),
                is_bot: zod_1.z.boolean().optional(),
                first_name: exports.commonSchemas.shortText,
                last_name: exports.commonSchemas.shortText.optional(),
                username: exports.commonSchemas.username.optional(),
                language_code: zod_1.z.string().max(10).optional()
            }),
            chat: zod_1.z.object({
                id: zod_1.z.number(),
                type: zod_1.z.enum(['private', 'group', 'supergroup', 'channel']),
                title: exports.commonSchemas.shortText.optional(),
                username: exports.commonSchemas.username.optional(),
                first_name: exports.commonSchemas.shortText.optional(),
                last_name: exports.commonSchemas.shortText.optional()
            }),
            date: zod_1.z.number().positive(),
            text: zod_1.z.string().max(4096, 'Message text too long').optional(),
            entities: zod_1.z.array(zod_1.z.object({
                type: zod_1.z.string(),
                offset: zod_1.z.number().min(0),
                length: zod_1.z.number().positive(),
                url: exports.commonSchemas.url.optional(),
                user: zod_1.z.object({
                    id: zod_1.z.number().positive(),
                    first_name: exports.commonSchemas.shortText
                }).optional()
            })).optional()
        }).optional(),
        callback_query: zod_1.z.object({
            id: zod_1.z.string(),
            from: zod_1.z.object({
                id: zod_1.z.number().positive(),
                first_name: exports.commonSchemas.shortText,
                username: exports.commonSchemas.username.optional()
            }),
            message: zod_1.z.object({
                message_id: zod_1.z.number().positive(),
                chat: zod_1.z.object({
                    id: zod_1.z.number(),
                    type: zod_1.z.enum(['private', 'group', 'supergroup', 'channel'])
                })
            }).optional(),
            data: zod_1.z.string().max(64, 'Callback data too long').optional()
        }).optional()
    }),
    sendMessage: zod_1.z.object({
        chat_id: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
        text: zod_1.z.string().min(1, 'Message text is required').max(4096, 'Message text too long'),
        parse_mode: zod_1.z.enum(['Markdown', 'MarkdownV2', 'HTML']).optional(),
        disable_web_page_preview: zod_1.z.boolean().optional(),
        disable_notification: zod_1.z.boolean().optional(),
        reply_to_message_id: zod_1.z.number().positive().optional(),
        reply_markup: zod_1.z.object({
            inline_keyboard: zod_1.z.array(zod_1.z.array(zod_1.z.object({
                text: zod_1.z.string().max(64),
                callback_data: zod_1.z.string().max(64).optional(),
                url: exports.commonSchemas.url.optional()
            }))).optional(),
            keyboard: zod_1.z.array(zod_1.z.array(zod_1.z.object({
                text: zod_1.z.string().max(64),
                request_contact: zod_1.z.boolean().optional(),
                request_location: zod_1.z.boolean().optional()
            }))).optional(),
            resize_keyboard: zod_1.z.boolean().optional(),
            one_time_keyboard: zod_1.z.boolean().optional(),
            remove_keyboard: zod_1.z.boolean().optional()
        }).optional()
    })
};
exports.adminSchemas = {
    createUser: zod_1.z.object({
        username: exports.commonSchemas.username,
        email: exports.commonSchemas.email,
        password: exports.commonSchemas.password,
        role: zod_1.z.enum(['OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER']).refine(val => ['OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER'].includes(val), {
            message: 'Invalid user role'
        }),
        storeId: exports.commonSchemas.uuid.optional(),
        firstName: exports.commonSchemas.shortText.optional(),
        lastName: exports.commonSchemas.shortText.optional(),
        phone: exports.commonSchemas.phone.optional(),
        isActive: zod_1.z.boolean().default(true)
    }),
    updateUser: zod_1.z.object({
        username: exports.commonSchemas.username.optional(),
        email: exports.commonSchemas.email.optional(),
        role: zod_1.z.enum(['OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER']).optional(),
        storeId: exports.commonSchemas.uuid.optional(),
        firstName: exports.commonSchemas.shortText.optional(),
        lastName: exports.commonSchemas.shortText.optional(),
        phone: exports.commonSchemas.phone.optional(),
        isActive: zod_1.z.boolean().optional()
    }),
    systemSettings: zod_1.z.object({
        maintenanceMode: zod_1.z.boolean().optional(),
        registrationEnabled: zod_1.z.boolean().optional(),
        maxStoresPerUser: exports.commonSchemas.positiveInt.optional(),
        maxProductsPerStore: exports.commonSchemas.positiveInt.optional(),
        maxOrdersPerDay: exports.commonSchemas.positiveInt.optional(),
        defaultCurrency: zod_1.z.string().length(3).toUpperCase().optional(),
        supportedCurrencies: zod_1.z.array(zod_1.z.string().length(3).toUpperCase()).optional(),
        rateLimits: zod_1.z.object({
            apiRequestsPerMinute: exports.commonSchemas.positiveInt.optional(),
            loginAttemptsPerHour: exports.commonSchemas.positiveInt.optional(),
            orderCreationsPerHour: exports.commonSchemas.positiveInt.optional()
        }).optional()
    })
};
exports.querySchemas = {
    pagination: zod_1.z.object({
        page: zod_1.z.coerce.number().int().min(1).default(1),
        limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
        sortBy: zod_1.z.string().max(50).optional(),
        sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc')
    }),
    search: zod_1.z.object({
        q: zod_1.z.string().max(255, 'Search query too long').optional(),
        category: exports.commonSchemas.shortText.optional(),
        minPrice: exports.commonSchemas.price.optional(),
        maxPrice: exports.commonSchemas.price.optional(),
        inStock: zod_1.z.coerce.boolean().optional(),
        tags: zod_1.z.string().transform(str => str.split(',')).optional()
    }),
    dateRange: zod_1.z.object({
        startDate: zod_1.z.coerce.date().optional(),
        endDate: zod_1.z.coerce.date().optional(),
        timezone: zod_1.z.string().max(50).optional()
    }).refine(data => {
        if (data.startDate && data.endDate) {
            return data.startDate <= data.endDate;
        }
        return true;
    }, {
        message: 'Start date must be before end date',
        path: ['endDate']
    })
};
exports.responseSchemas = {
    success: zod_1.z.object({
        success: zod_1.z.literal(true),
        data: zod_1.z.any(),
        message: zod_1.z.string().optional(),
        timestamp: zod_1.z.string().datetime()
    }),
    error: zod_1.z.object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
        message: zod_1.z.string(),
        details: zod_1.z.array(zod_1.z.string()).optional(),
        timestamp: zod_1.z.string().datetime()
    }),
    paginated: zod_1.z.object({
        success: zod_1.z.literal(true),
        data: zod_1.z.array(zod_1.z.any()),
        pagination: zod_1.z.object({
            page: zod_1.z.number().int().positive(),
            limit: zod_1.z.number().int().positive(),
            total: zod_1.z.number().int().min(0),
            totalPages: zod_1.z.number().int().min(0),
            hasNext: zod_1.z.boolean(),
            hasPrev: zod_1.z.boolean()
        }),
        timestamp: zod_1.z.string().datetime()
    })
};
exports.validationSchemas = {
    common: exports.commonSchemas,
    user: exports.userSchemas,
    store: exports.storeSchemas,
    product: exports.productSchemas,
    order: exports.orderSchemas,
    telegram: exports.telegramSchemas,
    admin: exports.adminSchemas,
    query: exports.querySchemas,
    response: exports.responseSchemas
};
const createSchemaWithErrors = (schema, _customErrors) => {
    return schema.refine(() => true, {
        message: 'Validation failed'
    });
};
exports.createSchemaWithErrors = createSchemaWithErrors;
const sanitizeSchemaOutput = (data) => {
    if (typeof data === 'string') {
        return data.trim();
    }
    if (Array.isArray(data)) {
        return data.map(exports.sanitizeSchemaOutput);
    }
    if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            sanitized[key] = (0, exports.sanitizeSchemaOutput)(value);
        }
        return sanitized;
    }
    return data;
};
exports.sanitizeSchemaOutput = sanitizeSchemaOutput;
//# sourceMappingURL=validationSchemas.js.map
import { z } from 'zod';

// Common validation schemas
export const commonSchemas = {
  // Basic types
  uuid: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email format').max(320),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  url: z.string().url('Invalid URL format').max(2048),

  // Identifiers
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),

  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
           'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),

  // Text fields
  shortText: z.string().max(255, 'Text must not exceed 255 characters').trim(),
  mediumText: z.string().max(1000, 'Text must not exceed 1000 characters').trim(),
  longText: z.string().max(10000, 'Text must not exceed 10000 characters').trim(),

  // Numeric fields
  positiveInt: z.number().int().positive('Must be a positive integer'),
  nonNegativeInt: z.number().int().min(0, 'Must be a non-negative integer'),
  price: z.number().min(0, 'Price must be non-negative').max(999999.99, 'Price too large'),

  // Date fields
  pastDate: z.date().max(new Date(), 'Date cannot be in the future'),
  futureDate: z.date().min(new Date(), 'Date cannot be in the past'),

  // File upload
  fileUpload: z.object({
    filename: z.string().max(255, 'Filename too long'),
    mimetype: z.string().regex(/^[a-z]+\/[a-z0-9\-+.]+$/i, 'Invalid MIME type'),
    size: z.number().max(10 * 1024 * 1024, 'File size must not exceed 10MB')
  })
};

// User schemas
export const userSchemas = {
  register: z.object({
    username: commonSchemas.username,
    email: commonSchemas.email,
    password: commonSchemas.password,
    firstName: commonSchemas.shortText.optional(),
    lastName: commonSchemas.shortText.optional(),
    phone: commonSchemas.phone.optional(),
    acceptTerms: z.boolean().refine(val => val === true, 'Must accept terms and conditions')
  }),

  login: z.object({
    email: commonSchemas.email,
    password: z.string().min(1, 'Password is required')
  }),

  updateProfile: z.object({
    firstName: commonSchemas.shortText.optional(),
    lastName: commonSchemas.shortText.optional(),
    phone: commonSchemas.phone.optional(),
    bio: commonSchemas.mediumText.optional()
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: commonSchemas.password,
    confirmPassword: z.string()
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
  }),

  telegramAuth: z.object({
    telegramId: z.string()
      .regex(/^\d+$/, 'Invalid Telegram ID format')
      .min(1, 'Telegram ID is required'),
    username: z.string()
      .max(32, 'Username must not exceed 32 characters')
      .optional(),
    firstName: z.string()
      .max(64, 'First name must not exceed 64 characters')
      .optional(),
    lastName: z.string()
      .max(64, 'Last name must not exceed 64 characters')
      .optional(),
    photoUrl: commonSchemas.url.optional(),
    authDate: z.string()
      .regex(/^\d+$/, 'Invalid auth date format')
      .refine((val) => {
        const timestamp = parseInt(val);
        return timestamp > 0 && timestamp <= Math.floor(Date.now() / 1000) + 60;
      }, 'Invalid auth date'),
    hash: z.string()
      .length(64, 'Invalid hash length - must be 64 characters')
      .regex(/^[a-f0-9]{64}$/, 'Hash must be a valid hex string'),
    sessionId: z.string().uuid().optional()
  })
};

// Store schemas
export const storeSchemas = {
  create: z.object({
    name: commonSchemas.shortText.min(1, 'Store name is required'),
    description: commonSchemas.mediumText.optional(),
    currency: z.string().length(3, 'Currency must be 3-letter code').toUpperCase(),
    timezone: z.string().max(50, 'Timezone too long'),
    language: z.string().length(2, 'Language must be 2-letter code').toLowerCase(),
    settings: z.object({
      allowGuestOrders: z.boolean().default(false),
      requirePhoneVerification: z.boolean().default(true),
      enableInventoryTracking: z.boolean().default(true),
      autoApproveOrders: z.boolean().default(false)
    }).optional()
  }),

  update: z.object({
    name: commonSchemas.shortText.optional(),
    description: commonSchemas.mediumText.optional(),
    currency: z.string().length(3, 'Currency must be 3-letter code').toUpperCase().optional(),
    timezone: z.string().max(50, 'Timezone too long').optional(),
    language: z.string().length(2, 'Language must be 2-letter code').toLowerCase().optional(),
    isActive: z.boolean().optional(),
    settings: z.object({
      allowGuestOrders: z.boolean().optional(),
      requirePhoneVerification: z.boolean().optional(),
      enableInventoryTracking: z.boolean().optional(),
      autoApproveOrders: z.boolean().optional()
    }).optional()
  }),

  telegramBot: z.object({
    botToken: z.string()
      .regex(/^\d{8,10}:[A-Za-z0-9_-]{35}$/, 'Invalid bot token format'),
    webhookUrl: commonSchemas.url.optional(),
    secretToken: z.string().min(1, 'Secret token is required').max(256),
    settings: z.object({
      enableNotifications: z.boolean().default(true),
      enableOrderUpdates: z.boolean().default(true),
      enableInventoryAlerts: z.boolean().default(true),
      enablePaymentNotifications: z.boolean().default(true)
    }).optional()
  })
};

// Product schemas
export const productSchemas = {
  create: z.object({
    name: commonSchemas.shortText.min(1, 'Product name is required'),
    description: commonSchemas.longText.optional(),
    price: commonSchemas.price,
    compareAtPrice: commonSchemas.price.optional(),
    sku: z.string().max(100, 'SKU too long').optional(),
    barcode: z.string().max(50, 'Barcode too long').optional(),
    weight: z.number().min(0, 'Weight must be non-negative').optional(),
    dimensions: z.object({
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional()
    }).optional(),
    category: commonSchemas.shortText.optional(),
    tags: z.array(commonSchemas.shortText).max(20, 'Too many tags').optional(),
    isActive: z.boolean().default(true),
    trackQuantity: z.boolean().default(true),
    quantity: commonSchemas.nonNegativeInt.optional(),
    lowStockThreshold: commonSchemas.nonNegativeInt.optional(),
    images: z.array(commonSchemas.url).max(10, 'Too many images').optional()
  }),

  update: z.object({
    name: commonSchemas.shortText.optional(),
    description: commonSchemas.longText.optional(),
    price: commonSchemas.price.optional(),
    compareAtPrice: commonSchemas.price.optional(),
    sku: z.string().max(100, 'SKU too long').optional(),
    barcode: z.string().max(50, 'Barcode too long').optional(),
    weight: z.number().min(0, 'Weight must be non-negative').optional(),
    dimensions: z.object({
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional()
    }).optional(),
    category: commonSchemas.shortText.optional(),
    tags: z.array(commonSchemas.shortText).max(20, 'Too many tags').optional(),
    isActive: z.boolean().optional(),
    trackQuantity: z.boolean().optional(),
    quantity: commonSchemas.nonNegativeInt.optional(),
    lowStockThreshold: commonSchemas.nonNegativeInt.optional(),
    images: z.array(commonSchemas.url).max(10, 'Too many images').optional()
  }),

  variant: z.object({
    name: commonSchemas.shortText.min(1, 'Variant name is required'),
    price: commonSchemas.price.optional(),
    sku: z.string().max(100, 'SKU too long').optional(),
    barcode: z.string().max(50, 'Barcode too long').optional(),
    weight: z.number().min(0, 'Weight must be non-negative').optional(),
    quantity: commonSchemas.nonNegativeInt.optional(),
    options: z.record(z.string().max(100), commonSchemas.shortText).optional()
  })
};

// Order schemas
export const orderSchemas = {
  create: z.object({
    customerId: commonSchemas.uuid.optional(),
    customerInfo: z.object({
      firstName: commonSchemas.shortText.min(1, 'First name is required'),
      lastName: commonSchemas.shortText.optional(),
      email: commonSchemas.email.optional(),
      phone: commonSchemas.phone.min(1, 'Phone is required'),
      telegramId: z.number().positive().optional()
    }),
    items: z.array(z.object({
      productId: commonSchemas.uuid,
      variantId: commonSchemas.uuid.optional(),
      quantity: commonSchemas.positiveInt,
      price: commonSchemas.price,
      name: commonSchemas.shortText.min(1, 'Item name is required')
    })).min(1, 'Order must contain at least one item'),
    shippingAddress: z.object({
      street: commonSchemas.shortText.min(1, 'Street is required'),
      city: commonSchemas.shortText.min(1, 'City is required'),
      state: commonSchemas.shortText.optional(),
      postalCode: z.string().max(20, 'Postal code too long').optional(),
      country: z.string().length(2, 'Country must be 2-letter code').toUpperCase(),
      additionalInfo: commonSchemas.mediumText.optional()
    }),
    paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'crypto', 'other']).refine(val =>
      ['cash', 'card', 'bank_transfer', 'crypto', 'other'].includes(val), {
        message: 'Invalid payment method'
      }),
    notes: commonSchemas.mediumText.optional(),
    discountCode: z.string().max(50, 'Discount code too long').optional()
  }),

  updateStatus: z.object({
    status: z.enum(['PENDING_ADMIN', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']).refine(val =>
      ['PENDING_ADMIN', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(val), {
        message: 'Invalid order status'
      }),
    notes: commonSchemas.mediumText.optional(),
    trackingNumber: z.string().max(100, 'Tracking number too long').optional()
  }),

  paymentProof: z.object({
    paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'crypto', 'other']),
    transactionId: z.string().max(255, 'Transaction ID too long').optional(),
    amount: commonSchemas.price,
    currency: z.string().length(3, 'Currency must be 3-letter code').toUpperCase(),
    proofImages: z.array(commonSchemas.url).max(5, 'Too many proof images').optional(),
    notes: commonSchemas.mediumText.optional()
  })
};

// Telegram webhook schemas
export const telegramSchemas = {
  webhook: z.object({
    update_id: z.number().positive('Invalid update ID'),
    message: z.object({
      message_id: z.number().positive(),
      from: z.object({
        id: z.number().positive(),
        is_bot: z.boolean().optional(),
        first_name: commonSchemas.shortText,
        last_name: commonSchemas.shortText.optional(),
        username: commonSchemas.username.optional(),
        language_code: z.string().max(10).optional()
      }),
      chat: z.object({
        id: z.number(),
        type: z.enum(['private', 'group', 'supergroup', 'channel']),
        title: commonSchemas.shortText.optional(),
        username: commonSchemas.username.optional(),
        first_name: commonSchemas.shortText.optional(),
        last_name: commonSchemas.shortText.optional()
      }),
      date: z.number().positive(),
      text: z.string().max(4096, 'Message text too long').optional(),
      entities: z.array(z.object({
        type: z.string(),
        offset: z.number().min(0),
        length: z.number().positive(),
        url: commonSchemas.url.optional(),
        user: z.object({
          id: z.number().positive(),
          first_name: commonSchemas.shortText
        }).optional()
      })).optional()
    }).optional(),
    callback_query: z.object({
      id: z.string(),
      from: z.object({
        id: z.number().positive(),
        first_name: commonSchemas.shortText,
        username: commonSchemas.username.optional()
      }),
      message: z.object({
        message_id: z.number().positive(),
        chat: z.object({
          id: z.number(),
          type: z.enum(['private', 'group', 'supergroup', 'channel'])
        })
      }).optional(),
      data: z.string().max(64, 'Callback data too long').optional()
    }).optional()
  }),

  sendMessage: z.object({
    chat_id: z.union([z.number(), z.string()]),
    text: z.string().min(1, 'Message text is required').max(4096, 'Message text too long'),
    parse_mode: z.enum(['Markdown', 'MarkdownV2', 'HTML']).optional(),
    disable_web_page_preview: z.boolean().optional(),
    disable_notification: z.boolean().optional(),
    reply_to_message_id: z.number().positive().optional(),
    reply_markup: z.object({
      inline_keyboard: z.array(z.array(z.object({
        text: z.string().max(64),
        callback_data: z.string().max(64).optional(),
        url: commonSchemas.url.optional()
      }))).optional(),
      keyboard: z.array(z.array(z.object({
        text: z.string().max(64),
        request_contact: z.boolean().optional(),
        request_location: z.boolean().optional()
      }))).optional(),
      resize_keyboard: z.boolean().optional(),
      one_time_keyboard: z.boolean().optional(),
      remove_keyboard: z.boolean().optional()
    }).optional()
  })
};

// Admin schemas
export const adminSchemas = {
  createUser: z.object({
    username: commonSchemas.username,
    email: commonSchemas.email,
    password: commonSchemas.password,
    role: z.enum(['OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER']).refine(val =>
      ['OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER'].includes(val), {
        message: 'Invalid user role'
      }),
    storeId: commonSchemas.uuid.optional(),
    firstName: commonSchemas.shortText.optional(),
    lastName: commonSchemas.shortText.optional(),
    phone: commonSchemas.phone.optional(),
    isActive: z.boolean().default(true)
  }),

  updateUser: z.object({
    username: commonSchemas.username.optional(),
    email: commonSchemas.email.optional(),
    role: z.enum(['OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER']).optional(),
    storeId: commonSchemas.uuid.optional(),
    firstName: commonSchemas.shortText.optional(),
    lastName: commonSchemas.shortText.optional(),
    phone: commonSchemas.phone.optional(),
    isActive: z.boolean().optional()
  }),

  systemSettings: z.object({
    maintenanceMode: z.boolean().optional(),
    registrationEnabled: z.boolean().optional(),
    maxStoresPerUser: commonSchemas.positiveInt.optional(),
    maxProductsPerStore: commonSchemas.positiveInt.optional(),
    maxOrdersPerDay: commonSchemas.positiveInt.optional(),
    defaultCurrency: z.string().length(3).toUpperCase().optional(),
    supportedCurrencies: z.array(z.string().length(3).toUpperCase()).optional(),
    rateLimits: z.object({
      apiRequestsPerMinute: commonSchemas.positiveInt.optional(),
      loginAttemptsPerHour: commonSchemas.positiveInt.optional(),
      orderCreationsPerHour: commonSchemas.positiveInt.optional()
    }).optional()
  })
};

// Query parameter schemas
export const querySchemas = {
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().max(50).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  }),

  search: z.object({
    q: z.string().max(255, 'Search query too long').optional(),
    category: commonSchemas.shortText.optional(),
    minPrice: commonSchemas.price.optional(),
    maxPrice: commonSchemas.price.optional(),
    inStock: z.coerce.boolean().optional(),
    tags: z.string().transform(str => str.split(',')).optional()
  }),

  dateRange: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    timezone: z.string().max(50).optional()
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

// API response schemas (for documentation and validation)
export const responseSchemas = {
  success: z.object({
    success: z.literal(true),
    data: z.any(),
    message: z.string().optional(),
    timestamp: z.string().datetime()
  }),

  error: z.object({
    success: z.literal(false),
    error: z.string(),
    message: z.string(),
    details: z.array(z.string()).optional(),
    timestamp: z.string().datetime()
  }),

  paginated: z.object({
    success: z.literal(true),
    data: z.array(z.any()),
    pagination: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
      hasNext: z.boolean(),
      hasPrev: z.boolean()
    }),
    timestamp: z.string().datetime()
  })
};

// Export all schemas
export const validationSchemas = {
  common: commonSchemas,
  user: userSchemas,
  store: storeSchemas,
  product: productSchemas,
  order: orderSchemas,
  telegram: telegramSchemas,
  admin: adminSchemas,
  query: querySchemas,
  response: responseSchemas
};

// Helper function to create schema with custom error messages
export const createSchemaWithErrors = <T extends z.ZodTypeAny>(
  schema: T,
  _customErrors: Record<string, string>
): T => {
  return schema.refine(() => true, {
    message: 'Validation failed'
  }) as T;
};

// Helper function to sanitize schema output
export const sanitizeSchemaOutput = <T>(data: T): T => {
  if (typeof data === 'string') {
    return data.trim() as T;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeSchemaOutput) as T;
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized = {} as T;
    for (const [key, value] of Object.entries(data)) {
      (sanitized as any)[key] = sanitizeSchemaOutput(value);
    }
    return sanitized;
  }
  return data;
};

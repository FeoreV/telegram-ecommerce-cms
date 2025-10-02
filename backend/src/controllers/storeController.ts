import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger, toLogMetadata } from '../utils/logger';
import { NotificationPriority, NotificationChannel, NotificationType } from '../services/notificationService';

type ContactInfoPayload = {
  phone?: string;
  email?: string;
  address?: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const removeEmptyValues = (value: unknown): unknown => {
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
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, removeEmptyValues(item)] as [string, unknown])
      .filter(([, item]) => item !== undefined);

    if (!entries.length) {
      return undefined;
    }

    return entries.reduce<Record<string, unknown>>((acc, [key, item]) => {
      acc[key] = item as unknown;
      return acc;
    }, {});
  }

  return value;
};

const normalizeJsonField = (value: unknown): string | null => {
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
    } catch (error) {
      return trimmed;
    }
  }

  const cleaned = removeEmptyValues(value);
  if (cleaned === undefined) {
    return null;
  }

  return JSON.stringify(cleaned);
};

const normalizeContactInfoInput = (
  contactInfo: unknown,
  legacy: { contactPhone?: string | null | undefined; contactEmail?: string | null | undefined; contactAddress?: string | null | undefined } = {}
): { serialized: string | null; primaryPhone: string | null } => {
  const info: ContactInfoPayload = {};

  const apply = (input: unknown, key: keyof ContactInfoPayload) => {
    if (isNonEmptyString(input)) {
      info[key] = input.trim();
    }
  };

  if (contactInfo && typeof contactInfo === 'object') {
    const candidate = contactInfo as Record<string, unknown>;
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

const parseJsonField = (value: unknown): unknown => {
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
    } catch (error) {
      return trimmed;
    }
  }

  return value;
};

const transformStore = <T extends Record<string, unknown>>(store: T): T => {
  if (!store) {
    return store;
  }

  const transformed = { ...store } as Record<string, unknown>;

  if ('contactInfo' in transformed) {
    transformed.contactInfo = parseJsonField(transformed.contactInfo);
  }

  if ('settings' in transformed) {
    transformed.settings = parseJsonField(transformed.settings);
  }

  return transformed as T;
};

export const getStores = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 10, search, status } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const whereClause: Prisma.StoreWhereInput = {};

  // Role-based filtering
  if (req.user?.role === 'OWNER') {
    // OWNER can see all stores - no additional filtering needed
  } else if (req.user?.role === 'VENDOR') {
    // VENDOR can only see stores they own
    whereClause.ownerId = req.user.id;
  } else if (req.user?.role === 'ADMIN') {
    // ADMIN can see stores they own OR stores they're admin of
    whereClause.OR = [
      { ownerId: req.user.id },
      { admins: { some: { userId: req.user.id } } }
    ];
  } else {
    // CUSTOMER and other roles cannot see stores by default
    whereClause.id = 'non-existent-id'; // This will return empty results
  }

  // Search filter
  if (typeof search === 'string' && search.trim().length > 0) {
    const searchTerm = search.trim();
    whereClause.OR = [
      ...(whereClause.OR || []),
      { name: { contains: searchTerm } },
      { description: { contains: searchTerm } }
    ];
  }

  // Status filter
  if (typeof status === 'string') {
    whereClause.status = status;
  }

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
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
    prisma.store.count({ where: whereClause }),
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

export const getStore = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const store = await prisma.store.findUnique({
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
    throw new AppError('Store not found', 404);
  }

  res.json({ store: transformStore(store) });
});

export const createStore = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    description,
    slug,
    currency,
    domain,
    status,
    contactPhone,
    contactEmail,
    contactAddress,
    contactInfo,
    settings,
  } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER and ADMIN can create stores  
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions to create stores', 403);
  }

  // Validate required fields
  if (!name || !description || !slug || !currency) {
    throw new AppError('Name, description, slug, and currency are required', 400);
  }

  // Validate slug format (allow lowercase letters, numbers, hyphens)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new AppError('Slug can only contain lowercase letters, numbers, and hyphens', 400);
  }

  // Validate currency
  const supportedCurrencies = ['USD', 'EUR', 'RUB', 'UAH'];
  if (!supportedCurrencies.includes(currency)) {
    throw new AppError('Unsupported currency', 400);
  }

  // Check if slug is unique
  const existingStoreBySlug = await prisma.store.findUnique({
    where: { slug },
  });

  if (existingStoreBySlug) {
    throw new AppError('Store with this slug already exists', 400);
  }

  // Check if name is unique (case-insensitive)
  const existingStoreByName = await prisma.store.findFirst({
    where: { 
      name: {
        equals: name
        // Note: Case insensitive search not supported in SQLite
        // For production with MySQL/PostgreSQL, can enable: mode: 'insensitive'
      }
    }
  });

  if (existingStoreByName) {
    throw new AppError('Store with this name already exists', 400);
  }

  try {
    const { serialized: normalizedContactInfo, primaryPhone } = normalizeContactInfoInput(contactInfo, {
      contactPhone,
      contactEmail,
      contactAddress,
    });

    const store = await prisma.store.create({
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

    // If user is ADMIN, automatically assign them as store admin
    if (req.user.role === 'ADMIN') {
      await prisma.storeAdmin.create({
        data: {
          userId: req.user.id,
          storeId: store.id,
          assignedBy: req.user.id
        }
      });
    }

    // Send notification about new store creation
    const { NotificationService } = await import('../services/notificationService.js');
    await NotificationService.send({
      title: 'Новый магазин создан',
      message: `Магазин "${store.name}" успешно создан`,
      type: NotificationType.STORE_CREATED,
      priority: NotificationPriority.MEDIUM,
      recipients: [req.user.id],
      channels: [NotificationChannel.SOCKET, NotificationChannel.TELEGRAM],
      data: {
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        createdBy: req.user.id
      }
    });

    logger.info(`Store created: ${store.id} (${store.name}) by user ${req.user.id}`);

    res.status(201).json({ 
      success: true,
      store: transformStore(store),
      message: 'Store created successfully'
    });

  } catch (error: unknown) {
    logger.error('Error creating store:', toLogMetadata(error));
    
    // Handle specific database errors
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const field = Array.isArray(error.meta?.target) ? error.meta?.target[0] : undefined;
      if (field === 'slug') {
        throw new AppError('Store with this slug already exists', 400);
      } else if (field === 'name') {
        throw new AppError('Store with this name already exists', 400);
      }
    }
    
    throw new AppError('Failed to create store', 500);
  }
});

export const checkSlugAvailability = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Support both param-based and query-based access
  const slugParam = typeof (req.params as { slug?: string }).slug === 'string'
    ? (req.params as { slug?: string }).slug
    : undefined;
  const slugQuery = typeof (req.query as { slug?: string }).slug === 'string'
    ? (req.query as { slug?: string }).slug
    : undefined;
  const excludeId = typeof (req.query as { excludeId?: string }).excludeId === 'string'
    ? (req.query as { excludeId?: string }).excludeId
    : undefined;
  const slug = (slugParam || slugQuery || '').toLowerCase();

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  if (!slug) {
    throw new AppError('Valid slug required', 400);
  }

  // Validate slug format (allow lowercase letters, numbers, hyphens)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new AppError('Slug can only contain lowercase letters, numbers, and hyphens', 400);
  }

  // Check if slug is unique, optionally excluding a given store ID
  const existingStore = await prisma.store.findFirst({
    where: excludeId
      ? { slug, NOT: { id: excludeId } }
      : { slug },
  });

  res.json({ 
    available: !existingStore,
    slug 
  });
});

export const updateStore = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const {
    name,
    description,
    slug,
    currency,
    domain,
    contactInfo,
    settings,
    status,
    contactPhone,
    contactEmail,
    contactAddress,
  } = req.body;

  // Normalize and validate slug if provided
  let normalizedSlug: string | undefined = undefined;
  if (slug) {
    normalizedSlug = String(slug).toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
      throw new AppError('Slug can only contain lowercase letters, numbers, and hyphens', 400);
    }
    const existingStore = await prisma.store.findFirst({
      where: {
        slug: normalizedSlug,
        NOT: { id },
      },
    });

    if (existingStore) {
      throw new AppError('Store slug already exists', 409);
    }
  }

  const updateData: Record<string, unknown> = {};

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

  if (
    contactInfo !== undefined ||
    contactPhone !== undefined ||
    contactEmail !== undefined ||
    contactAddress !== undefined
  ) {
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

  const store = await prisma.store.update({
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

  logger.info(`Store updated: ${store.id} by user ${req.user?.id}`);

  res.json({ store: transformStore(store) });
});

export const deleteStore = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  await prisma.store.delete({
    where: { id },
  });

  logger.info(`Store deleted: ${id} by user ${req.user?.id}`);

  res.json({ message: 'Store deleted successfully' });
});

export const addStoreAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;

  // Check if user exists and has ADMIN role
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.role !== 'ADMIN') {
    throw new AppError('User not found or not an admin', 400);
  }

  // Check if already an admin
  const existingAdmin = await prisma.storeAdmin.findUnique({
    where: {
      storeId_userId: {
        storeId: id,
        userId,
      },
    },
  });

  if (existingAdmin) {
    throw new AppError('User is already an admin of this store', 409);
  }

  await prisma.storeAdmin.create({
    data: {
      storeId: id,
      userId,
    },
  });

  logger.info(`Admin added to store: ${id}, user: ${userId} by ${req.user?.id}`);

  res.json({ message: 'Admin added successfully' });
});

export const removeStoreAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id, userId } = req.params;

  await prisma.storeAdmin.delete({
    where: {
      storeId_userId: {
        storeId: id,
        userId,
      },
    },
  });

  logger.info(`Admin removed from store: ${id}, user: ${userId} by ${req.user?.id}`);

  res.json({ message: 'Admin removed successfully' });
});

export const getUserStores = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const whereClause: Prisma.StoreWhereInput = {};

  // Role-based filtering for user's own stores
  if (req.user.role === 'OWNER') {
    // OWNER can see all stores - no filtering
  } else if (req.user.role === 'VENDOR') {
    // VENDOR can only see stores they own
    whereClause.ownerId = req.user.id;
  } else if (req.user.role === 'ADMIN') {
    // ADMIN can see stores they own OR stores they're admin of
    whereClause.OR = [
      { ownerId: req.user.id },
      { admins: { some: { userId: req.user.id } } }
    ];
  } else {
    // CUSTOMER and other roles cannot see stores
    throw new AppError('Insufficient permissions to access stores', 403);
  }

  const stores = await prisma.store.findMany({
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

  // Map stores to include hasBot information
  const storesWithBotInfo = stores.map((store) => {
    const transformed = transformStore(store);
    const { _count, ...rest } = transformed as Record<string, unknown> & {
      _count?: { products: number; orders: number };
      botUsername?: string | null;
    };

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

  logger.info(`User stores retrieved: ${storesWithBotInfo.length} stores for user ${req.user.id}`);
});

import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

// Get categories with role-based filtering  
export const getCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.query;
  
  let whereClause: Prisma.CategoryWhereInput = {};

  // Role-based filtering for non-owners
  if (req.user?.role !== 'OWNER') {
    const userStores = await prisma.store.findMany({
      where: {
        OR: [
          { ownerId: req.user?.id },
          { admins: { some: { userId: req.user?.id } } }
        ]
      },
      select: { id: true }
    });

    const storeIds = userStores.map(store => store.id);
    
    // Filter categories only for accessible stores
    whereClause = {
      products: {
        some: {
          storeId: { in: storeIds },
          isActive: true
        }
      }
    };
    
    // If specific store requested, verify access
    if (storeId) {
      whereClause = {
        products: {
          some: {
            storeId: storeId as string,
            isActive: true
          }
        }
      };
    }
  } else {
    // OWNER can see all categories, optionally filtered by store
    if (storeId) {
      whereClause = {
        products: {
          some: {
            storeId: storeId as string,
            isActive: true
          }
        }
      };
    }
  }

  const categories = await prisma.category.findMany({
    where: whereClause,
    include: {
      _count: {
        select: {
          products: {
            where: {
              ...(storeId && { storeId: storeId as string }),
              isActive: true
            }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  res.json({ categories });
});

export const getProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search,
    storeId,
    categoryId,
    isActive,
    minPrice,
    maxPrice 
  } = req.query;
  
  const offset = (Number(page) - 1) * Number(limit);

  const whereClause: Prisma.ProductWhereInput = {};

  // Store filter
  if (storeId) {
    whereClause.storeId = storeId as string;
  }

  // Role-based filtering for non-owners
  if (req.user?.role !== 'OWNER') {
    const userStores = await prisma.store.findMany({
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
      // Check if user has access to the specified store
      if (!storeIds.includes(whereClause.storeId as string)) {
        throw new AppError('No access to this store', 403);
      }
    } else {
      // Filter to only accessible stores
      whereClause.storeId = { in: storeIds };
    }
  }

  // Other filters
  if (search) {
    whereClause.OR = [
      { name: { contains: search as string } },
      { description: { contains: search as string } },
      { sku: { contains: search as string } }
    ];
  }

  if (categoryId) {
    whereClause.categoryId = categoryId as string;
  }

  if (isActive !== undefined) {
    whereClause.isActive = isActive === 'true';
  }

  if (minPrice || maxPrice) {
    whereClause.price = {};
    if (minPrice) whereClause.price.gte = parseFloat(minPrice as string);
    if (maxPrice) whereClause.price.lte = parseFloat(maxPrice as string);
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
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
    prisma.product.count({ where: whereClause }),
  ]);

  // Transform images from JSON string to array
  const transformedProducts = products.map(product => ({
    ...product,
    images: product.images ? JSON.parse(product.images) as string[] : []
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

export const getProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const product = await prisma.product.findUnique({
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
    throw new AppError('Product not found', 404);
  }

  // Transform images from JSON string to array
  const transformedProduct = {
    ...product,
    images: product.images ? JSON.parse(product.images) as string[] : []
  };

  res.json({ product: transformedProduct });
});

interface ProductVariantCreateInput {
  name: string;
  value: string;
  price?: number | null;
  stock?: number | null;
  sku?: string | null;
}

export const createProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    description,
    sku,
    price,
    stock,
    images,
    storeId,
    categoryId,
    variants,
  } = req.body;

  // Check if SKU is unique within the store
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  if (sku) {
    const existingProduct = await prisma.product.findUnique({
      where: {
        storeId_sku: {
          storeId,
          sku,
        },
      },
    });

    if (existingProduct) {
      throw new AppError('SKU already exists in this store', 409);
    }
  }

  const product = await prisma.product.create({
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
        create: variants?.map((variant: ProductVariantCreateInput) => ({
          name: variant.name,
          value: variant.value,
          price: variant.price ? parseFloat(variant.price as any) : null,
          stock: variant.stock ? parseInt(variant.stock as any) : null,
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

  logger.info(`Product created: ${product.id} by user ${req.user.id}`);

  // Transform images from JSON string to array
  const transformedProduct = {
    ...product,
    images: product.images ? JSON.parse(product.images) as string[] : []
  };

  res.status(201).json({ product: transformedProduct });
});

export const updateProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const {
    name,
    description,
    sku,
    price,
    stock,
    images,
    categoryId,
    isActive,
  } = req.body;

  // Check if SKU is unique within the store (if changed)
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  if (sku) {
    const existingProduct = await prisma.product.findFirst({
      where: {
        sku,
        storeId: (await prisma.product.findUnique({ where: { id }, select: { storeId: true } }))?.storeId,
        NOT: { id },
      },
    });

    if (existingProduct) {
      throw new AppError('SKU already exists in this store', 409);
    }
  }

  const product = await prisma.product.update({
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

  logger.info(`Product updated: ${product.id} by user ${req.user.id}`);

  // Transform images from JSON string to array
  const transformedProduct = {
    ...product,
    images: product.images ? JSON.parse(product.images) as string[] : []
  };

  res.json({ product: transformedProduct });
});

export const deleteProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  await prisma.product.delete({
    where: { id },
  });

  logger.info(`Product deleted: ${id} by user ${req.user.id}`);

  res.json({ message: 'Product deleted successfully' });
});

export const bulkUpdateProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productIds, updates } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new AppError('Product IDs array is required', 400);
  }

  const updateData: Prisma.ProductUpdateManyMutationInput = {};
  if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
  if (updates.stock !== undefined) updateData.stock = parseInt(updates.stock);
  if (updates.price !== undefined) updateData.price = parseFloat(updates.price);

  const result = await prisma.product.updateMany({
    where: {
      id: {
        in: productIds,
      },
    },
    data: updateData,
  });

  logger.info(`Bulk update: ${result.count} products updated by user ${req.user.id}`);

  res.json({ 
    message: `${result.count} products updated successfully`,
    count: result.count 
  });
});

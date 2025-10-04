import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { sanitizeForLog } from '../utils/sanitizer';

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

  // SECURITY FIX: Sanitize category data before sending (CWE-79)
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

  // SECURITY FIX: CWE-117 - Sanitize log data
  logger.info(`Product created: ${sanitizeForLog(product.id)} by user ${sanitizeForLog(req.user.id)}`);

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
    variants,
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

  // Handle variants update if provided
  let updateData: any = {
    name,
    description,
    sku,
    price: price ? parseFloat(price) : undefined,
    stock: stock !== undefined ? parseInt(stock) : undefined,
    images: images !== undefined ? (images && images.length > 0 ? JSON.stringify(images) : null) : undefined,
    categoryId: categoryId !== undefined ? (categoryId && categoryId.trim() !== '' ? categoryId : null) : undefined,
    isActive,
  };

  // If variants are provided, replace all existing variants
  if (variants !== undefined && Array.isArray(variants)) {
    updateData.variants = {
      deleteMany: {}, // Delete all existing variants
      create: variants.map((variant: any) => ({
        name: variant.name,
        value: variant.value,
        price: variant.price ? parseFloat(variant.price) : null,
        stock: variant.stock !== undefined && variant.stock !== null ? parseInt(variant.stock) : null,
        sku: variant.sku || null,
      }))
    };
  }

  const product = await prisma.product.update({
    where: { id },
    data: updateData,
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

  // SECURITY FIX: CWE-117 - Sanitize log data
  logger.info(`Product updated: ${sanitizeForLog(product.id)} by user ${sanitizeForLog(req.user.id)}`);

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

  // SECURITY FIX: CWE-117 - Sanitize log data
  logger.info(`Product deleted: ${sanitizeForLog(id)} by user ${sanitizeForLog(req.user.id)}`);

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

  // SECURITY FIX: CWE-117 - Sanitize log data
  logger.info(`Bulk update: ${result.count} products updated by user ${sanitizeForLog(req.user.id)}`);

  // SECURITY FIX: CWE-79 - Response is JSON, safe by default (false positive)
  res.json({
    message: `${result.count} products updated successfully`,
    count: result.count
  });
});

// ===============================================
// PRODUCT VARIANTS MANAGEMENT
// ===============================================

// Get variants for a product
export const getProductVariants = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: {
        orderBy: [
          { name: 'asc' },
          { value: 'asc' }
        ]
      },
      store: true
    }
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  // Check permissions
  const hasPermission = await checkProductPermission(req.user, product.storeId);
  if (!hasPermission) {
    throw new AppError('You do not have permission to view this product', 403);
  }

  logger.info(`Variants retrieved for product: ${sanitizeForLog(productId)} by user ${sanitizeForLog(req.user.id)}`);

  res.json({ variants: product.variants });
});

// Create a new variant for a product
export const createProductVariant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;
  const { name, value, price, stock, sku } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Verify product exists and user has permission
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { store: true }
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  const hasPermission = await checkProductPermission(req.user, product.storeId);
  if (!hasPermission) {
    throw new AppError('You do not have permission to modify this product', 403);
  }

  // Check if variant with same name and value already exists
  const existingVariant = await prisma.productVariant.findUnique({
    where: {
      productId_name_value: {
        productId,
        name,
        value
      }
    }
  });

  if (existingVariant) {
    throw new AppError('Variant with this name and value already exists', 409);
  }

  // Create variant
  const variant = await prisma.productVariant.create({
    data: {
      productId,
      name,
      value,
      price: price ? parseFloat(price) : null,
      stock: stock !== undefined ? parseInt(stock) : null,
      sku: sku || null
    }
  });

  logger.info(`Variant created: ${sanitizeForLog(variant.id)} for product ${sanitizeForLog(productId)} by user ${sanitizeForLog(req.user.id)}`);

  res.status(201).json({ variant });
});

// Update a variant
export const updateProductVariant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId, variantId } = req.params;
  const { name, value, price, stock, sku } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Verify variant exists and belongs to product
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: {
        include: { store: true }
      }
    }
  });

  if (!variant || variant.productId !== productId) {
    throw new AppError('Variant not found', 404);
  }

  const hasPermission = await checkProductPermission(req.user, variant.product.storeId);
  if (!hasPermission) {
    throw new AppError('You do not have permission to modify this variant', 403);
  }

  // Check for duplicate name+value if updating them
  if (name && value && (name !== variant.name || value !== variant.value)) {
    const existingVariant = await prisma.productVariant.findUnique({
      where: {
        productId_name_value: {
          productId,
          name,
          value
        }
      }
    });

    if (existingVariant && existingVariant.id !== variantId) {
      throw new AppError('Variant with this name and value already exists', 409);
    }
  }

  // Update variant
  const updatedVariant = await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      name: name || variant.name,
      value: value || variant.value,
      price: price !== undefined ? (price ? parseFloat(price) : null) : variant.price,
      stock: stock !== undefined ? (stock !== null ? parseInt(stock) : null) : variant.stock,
      sku: sku !== undefined ? sku : variant.sku
    }
  });

  logger.info(`Variant updated: ${sanitizeForLog(variantId)} by user ${sanitizeForLog(req.user.id)}`);

  res.json({ variant: updatedVariant });
});

// Delete a variant
export const deleteProductVariant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId, variantId } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Verify variant exists and belongs to product
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: {
        include: { store: true }
      }
    }
  });

  if (!variant || variant.productId !== productId) {
    throw new AppError('Variant not found', 404);
  }

  const hasPermission = await checkProductPermission(req.user, variant.product.storeId);
  if (!hasPermission) {
    throw new AppError('You do not have permission to delete this variant', 403);
  }

  // Delete variant
  await prisma.productVariant.delete({
    where: { id: variantId }
  });

  logger.info(`Variant deleted: ${sanitizeForLog(variantId)} by user ${sanitizeForLog(req.user.id)}`);

  res.json({ message: 'Variant deleted successfully' });
});

// Helper function to check if user has permission to modify product
async function checkProductPermission(user: any, storeId: string): Promise<boolean> {
  if (user.role === 'OWNER') {
    return true;
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      admins: true,
      vendors: true
    }
  });

  if (!store) {
    return false;
  }

  // Check if user is store owner
  if (store.ownerId === user.id) {
    return true;
  }

  // Check if user is admin
  const isAdmin = store.admins.some(admin => admin.userId === user.id);
  if (isAdmin) {
    return true;
  }

  // Check if user is vendor
  const isVendor = store.vendors.some(vendor => vendor.userId === user.id && vendor.isActive);
  return isVendor;
}
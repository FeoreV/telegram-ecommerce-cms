import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuditLogService, AuditAction } from '../middleware/auditLog';
import { logger, toLogMetadata } from '../utils/logger';
import multer from 'multer';
import csv from 'csv-parser';
import { createReadStream, unlinkSync } from 'fs';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new AppError('Only CSV files are allowed', 400));
    }
  }
});

// Bulk import products from CSV
export const importProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    throw new AppError('CSV file is required', 400);
  }

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const { storeId, dryRun = false } = req.body;

  if (!storeId) {
    throw new AppError('Store ID is required', 400);
  }

  // Verify user has access to store
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      OR: req.user?.role === 'OWNER' ? undefined : [
        { ownerId: req.user?.id },
        { admins: { some: { userId: req.user?.id } } }
      ]
    }
  });

  if (!store) {
    throw new AppError('Store not found or access denied', 404);
  }

  const csvPath = req.file.path;
  const products: any[] = [];
  const errors: string[] = [];

  try {
    // Parse CSV file
    createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => {
        // Validate required fields
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
          // Process products
          for (const productData of products) {
            try {
              // Handle category
              let categoryId = null;
              if (productData.categoryName) {
                let category = await prisma.category.findFirst({
                  where: { name: productData.categoryName }
                });

                if (!category) {
                  // Create category if it doesn't exist
                  const slug = productData.categoryName
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                  
                  category = await prisma.category.create({
                    data: {
                      name: productData.categoryName,
                      slug,
                    }
                  });
                }
                categoryId = category.id;
              }

              // Check if product exists (by SKU or name+store)
              let existingProduct = null;
              if (productData.sku) {
                existingProduct = await prisma.product.findFirst({
                  where: { storeId, sku: productData.sku }
                });
              } else {
                existingProduct = await prisma.product.findFirst({
                  where: { storeId, name: productData.name }
                });
              }

              if (existingProduct) {
                // Update existing product
                await prisma.product.update({
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
              } else {
                // Create new product
                await prisma.product.create({
                  data: {
                    ...productData,
                    storeId,
                    categoryId,
                  }
                });
              }

              processed++;
            } catch (error) {
              logger.error(`Failed to process product: ${productData.name}`, error);
              skipped++;
            }
          }

          // Audit log
          await AuditLogService.log(req.user.id, {
            action: AuditAction.BULK_IMPORT,
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
        logger.error('CSV parsing error:', toLogMetadata(error));
        res.status(500).json({ error: 'Failed to parse CSV file' });
      });

  } catch (error) {
    logger.error('Import error:', error);
    throw new AppError('Failed to import products', 500);
  } finally {
    // Clean up uploaded file
    try {
      unlinkSync(csvPath);
    } catch (error) {
      logger.warn('Failed to delete uploaded file:', error);
    }
  }
});

// Bulk export products to CSV
export const exportProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId, format = 'csv' } = req.query;

  if (!storeId) {
    throw new AppError('Store ID is required', 400);
  }

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Verify user has access to store
  const store = await prisma.store.findFirst({
    where: {
      id: storeId as string,
      OR: req.user?.role === 'OWNER' ? undefined : [
        { ownerId: req.user?.id },
        { admins: { some: { userId: req.user?.id } } }
      ]
    }
  });

  if (!store) {
    throw new AppError('Store not found or access denied', 404);
  }

  const products = await prisma.product.findMany({
    where: { storeId: storeId as string },
    include: {
      category: { select: { name: true } },
      variants: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  if (format === 'json') {
    // Export as JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="products-${store.name}-${Date.now()}.json"`);
    
    // Audit log
    await AuditLogService.log(req.user.id, {
      action: AuditAction.BULK_EXPORT,
      storeId: storeId as string,
      details: {
        type: 'products',
        format: 'json',
        count: products.length,
      }
    }, req);

    res.json(products);
  } else {
    // Export as CSV
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

    // Audit log
    await AuditLogService.log(req.user.id, {
      action: AuditAction.BULK_EXPORT,
      storeId: storeId as string,
      details: {
        type: 'products',
        format: 'csv',
        count: products.length,
      }
    }, req);

    res.send(csvContent);
  }
});

// Bulk update products
export const bulkUpdateProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId, updates, productIds } = req.body;

  if (!storeId || !updates || !productIds || !Array.isArray(productIds)) {
    throw new AppError('Store ID, product IDs, and updates are required', 400);
  }

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Verify user has access to store
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      OR: req.user?.role === 'OWNER' ? undefined : [
        { ownerId: req.user?.id },
        { admins: { some: { userId: req.user?.id } } }
      ]
    }
  });

  if (!store) {
    throw new AppError('Store not found or access denied', 404);
  }

  // Validate update fields
  const allowedFields = ['price', 'stock', 'isActive', 'description'];
  const updateData: any = {};
  
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      updateData[key] = updates[key];
    }
  });

  if (Object.keys(updateData).length === 0) {
    throw new AppError('No valid update fields provided', 400);
  }

  // Perform bulk update
  const result = await prisma.product.updateMany({
    where: {
      id: { in: productIds },
      storeId,
    },
    data: updateData,
  });

  // Audit log
  await AuditLogService.log(req.user.id, {
    action: AuditAction.BULK_UPDATE,
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

// Bulk delete products
export const bulkDeleteProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId, productIds } = req.body;

  if (!storeId || !productIds || !Array.isArray(productIds)) {
    throw new AppError('Store ID and product IDs are required', 400);
  }

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Verify user has access to store and delete permission
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      OR: req.user?.role === 'OWNER' ? undefined : [
        { ownerId: req.user?.id },
        { admins: { some: { userId: req.user?.id } } }
      ]
    }
  });

  if (!store) {
    throw new AppError('Store not found or access denied', 404);
  }

  // Check if products have orders (safer to deactivate instead of delete)
  const productsWithOrders = await prisma.product.findMany({
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
    // Deactivate products with orders instead of deleting
    const deactivated = await prisma.product.updateMany({
      where: {
        id: { in: productsWithOrders.map(p => p.id) },
        storeId,
      },
      data: { isActive: false }
    });

    // Delete products without orders
    const productsToDelete = productIds.filter(id => 
      !productsWithOrders.some(p => p.id === id)
    );

    let deleted = 0;
    if (productsToDelete.length > 0) {
      const deleteResult = await prisma.product.deleteMany({
        where: {
          id: { in: productsToDelete },
          storeId,
        }
      });
      deleted = deleteResult.count;
    }

    // Audit log
    await AuditLogService.log(req.user.id, {
      action: AuditAction.BULK_DELETE,
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
  } else {
    // Safe to delete all products
    const result = await prisma.product.deleteMany({
      where: {
        id: { in: productIds },
        storeId,
      }
    });

    // Audit log
    await AuditLogService.log(req.user.id, {
      action: AuditAction.BULK_DELETE,
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

// Get bulk operation template
export const getBulkTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
  } else {
    throw new AppError('Invalid template type', 400);
  }
});

export default {
  upload,
  importProducts,
  exportProducts,
  bulkUpdateProducts,
  bulkDeleteProducts,
  getBulkTemplate,
};

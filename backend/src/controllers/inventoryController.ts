import { Prisma, Product, ProductVariant } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { NotificationChannel, NotificationPriority, NotificationService, NotificationType } from '../services/notificationService';
import { logger, toLogMetadata } from '../utils/logger';
import { sanitizeForLog } from '../utils/sanitizer';

// Get inventory alerts
export const getInventoryAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId, severity, limit = 50 } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Build store filter based on user permissions
  let storeFilter: Prisma.ProductWhereInput = {};
  if (req.user.role !== 'OWNER') {
    const accessibleStores = await prisma.store.findMany({
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
    storeFilter.storeId = storeId as string;
  }

  try {
    // Get low stock products
    const lowStockProducts = await prisma.product.findMany({
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

    // Get out of stock products
    const outOfStockProducts = await prisma.product.findMany({
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

    // Calculate severity for each product
    const alerts = [
      ...lowStockProducts.map(product => ({
        type: 'LOW_STOCK' as const,
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
        type: 'OUT_OF_STOCK' as const,
        severity: 'CRITICAL' as const,
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          stock: product.stock,
            images: product.images,
            trackStock: product.trackStock
          },
          store: product.store,
        // variants: product.variants,
        message: `Товар "${product.name}" отсутствует на складе`,
        recommendedAction: 'Срочно пополните запасы',
        createdAt: new Date().toISOString()
      }))
    ];

    // Filter by severity if specified
    const filteredAlerts = severity
      ? alerts.filter(alert => alert.severity === severity)
      : alerts;

    // Sort by severity and stock level
    const sortedAlerts = filteredAlerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
      const severityDiff = severityOrder[b.severity as keyof typeof severityOrder] -
                          severityOrder[a.severity as keyof typeof severityOrder];

      if (severityDiff !== 0) return severityDiff;

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

  } catch (error: unknown) {
    logger.error('Error fetching inventory alerts:', toLogMetadata(error));
    throw new AppError('Failed to fetch inventory alerts', 500);
  }
});

// Update stock levels
export const updateStock = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId, variantId, stock, reason } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Validate stock value
  if (typeof stock !== 'number' || stock < 0) {
    throw new AppError('Stock must be a non-negative number', 400);
  }

  try {
    let updatedItem: Product | ProductVariant;
    let productName = '';
    let storeId = '';
    let oldStock = 0;

    if (variantId) {
      // Update variant stock
      const variant = await prisma.productVariant.findUnique({
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
        throw new AppError('Product variant not found', 404);
      }

      // Check permissions
      if (req.user.role !== 'OWNER') {
        const hasAccess = await prisma.store.findFirst({
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
          throw new AppError('No access to this store', 403);
        }
      }

      oldStock = variant.stock || 0;
      productName = `${variant.product.name} (${variant.name}: ${variant.value})`;
      storeId = variant.product.storeId;

      updatedItem = await prisma.productVariant.update({
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
    } else {
      // Update product stock
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          store: true
        }
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      // Check permissions
      if (req.user.role !== 'OWNER') {
        const hasAccess = await prisma.store.findFirst({
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
          throw new AppError('No access to this store', 403);
        }
      }

      oldStock = product.stock || 0;
      productName = product.name;
      storeId = product.storeId;

      updatedItem = await prisma.product.update({
        where: { id: productId },
        data: { stock },
        include: {
          store: true
        }
      });
    }

    // Log stock change
    await prisma.stockLog.create({
      data: {
        productId: (updatedItem as ProductVariant).productId || (updatedItem as Product).id,
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

    // Check if we need to send notifications
    await checkStockAlerts(
      variantId ? (updatedItem as any).product : (updatedItem as Product),
      variantId ? (updatedItem as ProductVariant) : null,
      oldStock,
      stock,
      storeId
    );

    // Emit real-time update
    const { SocketRoomService } = await import('../services/socketRoomService.js');
    SocketRoomService.notifyStore(storeId, 'inventory:stock_updated', {
      productId: variantId ? (updatedItem as ProductVariant).productId : (updatedItem as Product).id,
      variantId: variantId || null,
      productName,
      oldStock,
      newStock: stock,
      change: stock - oldStock,
      updatedBy: req.user.id
    });

    // SECURITY FIX: CWE-117 - Sanitize log data
    logger.info('Stock updated', { product: sanitizeForLog(productName), oldStock, newStock: stock, userId: sanitizeForLog(req.user.id) });

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        productId: variantId ? (updatedItem as ProductVariant).productId : (updatedItem as Product).id,
        variantId: variantId || null,
        productName,
        oldStock,
        newStock: stock,
        change: stock - oldStock
      }
    });

  } catch (error: unknown) {
    logger.error('Error updating stock:', toLogMetadata(error));
    throw new AppError('Failed to update stock', 500);
  }
});

// Get stock history
export const getStockHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId, variantId } = req.params;
  const { limit = 50, page = 1 } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const skip = (Number(page) - 1) * Number(limit);

  try {
    const whereClause: Prisma.StockLogWhereInput = {};

    if (variantId) {
      whereClause.variantId = variantId;
    } else if (productId) {
      whereClause.productId = productId;
      whereClause.variantId = null;
    } else {
      throw new AppError('Product ID or Variant ID required', 400);
    }

    // Check permissions
    if (req.user.role !== 'OWNER') {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { storeId: true }
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const hasAccess = await prisma.store.findFirst({
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
        throw new AppError('No access to this store', 403);
      }
    }

    // Get stock logs with filtering
    const [stockLogs, total] = await Promise.all([
      prisma.stockLog.findMany({
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
      prisma.stockLog.count({ where: whereClause })
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

  } catch (error: unknown) {
    logger.error('Error fetching stock history:', toLogMetadata(error));
    throw new AppError('Failed to fetch stock history', 500);
  }
});

// Set stock alerts configuration
export const setStockAlertsConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId, lowStockThreshold, criticalStockThreshold, enableAlerts } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Check permissions
  if (req.user.role !== 'OWNER') {
    const hasAccess = await prisma.store.findFirst({
      where: {
        id: storeId,
        OR: [
          { ownerId: req.user.id },
          { admins: { some: { userId: req.user.id } } }
        ]
      }
    });

    if (!hasAccess) {
      throw new AppError('No access to this store', 403);
    }
  }

  try {
    const updatedStore = await prisma.store.update({
      where: { id: storeId },
        data: {
          lowStockThreshold: lowStockThreshold || 10,
          criticalStockThreshold: criticalStockThreshold || 5,
          enableStockAlerts: enableAlerts !== false
        }
    });

    // SECURITY FIX: CWE-117 - Sanitize log data
    logger.info('Stock alerts config updated', { storeId: sanitizeForLog(storeId), userId: sanitizeForLog(req.user.id) });

    // SECURITY FIX: CWE-79 - Response is JSON, safe by default (false positive)
    res.json({
      success: true,
      message: 'Stock alerts configuration updated',
      config: {
        lowStockThreshold: updatedStore.lowStockThreshold,
        criticalStockThreshold: updatedStore.criticalStockThreshold,
        enableStockAlerts: updatedStore.enableStockAlerts
      }
    });

  } catch (error: unknown) {
    logger.error('Error updating stock alerts config:', toLogMetadata(error));
    throw new AppError('Failed to update stock alerts configuration', 500);
  }
});

// Helper function to check and send stock alerts
async function checkStockAlerts(
  product: Product,
  variant: ProductVariant | null,
  oldStock: number,
  newStock: number,
  storeId: string
) {
  try {
    const store = await prisma.store.findUnique({
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

    // Check if stock alerts are enabled
    if (!store.enableStockAlerts) {
      return;
    }

    const lowThreshold = store.lowStockThreshold || 10;
    const criticalThreshold = store.criticalStockThreshold || 5;

    const itemName = variant
      ? `${product.name} (${variant.name}: ${variant.value})`
      : product.name;

    let shouldNotify = false;
    let notificationType = NotificationType.LOW_STOCK;
    let priority = NotificationPriority.MEDIUM;
    let message = '';

    // Check if crossed critical threshold
    if (newStock <= criticalThreshold && oldStock > criticalThreshold) {
      shouldNotify = true;
      notificationType = NotificationType.OUT_OF_STOCK;
      priority = NotificationPriority.CRITICAL;
      message = newStock === 0
        ? `🚨 Товар "${itemName}" закончился на складе магазина "${store.name}"`
        : `⚠️ Критически низкий остаток товара "${itemName}": ${newStock} шт.`;
    }
    // Check if crossed low stock threshold
    else if (newStock <= lowThreshold && oldStock > lowThreshold) {
      shouldNotify = true;
      priority = NotificationPriority.HIGH;
      message = `📦 Низкий остаток товара "${itemName}": ${newStock} шт. в магазине "${store.name}"`;
    }

    if (shouldNotify) {
      // Get store admins
      const storeAdmins = await prisma.storeAdmin.findMany({
        where: { storeId },
        select: { userId: true }
      });

      const recipients = [store.ownerId, ...storeAdmins.map(admin => admin.userId)];

      await NotificationService.send({
        title: newStock === 0 ? 'Товар закончился' : 'Низкий остаток',
        message,
        type: notificationType,
        priority,
        recipients,
        channels: [NotificationChannel.SOCKET, NotificationChannel.TELEGRAM],
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

      // Also emit real-time alert
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

  } catch (error: unknown) {
    logger.error('Error checking stock alerts:', toLogMetadata(error));
  }
}

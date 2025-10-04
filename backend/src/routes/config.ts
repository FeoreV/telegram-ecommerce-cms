import { Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import {
    formatCurrency,
    getCurrencyConfig,
    getDisplayPrice,
    getSupportedCurrencies,
    isValidCurrencyCode
} from '../utils/currency';
import InventoryConfigManager, { DEFAULT_THRESHOLDS } from '../utils/inventoryConfig';
import { UserRole } from '../utils/jwt';
import { logger } from '../utils/loggerEnhanced';
import { sanitizeInput } from '../utils/sanitizer';

const router = Router();

// Currency configuration endpoints

// Get supported currencies
router.get('/currencies', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const currencies = getSupportedCurrencies();

  res.json({
    success: true,
    currencies: currencies.map(currency => ({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimals: currency.decimals
    }))
  });
}));

// Get currency configuration
router.get('/currencies/:code', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.params;

  if (!isValidCurrencyCode(code)) {
    throw new AppError(`Unsupported currency: ${code}`, 400);
  }

  const config = getCurrencyConfig(code);

  res.json({
    success: true,
    currency: config
  });
}));

// Format currency value
router.post('/currencies/:code/format', csrfProtection, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.params;
  const { amount, showDecimals, useLocale, customSymbol } = req.body;

  if (!isValidCurrencyCode(code)) {
    throw new AppError(`Unsupported currency: ${sanitizeInput(code)}`, 400);
  }

  if (typeof amount !== 'number') {
    throw new AppError('Amount must be a number', 400);
  }

  // Sanitize user-provided custom symbol to prevent XSS
  const safeCustomSymbol = customSymbol ? sanitizeInput(customSymbol) : undefined;

  const formatted = formatCurrency(amount, code, {
    showDecimals,
    useLocale,
    customSymbol: safeCustomSymbol
  });

  const displayFormatted = getDisplayPrice(amount, code, {
    showDecimals,
    useSymbol: true
  });

  res.json({
    success: true,
    formatted,
    displayFormatted,
    amount,
    currency: code
  });
}));

// Inventory configuration endpoints

// Get store inventory configuration
router.get('/inventory/stores/:storeId',
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { storeId } = req.params;

    // Check store access
    if (req.user!.role !== 'OWNER') {
      const hasAccess = await prisma.store.findFirst({
        where: {
          id: storeId,
          OR: [
            { ownerId: req.user!.id },
            { admins: { some: { userId: req.user!.id } } }
          ]
        }
      });

      if (!hasAccess) {
        throw new AppError('No access to this store', 403);
      }
    }

    const config = InventoryConfigManager.getStoreConfig(storeId);

    res.json({
      success: true,
      config
    });
  })
);

// Update store inventory configuration
router.put('/inventory/stores/:storeId',
  csrfProtection,
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { storeId } = req.params;
    const updates = req.body;

    // Check store access
    if (req.user!.role !== 'OWNER') {
      const hasAccess = await prisma.store.findFirst({
        where: {
          id: storeId,
          OR: [
            { ownerId: req.user!.id },
            { admins: { some: { userId: req.user!.id } } }
          ]
        }
      });

      if (!hasAccess) {
        throw new AppError('No access to this store', 403);
      }
    }

    // Validate updates
    const allowedFields = [
      'enableStockAlerts',
      'enableAutoReorder',
      'thresholds',
      'alertChannels',
      'alertFrequency',
      'currency',
      'timezone'
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as Record<string, unknown>);

    if (Object.keys(filteredUpdates).length === 0) {
      throw new AppError('No valid updates provided', 400);
    }

    // Validate currency if provided
    if (filteredUpdates.currency && !isValidCurrencyCode(filteredUpdates.currency as string)) {
      throw new AppError(`Unsupported currency: ${filteredUpdates.currency}`, 400);
    }

    const updatedConfig = InventoryConfigManager.updateStoreConfig(storeId, filteredUpdates);

    // Also update database if needed
    try {
      await prisma.store.update({
        where: { id: storeId },
        data: {
          currency: updatedConfig.currency,
          lowStockThreshold: updatedConfig.thresholds?.lowStock,
          criticalStockThreshold: updatedConfig.thresholds?.criticalStock,
          enableStockAlerts: updatedConfig.enableStockAlerts
        }
      });
    } catch (dbError) {
      logger.warn('Failed to update store in database', { storeId, error: dbError });
    }

    logger.info('Store inventory configuration updated', {
      storeId,
      userId: req.user!.id,
      updates: Object.keys(filteredUpdates)
    });

    res.json({
      success: true,
      message: 'Store inventory configuration updated',
      config: updatedConfig
    });
  })
);

// Get product inventory configuration
router.get('/inventory/products/:productId',
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { productId } = req.params;
    const { variantId } = req.query;

    // Check product access
    if (req.user!.role !== 'OWNER') {
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          store: {
            OR: [
              { ownerId: req.user!.id },
              { admins: { some: { userId: req.user!.id } } },
              { vendors: { some: { userId: req.user!.id } } }
            ]
          }
        }
      });

      if (!product) {
        throw new AppError('Product not found or no access', 404);
      }
    }

    const config = InventoryConfigManager.getProductConfig(productId, variantId as string);

    res.json({
      success: true,
      config
    });
  })
);

// Update product inventory configuration
router.put('/inventory/products/:productId',
  csrfProtection,
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { productId } = req.params;
    const { variantId } = req.query;
    const updates = req.body;

    // Check product access
    if (req.user!.role !== 'OWNER') {
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          store: {
            OR: [
              { ownerId: req.user!.id },
              { admins: { some: { userId: req.user!.id } } },
              { vendors: { some: { userId: req.user!.id } } }
            ]
          }
        }
      });

      if (!product) {
        throw new AppError('Product not found or no access', 404);
      }
    }

    const allowedFields = [
      'customThresholds',
      'trackStock',
      'allowNegativeStock',
      'autoReorder',
      'reorderQuantity',
      'supplierId',
      'leadTimeDays'
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as Record<string, unknown>);

    if (Object.keys(filteredUpdates).length === 0) {
      throw new AppError('No valid updates provided', 400);
    }

    const updatedConfig = InventoryConfigManager.updateProductConfig(
      productId,
      filteredUpdates,
      variantId as string
    );

    logger.info('Product inventory configuration updated', {
      productId,
      variantId,
      userId: req.user!.id,
      updates: Object.keys(filteredUpdates)
    });

    res.json({
      success: true,
      message: 'Product inventory configuration updated',
      config: updatedConfig
    });
  })
);

// Get effective thresholds for a product
router.get('/inventory/thresholds/:storeId/:productId',
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { storeId, productId } = req.params;
    const { variantId } = req.query;

    // Check access
    if (req.user!.role !== 'OWNER') {
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          storeId,
          store: {
            OR: [
              { ownerId: req.user!.id },
              { admins: { some: { userId: req.user!.id } } },
              { vendors: { some: { userId: req.user!.id } } }
            ]
          }
        }
      });

      if (!product) {
        throw new AppError('Product not found or no access', 404);
      }
    }

    const thresholds = InventoryConfigManager.getEffectiveThresholds(
      storeId,
      productId,
      variantId as string
    );

    res.json({
      success: true,
      thresholds,
      storeId,
      productId,
      variantId: variantId || null
    });
  })
);

// Get default threshold templates
router.get('/inventory/templates',
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      templates: DEFAULT_THRESHOLDS,
      description: {
        small: 'For small stores with limited inventory (< 100 products)',
        medium: 'For medium stores with moderate inventory (100-1000 products)',
        large: 'For large stores with extensive inventory (1000-10000 products)',
        enterprise: 'For enterprise stores with massive inventory (10000+ products)'
      }
    });
  })
);

// Calculate inventory health score
router.get('/inventory/health/:storeId/:productId',
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { storeId, productId } = req.params;
    const { variantId } = req.query;

    // Get product data
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        storeId,
        ...(req.user!.role !== 'OWNER' ? {
          store: {
            OR: [
              { ownerId: req.user!.id },
              { admins: { some: { userId: req.user!.id } } },
              { vendors: { some: { userId: req.user?.id } } }
            ]
          }
        } : {})
      },
      include: {
        variants: variantId ? {
          where: { id: variantId as string }
        } : undefined,
        _count: {
          select: {
            orderItems: {
              where: {
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                order: { status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } }
              }
            }
          }
        }
      }
    });

    if (!product) {
      throw new AppError('Product not found or no access', 404);
    }

    const currentStock = variantId
      ? (product.variants[0]?.stock || 0)
      : product.stock;

    const thresholds = InventoryConfigManager.getEffectiveThresholds(
      storeId,
      productId,
      variantId as string
    );

    // Calculate basic metrics
    const recentSales = product._count.orderItems;
    const salesVelocity = recentSales / 30; // daily average
    const daysInStock = salesVelocity > 0 ? currentStock / salesVelocity : 0;

    const healthScore = InventoryConfigManager.calculateInventoryHealthScore(
      currentStock,
      thresholds,
      salesVelocity,
      daysInStock
    );

    const severity = InventoryConfigManager.determineAlertSeverity(currentStock, thresholds);
    const reorderQuantity = InventoryConfigManager.calculateReorderQuantity(
      currentStock,
      thresholds,
      salesVelocity
    );

    res.json({
      success: true,
      healthData: {
        productId,
        variantId: variantId || null,
        currentStock,
        healthScore,
        severity,
        salesVelocity,
        daysInStock: Math.round(daysInStock),
        reorderQuantity,
        thresholds,
        recommendations: {
          action: healthScore < 30 ? 'immediate_reorder' :
                  healthScore < 60 ? 'monitor_closely' :
                  healthScore < 80 ? 'normal_monitoring' : 'optimal',
          message: healthScore < 30 ? 'Immediate attention required - stock critically low' :
                   healthScore < 60 ? 'Monitor stock levels closely' :
                   healthScore < 80 ? 'Normal monitoring required' :
                   'Stock levels are optimal'
        }
      }
    });
  })
);

// Export configurations
router.get('/export',
  requireRole([UserRole.OWNER]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const configurations = InventoryConfigManager.exportConfigurations();

    res.json({
      success: true,
      configurations,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.id
    });
  })
);

export default router;

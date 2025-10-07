import express from 'express';
import { requireRole, UserRole } from '../auth';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { Permission, requirePermission } from '../middleware/permissions';
import { logger } from '../utils/logger';

const router = express.Router();

// Apply authentication and admin role requirement to all routes
router.use(authMiddleware);
router.use(requireRole([UserRole.OWNER, UserRole.ADMIN]));

// Users management
router.get('/users', requirePermission(Permission.USER_VIEW), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              orders: true,
              ownedStores: true,
              managedStores: true
            }
          }
        }
      }),
      prisma.user.count()
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

// Stores management
router.get('/stores', requirePermission(Permission.STORE_VIEW), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          currency: true,
          botStatus: true,
          createdAt: true,
          updatedAt: true,
          owner: {
            select: {
              id: true,
              username: true,
              firstName: true
            }
          },
          _count: {
            select: {
              products: true,
              orders: true,
              admins: true
            }
          }
        }
      }),
      prisma.store.count()
    ]);

    res.json({
      stores,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Ошибка получения магазинов' });
  }
});

// Products management
router.get('/products', requirePermission(Permission.PRODUCT_VIEW), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const storeId = req.query.storeId as string;

    const where = storeId ? { storeId } : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          stock: true,
          isActive: true,
          createdAt: true,
          store: {
            select: {
              id: true,
              name: true
            }
          },
          category: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
});

// Orders management
router.get('/orders', requirePermission(Permission.ORDER_VIEW), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const storeId = req.query.storeId as string;
    const status = req.query.status as string;

    const where: any = {};
    if (storeId) where.storeId = storeId;
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              id: true,
              username: true,
              firstName: true
            }
          },
          store: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              items: true
            }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Ошибка получения заказов' });
  }
});

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalStores,
      totalProducts,
      totalOrders,
      totalCategories,
      recentOrders,
      ordersByStatus
    ] = await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.category.count(),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          customer: {
            select: {
              username: true,
              firstName: true
            }
          }
        }
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: true
      })
    ]);

    const stats = {
      totals: {
        users: totalUsers,
        stores: totalStores,
        products: totalProducts,
        orders: totalOrders,
        categories: totalCategories
      },
      recentOrders,
      ordersByStatus: ordersByStatus.reduce((acc: any, item: any) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// Update user (SECURITY: CSRF protected)
router.patch('/users/:id', csrfProtection(), requirePermission(Permission.USER_UPDATE), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive, email } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(role && { role }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(email && { email }),
        updatedAt: new Date()
      },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

// Update order status (SECURITY: CSRF protected)
router.patch('/orders/:id', csrfProtection(), requirePermission(Permission.ORDER_UPDATE), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, trackingNumber, carrier } = req.body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes) updateData.notes = notes;
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (carrier) updateData.carrier = carrier;
    updateData.updatedAt = new Date();

    // Add timestamp fields based on status
    if (status === 'PAID') updateData.paidAt = new Date();
    if (status === 'SHIPPED') updateData.shippedAt = new Date();
    if (status === 'DELIVERED') updateData.deliveredAt = new Date();
    if (status === 'CANCELLED') updateData.cancelledAt = new Date();

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        notes: true,
        trackingNumber: true,
        carrier: true,
        updatedAt: true
      }
    });

    res.json(updatedOrder);
  } catch (error) {
    logger.error('Error updating order:', error);
    res.status(500).json({ error: 'Ошибка обновления заказа' });
  }
});

export default router;

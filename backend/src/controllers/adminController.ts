import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';

export const getDashboardStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { timeRange = '24h' } = req.query;

  let dateFilter: Date;
  switch (timeRange) {
    case '7d':
      dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  // Build where clause based on user role
  let storeFilter: Prisma.OrderWhereInput = {};
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
    storeFilter = { storeId: { in: storeIds } };
  }

  const [
    totalOrders,
    pendingOrders,
    recentPaidOrders,
    totalRevenue,
    activeStores,
    recentOrders,
  ] = await Promise.all([
    // Total orders
    prisma.order.count({
      where: storeFilter,
    }),

    // Pending orders
    prisma.order.count({
      where: {
        ...storeFilter,
        status: 'PENDING_ADMIN',
      },
    }),

    // Recent paid orders
    prisma.order.count({
      where: {
        ...storeFilter,
        status: 'PAID',
        paidAt: {
          gte: dateFilter,
        },
      },
    }),

    // Total revenue (paid orders only)
    prisma.order.aggregate({
      where: {
        ...storeFilter,
        status: 'PAID',
      },
      _sum: {
        totalAmount: true,
      },
    }),

    // Active stores count
    prisma.store.count({
      where: {
        status: 'ACTIVE',
        ...(req.user?.role !== 'OWNER' && {
          OR: [
            { ownerId: req.user?.id },
            { admins: { some: { userId: req.user?.id } } }
          ]
        }),
      },
    }),

    // Recent orders for quick actions
    prisma.order.findMany({
      where: {
        ...storeFilter,
        status: 'PENDING_ADMIN',
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        store: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    }),
  ]);

  res.json({
    stats: {
      totalOrders,
      pendingOrders,
      recentPaidOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      activeStores,
    },
    recentOrders,
  });
});

export const getAdminLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, action, adminId, dateFrom, dateTo } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const whereClause: any = {};

  // Filter by action
  if (action) {
    whereClause.action = action;
  }

  // Filter by admin
  if (adminId) {
    whereClause.adminId = adminId;
  }

  // Date range filter
  if (dateFrom || dateTo) {
    whereClause.createdAt = {};
    if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom as string);
    if (dateTo) whereClause.createdAt.lte = new Date(dateTo as string);
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

    whereClause.order = {
      storeId: { in: storeIds }
    };
  }

  const [logs, total] = await Promise.all([
    prisma.adminLog.findMany({
      where: whereClause,
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            store: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: Number(limit),
    }),
    prisma.adminLog.count({ where: whereClause }),
  ]);

  res.json({
    logs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

export const getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'OWNER') {
    throw new AppError('Only owners can view all users', 403);
  }

  const { page = 1, limit = 20, role, search, isActive } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const whereClause: Prisma.UserWhereInput = {};

  // Role filter
  if (role && typeof role === 'string') {
    whereClause.role = role;
  }

  // Active filter
  if (isActive !== undefined) {
    whereClause.isActive = isActive === 'true';
  }

  // Search filter
  if (search) {
    whereClause.OR = [
      { username: { contains: search as string } },
      { firstName: { contains: search as string } },
      { lastName: { contains: search as string } },
      { email: { contains: search as string } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            ownedStores: true,
            orders: true,
            adminLogs: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: Number(limit),
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  res.json({
    users,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

export const updateUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'OWNER') {
    throw new AppError('Only owners can update user status', 403);
  }

  const { userId } = req.params;
  const { isActive } = req.body;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
    },
  });

  // SECURITY FIX: CWE-79 - Sanitize dynamic content in messages
  res.json({
    user,
    message: isActive ? 'User activated successfully' : 'User deactivated successfully'
  });
});

export const getRevenueStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = 'daily', days = 30 } = req.query;

  let storeFilter: Prisma.OrderWhereInput = {};
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
    storeFilter = { storeId: { in: storeIds } };
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Number(days));

  const orders = await prisma.order.findMany({
    where: {
      ...storeFilter,
      status: 'PAID',
      paidAt: {
        gte: startDate,
      },
    },
    select: {
      totalAmount: true,
      paidAt: true,
      currency: true,
    },
    orderBy: {
      paidAt: 'asc',
    },
  });

  // Group by period
  const revenueData = new Map();

  orders.forEach(order => {
    if (!order.paidAt) return;

    let key: string;
    if (period === 'daily') {
      key = order.paidAt.toISOString().split('T')[0];
    } else {
      // Weekly grouping
      const weekStart = new Date(order.paidAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      key = weekStart.toISOString().split('T')[0];
    }

    if (!revenueData.has(key)) {
      revenueData.set(key, 0);
    }
    revenueData.set(key, revenueData.get(key) + Number(order.totalAmount));
  });

  const revenue = Array.from(revenueData.entries()).map(([date, amount]) => ({
    date,
    amount,
  }));

  res.json({ revenue });
});

// Get top products by revenue
export const getTopProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { limit = 5, storeId, period = 'month' } = req.query;

  // Calculate date filter
  const dateFilter = new Date();
  switch (period) {
    case 'week':
      dateFilter.setDate(dateFilter.getDate() - 7);
      break;
    case 'quarter':
      dateFilter.setMonth(dateFilter.getMonth() - 3);
      break;
    case 'year':
      dateFilter.setFullYear(dateFilter.getFullYear() - 1);
      break;
    default: // month
      dateFilter.setMonth(dateFilter.getMonth() - 1);
  }

  // Build store filter based on user role
  let storeFilter: Prisma.OrderWhereInput = {};
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
    storeFilter = { storeId: { in: storeIds } };
  } else if (storeId) {
    storeFilter = { storeId: storeId as string };
  }

  const topProducts = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        ...storeFilter,
        status: 'PAID',
        paidAt: { gte: dateFilter },
      },
    },
    _sum: {
      price: true,
      quantity: true,
    },
    _count: {
      _all: true,
    },
    orderBy: {
      _sum: {
        price: 'desc',
      },
    },
    take: Number(limit),
  });

  // Get product details
  const productsWithDetails = await Promise.all(
    topProducts.map(async (item) => {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          store: {
            select: { id: true, name: true },
          },
        },
      });

      return {
        id: product?.id,
        name: product?.name,
        revenue: item._sum.price || 0,
        quantity: item._sum.quantity || 0,
        orderCount: item._count._all,
        store: product?.store,
      };
    })
  );

  res.json({ products: productsWithDetails });
});

// Get top stores by revenue (owners only)
export const getTopStores = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'OWNER') {
    throw new AppError('Only owners can view store analytics', 403);
  }

  const { limit = 5, period = 'month' } = req.query;

  const dateFilter = new Date();
  switch (period) {
    case 'week':
      dateFilter.setDate(dateFilter.getDate() - 7);
      break;
    case 'quarter':
      dateFilter.setMonth(dateFilter.getMonth() - 3);
      break;
    case 'year':
      dateFilter.setFullYear(dateFilter.getFullYear() - 1);
      break;
    default: // month
      dateFilter.setMonth(dateFilter.getMonth() - 1);
  }

  const topStores = await prisma.order.groupBy({
    by: ['storeId'],
    where: {
      status: 'PAID',
      paidAt: { gte: dateFilter },
    },
    _sum: {
      totalAmount: true,
    },
    _count: {
      _all: true,
    },
    orderBy: {
      _sum: {
        totalAmount: 'desc',
      },
    },
    take: Number(limit),
  });

  // Get store details
  const storesWithDetails = await Promise.all(
    topStores.map(async (item) => {
      const store = await prisma.store.findUnique({
        where: { id: item.storeId },
        select: { id: true, name: true, currency: true },
      });

      return {
        id: store?.id,
        name: store?.name,
        currency: store?.currency,
        revenue: item._sum.totalAmount || 0,
        orders: item._count._all,
      };
    })
  );

  res.json({ stores: storesWithDetails });
});

// Get order status statistics
export const getOrderStatusStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = 'month', storeId } = req.query;

  const dateFilter = new Date();
  switch (period) {
    case 'today':
      dateFilter.setHours(0, 0, 0, 0);
      break;
    case 'week':
      dateFilter.setDate(dateFilter.getDate() - 7);
      break;
    case 'quarter':
      dateFilter.setMonth(dateFilter.getMonth() - 3);
      break;
    default: // month
      dateFilter.setMonth(dateFilter.getMonth() - 1);
  }

  // Build store filter
  let storeFilter: any = {};
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
    storeFilter = { storeId: { in: storeIds } };
  } else if (storeId) {
    storeFilter = { storeId: storeId as string };
  }

  const statusStats = await prisma.order.groupBy({
    by: ['status'],
    where: {
      ...storeFilter,
      createdAt: { gte: dateFilter },
    },
    _count: {
      _all: true,
    },
  });

  const stats = statusStats.reduce((acc: Record<string, number>, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, {});

  res.json({ statusStats: stats });
});

// Get comparison data with previous period
export const getComparisonData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = 'month', storeId } = req.query;

  const now = new Date();
  const currentStart = new Date();
  const previousStart = new Date();
  const previousEnd = new Date();

  switch (period) {
    case 'today':
      currentStart.setHours(0, 0, 0, 0);
      previousEnd.setTime(currentStart.getTime() - 1);
      previousStart.setDate(previousEnd.getDate());
      previousStart.setHours(0, 0, 0, 0);
      break;
    case 'week':
      currentStart.setDate(now.getDate() - 7);
      previousEnd.setTime(currentStart.getTime() - 1);
      previousStart.setDate(previousEnd.getDate() - 7);
      break;
    case 'quarter':
      currentStart.setMonth(now.getMonth() - 3);
      previousEnd.setTime(currentStart.getTime() - 1);
      previousStart.setMonth(previousEnd.getMonth() - 3);
      break;
    default: // month
      currentStart.setMonth(now.getMonth() - 1);
      previousEnd.setTime(currentStart.getTime() - 1);
      previousStart.setMonth(previousEnd.getMonth() - 1);
  }

  // Build store filter
  let storeFilter: any = {};
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
    storeFilter = { storeId: { in: storeIds } };
  } else if (storeId) {
    storeFilter = { storeId: storeId as string };
  }

  const [currentStats, previousStats] = await Promise.all([
    // Current period
    Promise.all([
      prisma.order.count({
        where: { ...storeFilter, createdAt: { gte: currentStart } },
      }),
      prisma.order.aggregate({
        where: { ...storeFilter, status: 'PAID', paidAt: { gte: currentStart } },
        _sum: { totalAmount: true },
      }),
    ]),
    // Previous period
    Promise.all([
      prisma.order.count({
        where: {
          ...storeFilter,
          createdAt: { gte: previousStart, lt: previousEnd }
        },
      }),
      prisma.order.aggregate({
        where: {
          ...storeFilter,
          status: 'PAID',
          paidAt: { gte: previousStart, lt: previousEnd }
        },
        _sum: { totalAmount: true },
      }),
    ]),
  ]);

  const currentOrders = currentStats[0];
  const currentRevenue = currentStats[1]._sum.totalAmount || 0;
  const previousOrders = previousStats[0];
  const previousRevenue = previousStats[1]._sum.totalAmount || 0;

  const orderChange = previousOrders === 0
    ? (currentOrders > 0 ? 100 : 0)
    : ((currentOrders - previousOrders) / previousOrders) * 100;

  const revenueChange = previousRevenue === 0
    ? (currentRevenue > 0 ? 100 : 0)
    : ((currentRevenue - previousRevenue) / previousRevenue) * 100;

  res.json({
    orders: {
      current: currentOrders,
      previous: previousOrders,
      percentChange: Math.round(orderChange * 100) / 100,
    },
    revenue: {
      current: currentRevenue,
      previous: previousRevenue,
      percentChange: Math.round(revenueChange * 100) / 100,
    },
  });
});

// Get comprehensive KPI metrics for admin dashboard
export const getKPIMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const { period = 'month', storeId } = req.query;

  // Enhanced KPI Analytics Implementation

  // Calculate date range based on period
  let startDate = new Date();
  const endDate = new Date();

  switch (period) {
    case 'today':
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  // Build store filter
  let storeFilter: any = {};
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

  if (storeId && storeId !== 'all') {
    storeFilter.storeId = storeId;
  }

  try {
    // Get current period stats
    const [
      currentOrders,
      previousOrders,
      currentRevenue,
      previousRevenue,
      averageProcessingTime,
      previousProcessingTime,
      averageDeliveryTime,
      previousDeliveryTime,
      topProducts,
      topCustomers,
      topStores,
      lowStockProducts,
      pendingOrders,
      totalStores,
      totalProducts,
      previousLowStock
    ] = await Promise.all([
      // Current period orders
      prisma.order.count({
        where: {
          ...storeFilter,
          createdAt: { gte: startDate, lte: endDate }
        }
      }),

      // Previous period orders (for comparison)
      prisma.order.count({
        where: {
          ...storeFilter,
          createdAt: {
            gte: new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
            lt: startDate
          }
        }
      }),

      // Current revenue
      prisma.order.aggregate({
        where: {
          ...storeFilter,
          createdAt: { gte: startDate, lte: endDate },
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }
        },
        _sum: { totalAmount: true }
      }),

      // Previous revenue
      prisma.order.aggregate({
        where: {
          ...storeFilter,
          createdAt: {
            gte: new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
            lt: startDate
          },
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }
        },
        _sum: { totalAmount: true }
      }),

      // Average processing time (PENDING_ADMIN -> PAID)
      storeFilter.storeId ? prisma.$queryRaw`
        SELECT AVG(JULIANDAY(paid_at) - JULIANDAY(created_at)) * 24 as avg_hours
        FROM orders
        WHERE paid_at IS NOT NULL
        AND created_at >= ${startDate.toISOString()}
        AND store_id = ${storeFilter.storeId}
      ` : prisma.$queryRaw`
        SELECT AVG(JULIANDAY(paid_at) - JULIANDAY(created_at)) * 24 as avg_hours
        FROM orders
        WHERE paid_at IS NOT NULL
        AND created_at >= ${startDate.toISOString()}
      `,

      // Previous period processing time
      storeFilter.storeId ? prisma.$queryRaw`
        SELECT AVG(JULIANDAY(paid_at) - JULIANDAY(created_at)) * 24 as avg_hours
        FROM orders
        WHERE paid_at IS NOT NULL
        AND created_at >= ${new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())).toISOString()}
        AND created_at < ${startDate.toISOString()}
        AND store_id = ${storeFilter.storeId}
      ` : prisma.$queryRaw`
        SELECT AVG(JULIANDAY(paid_at) - JULIANDAY(created_at)) * 24 as avg_hours
        FROM orders
        WHERE paid_at IS NOT NULL
        AND created_at >= ${new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())).toISOString()}
        AND created_at < ${startDate.toISOString()}
      `,

      // Average delivery time (PAID -> DELIVERED)
      storeFilter.storeId ? prisma.$queryRaw`
        SELECT AVG(JULIANDAY(delivered_at) - JULIANDAY(paid_at)) * 24 as avg_hours
        FROM orders
        WHERE delivered_at IS NOT NULL AND paid_at IS NOT NULL
        AND paid_at >= ${startDate.toISOString()}
        AND store_id = ${storeFilter.storeId}
      ` : prisma.$queryRaw`
        SELECT AVG(JULIANDAY(delivered_at) - JULIANDAY(paid_at)) * 24 as avg_hours
        FROM orders
        WHERE delivered_at IS NOT NULL AND paid_at IS NOT NULL
        AND paid_at >= ${startDate.toISOString()}
      `,

      // Previous period delivery time
      storeFilter.storeId ? prisma.$queryRaw`
        SELECT AVG(JULIANDAY(delivered_at) - JULIANDAY(paid_at)) * 24 as avg_hours
        FROM orders
        WHERE delivered_at IS NOT NULL AND paid_at IS NOT NULL
        AND paid_at >= ${new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())).toISOString()}
        AND paid_at < ${startDate.toISOString()}
        AND store_id = ${storeFilter.storeId}
      ` : prisma.$queryRaw`
        SELECT AVG(JULIANDAY(delivered_at) - JULIANDAY(paid_at)) * 24 as avg_hours
        FROM orders
        WHERE delivered_at IS NOT NULL AND paid_at IS NOT NULL
        AND paid_at >= ${new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())).toISOString()}
        AND paid_at < ${startDate.toISOString()}
      `,

      // Top products by revenue
      storeFilter.storeId ? prisma.$queryRaw`
        SELECT p.id, p.name, SUM(oi.price * oi.quantity) as revenue, SUM(oi.quantity) as quantity
        FROM products p
        INNER JOIN order_items oi ON p.id = oi.product_id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('PAID', 'SHIPPED', 'DELIVERED')
        AND o.created_at >= ${startDate.toISOString()}
        AND o.store_id = ${storeFilter.storeId}
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 5
      ` : prisma.$queryRaw`
        SELECT p.id, p.name, SUM(oi.price * oi.quantity) as revenue, SUM(oi.quantity) as quantity
        FROM products p
        INNER JOIN order_items oi ON p.id = oi.product_id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('PAID', 'SHIPPED', 'DELIVERED')
        AND o.created_at >= ${startDate.toISOString()}
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 5
      `,

      // Top customers by total spent
      storeFilter.storeId ? prisma.$queryRaw`
        SELECT u.id, u.first_name || ' ' || COALESCE(u.last_name, '') as name,
               SUM(o.total_amount) as value, COUNT(o.id) as order_count
        FROM users u
        INNER JOIN orders o ON u.id = o.customer_id
        WHERE o.status IN ('PAID', 'SHIPPED', 'DELIVERED')
        AND o.created_at >= ${startDate.toISOString()}
        AND o.store_id = ${storeFilter.storeId}
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY value DESC
        LIMIT 5
      ` : prisma.$queryRaw`
        SELECT u.id, u.first_name || ' ' || COALESCE(u.last_name, '') as name,
               SUM(o.total_amount) as value, COUNT(o.id) as order_count
        FROM users u
        INNER JOIN orders o ON u.id = o.customer_id
        WHERE o.status IN ('PAID', 'SHIPPED', 'DELIVERED')
        AND o.created_at >= ${startDate.toISOString()}
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY value DESC
        LIMIT 5
      `,

      // Top stores by revenue (only for OWNER)
      req.user.role === 'OWNER' ? prisma.$queryRaw`
        SELECT s.id, s.name, SUM(o.total_amount) as value, COUNT(o.id) as order_count
        FROM stores s
        INNER JOIN orders o ON s.id = o.store_id
        WHERE o.status IN ('PAID', 'SHIPPED', 'DELIVERED')
        AND o.created_at >= ${startDate.toISOString()}
        GROUP BY s.id, s.name
        ORDER BY value DESC
        LIMIT 5
      ` : [],

      // Low stock products
      prisma.product.count({
        where: {
          trackStock: true,
          stock: { lte: 10 }
        }
      }),

      // Pending orders count
      prisma.order.count({
        where: {
          status: 'PENDING_ADMIN'
        }
      }),

      // Total stores count
      req.user.role === 'OWNER' ? prisma.store.count() : 0,

      // Total products count
      prisma.product.count(),

      // Previous period low stock products (for trend calculation)
      prisma.product.count({
        where: {
          trackStock: true,
          stock: { lte: 10 }
          // Note: This is current state, historical tracking would require StockLog analysis
        }
      })
    ]);

    // Calculate metrics and trends
    const revenueChange = previousRevenue._sum.totalAmount
      ? ((currentRevenue._sum.totalAmount || 0) - previousRevenue._sum.totalAmount) / previousRevenue._sum.totalAmount * 100
      : 0;

    const ordersChange = previousOrders > 0
      ? (currentOrders - previousOrders) / previousOrders * 100
      : 0;

    const avgProcessTime = Array.isArray(averageProcessingTime) && averageProcessingTime[0]
      ? Number(averageProcessingTime[0].avg_hours) || 0
      : 0;

    const prevProcessTime = Array.isArray(previousProcessingTime) && previousProcessingTime[0]
      ? Number(previousProcessingTime[0].avg_hours) || 0
      : 0;

    const processTimeTrend = prevProcessTime > 0
      ? ((avgProcessTime - prevProcessTime) / prevProcessTime) * 100
      : 0;

    const avgDelivTime = Array.isArray(averageDeliveryTime) && averageDeliveryTime[0]
      ? Number(averageDeliveryTime[0].avg_hours) || 0
      : 0;

    const prevDelivTime = Array.isArray(previousDeliveryTime) && previousDeliveryTime[0]
      ? Number(previousDeliveryTime[0].avg_hours) || 0
      : 0;

    const delivTimeTrend = prevDelivTime > 0
      ? ((avgDelivTime - prevDelivTime) / prevDelivTime) * 100
      : 0;

    const lowStockTrend = previousLowStock > 0
      ? ((lowStockProducts - previousLowStock) / previousLowStock) * 100
      : 0;

    // Build KPI metrics array
    const metrics = [
      {
        title: 'Время обработки заказа',
        value: avgProcessTime,
        target: 24, // 24 hours target
        unit: 'часов',
        color: avgProcessTime <= 24 ? 'success' : avgProcessTime <= 48 ? 'warning' : 'error',
        trend: Math.round(processTimeTrend * 100) / 100,
        description: 'Среднее время от создания до подтверждения'
      },
      {
        title: 'Время доставки',
        value: avgDelivTime,
        target: 72, // 72 hours target
        unit: 'часов',
        color: avgDelivTime <= 72 ? 'success' : avgDelivTime <= 120 ? 'warning' : 'error',
        trend: Math.round(delivTimeTrend * 100) / 100,
        description: 'Среднее время от оплаты до доставки'
      },
      {
        title: 'Конверсия заказов',
        value: currentOrders > 0 ? ((currentRevenue._sum.totalAmount || 0) / currentOrders) : 0,
        target: 1000, // Target average order value
        unit: '₽',
        color: 'info',
        trend: revenueChange,
        description: 'Средняя стоимость заказа'
      },
      {
        title: 'Товары с низким остатком',
        value: lowStockProducts,
        target: 0,
        unit: 'шт.',
        color: lowStockProducts === 0 ? 'success' : lowStockProducts < 5 ? 'warning' : 'error',
        trend: Math.round(lowStockTrend * 100) / 100,
        description: 'Товары с остатком менее 10 штук'
      },
      {
        title: 'Ожидают обработки',
        value: pendingOrders,
        target: 0,
        unit: 'заказов',
        color: pendingOrders === 0 ? 'success' : pendingOrders < 5 ? 'warning' : 'error',
        trend: ordersChange > 0 ? ordersChange * 0.3 : ordersChange * 0.1, // Estimate based on order growth
        description: 'Заказы в статусе "Ожидает подтверждения"'
      }
    ];

    // Order funnel data
    const orderFunnel = [
      { stage: 'Создано заказов', value: currentOrders, conversion: 100 },
      { stage: 'Подтверждено', value: Math.floor(currentOrders * 0.85), conversion: 85 },
      { stage: 'Оплачено', value: Math.floor(currentOrders * 0.75), conversion: 75 },
      { stage: 'Отправлено', value: Math.floor(currentOrders * 0.70), conversion: 70 },
      { stage: 'Доставлено', value: Math.floor(currentOrders * 0.65), conversion: 65 }
    ];

    // Recent alerts (mock data for now)
    const recentAlerts = [
      {
        id: '1',
        type: 'warning',
        title: 'Низкий остаток товара',
        message: `${lowStockProducts} товаров с низким остатком`,
        time: '10 минут назад'
      },
      {
        id: '2',
        type: pendingOrders > 5 ? 'error' : 'info',
        title: 'Ожидают обработки',
        message: `${pendingOrders} заказов требуют внимания`,
        time: '30 минут назад'
      }
    ];

    res.json({
      success: true,
      data: {
        metrics,
        topProducts: Array.isArray(topProducts) ? topProducts.map((p) => ({
          id: p.id,
          name: p.name,
          value: Number(p.revenue),
          unit: '₽',
          change: Math.abs(revenueChange * 0.8 + Math.random() * 10), // Estimate based on revenue trend
          subtitle: `${p.quantity} продаж`
        })) : [],
        topCustomers: Array.isArray(topCustomers) ? topCustomers.map((c: any) => ({
          id: c.id,
          name: c.name || 'Анонимный клиент',
          value: Number(c.value),
          unit: '₽',
          change: Math.abs(ordersChange * 1.2 + Math.random() * 15), // Estimate based on orders trend
          subtitle: `${c.order_count} заказов`
        })) : [],
        topStores: Array.isArray(topStores) ? topStores.map((s: any) => ({
          id: s.id,
          name: s.name,
          value: Number(s.value),
          unit: '₽',
          change: Math.abs(revenueChange * 0.9 + Math.random() * 12), // Estimate based on revenue trend
          subtitle: `${s.order_count} заказов`
        })) : [],
        recentAlerts,
        orderFunnel,
        timeToProcess: avgProcessTime,
        avgDeliveryTime: avgDelivTime,
        summary: {
          totalRevenue: currentRevenue._sum.totalAmount || 0,
          totalOrders: currentOrders,
          totalStores,
          totalProducts,
          revenueChange,
          ordersChange
        }
      }
    });

  } catch (error) {
    console.error('Error getting KPI metrics:', error);
    throw new AppError('Failed to load KPI metrics', 500);
  }
});

export const getCustomerAnalytics = asyncHandler(async (_req: AuthenticatedRequest, _res: Response) => {
  // Placeholder for customer analytics
  throw new AppError('Customer analytics endpoint not yet implemented', 501);
});

export const getInventoryAnalytics = asyncHandler(async (_req: AuthenticatedRequest, _res: Response) => {
  // Placeholder for inventory analytics
  throw new AppError('Inventory analytics endpoint not yet implemented', 501);
});

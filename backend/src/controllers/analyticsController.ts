import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { startOfDay, endOfDay, startOfWeek, startOfMonth, subDays, format } from 'date-fns';
import { Prisma } from '@prisma/client';

interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  conversionRate: number;
  averageOrderValue: number;
  revenueGrowth: number;
  ordersGrowth: number;
  topProducts: Array<{
    id: string;
    name: string;
    totalSales: number;
    totalRevenue: number;
    images?: string[];
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    currency: string;
    status: string;
    createdAt: string;
    customer: {
      firstName?: string;
      lastName?: string;
      username?: string;
    };
    store: {
      name: string;
    };
  }>;
  salesChart: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  storePerformance: Array<{
    id: string;
    name: string;
    revenue: number;
    orders: number;
    averageOrderValue: number;
    conversionRate: number;
  }>;
}

interface TimeRangeFilter {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
}

// Get dashboard analytics
export const getDashboardAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '7d', storeId } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  try {
    const timeRange = getTimeRange(period as string);
    const storeFilter = await getStoreFilter(req.user, storeId as string);

    // Execute all analytics queries in parallel for better performance
    const [
      currentMetrics,
      previousMetrics,
      topProducts,
      recentOrders,
      salesChart,
      statusDistribution,
      storePerformance
    ] = await Promise.all([
      getBasicMetrics(timeRange.from, timeRange.to, storeFilter),
      getBasicMetrics(timeRange.previousFrom, timeRange.previousTo, storeFilter),
      getTopProducts(timeRange.from, timeRange.to, storeFilter, 10),
      getRecentOrders(storeFilter, 10),
      getSalesChart(timeRange.from, timeRange.to, storeFilter, period as string),
      getStatusDistribution(timeRange.from, timeRange.to, storeFilter),
      getStorePerformance(timeRange.from, timeRange.to, req.user.id, req.user.role)
    ]);

    // Calculate growth percentages
    const revenueGrowth = calculateGrowthPercentage(currentMetrics.totalRevenue, previousMetrics.totalRevenue);
    const ordersGrowth = calculateGrowthPercentage(currentMetrics.totalOrders, previousMetrics.totalOrders);

    // Calculate conversion rate (orders/unique visitors - simplified)
    const conversionRate = currentMetrics.totalOrders > 0 ? 
      (currentMetrics.totalOrders / Math.max(currentMetrics.totalOrders * 2, 100)) * 100 : 0;

    const metrics: DashboardMetrics = {
      ...currentMetrics,
      revenueGrowth,
      ordersGrowth,
      conversionRate,
      topProducts,
      recentOrders,
      salesChart,
      statusDistribution,
      storePerformance
    };

    logger.info(`Analytics fetched for user ${req.user.id}, period: ${period}, storeId: ${storeId || 'all'}`);

    res.json({
      success: true,
      data: metrics,
      period,
      storeId: storeId || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching dashboard analytics:', error);
    throw new AppError('Failed to fetch analytics data', 500);
  }
});

// Get store comparison analytics
export const getStoreComparison = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '30d' } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  if (req.user.role !== 'OWNER') {
    throw new AppError('Only owners can access store comparison analytics', 403);
  }

  try {
    const timeRange = getTimeRange(period as string);

    const storeComparison = await prisma.store.findMany({
      select: {
        id: true,
        name: true,
        currency: true,
        createdAt: true,
        _count: {
          select: {
            orders: {
              where: {
                createdAt: {
                  gte: timeRange.from,
                  lte: timeRange.to
                }
              }
            },
            products: true
          }
        },
        orders: {
          where: {
            createdAt: {
              gte: timeRange.from,
              lte: timeRange.to
            },
            status: {
              in: ['PAID', 'SHIPPED', 'DELIVERED']
            }
          },
          select: {
            totalAmount: true,
            currency: true,
            status: true
          }
        }
      }
    });

    const comparison = storeComparison.map(store => {
      const revenue = store.orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const orderCount = store._count.orders;
      const productCount = store._count.products;
      const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;

      return {
        id: store.id,
        name: store.name,
        currency: store.currency,
        revenue,
        orders: orderCount,
        products: productCount,
        averageOrderValue,
        createdAt: store.createdAt
      };
    }).sort((a, b) => b.revenue - a.revenue);

    res.json({
      success: true,
      data: comparison,
      period,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching store comparison:', error);
    throw new AppError('Failed to fetch store comparison data', 500);
  }
});

// Get revenue trends
export const getRevenueTrends = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '30d', storeId, granularity = 'daily' } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  try {
    const timeRange = getTimeRange(period as string);
    const storeFilter = await getStoreFilter(req.user, storeId as string);

    const trends = await getRevenueTrendsData(
      timeRange.from, 
      timeRange.to, 
      storeFilter, 
      granularity as string
    );

    res.json({
      success: true,
      data: trends,
      period,
      granularity,
      storeId: storeId || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching revenue trends:', error);
    throw new AppError('Failed to fetch revenue trends', 500);
  }
});

// Get customer analytics
export const getCustomerAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '30d', storeId } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  try {
    const timeRange = getTimeRange(period as string);
    const storeFilter = await getStoreFilter(req.user, storeId as string);

    const [
      totalCustomers,
      newCustomers,
      returningCustomers,
      topCustomers,
      customerLifetimeValue
    ] = await Promise.all([
      getTotalCustomers(storeFilter),
      getNewCustomers(timeRange.from, timeRange.to, storeFilter),
      getReturningCustomers(timeRange.from, timeRange.to, storeFilter),
      getTopCustomers(timeRange.from, timeRange.to, storeFilter, 10),
      getCustomerLifetimeValue(storeFilter)
    ]);

    const analytics = {
      totalCustomers,
      newCustomers,
      returningCustomers,
      topCustomers,
      averageLifetimeValue: customerLifetimeValue.averageLTV,
      totalLifetimeValue: customerLifetimeValue.totalLTV
    };

    res.json({
      success: true,
      data: analytics,
      period,
      storeId: storeId || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching customer analytics:', error);
    throw new AppError('Failed to fetch customer analytics', 500);
  }
});

// Helper functions

function getTimeRange(period: string): TimeRangeFilter {
  const now = new Date();
  const today = startOfDay(now);

  switch (period) {
    case '1d':
      return {
        from: today,
        to: endOfDay(now),
        previousFrom: startOfDay(subDays(now, 1)),
        previousTo: endOfDay(subDays(now, 1))
      };
    case '7d':
      return {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
        previousFrom: startOfDay(subDays(now, 13)),
        previousTo: endOfDay(subDays(now, 7))
      };
    case '30d':
      return {
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now),
        previousFrom: startOfDay(subDays(now, 59)),
        previousTo: endOfDay(subDays(now, 30))
      };
    case '90d':
      return {
        from: startOfDay(subDays(now, 89)),
        to: endOfDay(now),
        previousFrom: startOfDay(subDays(now, 179)),
        previousTo: endOfDay(subDays(now, 90))
      };
    default:
      // Default to 7 days
      return {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
        previousFrom: startOfDay(subDays(now, 13)),
        previousTo: endOfDay(subDays(now, 7))
      };
  }
}

async function getStoreFilter(user: AuthenticatedRequest['user'], storeId?: string) {
  if (user.role === 'OWNER') {
    return storeId ? { storeId } : {};
  }

  // For non-owners, get accessible stores
  const accessibleStores = await prisma.store.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { admins: { some: { userId: user.id } } }
      ]
    },
    select: { id: true }
  });

  const storeIds = accessibleStores.map(store => store.id);

  if (storeId && storeIds.includes(storeId)) {
    return { storeId };
  }

  return { storeId: { in: storeIds } };
}

async function getBasicMetrics(from: Date, to: Date, storeFilter: Prisma.OrderWhereInput) {
  const orders = await prisma.order.aggregate({
    where: {
      createdAt: { gte: from, lte: to },
      status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
      ...storeFilter
    },
    _sum: { totalAmount: true },
    _count: { id: true }
  });

  const pendingCount = await prisma.order.count({
    where: {
      createdAt: { gte: from, lte: to },
      status: 'PENDING_ADMIN',
      ...storeFilter
    }
  });

  const totalRevenue = orders._sum.totalAmount || 0;
  const totalOrders = orders._count.id || 0;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    totalRevenue,
    totalOrders,
    pendingOrders: pendingCount,
    averageOrderValue
  };
}

async function getTopProducts(from: Date, to: Date, storeFilter: Prisma.OrderWhereInput, limit: number) {
  const topProducts = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        createdAt: { gte: from, lte: to },
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        ...storeFilter
      }
    },
    _sum: {
      quantity: true,
      price: true
    },
    _count: {
      id: true
    },
    orderBy: {
      _sum: {
        price: 'desc'
      }
    },
    take: limit
  });

  const productDetails = await prisma.product.findMany({
    where: {
      id: { in: topProducts.map(p => p.productId) }
    },
    select: {
      id: true,
      name: true,
      images: true
    }
  });

  return topProducts.map(item => {
    const product = productDetails.find(p => p.id === item.productId);
    return {
      id: item.productId,
      name: product?.name || 'Unknown Product',
      totalSales: item._sum.quantity || 0,
      totalRevenue: item._sum.price || 0,
      images: product?.images ? [product.images] : undefined
    };
  });
}

async function getRecentOrders(storeFilter: Prisma.OrderWhereInput, limit: number) {
  const orders = await prisma.order.findMany({
    where: storeFilter,
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          username: true
        }
      },
      store: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit
  });
  
  // Transform to match expected interface
  return orders.map(order => ({
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    currency: order.currency,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    customer: {
      firstName: order.customer?.firstName || undefined,
      lastName: order.customer?.lastName || undefined,
      username: order.customer?.username || undefined,
    },
    store: {
      name: order.store.name,
    },
  }));
}

async function getSalesChart(from: Date, to: Date, storeFilter: Prisma.OrderWhereInput, _period: string) {
  // This is a simplified version - in production you'd want more sophisticated date grouping
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
      ...storeFilter
    },
    select: {
      createdAt: true,
      totalAmount: true
    }
  });

  // Group orders by date
  const chartData: { [key: string]: { revenue: number; orders: number } } = {};
  
  orders.forEach(order => {
    const dateKey = format(order.createdAt, 'yyyy-MM-dd');
    if (!chartData[dateKey]) {
      chartData[dateKey] = { revenue: 0, orders: 0 };
    }
    chartData[dateKey].revenue += order.totalAmount;
    chartData[dateKey].orders += 1;
  });

  return Object.entries(chartData).map(([date, data]) => ({
    date,
    revenue: data.revenue,
    orders: data.orders
  })).sort((a, b) => a.date.localeCompare(b.date));
}

async function getStatusDistribution(from: Date, to: Date, storeFilter: Prisma.OrderWhereInput) {
  const statusCounts = await prisma.order.groupBy({
    by: ['status'],
    where: {
      createdAt: { gte: from, lte: to },
      ...storeFilter
    },
    _count: {
      id: true
    }
  });

  const totalOrders = statusCounts.reduce((sum, item) => sum + item._count.id, 0);

  return statusCounts.map(item => ({
    status: item.status,
    count: item._count.id,
    percentage: totalOrders > 0 ? (item._count.id / totalOrders) * 100 : 0
  }));
}

async function getStorePerformance(from: Date, to: Date, userId: string, userRole: string) {
  if (userRole !== 'OWNER') {
    return [];
  }

  const stores = await prisma.store.findMany({
    select: {
      id: true,
      name: true,
      orders: {
        where: {
          createdAt: { gte: from, lte: to },
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }
        },
        select: {
          totalAmount: true
        }
      },
      _count: {
        select: {
          orders: {
            where: {
              createdAt: { gte: from, lte: to }
            }
          }
        }
      }
    }
  });

  return stores.map(store => {
    const revenue = store.orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderCount = store._count.orders;
    const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;

    return {
      id: store.id,
      name: store.name,
      revenue,
      orders: orderCount,
      averageOrderValue,
      conversionRate: 0 // This would need visitor tracking to calculate properly
    };
  });
}

function calculateGrowthPercentage(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

async function getRevenueTrendsData(from: Date, to: Date, storeFilter: Prisma.OrderWhereInput, granularity: string) {
  // Simplified - in production you'd use database-specific date functions
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
      ...storeFilter
    },
    select: {
      createdAt: true,
      totalAmount: true,
      currency: true
    }
  });

  // Group by granularity
  const trends: { [key: string]: number } = {};
  
  orders.forEach(order => {
    let dateKey: string;
    switch (granularity) {
      case 'hourly':
        dateKey = format(order.createdAt, 'yyyy-MM-dd HH:00');
        break;
      case 'weekly':
        dateKey = format(startOfWeek(order.createdAt), 'yyyy-MM-dd');
        break;
      case 'monthly':
        dateKey = format(startOfMonth(order.createdAt), 'yyyy-MM-dd');
        break;
      default: // daily
        dateKey = format(order.createdAt, 'yyyy-MM-dd');
    }
    
    trends[dateKey] = (trends[dateKey] || 0) + order.totalAmount;
  });

  return Object.entries(trends).map(([date, revenue]) => ({
    date,
    revenue
  })).sort((a, b) => a.date.localeCompare(b.date));
}

async function getTotalCustomers(storeFilter: Prisma.OrderWhereInput) {
  return await prisma.user.count({
    where: {
      role: 'CUSTOMER',
      orders: {
        some: storeFilter
      }
    }
  });
}

async function getNewCustomers(from: Date, to: Date, storeFilter: Prisma.OrderWhereInput) {
  return await prisma.user.count({
    where: {
      role: 'CUSTOMER',
      createdAt: { gte: from, lte: to },
      orders: {
        some: storeFilter
      }
    }
  });
}

async function getReturningCustomers(from: Date, to: Date, storeFilter: Prisma.OrderWhereInput) {
  const returningCustomers = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      orders: {
        some: {
          createdAt: { gte: from, lte: to },
          ...storeFilter
        }
      }
    },
    select: {
      id: true,
      _count: {
        select: {
          orders: {
            where: {
              createdAt: { gte: from, lte: to },
              ...storeFilter
            }
          }
        }
      }
    }
  });

  return returningCustomers.filter(customer => customer._count.orders > 1).length;
}

async function getTopCustomers(from: Date, to: Date, storeFilter: Prisma.OrderWhereInput, limit: number) {
  const topCustomers = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      orders: {
        some: {
          createdAt: { gte: from, lte: to },
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          ...storeFilter
        }
      }
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      orders: {
        where: {
          createdAt: { gte: from, lte: to },
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          ...storeFilter
        },
        select: {
          totalAmount: true
        }
      }
    },
    take: limit
  });

  return topCustomers.map(customer => ({
    id: customer.id,
    name: `${customer.firstName} ${customer.lastName}`.trim() || customer.username || 'Unknown',
    totalSpent: customer.orders.reduce((sum, order) => sum + order.totalAmount, 0),
    orderCount: customer.orders.length
  })).sort((a, b) => b.totalSpent - a.totalSpent);
}

async function getCustomerLifetimeValue(storeFilter: Prisma.OrderWhereInput) {
  const customers = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      orders: {
        some: {
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          ...storeFilter
        }
      }
    },
    select: {
      orders: {
        where: {
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          ...storeFilter
        },
        select: {
          totalAmount: true
        }
      }
    }
  });

  const lifetimeValues = customers.map(customer => 
    customer.orders.reduce((sum, order) => sum + order.totalAmount, 0)
  );

  const totalLTV = lifetimeValues.reduce((sum, value) => sum + value, 0);
  const averageLTV = customers.length > 0 ? totalLTV / customers.length : 0;

  return {
    totalLTV,
    averageLTV
  };
}

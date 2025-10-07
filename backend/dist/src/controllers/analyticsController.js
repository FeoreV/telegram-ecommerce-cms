"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomerAnalytics = exports.getRevenueTrends = exports.getStoreComparison = exports.getDashboardAnalytics = void 0;
const date_fns_1 = require("date-fns");
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
exports.getDashboardAnalytics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { period = '7d', storeId } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    try {
        const timeRange = getTimeRange(period);
        const storeFilter = await getStoreFilter(req.user, storeId);
        const [currentMetrics, previousMetrics, topProducts, recentOrders, salesChart, statusDistribution, storePerformance] = await Promise.all([
            getBasicMetrics(timeRange.from, timeRange.to, storeFilter),
            getBasicMetrics(timeRange.previousFrom, timeRange.previousTo, storeFilter),
            getTopProducts(timeRange.from, timeRange.to, storeFilter, 10),
            getRecentOrders(storeFilter, 10),
            getSalesChart(timeRange.from, timeRange.to, storeFilter, period),
            getStatusDistribution(timeRange.from, timeRange.to, storeFilter),
            getStorePerformance(timeRange.from, timeRange.to, req.user.id, req.user.role)
        ]);
        const revenueGrowth = calculateGrowthPercentage(currentMetrics.totalRevenue, previousMetrics.totalRevenue);
        const ordersGrowth = calculateGrowthPercentage(currentMetrics.totalOrders, previousMetrics.totalOrders);
        const conversionRate = currentMetrics.totalOrders > 0 ?
            (currentMetrics.totalOrders / Math.max(currentMetrics.totalOrders * 2, 100)) * 100 : 0;
        const metrics = {
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
        const sanitizedUserId = String(req.user.id).replace(/[\r\n]/g, ' ');
        const sanitizedPeriod = String(period).replace(/[\r\n]/g, ' ');
        const sanitizedStoreId = storeId ? String(storeId).replace(/[\r\n]/g, ' ') : 'all';
        logger_1.logger.info(`Analytics fetched for user ${sanitizedUserId}, period: ${sanitizedPeriod}, storeId: ${sanitizedStoreId}`);
        res.json({
            success: true,
            data: metrics,
            period,
            storeId: storeId || null,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching dashboard analytics:', error);
        throw new errorHandler_1.AppError('Failed to fetch analytics data', 500);
    }
});
exports.getStoreComparison = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { period = '30d' } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can access store comparison analytics', 403);
    }
    try {
        const timeRange = getTimeRange(period);
        const storeComparison = await prisma_1.prisma.store.findMany({
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
    }
    catch (error) {
        logger_1.logger.error('Error fetching store comparison:', error);
        throw new errorHandler_1.AppError('Failed to fetch store comparison data', 500);
    }
});
exports.getRevenueTrends = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { period = '30d', storeId, granularity = 'daily' } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    try {
        const timeRange = getTimeRange(period);
        const storeFilter = await getStoreFilter(req.user, storeId);
        const trends = await getRevenueTrendsData(timeRange.from, timeRange.to, storeFilter, granularity);
        res.json({
            success: true,
            data: trends,
            period,
            granularity,
            storeId: storeId || null,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching revenue trends:', error);
        throw new errorHandler_1.AppError('Failed to fetch revenue trends', 500);
    }
});
exports.getCustomerAnalytics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { period = '30d', storeId } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    try {
        const timeRange = getTimeRange(period);
        const storeFilter = await getStoreFilter(req.user, storeId);
        const [totalCustomers, newCustomers, returningCustomers, topCustomers, customerLifetimeValue] = await Promise.all([
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
    }
    catch (error) {
        logger_1.logger.error('Error fetching customer analytics:', error);
        throw new errorHandler_1.AppError('Failed to fetch customer analytics', 500);
    }
});
function getTimeRange(period) {
    const now = new Date();
    const today = (0, date_fns_1.startOfDay)(now);
    switch (period) {
        case '1d':
            return {
                from: today,
                to: (0, date_fns_1.endOfDay)(now),
                previousFrom: (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(now, 1)),
                previousTo: (0, date_fns_1.endOfDay)((0, date_fns_1.subDays)(now, 1))
            };
        case '7d':
            return {
                from: (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(now, 6)),
                to: (0, date_fns_1.endOfDay)(now),
                previousFrom: (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(now, 13)),
                previousTo: (0, date_fns_1.endOfDay)((0, date_fns_1.subDays)(now, 7))
            };
        case '30d':
            return {
                from: (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(now, 29)),
                to: (0, date_fns_1.endOfDay)(now),
                previousFrom: (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(now, 59)),
                previousTo: (0, date_fns_1.endOfDay)((0, date_fns_1.subDays)(now, 30))
            };
        case '90d':
            return {
                from: (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(now, 89)),
                to: (0, date_fns_1.endOfDay)(now),
                previousFrom: (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(now, 179)),
                previousTo: (0, date_fns_1.endOfDay)((0, date_fns_1.subDays)(now, 90))
            };
        default:
            return {
                from: (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(now, 6)),
                to: (0, date_fns_1.endOfDay)(now),
                previousFrom: (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(now, 13)),
                previousTo: (0, date_fns_1.endOfDay)((0, date_fns_1.subDays)(now, 7))
            };
    }
}
async function getStoreFilter(user, storeId) {
    if (user.role === 'OWNER') {
        return storeId ? { storeId } : {};
    }
    const accessibleStores = await prisma_1.prisma.store.findMany({
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
async function getBasicMetrics(from, to, storeFilter) {
    const orders = await prisma_1.prisma.order.aggregate({
        where: {
            createdAt: { gte: from, lte: to },
            status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
            ...storeFilter
        },
        _sum: { totalAmount: true },
        _count: { id: true }
    });
    const pendingCount = await prisma_1.prisma.order.count({
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
async function getTopProducts(from, to, storeFilter, limit) {
    const topProducts = await prisma_1.prisma.orderItem.groupBy({
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
    const productDetails = await prisma_1.prisma.product.findMany({
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
async function getRecentOrders(storeFilter, limit) {
    const orders = await prisma_1.prisma.order.findMany({
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
async function getSalesChart(from, to, storeFilter, _period) {
    const orders = await prisma_1.prisma.order.findMany({
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
    const chartData = {};
    orders.forEach(order => {
        const dateKey = (0, date_fns_1.format)(order.createdAt, 'yyyy-MM-dd');
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
async function getStatusDistribution(from, to, storeFilter) {
    const statusCounts = await prisma_1.prisma.order.groupBy({
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
async function getStorePerformance(from, to, userId, userRole) {
    if (userRole !== 'OWNER') {
        return [];
    }
    const stores = await prisma_1.prisma.store.findMany({
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
            conversionRate: 0
        };
    });
}
function calculateGrowthPercentage(current, previous) {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
}
async function getRevenueTrendsData(from, to, storeFilter, granularity) {
    const orders = await prisma_1.prisma.order.findMany({
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
    const trends = {};
    orders.forEach(order => {
        let dateKey;
        switch (granularity) {
            case 'hourly':
                dateKey = (0, date_fns_1.format)(order.createdAt, 'yyyy-MM-dd HH:00');
                break;
            case 'weekly':
                dateKey = (0, date_fns_1.format)((0, date_fns_1.startOfWeek)(order.createdAt), 'yyyy-MM-dd');
                break;
            case 'monthly':
                dateKey = (0, date_fns_1.format)((0, date_fns_1.startOfMonth)(order.createdAt), 'yyyy-MM-dd');
                break;
            default:
                dateKey = (0, date_fns_1.format)(order.createdAt, 'yyyy-MM-dd');
        }
        trends[dateKey] = (trends[dateKey] || 0) + order.totalAmount;
    });
    return Object.entries(trends).map(([date, revenue]) => ({
        date,
        revenue
    })).sort((a, b) => a.date.localeCompare(b.date));
}
async function getTotalCustomers(storeFilter) {
    return await prisma_1.prisma.user.count({
        where: {
            role: 'CUSTOMER',
            orders: {
                some: storeFilter
            }
        }
    });
}
async function getNewCustomers(from, to, storeFilter) {
    return await prisma_1.prisma.user.count({
        where: {
            role: 'CUSTOMER',
            createdAt: { gte: from, lte: to },
            orders: {
                some: storeFilter
            }
        }
    });
}
async function getReturningCustomers(from, to, storeFilter) {
    const returningCustomers = await prisma_1.prisma.user.findMany({
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
async function getTopCustomers(from, to, storeFilter, limit) {
    const topCustomers = await prisma_1.prisma.user.findMany({
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
async function getCustomerLifetimeValue(storeFilter) {
    const customers = await prisma_1.prisma.user.findMany({
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
    const lifetimeValues = customers.map(customer => customer.orders.reduce((sum, order) => sum + order.totalAmount, 0));
    const totalLTV = lifetimeValues.reduce((sum, value) => sum + value, 0);
    const averageLTV = customers.length > 0 ? totalLTV / customers.length : 0;
    return {
        totalLTV,
        averageLTV
    };
}
//# sourceMappingURL=analyticsController.js.map
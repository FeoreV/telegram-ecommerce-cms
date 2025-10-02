"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotDataService = void 0;
const prisma_js_1 = require("../lib/prisma.js");
const logger_js_1 = require("../utils/logger.js");
class BotDataService {
    constructor(storeId) {
        this.storeId = storeId;
    }
    async getProducts(options = {}) {
        try {
            const { categoryId, isActive = true, search, limit = 50, offset = 0 } = options;
            const whereClause = {
                storeId: this.storeId,
                isActive
            };
            if (categoryId) {
                whereClause.categoryId = categoryId;
            }
            if (search) {
                whereClause.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { sku: { contains: search, mode: 'insensitive' } }
                ];
            }
            const products = await prisma_js_1.prisma.product.findMany({
                where: whereClause,
                include: {
                    variants: {
                        where: { stock: { gt: 0 } }
                    },
                    category: {
                        select: { id: true, name: true, slug: true }
                    }
                },
                take: limit,
                skip: offset,
                orderBy: { createdAt: 'desc' }
            });
            return {
                products,
                total: await prisma_js_1.prisma.product.count({ where: whereClause })
            };
        }
        catch (error) {
            logger_js_1.logger.error(`Error fetching products for store ${this.storeId}:`, error);
            throw new Error('Ошибка получения товаров');
        }
    }
    async getProduct(productId) {
        try {
            const product = await prisma_js_1.prisma.product.findFirst({
                where: {
                    id: productId,
                    storeId: this.storeId
                },
                include: {
                    variants: true,
                    category: true
                }
            });
            if (!product) {
                throw new Error('Товар не найден');
            }
            return product;
        }
        catch (error) {
            logger_js_1.logger.error(`Error fetching product ${productId} for store ${this.storeId}:`, error);
            throw error;
        }
    }
    async getCategories() {
        try {
            const categories = await prisma_js_1.prisma.category.findMany({
                where: {
                    products: {
                        some: {
                            storeId: this.storeId,
                            isActive: true
                        }
                    }
                },
                include: {
                    _count: {
                        select: {
                            products: {
                                where: {
                                    storeId: this.storeId,
                                    isActive: true
                                }
                            }
                        }
                    }
                },
                orderBy: { name: 'asc' }
            });
            return categories;
        }
        catch (error) {
            logger_js_1.logger.error(`Error fetching categories for store ${this.storeId}:`, error);
            throw new Error('Ошибка получения категорий');
        }
    }
    async createOrder(orderData) {
        try {
            const { customerId, items, customerInfo, notes } = orderData;
            for (const item of items) {
                const product = await prisma_js_1.prisma.product.findFirst({
                    where: {
                        id: item.productId,
                        storeId: this.storeId
                    }
                });
                if (!product) {
                    throw new Error(`Товар ${item.productId} не принадлежит этому магазину`);
                }
            }
            const orderNumber = await this.generateOrderNumber();
            const order = await prisma_js_1.prisma.order.create({
                data: {
                    orderNumber,
                    customerId,
                    storeId: this.storeId,
                    totalAmount: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                    customerInfo: JSON.stringify(customerInfo),
                    notes: notes || null,
                    status: 'PENDING_ADMIN',
                    items: {
                        create: items.map(item => ({
                            productId: item.productId,
                            variantId: item.variantId || null,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                },
                include: {
                    items: {
                        include: {
                            product: true,
                            variant: true
                        }
                    },
                    customer: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });
            logger_js_1.logger.info(`Order created: ${order.orderNumber} for store ${this.storeId}`);
            return order;
        }
        catch (error) {
            logger_js_1.logger.error(`Error creating order for store ${this.storeId}:`, error);
            throw error;
        }
    }
    async getOrder(orderId) {
        try {
            const order = await prisma_js_1.prisma.order.findFirst({
                where: {
                    id: orderId,
                    storeId: this.storeId
                },
                include: {
                    items: {
                        include: {
                            product: true,
                            variant: true
                        }
                    },
                    customer: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true,
                            telegramId: true
                        }
                    }
                }
            });
            if (!order) {
                throw new Error('Заказ не найден');
            }
            return order;
        }
        catch (error) {
            logger_js_1.logger.error(`Error fetching order ${orderId} for store ${this.storeId}:`, error);
            throw error;
        }
    }
    async getOrderByNumber(orderNumber) {
        try {
            const order = await prisma_js_1.prisma.order.findFirst({
                where: {
                    orderNumber,
                    storeId: this.storeId
                },
                include: {
                    items: {
                        include: {
                            product: true,
                            variant: true
                        }
                    },
                    customer: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true,
                            telegramId: true
                        }
                    }
                }
            });
            return order;
        }
        catch (error) {
            logger_js_1.logger.error(`Error fetching order ${orderNumber} for store ${this.storeId}:`, error);
            throw error;
        }
    }
    async getCustomerOrders(customerId, limit = 10) {
        try {
            const orders = await prisma_js_1.prisma.order.findMany({
                where: {
                    customerId,
                    storeId: this.storeId
                },
                include: {
                    items: {
                        include: {
                            product: {
                                select: { id: true, name: true, images: true }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit
            });
            return orders;
        }
        catch (error) {
            logger_js_1.logger.error(`Error fetching orders for customer ${customerId} in store ${this.storeId}:`, error);
            throw new Error('Ошибка получения заказов');
        }
    }
    async getOrCreateCustomer(telegramId, userData) {
        try {
            let user = await prisma_js_1.prisma.user.findUnique({
                where: { telegramId }
            });
            if (!user) {
                user = await prisma_js_1.prisma.user.create({
                    data: {
                        telegramId,
                        username: userData.username,
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        role: 'CUSTOMER'
                    }
                });
                logger_js_1.logger.info(`New customer created: ${telegramId} for store ${this.storeId}`);
            }
            else {
                const updateData = {};
                if (userData.username && userData.username !== user.username) {
                    updateData.username = userData.username;
                }
                if (userData.firstName && userData.firstName !== user.firstName) {
                    updateData.firstName = userData.firstName;
                }
                if (userData.lastName && userData.lastName !== user.lastName) {
                    updateData.lastName = userData.lastName;
                }
                if (Object.keys(updateData).length > 0) {
                    user = await prisma_js_1.prisma.user.update({
                        where: { id: user.id },
                        data: updateData
                    });
                }
            }
            return user;
        }
        catch (error) {
            logger_js_1.logger.error(`Error getting/creating customer ${telegramId} for store ${this.storeId}:`, error);
            throw new Error('Ошибка работы с пользователем');
        }
    }
    async getStoreInfo() {
        try {
            const store = await prisma_js_1.prisma.store.findUnique({
                where: { id: this.storeId },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    currency: true,
                    contactInfo: true,
                    botSettings: true,
                    _count: {
                        select: {
                            products: { where: { isActive: true } },
                            orders: true
                        }
                    }
                }
            });
            if (!store) {
                throw new Error('Магазин не найден');
            }
            return {
                ...store,
                botSettings: store.botSettings ? JSON.parse(store.botSettings) : null
            };
        }
        catch (error) {
            logger_js_1.logger.error(`Error fetching store info for ${this.storeId}:`, error);
            throw error;
        }
    }
    async updateStoreStats() {
        try {
            await prisma_js_1.prisma.store.update({
                where: { id: this.storeId },
                data: { botLastActive: new Date() }
            });
        }
        catch (error) {
            logger_js_1.logger.warn(`Error updating store stats for ${this.storeId}:`, error);
        }
    }
    async generateOrderNumber() {
        const now = new Date();
        const monthYear = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear().toString().slice(-2)}`;
        const lastOrder = await prisma_js_1.prisma.order.findFirst({
            where: {
                storeId: this.storeId,
                orderNumber: { startsWith: monthYear }
            },
            orderBy: { orderNumber: 'desc' }
        });
        let sequence = 1;
        if (lastOrder) {
            const lastSequence = parseInt(lastOrder.orderNumber.split('-')[1] || '0');
            sequence = lastSequence + 1;
        }
        return `${monthYear}-${sequence.toString().padStart(5, '0')}`;
    }
    async validateStoreAccess() {
        try {
            const store = await prisma_js_1.prisma.store.findUnique({
                where: { id: this.storeId },
                select: { id: true, botStatus: true }
            });
            return !!(store && store.botStatus === 'ACTIVE');
        }
        catch (error) {
            logger_js_1.logger.error(`Error validating store access for ${this.storeId}:`, error);
            return false;
        }
    }
    async getBasicStats() {
        try {
            const [totalProducts, activeProducts, totalOrders, pendingOrders, totalRevenue] = await Promise.all([
                prisma_js_1.prisma.product.count({
                    where: { storeId: this.storeId }
                }),
                prisma_js_1.prisma.product.count({
                    where: { storeId: this.storeId, isActive: true }
                }),
                prisma_js_1.prisma.order.count({
                    where: { storeId: this.storeId }
                }),
                prisma_js_1.prisma.order.count({
                    where: { storeId: this.storeId, status: 'PENDING_ADMIN' }
                }),
                prisma_js_1.prisma.order.aggregate({
                    where: {
                        storeId: this.storeId,
                        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }
                    },
                    _sum: { totalAmount: true }
                })
            ]);
            return {
                products: {
                    total: totalProducts,
                    active: activeProducts
                },
                orders: {
                    total: totalOrders,
                    pending: pendingOrders
                },
                revenue: totalRevenue._sum.totalAmount || 0
            };
        }
        catch (error) {
            logger_js_1.logger.error(`Error fetching basic stats for store ${this.storeId}:`, error);
            throw new Error('Ошибка получения статистики');
        }
    }
}
exports.BotDataService = BotDataService;
exports.default = BotDataService;
//# sourceMappingURL=botDataService.js.map
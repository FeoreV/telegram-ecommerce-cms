import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Bot Data Service - Изолированный доступ к данным для каждого бота
 * Обеспечивает строгую изоляцию данных на уровне магазина
 */
export class BotDataService {
  private storeId: string;

  constructor(storeId: string) {
    this.storeId = storeId;
  }

  /**
   * PRODUCTS - Товары магазина
   */
  async getProducts(options: {
    categoryId?: string;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    try {
      const {
        categoryId,
        isActive = true,
        search,
        limit = 50,
        offset = 0
      } = options;

      const whereClause: any = {
        storeId: this.storeId, // Строгая изоляция по магазину
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

      const products = await prisma.product.findMany({
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
        total: await prisma.product.count({ where: whereClause })
      };
    } catch (error) {
      logger.error('Error fetching products for store', { storeId: this.storeId, error });
      throw new Error('Ошибка получения товаров');
    }
  }

  async getProduct(productId: string) {
    try {
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          storeId: this.storeId // Проверяем принадлежность к магазину
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
    } catch (error) {
      logger.error('Error fetching product for store', { productId, storeId: this.storeId, error });
      throw error;
    }
  }

  async getCategories() {
    try {
      // Получаем категории товаров этого магазина
      const categories = await prisma.category.findMany({
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
    } catch (error) {
      logger.error(`Error fetching categories for store:`, { storeId: this.storeId, error });
      throw new Error('Ошибка получения категорий');
    }
  }

  /**
   * ORDERS - Заказы магазина
   */
  async createOrder(orderData: {
    customerId: string;
    items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      price: number;
    }>;
    customerInfo: any;
    notes?: string;
  }) {
    try {
      const { customerId, items, customerInfo, notes } = orderData;

      // Проверяем, что все товары принадлежат этому магазину
      for (const item of items) {
        const product = await prisma.product.findFirst({
          where: {
            id: item.productId,
            storeId: this.storeId
          }
        });

        if (!product) {
          throw new Error(`Товар ${item.productId} не принадлежит этому магазину`);
        }
      }

      // Генерируем номер заказа
      const orderNumber = await this.generateOrderNumber();

      // Создаем заказ
      const order = await prisma.order.create({
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

      logger.info('Order created', { orderNumber: order.orderNumber, storeId: this.storeId });
      return order;
    } catch (error) {
      logger.error('Error creating order for store', { storeId: this.storeId, error });
      throw error;
    }
  }

  async getOrder(orderId: string) {
    try {
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          storeId: this.storeId // Проверяем принадлежность к магазину
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
    } catch (error) {
      logger.error('Error fetching order for store', { orderId, storeId: this.storeId, error });
      throw error;
    }
  }

  async getOrderByNumber(orderNumber: string) {
    try {
      const order = await prisma.order.findFirst({
        where: {
          orderNumber,
          storeId: this.storeId // Проверяем принадлежность к магазину
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
    } catch (error) {
      logger.error('Error fetching order by number for store', { orderNumber, storeId: this.storeId, error });
      throw error;
    }
  }

  async getCustomerOrders(customerId: string, limit: number = 10) {
    try {
      const orders = await prisma.order.findMany({
        where: {
          customerId,
          storeId: this.storeId // Изоляция по магазину
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
    } catch (error) {
      logger.error('Error fetching orders for customer in store', { customerId, storeId: this.storeId, error });
      throw new Error('Ошибка получения заказов');
    }
  }

  /**
   * CUSTOMERS - Клиенты магазина
   */
  async getOrCreateCustomer(telegramId: string, userData: {
    username?: string;
    firstName?: string;
    lastName?: string;
  }) {
    try {
      let user = await prisma.user.findUnique({
        where: { telegramId }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            telegramId,
            username: userData.username,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: 'CUSTOMER'
          }
        });
        logger.info('New customer created for store', { telegramId, storeId: this.storeId });
      } else {
        // Обновляем информацию пользователя, если она изменилась
        const updateData: any = {};
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
          user = await prisma.user.update({
            where: { id: user.id },
            data: updateData
          });
        }
      }

      return user;
    } catch (error) {
      logger.error('Error getting/creating customer for store', { telegramId, storeId: this.storeId, error });
      throw new Error('Ошибка работы с пользователем');
    }
  }

  /**
   * STORE INFO - Информация о магазине
   */
  async getStoreInfo() {
    try {
      const store = await prisma.store.findUnique({
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
    } catch (error) {
      logger.error('Error fetching store info', { storeId: this.storeId, error });
      throw error;
    }
  }

  async updateStoreStats() {
    try {
      // First check if store exists
      const store = await prisma.store.findUnique({
        where: { id: this.storeId },
        select: { id: true }
      });

      if (!store) {
        logger.error('Store not found - bot should be stopped', { storeId: this.storeId });
        throw new Error(`STORE_NOT_FOUND: Store ${this.storeId} does not exist`);
      }

      await prisma.store.update({
        where: { id: this.storeId },
        data: { botLastActive: new Date() }
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('STORE_NOT_FOUND')) {
        throw error; // Re-throw to signal bot should stop
      }
      logger.warn('Error updating store stats', { storeId: this.storeId, error });
    }
  }

  /**
   * UTILITY METHODS
   */
  private async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const monthYear = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear().toString().slice(-2)}`;

    const lastOrder = await prisma.order.findFirst({
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

  /**
   * VALIDATION METHODS
   */
  async validateStoreAccess(): Promise<boolean> {
    try {
      const store = await prisma.store.findUnique({
        where: { id: this.storeId },
        select: { id: true, botStatus: true }
      });

      return !!(store && store.botStatus === 'ACTIVE');
    } catch (error) {
      logger.error('Error validating store access', { storeId: this.storeId, error });
      return false;
    }
  }

  /**
   * ANALYTICS - Базовая аналитика для бота
   */
  async getBasicStats() {
    try {
      const [
        totalProducts,
        activeProducts,
        totalOrders,
        pendingOrders,
        totalRevenue
      ] = await Promise.all([
        prisma.product.count({
          where: { storeId: this.storeId }
        }),
        prisma.product.count({
          where: { storeId: this.storeId, isActive: true }
        }),
        prisma.order.count({
          where: { storeId: this.storeId }
        }),
        prisma.order.count({
          where: { storeId: this.storeId, status: 'PENDING_ADMIN' }
        }),
        prisma.order.aggregate({
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
    } catch (error) {
      logger.error('Error fetching basic stats for store', { storeId: this.storeId, error });
      throw new Error('Ошибка получения статистики');
    }
  }
}

export default BotDataService;

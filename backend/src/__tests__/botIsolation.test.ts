/**
 * @jest-environment node
 */
import { PrismaClient } from '@prisma/client';
import BotDataService from '../services/botDataService.js';

// Используем реальную Prisma для интеграционных тестов
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./test.db'
    }
  }
});

// Mock logger to avoid console spam during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Bot Data Isolation', () => {
  let store1Id: string;
  let store2Id: string;
  let user1Id: string;
  let user2Id: string;
  let product1Id: string;
  let product2Id: string;
  let order1Id: string;
  let order2Id: string;

  beforeAll(async () => {
    // Очистка тестовых данных
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.storeAdmin.deleteMany({});
    await prisma.store.deleteMany({});
    await prisma.user.deleteMany({});

    // Создание тестовых пользователей
    const user1 = await prisma.user.create({
      data: {
        telegramId: '123456789',
        username: 'testuser1',
        firstName: 'Test',
        lastName: 'User1',
        role: 'CUSTOMER'
      }
    });
    user1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        telegramId: '987654321',
        username: 'testuser2',
        firstName: 'Test',
        lastName: 'User2',
        role: 'CUSTOMER'
      }
    });
    user2Id = user2.id;

    // Создание владельца магазинов
    const owner = await prisma.user.create({
      data: {
        telegramId: '111222333',
        username: 'owner',
        firstName: 'Store',
        lastName: 'Owner',
        role: 'OWNER'
      }
    });

    // Создание тестовых магазинов
    const store1 = await prisma.store.create({
      data: {
        name: 'Test Store 1',
        slug: 'test-store-1',
        description: 'First test store',
        currency: 'USD',
        ownerId: owner.id,
        botStatus: 'ACTIVE'
      }
    });
    store1Id = store1.id;

    const store2 = await prisma.store.create({
      data: {
        name: 'Test Store 2',
        slug: 'test-store-2',
        description: 'Second test store',
        currency: 'EUR',
        ownerId: owner.id,
        botStatus: 'ACTIVE'
      }
    });
    store2Id = store2.id;

    // Создание тестовых товаров
    const product1 = await prisma.product.create({
      data: {
        name: 'Product from Store 1',
        description: 'Product belonging to store 1',
        price: 100,
        stock: 50,
        storeId: store1Id,
        isActive: true
      }
    });
    product1Id = product1.id;

    const product2 = await prisma.product.create({
      data: {
        name: 'Product from Store 2',
        description: 'Product belonging to store 2',
        price: 200,
        stock: 30,
        storeId: store2Id,
        isActive: true
      }
    });
    product2Id = product2.id;

    // Создание тестовых заказов
    const order1 = await prisma.order.create({
      data: {
        orderNumber: '0125-00001',
        customerId: user1Id,
        storeId: store1Id,
        totalAmount: 100,
        currency: 'USD',
        customerInfo: JSON.stringify({ name: 'Test User 1', phone: '+1234567890' }),
        status: 'PENDING_ADMIN',
        items: {
          create: {
            productId: product1Id,
            quantity: 1,
            price: 100
          }
        }
      }
    });
    order1Id = order1.id;

    const order2 = await prisma.order.create({
      data: {
        orderNumber: '0125-00002',
        customerId: user2Id,
        storeId: store2Id,
        totalAmount: 200,
        currency: 'EUR',
        customerInfo: JSON.stringify({ name: 'Test User 2', phone: '+0987654321' }),
        status: 'PENDING_ADMIN',
        items: {
          create: {
            productId: product2Id,
            quantity: 1,
            price: 200
          }
        }
      }
    });
    order2Id = order2.id;
  });

  afterAll(async () => {
    // Очистка тестовых данных
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.storeAdmin.deleteMany({});
    await prisma.store.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('BotDataService Isolation', () => {
    it('should only return products from the correct store', async () => {
      const botDataService1 = new BotDataService(store1Id);
      const botDataService2 = new BotDataService(store2Id);

      const store1Products = await botDataService1.getProducts();
      const store2Products = await botDataService2.getProducts();

      expect(store1Products.products).toHaveLength(1);
      expect(store1Products.products[0].id).toBe(product1Id);
      expect(store1Products.products[0].name).toBe('Product from Store 1');

      expect(store2Products.products).toHaveLength(1);
      expect(store2Products.products[0].id).toBe(product2Id);
      expect(store2Products.products[0].name).toBe('Product from Store 2');
    });

    it('should not access products from other stores', async () => {
      const botDataService1 = new BotDataService(store1Id);

      // Пытаемся получить товар из другого магазина
      await expect(botDataService1.getProduct(product2Id)).rejects.toThrow('Товар не найден');
    });

    it('should only return orders from the correct store', async () => {
      const botDataService1 = new BotDataService(store1Id);
      const botDataService2 = new BotDataService(store2Id);

      const order1FromService1 = await botDataService1.getOrder(order1Id);
      const order2FromService2 = await botDataService2.getOrder(order2Id);

      expect(order1FromService1.id).toBe(order1Id);
      expect(order1FromService1.storeId).toBe(store1Id);

      expect(order2FromService2.id).toBe(order2Id);
      expect(order2FromService2.storeId).toBe(store2Id);
    });

    it('should not access orders from other stores', async () => {
      const botDataService1 = new BotDataService(store1Id);

      // Пытаемся получить заказ из другого магазина
      await expect(botDataService1.getOrder(order2Id)).rejects.toThrow('Заказ не найден');
    });

    it('should isolate customer orders by store', async () => {
      const botDataService1 = new BotDataService(store1Id);
      const botDataService2 = new BotDataService(store2Id);

      const user1OrdersInStore1 = await botDataService1.getCustomerOrders(user1Id);
      const user1OrdersInStore2 = await botDataService2.getCustomerOrders(user1Id);

      // Пользователь 1 должен иметь заказы только в магазине 1
      expect(user1OrdersInStore1).toHaveLength(1);
      expect(user1OrdersInStore1[0].id).toBe(order1Id);
      
      // У пользователя 1 не должно быть заказов в магазине 2
      expect(user1OrdersInStore2).toHaveLength(0);
    });

    it('should return correct store information only', async () => {
      const botDataService1 = new BotDataService(store1Id);
      const botDataService2 = new BotDataService(store2Id);

      const store1Info = await botDataService1.getStoreInfo();
      const store2Info = await botDataService2.getStoreInfo();

      expect(store1Info.id).toBe(store1Id);
      expect(store1Info.name).toBe('Test Store 1');
      expect(store1Info.currency).toBe('USD');

      expect(store2Info.id).toBe(store2Id);
      expect(store2Info.name).toBe('Test Store 2');
      expect(store2Info.currency).toBe('EUR');
    });

    it('should isolate analytics between stores', async () => {
      const botDataService1 = new BotDataService(store1Id);
      const botDataService2 = new BotDataService(store2Id);

      const stats1 = await botDataService1.getBasicStats();
      const stats2 = await botDataService2.getBasicStats();

      expect(stats1.products.total).toBe(1);
      expect(stats1.orders.total).toBe(1);

      expect(stats2.products.total).toBe(1);
      expect(stats2.orders.total).toBe(1);
    });

    it('should only create orders with products from the same store', async () => {
      const botDataService1 = new BotDataService(store1Id);

      // Пытаемся создать заказ с товаром из другого магазина
      await expect(botDataService1.createOrder({
        customerId: user1Id,
        items: [{
          productId: product2Id, // Товар из магазина 2
          quantity: 1,
          price: 200
        }],
        customerInfo: { name: 'Test', phone: '123' }
      })).rejects.toThrow('не принадлежит этому магазину');
    });

    it('should validate store access correctly', async () => {
      const botDataService1 = new BotDataService(store1Id);
      const botDataService2 = new BotDataService(store2Id);

      const access1 = await botDataService1.validateStoreAccess();
      const access2 = await botDataService2.validateStoreAccess();

      expect(access1).toBe(true);
      expect(access2).toBe(true);

      // Тест с неактивным магазином
      const invalidService = new BotDataService('invalid-store-id');
      const invalidAccess = await invalidService.validateStoreAccess();
      expect(invalidAccess).toBe(false);
    });

    it('should generate unique order numbers per store', async () => {
      const botDataService1 = new BotDataService(store1Id);
      const botDataService2 = new BotDataService(store2Id);

      // Создаем новые заказы в каждом магазине
      const order1 = await botDataService1.createOrder({
        customerId: user1Id,
        items: [{
          productId: product1Id,
          quantity: 1,
          price: 100
        }],
        customerInfo: { name: 'Test', phone: '123' }
      });

      const order2 = await botDataService2.createOrder({
        customerId: user2Id,
        items: [{
          productId: product2Id,
          quantity: 1,
          price: 200
        }],
        customerInfo: { name: 'Test', phone: '123' }
      });

      // Номера заказов должны быть разными
      expect(order1.orderNumber).not.toBe(order2.orderNumber);
      
      // Заказы должны принадлежать правильным магазинам
      expect(order1.storeId).toBe(store1Id);
      expect(order2.storeId).toBe(store2Id);

      // Очистка созданных заказов
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: [order1.id, order2.id] } }
      });
      await prisma.order.deleteMany({
        where: { id: { in: [order1.id, order2.id] } }
      });
    });

    it('should handle search queries with store isolation', async () => {
      const botDataService1 = new BotDataService(store1Id);
      const botDataService2 = new BotDataService(store2Id);

      const searchResults1 = await botDataService1.getProducts({
        search: 'Product'
      });

      const searchResults2 = await botDataService2.getProducts({
        search: 'Product'
      });

      // Каждый магазин должен найти только свои товары
      expect(searchResults1.products).toHaveLength(1);
      expect(searchResults1.products[0].storeId).toBe(store1Id);

      expect(searchResults2.products).toHaveLength(1);
      expect(searchResults2.products[0].storeId).toBe(store2Id);
    });

    it('should create and retrieve customers independently per store context', async () => {
      const botDataService1 = new BotDataService(store1Id);
      const botDataService2 = new BotDataService(store2Id);

      // Создаем/получаем пользователя через разные сервисы
      const customer1 = await botDataService1.getOrCreateCustomer('555666777', {
        username: 'newcustomer',
        firstName: 'New',
        lastName: 'Customer'
      });

      const customer2 = await botDataService2.getOrCreateCustomer('555666777', {
        username: 'newcustomer_updated',
        firstName: 'New Updated',
        lastName: 'Customer Updated'
      });

      // Должны получить одного и того же пользователя
      expect(customer1.id).toBe(customer2.id);
      expect(customer1.telegramId).toBe('555666777');

      // Но данные должны быть обновлены
      expect(customer2.username).toBe('newcustomer_updated');
      expect(customer2.firstName).toBe('New Updated');

      // Очистка
      await prisma.user.delete({ where: { id: customer1.id } });
    });
  });

  describe('Store Access Validation', () => {
    it('should properly validate bot status for store access', async () => {
      // Деактивируем один из магазинов
      await prisma.store.update({
        where: { id: store2Id },
        data: { botStatus: 'INACTIVE' }
      });

      const botDataService1 = new BotDataService(store1Id);
      const botDataService2 = new BotDataService(store2Id);

      const access1 = await botDataService1.validateStoreAccess();
      const access2 = await botDataService2.validateStoreAccess();

      expect(access1).toBe(true); // Активный магазин
      expect(access2).toBe(false); // Неактивный магазин

      // Восстанавливаем статус для cleanup
      await prisma.store.update({
        where: { id: store2Id },
        data: { botStatus: 'ACTIVE' }
      });
    });
  });
});

describe('Cross-Store Data Leakage Prevention', () => {
  it('should never return data from other stores in any query', async () => {
    // Создаем множество тестовых данных в разных магазинах
    const stores = [];
    const products = [];

    // Создаем владельца
    const owner = await prisma.user.create({
      data: {
        telegramId: '999888777',
        username: 'multiowner',
        role: 'OWNER'
      }
    });

    // Создаем несколько магазинов
    for (let i = 0; i < 3; i++) {
      const store = await prisma.store.create({
        data: {
          name: `Multi Store ${i}`,
          slug: `multi-store-${i}`,
          currency: 'USD',
          ownerId: owner.id,
          botStatus: 'ACTIVE'
        }
      });
      stores.push(store);

      // Создаем товары для каждого магазина
      for (let j = 0; j < 3; j++) {
        const product = await prisma.product.create({
          data: {
            name: `Product ${j} for Store ${i}`,
            price: 100 * (i + 1),
            stock: 10 * (j + 1),
            storeId: store.id,
            isActive: true
          }
        });
        products.push(product);
      }
    }

    // Тестируем изоляцию для каждого магазина
    for (let i = 0; i < stores.length; i++) {
      const botDataService = new BotDataService(stores[i].id);
      
      const storeProducts = await botDataService.getProducts();
      const storeInfo = await botDataService.getStoreInfo();
      const storeStats = await botDataService.getBasicStats();

      // Проверяем, что каждый сервис видит только свои данные
      expect(storeProducts.products).toHaveLength(3);
      storeProducts.products.forEach(product => {
        expect(product.storeId).toBe(stores[i].id);
        expect(product.name).toContain(`Store ${i}`);
      });

      expect(storeInfo.id).toBe(stores[i].id);
      expect(storeInfo.name).toBe(`Multi Store ${i}`);
      
      expect(storeStats.products.total).toBe(3);
    }

    // Очистка
    await prisma.product.deleteMany({
      where: { storeId: { in: stores.map(s => s.id) } }
    });
    await prisma.store.deleteMany({
      where: { id: { in: stores.map(s => s.id) } }
    });
    await prisma.user.delete({ where: { id: owner.id } });
  });
});

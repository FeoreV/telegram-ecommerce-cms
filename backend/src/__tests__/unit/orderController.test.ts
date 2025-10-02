import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { prisma } from '../../lib/prisma';
import { generateToken } from '../../utils/jwt';
import orderRoutes from '../../routes/orders';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      createMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
    },
    store: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    adminLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock notification service
jest.mock('../../services/notificationService', () => ({
  NotificationService: {
    send: jest.fn(),
  },
  NotificationChannel: {
    SOCKET: 'SOCKET',
    TELEGRAM: 'TELEGRAM',
  },
  NotificationPriority: {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
  },
  NotificationType: {
    ORDER_CREATED: 'ORDER_CREATED',
    PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  },
}));

const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);

describe('Order Controller', () => {
  let adminToken: string;
  let customerToken: string;

  interface MockStore {
    id: string;
    name: string;
    currency: string;
    ownerId: string;
  }

  interface MockProduct {
    id: string;
    name: string;
    price: number;
    stock: number;
    trackStock: boolean;
    storeId: string;
  }

  let mockStore: MockStore;
  let mockProduct: MockProduct;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create test tokens
    adminToken = generateToken({
      userId: 'admin-id',
      telegramId: '123456789',
      role: 'ADMIN',
    });

    customerToken = generateToken({
      userId: 'customer-id',
      telegramId: '987654321',
      role: 'CUSTOMER',
    });

    // Mock data
    mockStore = {
      id: 'store-id',
      name: 'Test Store',
      currency: 'USD',
      ownerId: 'admin-id',
    };

    mockProduct = {
      id: 'product-id',
      name: 'Test Product',
      price: 100,
      stock: 10,
      trackStock: true,
      storeId: 'store-id',
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/orders', () => {
    it('should return orders for authenticated user', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'PENDING_ADMIN',
          totalAmount: 100,
          currency: 'USD',
        },
      ];

      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.order.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.orders).toEqual(mockOrders);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get('/api/orders');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No token provided');
    });

    it('should filter orders by status', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          status: 'PAID',
          totalAmount: 100,
        },
      ];

      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.order.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/orders?status=PAID')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PAID',
          }),
        })
      );
    });
  });

  describe('POST /api/orders', () => {
    const orderData = {
      storeId: 'store-id',
      items: [
        {
          productId: 'product-id',
          quantity: 2,
          price: 100,
        },
      ],
    };

    beforeEach(() => {
      (prisma.store.findFirst as jest.Mock).mockResolvedValue(mockStore);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          order: {
            create: jest.fn().mockResolvedValue({
              id: 'new-order-id',
              orderNumber: 'ORD-12345',
              status: 'PENDING_ADMIN',
              totalAmount: 200,
              currency: 'USD',
            }),
          },
          orderItem: {
            createMany: jest.fn(),
          },
        });
      });
    });

    it('should create order successfully', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData);

      expect(response.status).toBe(201);
      expect(response.body.order.status).toBe('PENDING_ADMIN');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should check store permissions', async () => {
      (prisma.store.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Store not found');
    });

    it('should validate stock availability', async () => {
      const outOfStockProduct = { ...mockProduct, stock: 1 };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(outOfStockProduct);

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Insufficient stock');
    });
  });

  describe('PUT /api/orders/:id/confirm', () => {
    const mockOrder = {
      id: 'order-id',
      status: 'PENDING_ADMIN',
      customerId: 'customer-id',
      storeId: 'store-id',
      store: mockStore,
      customer: { id: 'customer-id', firstName: 'John' },
    };

    beforeEach(() => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'PAID',
      });
      (prisma.adminLog.create as jest.Mock).mockResolvedValue({});
    });

    it('should confirm payment successfully', async () => {
      const response = await request(app)
        .put('/api/orders/order-id/confirm')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe('PAID');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAID',
          }),
        })
      );
    });

    it('should require admin permissions', async () => {
      const response = await request(app)
        .put('/api/orders/order-id/confirm')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
    });

    it('should validate order status', async () => {
      const paidOrder = { ...mockOrder, status: 'PAID' };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(paidOrder);

      const response = await request(app)
        .put('/api/orders/order-id/confirm')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already confirmed');
    });

    it('should log admin action', async () => {
      await request(app)
        .put('/api/orders/order-id/confirm')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'payment_confirmed',
            adminId: 'admin-id',
            orderId: 'order-id',
          }),
        })
      );
    });
  });

  describe('PUT /api/orders/:id/reject', () => {
    const mockOrder = {
      id: 'order-id',
      status: 'PENDING_ADMIN',
      customerId: 'customer-id',
      storeId: 'store-id',
    };

    beforeEach(() => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'REJECTED',
        rejectionReason: 'Invalid payment proof',
      });
    });

    it('should reject order with reason', async () => {
      const response = await request(app)
        .put('/api/orders/order-id/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Invalid payment proof' });

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe('REJECTED');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectionReason: 'Invalid payment proof',
          }),
        })
      );
    });

    it('should require rejection reason', async () => {
      const response = await request(app)
        .put('/api/orders/order-id/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('reason is required');
    });
  });

  describe('Order state machine validation', () => {
    it('should validate PENDING_ADMIN to PAID transition', async () => {
      const mockOrder = {
        id: 'order-id',
        status: 'PENDING_ADMIN',
        customerId: 'customer-id',
        storeId: 'store-id',
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'PAID',
      });

      const response = await request(app)
        .put('/api/orders/order-id/confirm')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should prevent invalid state transitions', async () => {
      const mockOrder = {
        id: 'order-id',
        status: 'CANCELLED',
        customerId: 'customer-id',
        storeId: 'store-id',
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const response = await request(app)
        .put('/api/orders/order-id/confirm')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
    });
  });
});

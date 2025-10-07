import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import storeRoutes from '../../routes/stores';
import { prisma } from '../../lib/prisma';

const prismaStoreMock = prisma.store as unknown as {
  findUnique: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  findFirst: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  create: jest.MockedFunction<(...args: any[]) => Promise<any>>;
};

const prismaStoreAdminMock = prisma.storeAdmin as unknown as {
  create: jest.MockedFunction<(...args: any[]) => Promise<any>>;
};

const MOCK_NOTIFICATION_TYPE = {
  STORE_CREATED: 'STORE_CREATED',
} as const;

jest.mock('../../middleware/validation', () => ({
  validate: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../services/notificationService.js', () => ({
  NotificationService: {
    send: jest.fn(),
  },
  NotificationType: MOCK_NOTIFICATION_TYPE,
}), { virtual: true });

// Helper to create a signed-in request context
const withAuthenticatedUser =
  (role: 'OWNER' | 'ADMIN') =>
  (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
  (req as any).user = {
    id: `user-${role.toLowerCase()}`,
    role,
  };
  next();
};

describe('Store creation API', () => {
  const app = express();
  let notificationMock: {
    NotificationService: { send: jest.Mock };
  };

  app.use(cookieParser());
  app.use(express.json());

  // Disable CSRF checks for tests
  app.use((req, _res, next) => {
    (req as any).csrfTokenValidated = true;
    next();
  });

  // Emulate enhancedAuthMiddleware by injecting auth user
  app.use('/api/stores', withAuthenticatedUser('OWNER'));
  app.use('/api/stores', storeRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
    notificationMock = jest.requireMock('../../services/notificationService.js');
    prismaStoreMock.findUnique.mockResolvedValue(undefined);
    prismaStoreMock.findFirst.mockResolvedValue(undefined);
    prismaStoreMock.create.mockImplementation(async ({
      data,
      include,
    }) => ({
      id: 'store-id',
      name: data.name,
      description: data.description,
      slug: data.slug,
      currency: data.currency,
      domain: data.domain,
      status: data.status,
      contactInfo: data.contactInfo,
      contactPhone: data.contactPhone,
      settings: data.settings,
      ownerId: data.ownerId,
      _count: include?._count ? { products: 0, orders: 0 } : undefined,
      owner: include?.owner
        ? {
            id: 'owner-id',
            username: 'ownerUser',
            firstName: 'Owner',
            lastName: 'User',
          }
        : undefined,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a store for OWNER and returns normalized payload', async () => {
    const response = await request(app)
      .post('/api/stores')
      .send({
        name: 'Test Store',
        description: ' Awesome store ',
        slug: 'Test-Store',
        currency: 'usd',
        domain: ' my-store.test ',
        contactInfo: {
          phone: '+79990000000',
          email: ' test@example.com ',
          address: ' Moscow ',
        },
        settings: {
          timezone: 'Europe/Moscow',
          theme: 'light',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.store.slug).toBe('test-store');
    expect(response.body.store.currency).toBe('USD');
    expect(response.body.store.contactInfo).toEqual({
      phone: '+79990000000',
      email: 'test@example.com',
      address: 'Moscow',
    });
    expect(response.body.store.settings).toEqual({
      timezone: 'Europe/Moscow',
      theme: 'light',
    });

    expect(prismaStoreMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Test Store',
          description: 'Awesome store',
          slug: 'test-store',
          currency: 'USD',
          ownerId: 'user-owner',
          enableStockAlerts: true,
        }),
      }),
    );

    expect(notificationMock.NotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MOCK_NOTIFICATION_TYPE.STORE_CREATED,
        recipients: ['user-owner'],
      }),
    );

    expect(prismaStoreAdminMock.create).not.toHaveBeenCalled();
  });

  it('assigns ADMIN as store admin after creation', async () => {
    const adminApp = express();
    adminApp.use(cookieParser());
    adminApp.use(express.json());
    adminApp.use((req, _res, next) => {
      (req as any).csrfTokenValidated = true;
      next();
    });
    adminApp.use('/api/stores', withAuthenticatedUser('ADMIN'));
    adminApp.use('/api/stores', storeRoutes);

    const response = await request(adminApp)
      .post('/api/stores')
      .send({
        name: 'Admin Store',
        description: 'Admin description',
        slug: 'admin-store',
        currency: 'EUR',
      });

    expect(response.status).toBe(201);
    expect(prismaStoreAdminMock.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-admin',
        storeId: 'store-id',
        assignedBy: 'user-admin',
      },
    });
  });

  it('rejects duplicate slug', async () => {
    prismaStoreMock.findUnique.mockResolvedValueOnce({
      id: 'existing-store',
      name: 'Existing Store',
      description: 'Existing',
      slug: 'duplicate',
      currency: 'USD',
      status: 'ACTIVE',
      domain: null,
      contactInfo: null,
      contactPhone: null,
      settings: null,
      ownerId: 'owner-id',
    } as any);

    const response = await request(app)
      .post('/api/stores')
      .send({
        name: 'Duplicate Store',
        description: 'Description',
        slug: 'duplicate',
        currency: 'USD',
      });

    expect(response.status).toBe(400);
  });
});



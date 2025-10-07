import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import storeRoutes from '../../routes/stores';
import { NotificationType } from '../../services/notificationService';
import { prisma } from '../../lib/prisma';

const prismaStoreMock = prisma.store as unknown as {
  findUnique: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  findFirst: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  create: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  update: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  delete: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  count: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  findMany: jest.MockedFunction<(...args: any[]) => Promise<any>>;
};

const prismaStoreAdminMock = prisma.storeAdmin as unknown as {
  create: jest.MockedFunction<(...args: any[]) => Promise<any>>;
};

jest.mock('../../middleware/validation', () => ({
  validate: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../services/notificationService.js', () => ({
  NotificationService: {
    send: jest.fn(),
  },
  NotificationType: { STORE_CREATED: 'STORE_CREATED' },
}), { virtual: true });

const withAuthenticatedUser =
  (role: 'OWNER' | 'ADMIN' | 'VENDOR') =>
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

describe('Store Integration API', () => {
  const app = express();
  let notificationMock: {
    NotificationService: { send: jest.Mock };
  };

  app.use(cookieParser());
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).csrfTokenValidated = true;
    next();
  });
  app.use('/api/stores', withAuthenticatedUser('OWNER'));
  app.use('/api/stores', storeRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
    notificationMock = jest.requireMock('../../services/notificationService.js');
    prismaStoreMock.findUnique.mockResolvedValue(undefined);
    prismaStoreMock.findFirst.mockResolvedValue(undefined);
    prismaStoreMock.count.mockResolvedValue(10);
    prismaStoreMock.findMany.mockResolvedValue([]);
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
    prismaStoreMock.update.mockImplementation(async ({ data }) => ({
      id: 'store-id',
      name: data.name || 'Updated Store',
      description: data.description || 'Updated',
      slug: data.slug || 'updated',
      currency: data.currency || 'EUR',
      domain: data.domain || null,
      status: data.status || 'ACTIVE',
      contactInfo: data.contactInfo || null,
      contactPhone: data.contactPhone || null,
      settings: data.settings || null,
      ownerId: 'user-owner',
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates store information', async () => {
    const response = await request(app)
      .put('/api/stores/store-id')
      .set('x-csrf-token', 'test-token')
      .send({
        name: ' Updated Store ',
        description: ' Updated description ',
      });

    expect(response.status).toBe(200);
    expect(prismaStoreMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'store-id' },
        data: expect.objectContaining({
          name: 'Updated Store',
          description: 'Updated description',
        }),
      }),
    );
  });

  it('lists stores with pagination', async () => {
    prismaStoreMock.findMany.mockResolvedValueOnce([
      {
        id: 'store-1',
        name: 'Store 1',
        slug: 'store-1',
        description: 'First store',
        currency: 'USD',
        status: 'ACTIVE',
        ownerId: 'user-owner',
        owner: { id: 'user-owner', username: 'owner', firstName: 'Owner', lastName: 'User' },
        admins: [],
        _count: { products: 5, orders: 10 },
      },
    ] as any);
    prismaStoreMock.count.mockResolvedValueOnce(1);

    const response = await request(app)
      .get('/api/stores')
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.pagination.total).toBe(1);
  });

  it('prevents non-OWNER/ADMIN from creating stores', async () => {
    const vendorApp = express();
    vendorApp.use(cookieParser());
    vendorApp.use(express.json());
    vendorApp.use((req, _res, next) => {
      (req as any).csrfTokenValidated = true;
      next();
    });
    vendorApp.use('/api/stores', withAuthenticatedUser('VENDOR'));
    vendorApp.use('/api/stores', storeRoutes);

    const response = await request(vendorApp)
      .post('/api/stores')
      .set('x-csrf-token', 'test-token')
      .send({
        name: 'Vendor Store',
        description: 'Description',
        slug: 'vendor-store',
        currency: 'USD',
      });

    expect(response.status).toBe(403);
  });
});

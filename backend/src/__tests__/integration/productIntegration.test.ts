import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import productRoutes from '../../routes/products';
import { prisma } from '../../lib/prisma';

const prismaProductMock = prisma.product as unknown as {
  findMany: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  count: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  findUnique: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  findFirst: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  create: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  update: jest.MockedFunction<(...args: any[]) => Promise<any>>;
  delete: jest.MockedFunction<(...args: any[]) => Promise<any>>;
};

const prismaStoreMock = prisma.store as unknown as {
  findMany: jest.MockedFunction<(...args: any[]) => Promise<any>>;
};

jest.mock('../../middleware/validation', () => ({
  validate: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../middleware/csrfProtection', () => ({
  csrfProtection: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

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

describe('Product Integration API', () => {
  const ownerApp = express();

  ownerApp.use(cookieParser());
  ownerApp.use(express.json());
  ownerApp.use((req, _res, next) => {
    (req as any).csrfTokenValidated = true;
    next();
  });
  ownerApp.use('/api/products', withAuthenticatedUser('OWNER'));
  ownerApp.use('/api/products', productRoutes);

  beforeEach(() => {
    jest.clearAllMocks();

    prismaProductMock.findMany.mockResolvedValue([]);
    prismaProductMock.count.mockResolvedValue(0);
    prismaProductMock.findUnique.mockResolvedValue(undefined);
    prismaProductMock.findFirst.mockResolvedValue(undefined);
    prismaProductMock.create.mockImplementation(async ({ data }) => ({
      id: 'product-id',
      name: data.name,
      description: data.description,
      sku: data.sku,
      price: data.price,
      stock: data.stock,
      images: data.images,
      storeId: data.storeId,
      categoryId: data.categoryId,
      isActive: true,
      trackStock: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      variants: [],
      store: {
        id: data.storeId,
        name: 'Store name',
        slug: 'store-slug',
      },
      category: data.categoryId ? {
        id: data.categoryId,
        name: 'Category name',
        slug: 'category-slug',
      } : null,
      _count: { orderItems: 0 },
    }));
    prismaProductMock.update.mockImplementation(async ({ data }) => ({
      id: 'product-id',
      name: data.name || 'Updated Product',
      description: data.description || 'Updated',
      sku: data.sku || 'SKU123',
      price: data.price || 100,
      stock: data.stock !== undefined ? data.stock : 10,
      images: data.images,
      storeId: 'store-id',
      categoryId: data.categoryId,
      isActive: data.isActive !== undefined ? data.isActive : true,
      trackStock: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      variants: [],
      store: {
        id: 'store-id',
        name: 'Store name',
        slug: 'store-slug',
      },
      category: null,
      _count: { orderItems: 0 },
    }));
    prismaProductMock.delete.mockResolvedValue({ id: 'product-id' } as any);

    prismaStoreMock.findMany.mockResolvedValue([{ id: 'store-id' }] as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists products with pagination', async () => {
    prismaProductMock.findMany.mockResolvedValueOnce([
      {
        id: 'product-1',
        name: 'Product 1',
        description: 'Description 1',
        price: 100,
        stock: 10,
        images: JSON.stringify(['img1.png']),
        storeId: 'store-id',
        categoryId: null,
        isActive: true,
        trackStock: true,
        sku: 'SKU1',
        createdAt: new Date(),
        updatedAt: new Date(),
        variants: [],
        _count: { orderItems: 0 },
        store: { id: 'store-id', name: 'Store name', slug: 'store-slug' },
        category: null,
      },
    ] as any);
    prismaProductMock.count.mockResolvedValueOnce(1);

    const response = await request(ownerApp)
      .get('/api/products')
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.items[0].images).toEqual(['img1.png']);
  });

  it('creates a product with variants', async () => {
    const response = await request(ownerApp)
      .post('/api/products')
      .send({
        name: 'New Product',
        description: 'Product description',
        sku: 'SKU123',
        price: '99.99',
        stock: '5',
        images: ['image1.png'],
        storeId: 'store-id',
        categoryId: 'category-id',
        variants: [
          { name: 'Size', value: 'L', price: '109.99', stock: '3' },
        ],
      });

    expect(response.status).toBe(201);
    expect(prismaProductMock.create).toHaveBeenCalled();
    expect(response.body.product.name).toBe('New Product');
    expect(response.body.product.images).toEqual(['image1.png']);
  });

  it('prevents duplicate SKU in same store', async () => {
    prismaProductMock.findUnique.mockResolvedValueOnce({ id: 'existing-product' } as any);

    const response = await request(ownerApp)
      .post('/api/products')
      .send({
        name: 'Duplicate Product',
        sku: 'DUPSKU',
        price: '50',
        stock: '2',
        storeId: 'store-id',
      });

    expect(response.status).toBe(409);
  });

  it('updates existing product', async () => {
    const response = await request(ownerApp)
      .put('/api/products/product-id')
      .send({
        name: 'Updated Product',
        price: '120',
        stock: '8',
      });

    expect(response.status).toBe(200);
    expect(prismaProductMock.update).toHaveBeenCalled();
  });

  it('deletes a product', async () => {
    const response = await request(ownerApp)
      .delete('/api/products/product-id');

    expect(response.status).toBe(200);
    expect(prismaProductMock.delete).toHaveBeenCalled();
  });
});

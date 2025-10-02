import { Request, Response, NextFunction } from 'express';
import {
  requireRole,
  requireStoreAccessAsync,
  requirePermission,
  hasStoreAccess,
  getUserStoreAccess,
  validateRoleHierarchy,
  ROLE_HIERARCHY,
  UserRole,
  Permission,
} from '../../middleware/permissions';
import { prisma } from '../../lib/prisma';

interface MockAuthenticatedRequest extends Partial<Request> {
  user: {
    id: string;
    role: UserRole;
    telegramId?: string;
  };
  params: Record<string, string>;
  body: Record<string, unknown>;
}

const mockRequest = (userOverrides: Partial<{ id: string; role: UserRole; telegramId?: string }> = {}, paramsOverrides: Record<string, string> = {}, bodyOverrides: Record<string, unknown> = {}) => ({
  user: {
    id: 'user-123',
    role: UserRole.CUSTOMER,
    ...userOverrides
  },
  params: {
    storeId: 'store-123',
    ...paramsOverrides
  },
  body: {
    ...bodyOverrides
  },
  // Add other properties that might be accessed by middleware, if necessary
  get: (header: string) => {
    if (header === 'User-Agent') return 'mock-user-agent';
    return undefined;
  },
  ip: '127.0.0.1',
  // Add other methods/properties from Request if needed
} as MockAuthenticatedRequest);

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe('RBAC/Permissions System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role Hierarchy', () => {
    test('should have correct role hierarchy order', () => {
      expect(ROLE_HIERARCHY).toEqual({
        OWNER: 4,
        ADMIN: 3,
        VENDOR: 2,
        CUSTOMER: 1
      });
    });

    test('should validate role hierarchy correctly', () => {
      expect(validateRoleHierarchy(UserRole.OWNER, UserRole.ADMIN)).toBe(true);
      expect(validateRoleHierarchy(UserRole.ADMIN, UserRole.VENDOR)).toBe(true);
      expect(validateRoleHierarchy(UserRole.VENDOR, UserRole.CUSTOMER)).toBe(true);

      expect(validateRoleHierarchy(UserRole.CUSTOMER, UserRole.VENDOR)).toBe(false);
      expect(validateRoleHierarchy(UserRole.VENDOR, UserRole.ADMIN)).toBe(false);
      expect(validateRoleHierarchy(UserRole.ADMIN, UserRole.OWNER)).toBe(false);
    });

    test('should handle equal roles', () => {
      expect(validateRoleHierarchy(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
      expect(validateRoleHierarchy(UserRole.VENDOR, UserRole.VENDOR)).toBe(true);
    });

    test('should handle invalid roles', () => {
      expect(validateRoleHierarchy('INVALID_ROLE' as UserRole, UserRole.ADMIN)).toBe(false);
      expect(validateRoleHierarchy(UserRole.ADMIN, 'INVALID_ROLE' as UserRole)).toBe(false);
    });
  });

  describe('requireRole middleware', () => {
    test('should allow access for users with required role', async () => {
      const req = mockRequest({ role: UserRole.ADMIN });
      const res = mockResponse();
      const middleware = requireRole([UserRole.ADMIN]);

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow access for users with higher role', async () => {
      const req = mockRequest({ role: UserRole.OWNER });
      const res = mockResponse();
      const middleware = requireRole([UserRole.ADMIN]);

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access for users with insufficient role', async () => {
      const req = mockRequest({ role: UserRole.CUSTOMER });
      const res = mockResponse();
      const middleware = requireRole([UserRole.ADMIN]);

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        required: ['ADMIN'],
        current: 'CUSTOMER'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle multiple allowed roles', async () => {
      const req = mockRequest({ role: UserRole.VENDOR });
      const res = mockResponse();
      const middleware = requireRole([UserRole.ADMIN, UserRole.VENDOR]);

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should handle missing user', async () => {
      const req = mockRequest();
      // The 'user' property is now mandatory on MockAuthenticatedRequest,
      // so we explicitly set it to undefined to simulate a missing user for this test.
      (req.user as any) = undefined;
      const res = mockResponse();
      const middleware = requireRole([UserRole.ADMIN]);

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required'
      });
    });

    test('should bypass checks in development for OWNER', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const req = mockRequest({ role: UserRole.OWNER });
      const res = mockResponse();
      const middleware = requireRole([UserRole.ADMIN]);

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Store Access Control', () => {
    test('should allow OWNER access to any store', async () => {
      const hasAccess = await hasStoreAccess('user-owner', 'any-store', UserRole.OWNER);
      expect(hasAccess).toBe(true);
    });

    test('should check database for non-OWNER roles', async () => {
      const mockStore = {
        id: 'store-123',
        ownerId: 'user-123',
        admins: [{ userId: 'user-admin' }],
        vendors: [{ userId: 'user-vendor' }]
      };

      (prisma.store.findFirst as jest.Mock).mockResolvedValue(mockStore);

      // Store owner should have access
      const ownerAccess = await hasStoreAccess('user-123', 'store-123', UserRole.ADMIN);
      expect(ownerAccess).toBe(true);

      // Admin should have access
      const adminAccess = await hasStoreAccess('user-admin', 'store-123', UserRole.ADMIN);
      expect(adminAccess).toBe(true);

      // Vendor should have access
      const vendorAccess = await hasStoreAccess('user-vendor', 'store-123', UserRole.VENDOR);
      expect(vendorAccess).toBe(true);

      // Unrelated user should not have access
      const noAccess = await hasStoreAccess('user-other', 'store-123', UserRole.CUSTOMER);
      expect(noAccess).toBe(false);
    });

    test('should handle store not found', async () => {
      (prisma.store.findFirst as jest.Mock).mockResolvedValue(null);

      const hasAccess = await hasStoreAccess('user-123', 'nonexistent-store', UserRole.ADMIN);
      expect(hasAccess).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      (prisma.store.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      const hasAccess = await hasStoreAccess('user-123', 'store-123', UserRole.ADMIN);
      expect(hasAccess).toBe(false);
    });
  });

  describe('requireStoreAccess middleware', () => {
    test('should allow access for users with store access', async () => {
      const req = mockRequest({ role: UserRole.ADMIN });
      const res = mockResponse();

      (prisma.store.findFirst as jest.Mock).mockResolvedValue({
        id: 'store-123',
        ownerId: 'user-123'
      });

      const middleware = requireStoreAccessAsync();
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access for users without store access', async () => {
      const req = mockRequest({ role: UserRole.ADMIN });
      const res = mockResponse();

      (prisma.store.findFirst as jest.Mock).mockResolvedValue(null);

      const middleware = requireStoreAccessAsync();
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No access to this store'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should use custom store ID from parameter', async () => {
      const req = mockRequest(
        { role: UserRole.ADMIN },
        { customStoreId: 'custom-store-456' }
      );
      const res = mockResponse();

      (prisma.store.findFirst as jest.Mock).mockResolvedValue({
        id: 'custom-store-456',
        ownerId: 'user-123'
      });

      const middleware = requireStoreAccessAsync('customStoreId');
      await middleware(req, res, mockNext);

      expect(prisma.store.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'custom-store-456'
          })
        })
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireOwnership middleware', () => {
    test('should allow access for resource owner', async () => {
      const req = mockRequest({ id: 'user-123', role: UserRole.CUSTOMER });
      const res = mockResponse();

      const middleware = requirePermission(Permission.USER_UPDATE, (r: MockAuthenticatedRequest) => ({
        userId: r.user.id,
        resourceOwnerId: r.user.id,
      }));
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow access for higher-role users', async () => {
      const req = mockRequest({ id: 'admin-123', role: UserRole.ADMIN });
      const res = mockResponse();

      const middleware = requirePermission(Permission.USER_UPDATE, (r: MockAuthenticatedRequest) => ({
        userId: 'user-123',
        resourceOwnerId: 'user-123',
      }));
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should deny access for non-owners with insufficient role', async () => {
      const req = mockRequest(
        { id: 'user-other', role: UserRole.CUSTOMER },
        { userId: 'user-123' }
      );
      const res = mockResponse();

      const middleware = requirePermission(Permission.USER_UPDATE, (r: MockAuthenticatedRequest) => ({
        userId: r.params.userId,
        resourceOwnerId: 'user-123',
      }));
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied. You can only access your own resources.'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle different resource types', async () => {
      const req = mockRequest(
        { id: 'user-123', role: UserRole.CUSTOMER },
        { orderId: 'order-456' }
      );
      const res = mockResponse();

      // Mock order lookup
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-456',
        customerId: 'user-123'
      });

      const middleware = requirePermission(Permission.ORDER_VIEW, (r: MockAuthenticatedRequest) => ({
        userId: r.user.id,
        orderId: r.params.orderId, // Should be r.params.orderId
        resourceOwnerId: 'user-123',
      }));
      await middleware(req, res, mockNext);

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-456' },
        select: { customerId: true }
      });
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserStoreAccess function', () => {
    test('should return all stores for OWNER', async () => {
      (prisma.store.findMany as jest.Mock).mockResolvedValue([
        { id: 'store-1', name: 'Store 1' },
        { id: 'store-2', name: 'Store 2' }
      ]);

      const access = await getUserStoreAccess('user-owner', UserRole.OWNER);

      expect(access.hasFullAccess).toBe(true);
      expect(access.accessibleStores).toHaveLength(2);
      expect(prisma.store.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {}
        })
      );
    });

    test('should return only accessible stores for non-OWNER', async () => {
      const mockStores = [
        { id: 'store-1', name: 'Owned Store' },
        { id: 'store-2', name: 'Admin Store' }
      ];

      (prisma.store.findMany as jest.Mock).mockResolvedValue(mockStores);

      const access = await getUserStoreAccess('user-admin', UserRole.ADMIN);

      expect(access.hasFullAccess).toBe(false);
      expect(access.accessibleStores).toHaveLength(2);
      expect(prisma.store.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { ownerId: 'user-admin' },
              { admins: { some: { userId: 'user-admin' } } },
              { vendors: { some: { userId: 'user-admin' } } }
            ]
          }
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null/undefined user gracefully', async () => {
      const hasAccess = await hasStoreAccess(null, 'store-123', UserRole.ADMIN);
      expect(hasAccess).toBe(false);

      const hasAccess2 = await hasStoreAccess(undefined, 'store-123', UserRole.ADMIN);
      expect(hasAccess2).toBe(false);
    });

    test('should handle null/undefined storeId gracefully', async () => {
      const hasAccess = await hasStoreAccess('user-123', null, UserRole.ADMIN);
      expect(hasAccess).toBe(false);

      const hasAccess2 = await hasStoreAccess('user-123', undefined, UserRole.ADMIN);
      expect(hasAccess2).toBe(false);
    });

    test('should handle network timeouts', async () => {
      jest.setTimeout(15000);

      (prisma.store.findFirst as jest.Mock).mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 12000))
      );

      const hasAccess = await hasStoreAccess('user-123', 'store-123', UserRole.ADMIN);
      expect(hasAccess).toBe(false);
    });

    test('should handle concurrent permission checks', async () => {
      const mockStore = {
        id: 'store-123',
        ownerId: 'user-123'
      };

      (prisma.store.findFirst as jest.Mock).mockResolvedValue(mockStore);

      // Simulate concurrent checks
      const promises = Array.from({ length: 10 }, () =>
        hasStoreAccess('user-123', 'store-123', UserRole.ADMIN)
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every(result => result === true)).toBe(true);
    });

    test('should validate role parameter', async () => {
      const req = mockRequest({ role: null });
      const res = mockResponse();
      const middleware = requireRole([UserRole.ADMIN]);

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    test('should handle role checks efficiently', async () => {
      const startTime = Date.now();

      const req = mockRequest({ role: UserRole.ADMIN });
      const res = mockResponse();
      const middleware = requireRole([UserRole.ADMIN]);

      await middleware(req, res, mockNext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10); // Should complete in less than 10ms
    });

    test('should cache store access results', async () => {
      const mockStore = { id: 'store-123', ownerId: 'user-123' };
      (prisma.store.findFirst as jest.Mock).mockResolvedValue(mockStore);

      // First call
      await hasStoreAccess('user-123', 'store-123', UserRole.ADMIN);

      // Second call (should potentially use cache)
      await hasStoreAccess('user-123', 'store-123', UserRole.ADMIN);

      // For now, we expect 2 calls (no caching implemented yet)
      expect(prisma.store.findFirst).toHaveBeenCalledTimes(2);
    });
  });
});

import { Request, Response } from 'express';
import { telegramAuth, getProfile } from '../controllers/authController';
import { prisma } from '../lib/prisma';
import { generateToken } from '../utils/jwt';

// Mock Prisma
jest.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock JWT
jest.mock('../utils/jwt', () => ({
  generateToken: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGenerateToken = generateToken as jest.MockedFunction<typeof generateToken>;

describe('Auth Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockReq = {
      body: {},
    };
    
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };

    jest.clearAllMocks();
  });

  describe('telegramAuth', () => {
    it('should create new user and return token', async () => {
      const userData = {
        telegramId: '123456789',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      };

      mockReq.body = userData;

      const mockUser = {
        id: 'user-id',
        telegramId: userData.telegramId,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: 'CUSTOMER',
        isActive: true,
      };

      mockPrisma.user.upsert.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue('mock-jwt-token');

      await telegramAuth(mockReq as Request, mockRes as Response);

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { telegramId: userData.telegramId },
        update: {
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          lastActiveAt: expect.any(Date),
        },
        create: {
          telegramId: userData.telegramId,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: 'CUSTOMER',
          isActive: true,
        },
      });

      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        telegramId: mockUser.telegramId,
        role: mockUser.role,
      });

      expect(jsonMock).toHaveBeenCalledWith({
        token: 'mock-jwt-token',
        user: mockUser,
      });
    });

    it('should handle missing telegramId', async () => {
      mockReq.body = { username: 'testuser' };

      await telegramAuth(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Telegram ID is required',
      });
    });

    it('should handle inactive user', async () => {
      const userData = {
        telegramId: '123456789',
        username: 'testuser',
      };

      mockReq.body = userData;

      const mockUser = {
        id: 'user-id',
        telegramId: userData.telegramId,
        username: userData.username,
        role: 'CUSTOMER',
        isActive: false,
      };

      mockPrisma.user.upsert.mockResolvedValue(mockUser);

      await telegramAuth(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Account is deactivated',
      });
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockUser = {
        id: 'user-id',
        telegramId: '123456789',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'CUSTOMER',
        isActive: true,
      };

      // Mock authenticated request
      mockReq.user = mockUser;

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await getProfile(mockReq as Request, mockRes as Response);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastActiveAt: true,
        },
      });

      expect(jsonMock).toHaveBeenCalledWith({
        user: mockUser,
      });
    });

    it('should handle user not found', async () => {
      mockReq.user = { id: 'non-existent-id' } as Request['user'];
      
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await getProfile(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'User not found',
      });
    });
  });
});

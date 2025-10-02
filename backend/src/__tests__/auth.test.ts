import { generateToken, verifyToken } from '../utils/jwt';
import { UserRole } from '@prisma/client';

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-minimum-32-chars';

describe('JWT Utils', () => {
  const mockPayload = {
    userId: 'test-user-id',
    telegramId: '123456789',
    role: UserRole.CUSTOMER
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(mockPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct payload in token', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.telegramId).toBe(mockPayload.telegramId);
      expect(decoded.role).toBe(mockPayload.role);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token correctly', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);
      
      expect(decoded).toMatchObject(mockPayload);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        verifyToken('invalid.token.here');
      }).toThrow('Invalid token');
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        verifyToken('not-a-jwt-token');
      }).toThrow('Invalid token');
    });

    it('should throw error for empty token', () => {
      expect(() => {
        verifyToken('');
      }).toThrow();
    });
  });
});

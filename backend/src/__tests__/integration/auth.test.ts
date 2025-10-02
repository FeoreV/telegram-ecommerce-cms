import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

describe('Authentication Integration Tests', () => {
  // Test user data will be created dynamically in tests

  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.deleteMany({
      where: {
        telegramId: { in: ['999999999', '888888888'] }
      }
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any existing test users
    await prisma.user.deleteMany({
      where: {
        telegramId: { in: ['999999999', '888888888'] }
      }
    });
  });

  describe('Telegram Authentication Flow', () => {
    it('should create new user on first telegram login', async () => {
      const telegramData = {
        telegramId: '999999999',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/telegram')
        .send(telegramData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.telegramId).toBe(telegramData.telegramId);
      expect(response.body.user.role).toBe('CUSTOMER');

      // Verify user was created in database
      const createdUser = await prisma.user.findUnique({
        where: { telegramId: telegramData.telegramId }
      });

      expect(createdUser).toBeTruthy();
      expect(createdUser?.username).toBe(telegramData.username);
    });

    it('should update existing user info on subsequent logins', async () => {
      const telegramData = {
        telegramId: '999999999',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      };

      // First login
      await request(app)
        .post('/api/auth/telegram')
        .send(telegramData);

      // Second login with updated info
      const updatedData = {
        ...telegramData,
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await request(app)
        .post('/api/auth/telegram')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body.user.firstName).toBe('Updated');
      expect(response.body.user.lastName).toBe('Name');

      // Verify database was updated
      const updatedUser = await prisma.user.findUnique({
        where: { telegramId: telegramData.telegramId }
      });

      expect(updatedUser?.firstName).toBe('Updated');
      expect(updatedUser?.lastName).toBe('Name');
    });

    it('should reject login for inactive user', async () => {
      // Create inactive user
      await prisma.user.create({
        data: {
          telegramId: '888888888',
          username: 'inactive',
          role: 'CUSTOMER',
          isActive: false
        }
      });

      const response = await request(app)
        .post('/api/auth/telegram')
        .send({
          telegramId: '888888888',
          username: 'inactive'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('deactivated');
    });

    it('should assign OWNER role to super admin', async () => {
      const originalSuperAdminId = process.env.SUPER_ADMIN_TELEGRAM_ID;
      process.env.SUPER_ADMIN_TELEGRAM_ID = '999999999';

      const response = await request(app)
        .post('/api/auth/telegram')
        .send({
          telegramId: '999999999',
          username: 'superadmin',
          firstName: 'Super',
          lastName: 'Admin'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('OWNER');

      // Restore original value
      process.env.SUPER_ADMIN_TELEGRAM_ID = originalSuperAdminId;
    });
  });

  describe('Token Refresh Flow', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create user and get tokens
      const response = await request(app)
        .post('/api/auth/telegram')
        .send({
          telegramId: '999999999',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User'
        });

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.accessToken).not.toBe(accessToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid refresh token');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });
  });

  describe('QR Authentication Flow', () => {
    it('should generate QR auth session', async () => {
      const response = await request(app)
        .post('/api/auth/qr/generate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.deepLink).toBeDefined();
      expect(response.body.qrData).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
      expect(response.body.expiresIn).toBe(300); // 5 minutes
    });

    it('should check QR auth status', async () => {
      // Generate session first
      const generateResponse = await request(app)
        .post('/api/auth/qr/generate');

      const sessionId = generateResponse.body.sessionId;

      const response = await request(app)
        .get(`/api/auth/qr/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.completed).toBe(false);
    });

    it('should reject invalid session ID', async () => {
      const response = await request(app)
        .get('/api/auth/qr/invalid-session-id');

      expect(response.status).toBe(400);
    });
  });

  describe('Profile Management', () => {
    let userToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/telegram')
        .send({
          telegramId: '999999999',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User'
        });

      userToken = response.body.accessToken;
    });

    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.telegramId).toBe('999999999');
      expect(response.body.user.username).toBe('testuser');
    });

    it('should update user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'test@example.com'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.firstName).toBe('Updated');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject profile access without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
    });
  });

  describe('Session Management', () => {
    let userToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/telegram')
        .send({
          telegramId: '999999999',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User'
        });

      userToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should get active sessions', async () => {
      const response = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sessions).toBeInstanceOf(Array);
      expect(response.body.sessions.length).toBeGreaterThan(0);
    });

    it('should logout and invalidate refresh token', async () => {
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ refreshToken });

      expect(logoutResponse.status).toBe(200);

      // Try to use the refresh token - should fail
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(401);
    });
  });

  describe('Deep Link Generation', () => {
    it('should generate auth deep link', async () => {
      const response = await request(app)
        .post('/api/auth/deep-link')
        .send({
          action: 'auth'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deepLink).toBeDefined();
      expect(response.body.deepLink).toContain('t.me/');
      expect(response.body.action).toBe('auth');
    });

    it('should generate admin panel deep link', async () => {
      const response = await request(app)
        .post('/api/auth/deep-link')
        .send({
          action: 'admin_panel'
        });

      expect(response.status).toBe(200);
      expect(response.body.deepLink).toContain('admin_panel');
    });

    it('should generate order verification deep link', async () => {
      const response = await request(app)
        .post('/api/auth/deep-link')
        .send({
          action: 'order_verify',
          params: { orderId: 'test-order-123' }
        });

      expect(response.status).toBe(200);
      expect(response.body.deepLink).toContain('verify_test-order-123');
    });

    it('should reject invalid action', async () => {
      const response = await request(app)
        .post('/api/auth/deep-link')
        .send({
          action: 'invalid_action'
        });

      expect(response.status).toBe(400);
    });
  });
});

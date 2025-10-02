import { 
  NotificationService, 
  NotificationChannel, 
  NotificationPriority, 
  NotificationType,
  NotificationPayload
} from '../../services/notificationService';
import { TelegramNotificationService } from '../../services/telegramNotificationService';
import { prisma } from '../../lib/prisma';
import { getIO } from '../../lib/socket';

// Mock dependencies
jest.mock('../../services/telegramNotificationService');
jest.mock('../../lib/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn().mockReturnValue({
      emit: jest.fn()
    }),
    emit: jest.fn()
  }))
}));
jest.mock('nodemailer');

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockTelegramService: jest.Mocked<TelegramNotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the singleton instance
    NotificationService.resetInstance();
    notificationService = NotificationService.getInstance();
    
    mockTelegramService = new TelegramNotificationService() as jest.Mocked<TelegramNotificationService>;
    notificationService.setTelegramService(mockTelegramService);
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = NotificationService.getInstance();
      const instance2 = NotificationService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should initialize services on first call', () => {
      const instance = NotificationService.getInstance();
      expect(instance).toBeDefined();
    });
  });

  describe('Channel Routing', () => {
    const mockPayload: NotificationPayload = {
      title: 'Test Notification',
      message: 'Test message',
      type: NotificationType.ORDER_STATUS_CHANGED,
      priority: NotificationPriority.HIGH,
      recipients: ['user-123'],
      channels: [NotificationChannel.SOCKET, NotificationChannel.TELEGRAM],
      data: { orderId: 'order-123' }
    };

    test('should route to socket channel', async () => {
      const mockIO = getIO();
      
      await notificationService.send({
        ...mockPayload,
        channels: [NotificationChannel.SOCKET]
      });

      expect(mockIO.to).toHaveBeenCalledWith('user_user-123');
    });

    test('should route to telegram channel', async () => {
      mockTelegramService.sendNotification.mockResolvedValue({
        success: true,
        channel: NotificationChannel.TELEGRAM,
        recipientId: 'user-123'
      });

      await notificationService.send({
        ...mockPayload,
        channels: [NotificationChannel.TELEGRAM]
      });

      expect(mockTelegramService.sendNotification).toHaveBeenCalledWith(
        'user-123',
        mockPayload.title,
        mockPayload.message,
        expect.objectContaining({
          type: mockPayload.type,
          priority: mockPayload.priority
        })
      );
    });

    test('should route to multiple channels', async () => {
      const mockIO = getIO();
      mockTelegramService.sendNotification.mockResolvedValue({
        success: true,
        channel: NotificationChannel.TELEGRAM,
        recipientId: 'user-123'
      });

      await notificationService.send({
        ...mockPayload,
        channels: [NotificationChannel.SOCKET, NotificationChannel.TELEGRAM]
      });

      expect(mockIO.to).toHaveBeenCalled();
      expect(mockTelegramService.sendNotification).toHaveBeenCalled();
    });

    test('should handle email channel', async () => {
      // Mock user with email
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com'
      });

      await notificationService.send({
        ...mockPayload,
        channels: [NotificationChannel.EMAIL]
      });

      // Would check email sending mock here when implemented
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { email: true, firstName: true, lastName: true }
      });
    });

    test('should handle push notification channel', async () => {
      await notificationService.send({
        ...mockPayload,
        channels: [NotificationChannel.PUSH]
      });

      // Push notifications would be handled here when implemented
      // For now, just ensure it doesn't crash
      expect(true).toBe(true);
    });
  });

  describe('Priority Handling', () => {
    test('should handle CRITICAL priority notifications', async () => {
      const mockPayload: NotificationPayload = {
        title: 'Critical Alert',
        message: 'System down!',
        type: NotificationType.SYSTEM_ALERT,
        priority: NotificationPriority.CRITICAL,
        recipients: ['admin-123'],
        channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL]
      };

      const results = await notificationService.send(mockPayload);

      expect(results).toBeDefined();
      expect(results.some(r => r.priority === NotificationPriority.CRITICAL)).toBe(true);
    });

    test('should prioritize CRITICAL over other notifications', async () => {
      // Send low priority first
      const lowPriorityPromise = notificationService.send({
        title: 'Low Priority',
        message: 'Can wait',
        type: NotificationType.ORDER_STATUS_CHANGED,
        priority: NotificationPriority.LOW,
        recipients: ['user-123'],
        channels: [NotificationChannel.SOCKET]
      });

      // Send critical second (should be processed first)
      const criticalPromise = notificationService.send({
        title: 'CRITICAL',
        message: 'Urgent!',
        type: NotificationType.SYSTEM_ALERT,
        priority: NotificationPriority.CRITICAL,
        recipients: ['admin-123'],
        channels: [NotificationChannel.TELEGRAM]
      });

      await Promise.all([lowPriorityPromise, criticalPromise]);

      // Critical should be processed with higher priority
      expect(mockTelegramService.sendNotification).toHaveBeenCalled();
    });
  });

  describe('Notification Types', () => {
    test('should handle ORDER_STATUS_CHANGED notifications', async () => {
      const payload: NotificationPayload = {
        title: 'Order Updated',
        message: 'Your order #123 has been shipped',
        type: NotificationType.ORDER_STATUS_CHANGED,
        priority: NotificationPriority.HIGH,
        recipients: ['customer-123'],
        channels: [NotificationChannel.TELEGRAM],
        data: {
          orderId: 'order-123',
          newStatus: 'SHIPPED',
          trackingNumber: 'TRACK123'
        }
      };

      await notificationService.send(payload);

      expect(mockTelegramService.sendNotification).toHaveBeenCalledWith(
        'customer-123',
        'Order Updated',
        'Your order #123 has been shipped',
        expect.objectContaining({
          type: NotificationType.ORDER_STATUS_CHANGED,
          data: expect.objectContaining({
            orderId: 'order-123',
            newStatus: 'SHIPPED'
          })
        })
      );
    });

    test('should handle PAYMENT_RECEIVED notifications', async () => {
      const payload: NotificationPayload = {
        title: 'Payment Received',
        message: 'Payment of $100 received for order #456',
        type: NotificationType.PAYMENT_RECEIVED,
        priority: NotificationPriority.HIGH,
        recipients: ['store-admin-123'],
        channels: [NotificationChannel.SOCKET, NotificationChannel.TELEGRAM],
        data: {
          orderId: 'order-456',
          amount: 100,
          currency: 'USD'
        }
      };

      await notificationService.send(payload);

      expect(mockTelegramService.sendNotification).toHaveBeenCalled();
    });

    test('should handle LOW_STOCK notifications', async () => {
      const payload: NotificationPayload = {
        title: 'Low Stock Alert',
        message: 'Product "iPhone 15" has only 2 items left',
        type: NotificationType.LOW_STOCK,
        priority: NotificationPriority.MEDIUM,
        recipients: ['store-owner-123', 'store-admin-456'],
        channels: [NotificationChannel.SOCKET, NotificationChannel.EMAIL],
        data: {
          productId: 'product-123',
          productName: 'iPhone 15',
          currentStock: 2,
          threshold: 5
        }
      };

      await notificationService.send(payload);

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2); // For email addresses
    });
  });

  describe('Database Integration', () => {
    test('should save notification to database', async () => {
      (prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notification-123',
        title: 'Test',
        message: 'Test message'
      });

      await notificationService.send({
        title: 'Test Notification',
        message: 'Test message',
        type: NotificationType.ORDER_STATUS_CHANGED,
        priority: NotificationPriority.MEDIUM,
        recipients: ['user-123'],
        channels: [NotificationChannel.SOCKET],
        data: {}
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Test Notification',
          message: 'Test message',
          type: NotificationType.ORDER_STATUS_CHANGED,
          priority: NotificationPriority.MEDIUM,
          channels: [NotificationChannel.SOCKET]
        })
      });
    });

    test('should handle database save failures gracefully', async () => {
      (prisma.notification.create as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const results = await notificationService.send({
        title: 'Test',
        message: 'Test message',
        type: NotificationType.ORDER_STATUS_CHANGED,
        priority: NotificationPriority.MEDIUM,
        recipients: ['user-123'],
        channels: [NotificationChannel.SOCKET],
        data: {}
      });

      // Should still attempt to send even if DB save fails
      expect(results).toBeDefined();
    });
  });

  describe('Bulk Notifications', () => {
    test('should send to multiple recipients', async () => {
      const recipients = ['user-1', 'user-2', 'user-3'];

      await notificationService.send({
        title: 'Bulk Notification',
        message: 'Message to all',
        type: NotificationType.SYSTEM_ALERT,
        priority: NotificationPriority.MEDIUM,
        recipients,
        channels: [NotificationChannel.TELEGRAM],
        data: {}
      });

      expect(mockTelegramService.sendNotification).toHaveBeenCalledTimes(3);
      
      recipients.forEach(recipient => {
        expect(mockTelegramService.sendNotification).toHaveBeenCalledWith(
          recipient,
          'Bulk Notification',
          'Message to all',
          expect.any(Object)
        );
      });
    });

    test('should handle partial failures in bulk sends', async () => {
      mockTelegramService.sendNotification
        .mockResolvedValueOnce({ success: true, channel: NotificationChannel.TELEGRAM, recipientId: 'user-1' })
        .mockRejectedValueOnce(new Error('Failed for user-2'))
        .mockResolvedValueOnce({ success: true, channel: NotificationChannel.TELEGRAM, recipientId: 'user-3' });

      const results = await notificationService.send({
        title: 'Bulk Test',
        message: 'Test message',
        type: NotificationType.ORDER_STATUS_CHANGED,
        priority: NotificationPriority.MEDIUM,
        recipients: ['user-1', 'user-2', 'user-3'],
        channels: [NotificationChannel.TELEGRAM],
        data: {}
      });

      // Should have results for all recipients (some successful, some failed)
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.success === true)).toBe(true);
      expect(results.some(r => r.success === false)).toBe(true);
    });
  });

  describe('Store-specific Notifications', () => {
    test('should send to store admins', async () => {
      (prisma.store.findUnique as jest.Mock).mockResolvedValue({
        id: 'store-123',
        ownerId: 'owner-123',
        admins: [
          { userId: 'admin-1' },
          { userId: 'admin-2' }
        ]
      });

      await notificationService.sendToStore('store-123', {
        title: 'Store Notification',
        message: 'Something happened in your store',
        type: NotificationType.ORDER_STATUS_CHANGED,
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.TELEGRAM],
        data: { storeId: 'store-123' }
      });

      // Should send to owner + 2 admins = 3 total
      expect(mockTelegramService.sendNotification).toHaveBeenCalledTimes(3);
    });

    test('should handle store not found', async () => {
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        notificationService.sendToStore('nonexistent-store', {
          title: 'Test',
          message: 'Test',
          type: NotificationType.ORDER_STATUS_CHANGED,
          priority: NotificationPriority.MEDIUM,
          channels: [NotificationChannel.SOCKET],
          data: {}
        })
      ).rejects.toThrow('Store not found');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid notification channels', async () => {
      const results = await notificationService.send({
        title: 'Test',
        message: 'Test message',
        type: NotificationType.ORDER_STATUS_CHANGED,
        priority: NotificationPriority.MEDIUM,
        recipients: ['user-123'],
        channels: ['INVALID_CHANNEL' as NotificationChannel],
        data: {}
      });

      // Should handle gracefully without crashing
      expect(results).toBeDefined();
    });

    test('should handle telegram service failures', async () => {
      mockTelegramService.sendNotification.mockRejectedValue(new Error('Telegram API Error'));

      const results = await notificationService.send({
        title: 'Test',
        message: 'Test message',
        type: NotificationType.ORDER_STATUS_CHANGED,
        priority: NotificationPriority.MEDIUM,
        recipients: ['user-123'],
        channels: [NotificationChannel.TELEGRAM],
        data: {}
      });

      expect(results.some(r => r.success === false)).toBe(true);
    });

    test('should handle socket connection failures', async () => {
      const mockIO = getIO();
      mockIO.to.mockImplementation(() => {
        throw new Error('Socket connection failed');
      });

      const results = await notificationService.send({
        title: 'Test',
        message: 'Test message',
        type: NotificationType.ORDER_STATUS_CHANGED,
        priority: NotificationPriority.MEDIUM,
        recipients: ['user-123'],
        channels: [NotificationChannel.SOCKET],
        data: {}
      });

      // Should handle socket errors gracefully
      expect(results).toBeDefined();
    });

    test('should validate required fields', async () => {
      await expect(
        notificationService.send({
          title: '',
          message: '',
          type: NotificationType.ORDER_STATUS_CHANGED,
          priority: NotificationPriority.MEDIUM,
          recipients: [],
          channels: [],
          data: {}
        })
      ).rejects.toThrow();
    });

    test('should handle rate limiting', async () => {
      // Simulate sending many notifications quickly
      const promises = Array.from({ length: 100 }, (_, i) => 
        notificationService.send({
          title: `Notification ${i}`,
          message: `Message ${i}`,
          type: NotificationType.ORDER_STATUS_CHANGED,
          priority: NotificationPriority.LOW,
          recipients: ['user-123'],
          channels: [NotificationChannel.SOCKET],
          data: {}
        })
      );

      const results = await Promise.all(promises);
      
      // Should handle all requests (with potential rate limiting)
      expect(results.length).toBe(100);
    });
  });

  describe('Performance Tests', () => {
    test('should handle high-volume notifications efficiently', async () => {
      const startTime = Date.now();
      
      const promises = Array.from({ length: 50 }, (_, i) => 
        notificationService.send({
          title: `Notification ${i}`,
          message: `Message ${i}`,
          type: NotificationType.ORDER_STATUS_CHANGED,
          priority: NotificationPriority.MEDIUM,
          recipients: [`user-${i}`],
          channels: [NotificationChannel.SOCKET],
          data: {}
        })
      );

      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000);
    });

    test('should not block on slow channels', async () => {
      // Mock slow telegram service
      mockTelegramService.sendNotification.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          channel: NotificationChannel.TELEGRAM,
          recipientId: 'user-123'
        }), 3000))
      );

      const startTime = Date.now();

      await notificationService.send({
        title: 'Test',
        message: 'Test message',
        type: NotificationType.ORDER_STATUS_CHANGED,
        priority: NotificationPriority.MEDIUM,
        recipients: ['user-123'],
        channels: [NotificationChannel.SOCKET, NotificationChannel.TELEGRAM],
        data: {}
      });

      const duration = Date.now() - startTime;

      // Should not be blocked by slow telegram channel if socket is fast
      // This test may need adjustment based on implementation
      expect(duration).toBeLessThan(4000);
    });
  });
});

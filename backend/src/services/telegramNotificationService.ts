import axios from 'axios';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
// SECURITY FIX: Import URL sanitization for SSRF protection
import { sanitizeForLog, sanitizeUrl } from '../utils/sanitizer';

interface OrderForNotification {
  id: string;
  orderNumber: string;
  totalAmount: number;
  currency: string;
  store: {
    name: string;
    telegramBotToken?: string;
  };
  customer: {
    telegramId?: string;
  };
}

export interface TelegramNotificationData {
  telegramId: string;
  type: 'payment_confirmed' | 'order_rejected' | 'order_shipped' | 'order_delivered' | 'order_cancelled';
  orderData: {
    orderNumber: string;
    orderId: string;
    storeName: string;
    totalAmount: number;
    currency: string;
  };
  additionalData?: {
    reason?: string;
    trackingNumber?: string;
    carrier?: string;
  };
}

class TelegramNotificationService {
  private botApiUrl: string;

  constructor() {
    // Get bot URL from environment - the Telegram bot should expose an API endpoint
    this.botApiUrl = process.env.TELEGRAM_BOT_API_URL || 'http://localhost:3003/api';
  }

  async notifyCustomerPaymentConfirmed(order: OrderForNotification): Promise<void> {
    try {
      const notification: TelegramNotificationData = {
        telegramId: order.customer.telegramId,
        type: 'payment_confirmed',
        orderData: {
          orderNumber: order.orderNumber,
          orderId: order.id,
          storeName: order.store.name,
          totalAmount: order.totalAmount,
          currency: order.currency,
        },
      };

      await this.sendNotification(notification);
      logger.info(`Payment confirmation notification sent to customer ${sanitizeForLog(order.customer.telegramId || '')} for order ${sanitizeForLog(order.orderNumber)}`);
    } catch (error) {
      logger.error('Failed to send payment confirmation notification:', error);
    }
  }

  async notifyCustomerOrderRejected(order: OrderForNotification, reason: string): Promise<void> {
    try {
      const notification: TelegramNotificationData = {
        telegramId: order.customer.telegramId,
        type: 'order_rejected',
        orderData: {
          orderNumber: order.orderNumber,
          orderId: order.id,
          storeName: order.store.name,
          totalAmount: order.totalAmount,
          currency: order.currency,
        },
        additionalData: {
          reason,
        },
      };

      await this.sendNotification(notification);
      logger.info('Order rejection notification sent', {
        customerId: order.customer.telegramId,
        orderNumber: order.orderNumber
      });
    } catch (error) {
      logger.error('Failed to send order rejection notification:', error);
    }
  }

  async notifyCustomerOrderShipped(order: OrderForNotification, trackingNumber?: string, carrier?: string): Promise<void> {
    try {
      const notification: TelegramNotificationData = {
        telegramId: order.customer.telegramId,
        type: 'order_shipped',
        orderData: {
          orderNumber: order.orderNumber,
          orderId: order.id,
          storeName: order.store.name,
          totalAmount: order.totalAmount,
          currency: order.currency,
        },
        additionalData: {
          trackingNumber,
          carrier,
        },
      };

      await this.sendNotification(notification);
      logger.info('Order shipped notification sent', {
        customerId: order.customer.telegramId,
        orderNumber: order.orderNumber
      });
    } catch (error) {
      logger.error('Failed to send order shipped notification:', error);
    }
  }

  async notifyCustomerOrderDelivered(order: OrderForNotification): Promise<void> {
    try {
      const notification: TelegramNotificationData = {
        telegramId: order.customer.telegramId,
        type: 'order_delivered',
        orderData: {
          orderNumber: order.orderNumber,
          orderId: order.id,
          storeName: order.store.name,
          totalAmount: order.totalAmount,
          currency: order.currency,
        },
      };

      await this.sendNotification(notification);
      logger.info(`Order delivered notification sent to customer ${sanitizeForLog(order.customer.telegramId || '')} for order ${sanitizeForLog(order.orderNumber)}`);
    } catch (error) {
      logger.error('Failed to send order delivered notification:', error);
    }
  }

  async notifyCustomerOrderCancelled(order: OrderForNotification, reason: string): Promise<void> {
    try {
      const notification: TelegramNotificationData = {
        telegramId: order.customer.telegramId,
        type: 'order_cancelled',
        orderData: {
          orderNumber: order.orderNumber,
          orderId: order.id,
          storeName: order.store.name,
          totalAmount: order.totalAmount,
          currency: order.currency,
        },
        additionalData: {
          reason,
        },
      };

      await this.sendNotification(notification);
      logger.info('Order cancellation notification sent', {
        customerId: order.customer.telegramId,
        orderNumber: order.orderNumber
      });
    } catch (error) {
      logger.error('Failed to send order cancellation notification:', error);
    }
  }

  private async sendNotification(notification: TelegramNotificationData): Promise<void> {
    try {
      // Validate bot API URL to prevent SSRF
      const urlValidation = await import('../utils/urlValidator.js').then(m => m.validateUrl);
      const validation = urlValidation(`${this.botApiUrl}/notify-customer`, {
        allowPrivateIPs: process.env.NODE_ENV === 'development',
        allowedProtocols: ['http:', 'https:']
      });

      if (!validation.valid) {
        throw new Error(`Invalid bot API URL: ${validation.error}`);
      }

      const response = await axios.post(
        `${this.botApiUrl}/notify-customer`,
        notification,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      if (response.status !== 200) {
        throw new Error(`Bot API returned status ${response.status}: ${response.statusText}`);
      }

      logger.debug('Notification sent successfully to bot API', {
        customerId: notification.telegramId
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          logger.warn('Telegram bot is not available - notification queued for retry');
          await this.queueNotificationForRetry(notification);
        } else {
          logger.error('HTTP error sending notification to bot:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          });
        }
      } else {
        logger.error('Unexpected error sending notification to bot:', error);
      }
      throw error;
    }
  }

  private async queueNotificationForRetry(notification: TelegramNotificationData): Promise<void> {
    try {
      // Store failed notifications in database for retry
      await prisma.adminLog.create({
        data: {
          adminId: 'system',
          action: 'NOTIFICATION_RETRY_QUEUE',
          details: JSON.stringify({
            type: 'telegram_customer_notification',
            notification,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(`Notification queued for retry: ${sanitizeForLog(notification.type)} for customer ${sanitizeForLog(notification.telegramId)}`);
    } catch (dbError) {
      logger.error('Failed to queue notification for retry:', dbError);
    }
  }

  // Method to retry failed notifications (can be called by a cron job)
  async retryFailedNotifications(): Promise<void> {
    try {
      const failedNotifications = await prisma.adminLog.findMany({
        where: {
          action: 'NOTIFICATION_RETRY_QUEUE',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 10, // Process up to 10 at a time
      });

      for (const log of failedNotifications) {
        try {
          const logData = JSON.parse(log.details || '{}');
          const notification = logData.notification as TelegramNotificationData;

          if (notification) {
            await this.sendNotification(notification);

            // Remove from retry queue on success
            await prisma.adminLog.delete({
              where: { id: log.id },
            });

            logger.info(`Successfully retried notification for customer ${notification.telegramId}`);
          }
        } catch (retryError) {
          logger.error(`Failed to retry notification ${log.id}:`, retryError);

          // If notification is older than 24 hours, remove it
          if (log.createdAt < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
            await prisma.adminLog.delete({
              where: { id: log.id },
            });
            logger.info(`Removed expired retry notification ${log.id}`);
          }
        }
      }

      if (failedNotifications.length > 0) {
        logger.info(`Processed ${failedNotifications.length} retry notifications`);
      }
    } catch (error) {
      logger.error('Error during notification retry process:', error);
    }
  }

  // Health check method
  async checkBotHealth(): Promise<boolean> {
    try {
      // SECURITY FIX: Validate URL to prevent SSRF (CWE-918)
      const healthUrl = `${this.botApiUrl}/health`;

      // Ensure URL is from allowed domains (localhost or configured bot URL)
      const allowedDomains = ['localhost', '127.0.0.1'];
      if (process.env.BOT_API_DOMAIN) {
        allowedDomains.push(process.env.BOT_API_DOMAIN);
      }

      const safeUrl = sanitizeUrl(healthUrl, allowedDomains);

      const response = await axios.get(safeUrl, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Bot health check failed:', error);
      return false;
    }
  }
}

export const telegramNotificationService = new TelegramNotificationService();

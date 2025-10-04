import TelegramBot from 'node-telegram-bot-api';
import * as nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';
import { getIO } from '../lib/socket';
import { logger, serializeError } from '../utils/logger';

// Interfaces for typed data
interface EmailRecipient {
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface CustomerInfo {
  name?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  telegramId?: string;
}

// Notification types
export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_PAID = 'ORDER_PAID',
  ORDER_REJECTED = 'ORDER_REJECTED',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  PAYMENT_PROOF_UPLOADED = 'PAYMENT_PROOF_UPLOADED',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  BULK_OPERATION = 'BULK_OPERATION',
  STORE_CREATED = 'STORE_CREATED',
  USER_REGISTERED = 'USER_REGISTERED',
  BOT_CREATED = 'BOT_CREATED',
  BOT_ACTIVATED = 'BOT_ACTIVATED',
  BOT_DEACTIVATED = 'BOT_DEACTIVATED',
  BOT_ERROR = 'BOT_ERROR',
  BOT_RESTARTED = 'BOT_RESTARTED',
  // Employee management notifications
  EMPLOYEE_INVITATION = 'EMPLOYEE_INVITATION',
  EMPLOYEE_JOINED = 'EMPLOYEE_JOINED',
  EMPLOYEE_INVITATION_REJECTED = 'EMPLOYEE_INVITATION_REJECTED',
  EMPLOYEE_REMOVED = 'EMPLOYEE_REMOVED',
  SECURITY_ALERT = 'SECURITY_ALERT',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
  PUSH = 'PUSH',
  SOCKET = 'SOCKET',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  recipients: string[]; // User IDs
  data?: Record<string, unknown>;
  storeId?: string;
  orderId?: string;
}

// Email transporter configuration
let emailTransporter: nodemailer.Transporter | null = null;

const initEmailTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    logger.info('Email transporter initialized');
  } else {
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      logger.info('Email not configured - email notifications disabled (development mode)');
    } else {
      logger.warn('Email configuration missing - email notifications disabled');
    }
  }
};

// Initialize email on service load
initEmailTransporter();

// Telegram bot for admin notifications
let telegramBot: TelegramBot | null = null;

const initTelegramBot = async () => {
  if (process.env.ADMIN_TELEGRAM_BOT_TOKEN) {
    try {
      const TelegramBot = await import('node-telegram-bot-api');
      telegramBot = new TelegramBot.default(process.env.ADMIN_TELEGRAM_BOT_TOKEN, { polling: false });
      logger.info('Admin Telegram bot initialized');
    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error);
    }
  } else {
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      logger.info('Admin Telegram bot not configured - admin notifications disabled (development mode)');
    } else {
      logger.warn('Admin Telegram bot token missing - Telegram notifications disabled');
    }
  }
};

initTelegramBot();

// Main notification service
export class NotificationService {
  private static instance: NotificationService | undefined;
  private telegramService: any;

  private constructor() {
    // Private constructor to prevent direct instantiation
    if (NotificationService.instance) {
      throw new Error("Error: Instantiation failed: Use NotificationService.getInstance() instead of new.");
    }
    this.telegramService = null; // Will be set when needed
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Allows resetting the singleton instance for testing
  static resetInstance() {
    NotificationService.instance = undefined;
  }

  // Allows setting the Telegram service for testing
  setTelegramService(service: any) {
    this.telegramService = service;
  }

  // Send notification through all specified channels
  public static async send(notification: NotificationData): Promise<void> {
    const instance = NotificationService.getInstance();
    return instance.sendInstance(notification);
  }

  // Instance method for sending notifications
  private async sendInstance(notification: NotificationData): Promise<void> {
    try {
      logger.info('Sending notification:', {
        type: notification.type,
        priority: notification.priority,
        channels: notification.channels,
        recipients: notification.recipients.length,
      });

      // Store notification in database
      await NotificationService.storeNotification(notification);

      // Send through each channel
      const promises = notification.channels.map(channel => {
        switch (channel) {
          case NotificationChannel.EMAIL:
            return NotificationService.sendEmail(notification);
          case NotificationChannel.TELEGRAM:
            return NotificationService.sendTelegram(notification);
          case NotificationChannel.PUSH:
            return NotificationService.sendPush(notification);
          case NotificationChannel.SOCKET:
            return NotificationService.sendSocket(notification);
          default:
            return Promise.resolve();
        }
      });

      await Promise.allSettled(promises);
      logger.info('Notification sent successfully');

    } catch (error) {
      logger.error('Failed to send notification:', serializeError(error));
    }
  }

  // Store notification in database
  private static async storeNotification(notification: NotificationData): Promise<void> {
    const payloads = notification.recipients.map(recipientId => ({
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      channels: JSON.stringify(notification.channels),
      data: notification.data ? JSON.stringify(notification.data) : null,
      userId: recipientId,
      storeId: notification.storeId || null,
      orderId: notification.orderId || null,
    }));

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await prisma.notification.createMany({ data: payloads });
        logger.info('Stored notifications in database', {
          count: payloads.length,
          type: notification.type,
          priority: notification.priority,
        });
        return;
      } catch (error) {
        logger.error('Failed to store notifications in database', serializeError(error));

        if (attempt === maxAttempts) {
          logger.error('Exceeded retry attempts for saving notifications', {
            recipients: notification.recipients.length,
            type: notification.type,
          });
          return;
        }

        const delay = Math.pow(2, attempt) * 1000;
        logger.warn('Retrying notification storage with backoff', {
          attempt,
          delay,
          recipients: notification.recipients.length,
          type: notification.type,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Send email notification
  private static async sendEmail(notification: NotificationData): Promise<void> {
    if (!emailTransporter) {
      logger.warn('Email transporter not configured');
      return;
    }

    try {
      // Get recipient emails
      const recipients = await prisma.user.findMany({
        where: {
          id: { in: notification.recipients },
          email: { not: null },
        },
        select: { email: true, firstName: true, lastName: true },
      });

      if (recipients.length === 0) {
        logger.warn('No email recipients found');
        return;
      }

      const emailPromises = recipients.map(recipient => {
        if (!recipient.email) return Promise.resolve();

        const html = this.generateEmailHTML(notification, recipient);

        if (!emailTransporter) return Promise.resolve();

        return emailTransporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@telegram-ecommerce.com',
          to: recipient.email,
          subject: `[${notification.priority}] ${notification.title}`,
          html,
        });
      });

      await Promise.allSettled(emailPromises);
      logger.info(`Email notifications sent to ${recipients.length} recipients`);

    } catch (error) {
      logger.error('Failed to send email notifications:', serializeError(error));
    }
  }

  // Send Telegram notification
  private static async sendTelegram(notification: NotificationData): Promise<void> {
    if (!telegramBot) {
      logger.warn('Telegram bot not configured');
      return;
    }

    try {
      // Get recipient Telegram IDs
      const recipients = await prisma.user.findMany({
        where: {
          id: { in: notification.recipients },
          telegramId: { not: null },
        },
        select: { telegramId: true, firstName: true, lastName: true },
      });

      if (recipients.length === 0) {
        logger.warn('No Telegram recipients found');
        return;
      }

      const telegramMessage = this.generateTelegramMessage(notification);

      const telegramPromises = recipients.map(recipient => {
        return telegramBot.sendMessage(recipient.telegramId, telegramMessage, {
          parse_mode: 'Markdown',
          disable_notification: notification.priority === NotificationPriority.LOW,
        });
      });

      await Promise.allSettled(telegramPromises);
      logger.info(`Telegram notifications sent to ${recipients.length} recipients`);

    } catch (error) {
      logger.error('Failed to send Telegram notifications:', error);
    }
  }

  // Send push notification through WebSocket
  private static async sendPush(notification: NotificationData): Promise<void> {
    try {
      // For now, we'll use Socket.IO as our push notification mechanism
      // In a production setup, you'd integrate with services like Firebase

      const pushData = {
        type: 'push_notification',
        notification: {
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          type: notification.type,
          data: notification.data,
        }
      };

      // Send to specific recipients
      notification.recipients.forEach(recipientId => {
        getIO().to(`user_${recipientId}`).emit('push_notification', pushData);
      });

      logger.info(`Push notifications sent to ${notification.recipients.length} recipients`);

    } catch (error) {
      logger.error('Failed to send push notifications:', error);
    }
  }

  // Send real-time notification through Socket.IO
  private static async sendSocket(notification: NotificationData): Promise<void> {
    try {
      const socketData = {
        type: 'real_time_notification',
        notification: {
          id: Date.now().toString(),
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          type: notification.type,
          data: notification.data,
          timestamp: new Date().toISOString(),
        }
      };

      // Import SocketRoomService dynamically to avoid circular dependencies
      const { SocketRoomService } = await import('./socketRoomService.js');

      // Send to specific recipients
      notification.recipients.forEach(recipientId => {
        SocketRoomService.notifyUser(recipientId, 'notification', socketData);
      });

      // Also send to admin rooms if it's a high priority notification
      if (notification.priority === NotificationPriority.HIGH ||
          notification.priority === NotificationPriority.CRITICAL) {
        SocketRoomService.notifyAdmins('notification', socketData);
      }

      // If notification is store-specific, also send to store room
      if (notification.data?.storeId) {
        SocketRoomService.notifyStore(notification.data.storeId as string, 'notification', socketData);
      }

      logger.info(`Socket notifications sent to ${notification.recipients.length} recipients`);

    } catch (error) {
      logger.error('Failed to send socket notifications:', error);
    }
  }

  // Generate email HTML template
  private static generateEmailHTML(notification: NotificationData, recipient: EmailRecipient): string {
    const priorityColors = {
      [NotificationPriority.LOW]: '#28a745',
      [NotificationPriority.MEDIUM]: '#ffc107',
      [NotificationPriority.HIGH]: '#fd7e14',
      [NotificationPriority.CRITICAL]: '#dc3545',
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Notification</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: ${priorityColors[notification.priority]}; color: white; padding: 20px; }
            .content { padding: 20px; }
            .priority-badge { background: ${priorityColors[notification.priority]}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; }
            .data-section { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">${notification.title}</h1>
                <span class="priority-badge">${notification.priority}</span>
            </div>
            <div class="content">
                <p>Привет, ${recipient.firstName || 'Админ'}!</p>
                <p>${notification.message}</p>

                ${notification.data ? `
                <div class="data-section">
                    <strong>Дополнительная информация:</strong>
                    <pre>${JSON.stringify(notification.data, null, 2)}</pre>
                </div>` : ''}

                <p style="margin-top: 20px;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
                       style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                        Открыть админ панель
                    </a>
                </p>
            </div>
            <div class="footer">
                Telegram E-commerce Admin System<br>
                ${new Date().toLocaleString('ru-RU')}
            </div>
        </div>
    </body>
    </html>`;
  }

  // Generate Telegram message
  private static generateTelegramMessage(notification: NotificationData): string {
    const priorityEmojis = {
      [NotificationPriority.LOW]: '💡',
      [NotificationPriority.MEDIUM]: '⚠️',
      [NotificationPriority.HIGH]: '🔥',
      [NotificationPriority.CRITICAL]: '🚨',
    };

    let message = `${priorityEmojis[notification.priority]} *${notification.title}*\n\n`;
    message += `${notification.message}\n\n`;

    if (notification.data) {
      message += `📊 *Детали:*\n`;
      Object.entries(notification.data).forEach(([key, value]) => {
        message += `• ${key}: ${value}\n`;
      });
      message += '\n';
    }

    message += `⏰ ${new Date().toLocaleString('ru-RU')}\n`;
    message += `🏷️ Приоритет: ${notification.priority}`;

    return message;
  }

  // Helper methods for common notification types
  static async notifyOrderCreated(orderId: string, storeId: string, customerInfo: CustomerInfo): Promise<void> {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { owner: true, admins: { include: { user: true } } }
    });

    if (!store) return;

    const recipients = [store.owner.id, ...store.admins.map(a => a.user.id)];

    await NotificationService.send({
      type: NotificationType.ORDER_CREATED,
      title: `Новый заказ в магазине ${store.name}`,
      message: `Поступил новый заказ от ${customerInfo.name}. Требуется подтверждение оплаты.`,
      priority: NotificationPriority.HIGH,
      channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.SOCKET],
      recipients,
      storeId,
      orderId,
      data: {
        storeName: store.name,
        customerName: customerInfo.name,
        orderNumber: orderId,
      }
    });
  }

  static async notifyLowStock(productId: string, currentStock: number, threshold: number): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        store: {
          include: {
            owner: true,
            admins: { include: { user: true } }
          }
        }
      }
    });

    if (!product) return;

    const recipients = [product.store.owner.id, ...product.store.admins.map(a => a.user.id)];

    await NotificationService.send({
      type: NotificationType.LOW_STOCK,
      title: `Мало товара: ${product.name}`,
      message: `Товар "${product.name}" заканчивается. Осталось: ${currentStock} шт.`,
      priority: NotificationPriority.MEDIUM,
      channels: [NotificationChannel.EMAIL, NotificationChannel.SOCKET],
      recipients,
      storeId: product.storeId,
      data: {
        productName: product.name,
        currentStock,
        threshold,
        storeName: product.store.name,
      }
    });
  }

  static async notifyPaymentProofUploaded(orderId: string, storeId: string, customerInfo: CustomerInfo): Promise<void> {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { owner: true, admins: { include: { user: true } } }
    });

    if (!store) return;

    const recipients = [store.owner.id, ...store.admins.map(a => a.user.id)];

    await NotificationService.send({
      type: NotificationType.PAYMENT_PROOF_UPLOADED,
      title: `Чек загружен для заказа в ${store.name}`,
      message: `Клиент ${customerInfo.name} загрузил чек оплаты. Требуется проверка и подтверждение.`,
      priority: NotificationPriority.HIGH,
      channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.SOCKET],
      recipients,
      storeId,
      orderId,
      data: {
        storeName: store.name,
        customerName: customerInfo.name,
        orderNumber: orderId,
        customerTelegramId: customerInfo.telegramId,
        customerUsername: customerInfo.username,
      }
    });
  }

  static async notifySystemError(error: string, details: Record<string, unknown>): Promise<void> {
    // Notify system administrators (OWNER role users)
    const owners = await prisma.user.findMany({
      where: { role: 'OWNER', isActive: true },
      select: { id: true }
    });

    if (owners.length === 0) return;

    await NotificationService.send({
      type: NotificationType.SYSTEM_ERROR,
      title: 'Системная ошибка',
      message: `Произошла ошибка в системе: ${error}`,
      priority: NotificationPriority.CRITICAL,
      channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM],
      recipients: owners.map(o => o.id),
      data: {
        error,
        details,
        timestamp: new Date().toISOString(),
      }
    });
  }

  // Alias for backward compatibility
  static async sendNotification(notification: NotificationData): Promise<void> {
    return NotificationService.send(notification);
  }
}

export default NotificationService;

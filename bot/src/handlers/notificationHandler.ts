import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { sanitizeForLog } from '../utils/sanitizer';

export interface CustomerNotificationData {
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

export class NotificationHandler {
  constructor(private bot: TelegramBot) {}

  async sendCustomerNotification(notification: CustomerNotificationData): Promise<void> {
    try {
      const message = this.formatNotificationMessage(notification);
      const keyboard = this.getNotificationKeyboard(notification);

      await this.bot.sendMessage(notification.telegramId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      logger.info(`Customer notification sent: ${notification.type} to ${notification.telegramId} for order ${notification.orderData.orderNumber}`);
    } catch (error) {
      logger.error('Failed to send customer notification:', error);
      throw error;
    }
  }

  private formatNotificationMessage(notification: CustomerNotificationData): string {
    const { orderData, additionalData } = notification;
    const orderNumber = orderData.orderNumber;

    switch (notification.type) {
      case 'payment_confirmed':
        return `✅ *Оплата подтверждена!*\n\n` +
               `🧾 Заказ: ${orderNumber}\n` +
               `🏪 Магазин: ${orderData.storeName}\n` +
               `💳 Сумма: ${orderData.totalAmount} ${orderData.currency}\n\n` +
               `🎉 Спасибо за покупку! Ваш заказ принят в обработку.\n` +
               `📦 Мы уведомим вас о статусе доставки.`;

      case 'order_rejected':
        return `❌ *Заказ отклонен*\n\n` +
               `🧾 Заказ: ${orderNumber}\n` +
               `🏪 Магазин: ${orderData.storeName}\n` +
               `💰 Сумма: ${orderData.totalAmount} ${orderData.currency}\n\n` +
               `${additionalData?.reason ? `📝 Причина: ${additionalData.reason}\n\n` : ''}` +
               `📞 Если у вас есть вопросы, свяжитесь с поддержкой магазина.`;

      case 'order_shipped':
        return `📦 *Заказ отправлен!*\n\n` +
               `🧾 Заказ: ${orderNumber}\n` +
               `🏪 Магазин: ${orderData.storeName}\n\n` +
               `🚚 Ваш заказ в пути!\n` +
               `${additionalData?.trackingNumber ? `📋 Трек-номер: \`${additionalData.trackingNumber}\`\n` : ''}` +
               `${additionalData?.carrier ? `🚛 Служба доставки: ${additionalData.carrier}\n` : ''}` +
               `\n📱 Отслеживайте статус доставки через наш бот.`;

      case 'order_delivered':
        return `✅ *Заказ доставлен!*\n\n` +
               `🧾 Заказ: ${orderNumber}\n` +
               `🏪 Магазин: ${orderData.storeName}\n\n` +
               `🎉 Ваш заказ успешно доставлен!\n` +
               `⭐ Мы будем благодарны за отзыв о покупке.\n\n` +
               `💫 Спасибо, что выбираете нас!`;

      case 'order_cancelled':
        return `🚫 *Заказ отменен*\n\n` +
               `🧾 Заказ: ${orderNumber}\n` +
               `🏪 Магазин: ${orderData.storeName}\n\n` +
               `${additionalData?.reason ? `📝 Причина: ${additionalData.reason}\n\n` : ''}` +
               `💰 Если была произведена оплата, средства будут возвращены.\n` +
               `📞 По вопросам обращайтесь в поддержку.`;

      default:
        return `📬 *Обновление заказа*\n\n` +
               `🧾 Заказ: ${orderNumber}\n` +
               `🏪 Магазин: ${orderData.storeName}\n\n` +
               `ℹ️ Статус вашего заказа изменился.`;
    }
  }

  private getNotificationKeyboard(notification: CustomerNotificationData) {
    const keyboard = {
      inline_keyboard: [] as any[]
    };

    // Always show order details button
    keyboard.inline_keyboard.push([
      { text: '📋 Детали заказа', callback_data: `order_view_${notification.orderData.orderId}` }
    ]);

    // Type-specific buttons
    switch (notification.type) {
      case 'payment_confirmed':
      case 'order_shipped':
      case 'order_delivered':
        keyboard.inline_keyboard.push([
          { text: '🏪 Магазины', callback_data: 'store_list' },
          { text: '📋 Мои заказы', callback_data: 'order_list' }
        ]);
        break;

      case 'order_rejected':
      case 'order_cancelled':
        keyboard.inline_keyboard.push([
          { text: '🔄 Сделать новый заказ', callback_data: 'store_list' },
          { text: '📋 Мои заказы', callback_data: 'order_list' }
        ]);
        break;
    }

    return keyboard;
  }

  // Send notification with retry logic
  async sendCustomerNotificationWithRetry(
    notification: CustomerNotificationData,
    maxRetries: number = 3
  ): Promise<boolean> {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        await this.sendCustomerNotification(notification);
        return true;
      } catch (error) {
        attempts++;
        logger.warn(`Notification attempt ${attempts} failed for customer ${sanitizeForLog(notification.telegramId)}:`, error);

        if (attempts >= maxRetries) {
          logger.error(`Failed to send notification after ${maxRetries} attempts to customer ${sanitizeForLog(notification.telegramId)}`);
          return false;
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return false;
  }

  // Send bulk notifications (for admin announcements)
  async sendBulkNotification(
    telegramIds: string[],
    message: string,
    keyboard?: any
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const telegramId of telegramIds) {
      try {
        await this.bot.sendMessage(telegramId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        success++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Failed to send bulk notification to ${sanitizeForLog(telegramId)}:`, error);
        failed++;
      }
    }

    logger.info(`Bulk notification results: ${success} sent, ${failed} failed`);
    return { success, failed };
  }
}

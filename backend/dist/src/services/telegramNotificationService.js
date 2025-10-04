"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramNotificationService = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
class TelegramNotificationService {
    constructor() {
        this.botApiUrl = process.env.TELEGRAM_BOT_API_URL || 'http://localhost:3003/api';
    }
    async notifyCustomerPaymentConfirmed(order) {
        try {
            const notification = {
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
            logger_1.logger.info(`Payment confirmation notification sent to customer ${(0, sanitizer_1.sanitizeForLog)(order.customer.telegramId || '')} for order ${(0, sanitizer_1.sanitizeForLog)(order.orderNumber)}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send payment confirmation notification:', error);
        }
    }
    async notifyCustomerOrderRejected(order, reason) {
        try {
            const notification = {
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
            logger_1.logger.info('Order rejection notification sent', {
                customerId: order.customer.telegramId,
                orderNumber: order.orderNumber
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send order rejection notification:', error);
        }
    }
    async notifyCustomerOrderShipped(order, trackingNumber, carrier) {
        try {
            const notification = {
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
            logger_1.logger.info('Order shipped notification sent', {
                customerId: order.customer.telegramId,
                orderNumber: order.orderNumber
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send order shipped notification:', error);
        }
    }
    async notifyCustomerOrderDelivered(order) {
        try {
            const notification = {
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
            logger_1.logger.info(`Order delivered notification sent to customer ${(0, sanitizer_1.sanitizeForLog)(order.customer.telegramId || '')} for order ${(0, sanitizer_1.sanitizeForLog)(order.orderNumber)}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send order delivered notification:', error);
        }
    }
    async notifyCustomerOrderCancelled(order, reason) {
        try {
            const notification = {
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
            logger_1.logger.info('Order cancellation notification sent', {
                customerId: order.customer.telegramId,
                orderNumber: order.orderNumber
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send order cancellation notification:', error);
        }
    }
    async sendNotification(notification) {
        try {
            const urlValidation = await import('../utils/urlValidator').then(m => m.validateUrl);
            const validation = urlValidation(`${this.botApiUrl}/notify-customer`, {
                allowPrivateIPs: process.env.NODE_ENV === 'development',
                allowedProtocols: ['http:', 'https:']
            });
            if (!validation.valid) {
                throw new Error(`Invalid bot API URL: ${validation.error}`);
            }
            const response = await axios_1.default.post(`${this.botApiUrl}/notify-customer`, notification, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            });
            if (response.status !== 200) {
                throw new Error(`Bot API returned status ${response.status}: ${response.statusText}`);
            }
            logger_1.logger.debug('Notification sent successfully to bot API', {
                customerId: notification.telegramId
            });
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED') {
                    logger_1.logger.warn('Telegram bot is not available - notification queued for retry');
                    await this.queueNotificationForRetry(notification);
                }
                else {
                    logger_1.logger.error('HTTP error sending notification to bot:', {
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        data: error.response?.data,
                    });
                }
            }
            else {
                logger_1.logger.error('Unexpected error sending notification to bot:', error);
            }
            throw error;
        }
    }
    async queueNotificationForRetry(notification) {
        try {
            await prisma_1.prisma.adminLog.create({
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
            logger_1.logger.info(`Notification queued for retry: ${(0, sanitizer_1.sanitizeForLog)(notification.type)} for customer ${(0, sanitizer_1.sanitizeForLog)(notification.telegramId)}`);
        }
        catch (dbError) {
            logger_1.logger.error('Failed to queue notification for retry:', dbError);
        }
    }
    async retryFailedNotifications() {
        try {
            const failedNotifications = await prisma_1.prisma.adminLog.findMany({
                where: {
                    action: 'NOTIFICATION_RETRY_QUEUE',
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
                orderBy: {
                    createdAt: 'asc',
                },
                take: 10,
            });
            for (const log of failedNotifications) {
                try {
                    const logData = JSON.parse(log.details || '{}');
                    const notification = logData.notification;
                    if (notification) {
                        await this.sendNotification(notification);
                        await prisma_1.prisma.adminLog.delete({
                            where: { id: log.id },
                        });
                        logger_1.logger.info(`Successfully retried notification for customer ${notification.telegramId}`);
                    }
                }
                catch (retryError) {
                    logger_1.logger.error(`Failed to retry notification ${log.id}:`, retryError);
                    if (log.createdAt < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
                        await prisma_1.prisma.adminLog.delete({
                            where: { id: log.id },
                        });
                        logger_1.logger.info(`Removed expired retry notification ${log.id}`);
                    }
                }
            }
            if (failedNotifications.length > 0) {
                logger_1.logger.info(`Processed ${failedNotifications.length} retry notifications`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error during notification retry process:', error);
        }
    }
    async checkBotHealth() {
        try {
            const healthUrl = `${this.botApiUrl}/health`;
            const allowedDomains = ['localhost', '127.0.0.1'];
            if (process.env.BOT_API_DOMAIN) {
                allowedDomains.push(process.env.BOT_API_DOMAIN);
            }
            const safeUrl = (0, sanitizer_1.sanitizeUrl)(healthUrl, allowedDomains);
            const response = await axios_1.default.get(safeUrl, {
                timeout: 5000,
            });
            return response.status === 200;
        }
        catch (error) {
            logger_1.logger.warn('Bot health check failed:', error);
            return false;
        }
    }
}
exports.telegramNotificationService = new TelegramNotificationService();
//# sourceMappingURL=telegramNotificationService.js.map
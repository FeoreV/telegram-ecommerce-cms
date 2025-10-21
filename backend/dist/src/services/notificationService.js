"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = exports.NotificationPriority = exports.NotificationChannel = exports.NotificationType = void 0;
const nodemailer = __importStar(require("nodemailer"));
const prisma_1 = require("../lib/prisma");
const socket_1 = require("../lib/socket");
const logger_1 = require("../utils/logger");
var NotificationType;
(function (NotificationType) {
    NotificationType["ORDER_CREATED"] = "ORDER_CREATED";
    NotificationType["ORDER_PAID"] = "ORDER_PAID";
    NotificationType["ORDER_REJECTED"] = "ORDER_REJECTED";
    NotificationType["ORDER_SHIPPED"] = "ORDER_SHIPPED";
    NotificationType["ORDER_DELIVERED"] = "ORDER_DELIVERED";
    NotificationType["ORDER_CANCELLED"] = "ORDER_CANCELLED";
    NotificationType["PAYMENT_CONFIRMED"] = "PAYMENT_CONFIRMED";
    NotificationType["PAYMENT_PROOF_UPLOADED"] = "PAYMENT_PROOF_UPLOADED";
    NotificationType["LOW_STOCK"] = "LOW_STOCK";
    NotificationType["OUT_OF_STOCK"] = "OUT_OF_STOCK";
    NotificationType["SYSTEM_ERROR"] = "SYSTEM_ERROR";
    NotificationType["ADMIN_LOGIN"] = "ADMIN_LOGIN";
    NotificationType["BULK_OPERATION"] = "BULK_OPERATION";
    NotificationType["STORE_CREATED"] = "STORE_CREATED";
    NotificationType["USER_REGISTERED"] = "USER_REGISTERED";
    NotificationType["BOT_CREATED"] = "BOT_CREATED";
    NotificationType["BOT_ACTIVATED"] = "BOT_ACTIVATED";
    NotificationType["BOT_DEACTIVATED"] = "BOT_DEACTIVATED";
    NotificationType["BOT_ERROR"] = "BOT_ERROR";
    NotificationType["BOT_RESTARTED"] = "BOT_RESTARTED";
    NotificationType["EMPLOYEE_INVITATION"] = "EMPLOYEE_INVITATION";
    NotificationType["EMPLOYEE_JOINED"] = "EMPLOYEE_JOINED";
    NotificationType["EMPLOYEE_INVITATION_REJECTED"] = "EMPLOYEE_INVITATION_REJECTED";
    NotificationType["EMPLOYEE_REMOVED"] = "EMPLOYEE_REMOVED";
    NotificationType["SECURITY_ALERT"] = "SECURITY_ALERT";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["EMAIL"] = "EMAIL";
    NotificationChannel["TELEGRAM"] = "TELEGRAM";
    NotificationChannel["PUSH"] = "PUSH";
    NotificationChannel["SOCKET"] = "SOCKET";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "LOW";
    NotificationPriority["MEDIUM"] = "MEDIUM";
    NotificationPriority["HIGH"] = "HIGH";
    NotificationPriority["CRITICAL"] = "CRITICAL";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
let emailTransporter = null;
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
        logger_1.logger.info('Email transporter initialized');
    }
    else {
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (isDevelopment) {
            logger_1.logger.info('Email not configured - email notifications disabled (development mode)');
        }
        else {
            logger_1.logger.warn('Email configuration missing - email notifications disabled');
        }
    }
};
initEmailTransporter();
let telegramBot = null;
const initTelegramBot = async () => {
    if (process.env.ADMIN_TELEGRAM_BOT_TOKEN) {
        try {
            const TelegramBot = await import('node-telegram-bot-api');
            telegramBot = new TelegramBot.default(process.env.ADMIN_TELEGRAM_BOT_TOKEN, { polling: false });
            logger_1.logger.info('Admin Telegram bot initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Telegram bot:', error);
        }
    }
    else {
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (isDevelopment) {
            logger_1.logger.info('Admin Telegram bot not configured - admin notifications disabled (development mode)');
        }
        else {
            logger_1.logger.warn('Admin Telegram bot token missing - Telegram notifications disabled');
        }
    }
};
initTelegramBot();
class NotificationService {
    constructor() {
        if (NotificationService.instance) {
            throw new Error("Error: Instantiation failed: Use NotificationService.getInstance() instead of new.");
        }
        this.telegramService = null;
    }
    static getInstance() {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }
    static resetInstance() {
        NotificationService.instance = undefined;
    }
    setTelegramService(service) {
        this.telegramService = service;
    }
    static async send(notification) {
        const instance = NotificationService.getInstance();
        return instance.sendInstance(notification);
    }
    async sendInstance(notification) {
        try {
            logger_1.logger.info('Sending notification:', {
                type: notification.type,
                priority: notification.priority,
                channels: notification.channels,
                recipients: notification.recipients.length,
            });
            await NotificationService.storeNotification(notification);
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
            logger_1.logger.info('Notification sent successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to send notification:', (0, logger_1.serializeError)(error));
        }
    }
    static async storeNotification(notification) {
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
                await prisma_1.prisma.notification.createMany({ data: payloads });
                logger_1.logger.info('Stored notifications in database', {
                    count: payloads.length,
                    type: notification.type,
                    priority: notification.priority,
                });
                return;
            }
            catch (error) {
                logger_1.logger.error('Failed to store notifications in database', (0, logger_1.serializeError)(error));
                if (attempt === maxAttempts) {
                    logger_1.logger.error('Exceeded retry attempts for saving notifications', {
                        recipients: notification.recipients.length,
                        type: notification.type,
                    });
                    return;
                }
                const delay = Math.pow(2, attempt) * 1000;
                logger_1.logger.warn('Retrying notification storage with backoff', {
                    attempt,
                    delay,
                    recipients: notification.recipients.length,
                    type: notification.type,
                });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    static async sendEmail(notification) {
        if (!emailTransporter) {
            logger_1.logger.warn('Email transporter not configured');
            return;
        }
        try {
            const recipients = await prisma_1.prisma.user.findMany({
                where: {
                    id: { in: notification.recipients },
                    email: { not: null },
                },
                select: { email: true, firstName: true, lastName: true },
            });
            if (recipients.length === 0) {
                logger_1.logger.warn('No email recipients found');
                return;
            }
            const emailPromises = recipients.map(recipient => {
                if (!recipient.email)
                    return Promise.resolve();
                const html = this.generateEmailHTML(notification, recipient);
                if (!emailTransporter)
                    return Promise.resolve();
                return emailTransporter.sendMail({
                    from: process.env.SMTP_FROM || 'noreply@telegram-ecommerce.com',
                    to: recipient.email,
                    subject: `[${notification.priority}] ${notification.title}`,
                    html,
                });
            });
            await Promise.allSettled(emailPromises);
            logger_1.logger.info(`Email notifications sent to ${recipients.length} recipients`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send email notifications:', (0, logger_1.serializeError)(error));
        }
    }
    static async sendTelegram(notification) {
        if (!telegramBot) {
            logger_1.logger.warn('Telegram bot not configured');
            return;
        }
        try {
            const recipients = await prisma_1.prisma.user.findMany({
                where: {
                    id: { in: notification.recipients },
                    telegramId: { not: null },
                },
                select: { telegramId: true, firstName: true, lastName: true },
            });
            if (recipients.length === 0) {
                logger_1.logger.warn('No Telegram recipients found');
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
            logger_1.logger.info(`Telegram notifications sent to ${recipients.length} recipients`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send Telegram notifications:', error);
        }
    }
    static async sendPush(notification) {
        try {
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
            notification.recipients.forEach(recipientId => {
                (0, socket_1.getIO)().to(`user_${recipientId}`).emit('push_notification', pushData);
            });
            logger_1.logger.info(`Push notifications sent to ${notification.recipients.length} recipients`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send push notifications:', error);
        }
    }
    static async sendSocket(notification) {
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
            const { SocketRoomService } = await import('./socketRoomService.js');
            notification.recipients.forEach(recipientId => {
                SocketRoomService.notifyUser(recipientId, 'notification', socketData);
            });
            if (notification.priority === NotificationPriority.HIGH ||
                notification.priority === NotificationPriority.CRITICAL) {
                SocketRoomService.notifyAdmins('notification', socketData);
            }
            if (notification.data?.storeId) {
                SocketRoomService.notifyStore(notification.data.storeId, 'notification', socketData);
            }
            logger_1.logger.info(`Socket notifications sent to ${notification.recipients.length} recipients`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send socket notifications:', error);
        }
    }
    static generateEmailHTML(notification, recipient) {
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
    static generateTelegramMessage(notification) {
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
    static async notifyOrderCreated(orderId, storeId, customerInfo) {
        const store = await prisma_1.prisma.store.findUnique({
            where: { id: storeId },
            include: { owner: true, admins: { include: { user: true } } }
        });
        if (!store)
            return;
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
    static async notifyLowStock(productId, currentStock, threshold) {
        const product = await prisma_1.prisma.product.findUnique({
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
        if (!product)
            return;
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
    static async notifyPaymentProofUploaded(orderId, storeId, customerInfo) {
        const store = await prisma_1.prisma.store.findUnique({
            where: { id: storeId },
            include: { owner: true, admins: { include: { user: true } } }
        });
        if (!store)
            return;
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
    static async notifySystemError(error, details) {
        const owners = await prisma_1.prisma.user.findMany({
            where: { role: 'OWNER', isActive: true },
            select: { id: true }
        });
        if (owners.length === 0)
            return;
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
    static async sendNotification(notification) {
        return NotificationService.send(notification);
    }
}
exports.NotificationService = NotificationService;
exports.default = NotificationService;
//# sourceMappingURL=notificationService.js.map
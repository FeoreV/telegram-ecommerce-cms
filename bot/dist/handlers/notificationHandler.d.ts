import TelegramBot from 'node-telegram-bot-api';
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
export declare class NotificationHandler {
    private bot;
    constructor(bot: TelegramBot);
    sendCustomerNotification(notification: CustomerNotificationData): Promise<void>;
    private formatNotificationMessage;
    private getNotificationKeyboard;
    sendCustomerNotificationWithRetry(notification: CustomerNotificationData, maxRetries?: number): Promise<boolean>;
    sendBulkNotification(telegramIds: string[], message: string, keyboard?: any): Promise<{
        success: number;
        failed: number;
    }>;
}
//# sourceMappingURL=notificationHandler.d.ts.map
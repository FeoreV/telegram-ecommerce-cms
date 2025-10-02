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
declare class TelegramNotificationService {
    private botApiUrl;
    constructor();
    notifyCustomerPaymentConfirmed(order: OrderForNotification): Promise<void>;
    notifyCustomerOrderRejected(order: OrderForNotification, reason: string): Promise<void>;
    notifyCustomerOrderShipped(order: OrderForNotification, trackingNumber?: string, carrier?: string): Promise<void>;
    notifyCustomerOrderDelivered(order: OrderForNotification): Promise<void>;
    notifyCustomerOrderCancelled(order: OrderForNotification, reason: string): Promise<void>;
    private sendNotification;
    private queueNotificationForRetry;
    retryFailedNotifications(): Promise<void>;
    checkBotHealth(): Promise<boolean>;
}
export declare const telegramNotificationService: TelegramNotificationService;
export {};
//# sourceMappingURL=telegramNotificationService.d.ts.map
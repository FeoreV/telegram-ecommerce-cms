interface CustomerInfo {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    telegramId?: string;
}
export declare enum NotificationType {
    ORDER_CREATED = "ORDER_CREATED",
    ORDER_PAID = "ORDER_PAID",
    ORDER_REJECTED = "ORDER_REJECTED",
    ORDER_SHIPPED = "ORDER_SHIPPED",
    ORDER_DELIVERED = "ORDER_DELIVERED",
    ORDER_CANCELLED = "ORDER_CANCELLED",
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED",
    PAYMENT_PROOF_UPLOADED = "PAYMENT_PROOF_UPLOADED",
    LOW_STOCK = "LOW_STOCK",
    OUT_OF_STOCK = "OUT_OF_STOCK",
    SYSTEM_ERROR = "SYSTEM_ERROR",
    ADMIN_LOGIN = "ADMIN_LOGIN",
    BULK_OPERATION = "BULK_OPERATION",
    STORE_CREATED = "STORE_CREATED",
    USER_REGISTERED = "USER_REGISTERED",
    BOT_CREATED = "BOT_CREATED",
    BOT_ACTIVATED = "BOT_ACTIVATED",
    BOT_DEACTIVATED = "BOT_DEACTIVATED",
    BOT_ERROR = "BOT_ERROR",
    BOT_RESTARTED = "BOT_RESTARTED",
    EMPLOYEE_INVITATION = "EMPLOYEE_INVITATION",
    EMPLOYEE_JOINED = "EMPLOYEE_JOINED",
    EMPLOYEE_INVITATION_REJECTED = "EMPLOYEE_INVITATION_REJECTED",
    EMPLOYEE_REMOVED = "EMPLOYEE_REMOVED",
    SECURITY_ALERT = "SECURITY_ALERT"
}
export declare enum NotificationChannel {
    EMAIL = "EMAIL",
    TELEGRAM = "TELEGRAM",
    PUSH = "PUSH",
    SOCKET = "SOCKET"
}
export declare enum NotificationPriority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export interface NotificationData {
    type: NotificationType;
    title: string;
    message: string;
    priority: NotificationPriority;
    channels: NotificationChannel[];
    recipients: string[];
    data?: Record<string, unknown>;
    storeId?: string;
    orderId?: string;
}
export declare class NotificationService {
    private static instance;
    private telegramService;
    private constructor();
    static getInstance(): NotificationService;
    static resetInstance(): void;
    setTelegramService(service: TelegramNotificationService): void;
    send(notification: NotificationData): Promise<void>;
    private static storeNotification;
    private static sendEmail;
    private static sendTelegram;
    private static sendPush;
    private static sendSocket;
    private static generateEmailHTML;
    private static generateTelegramMessage;
    static notifyOrderCreated(orderId: string, storeId: string, customerInfo: CustomerInfo): Promise<void>;
    static notifyLowStock(productId: string, currentStock: number, threshold: number): Promise<void>;
    static notifyPaymentProofUploaded(orderId: string, storeId: string, customerInfo: CustomerInfo): Promise<void>;
    static notifySystemError(error: string, details: Record<string, unknown>): Promise<void>;
    static sendNotification(notification: NotificationData): Promise<void>;
}
export default NotificationService;
//# sourceMappingURL=notificationService.d.ts.map
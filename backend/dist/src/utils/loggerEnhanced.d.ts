import winston from 'winston';
export declare const LOG_LEVELS: {
    readonly error: 0;
    readonly warn: 1;
    readonly info: 2;
    readonly http: 3;
    readonly verbose: 4;
    readonly debug: 5;
    readonly silly: 6;
};
export declare enum LogCategory {
    SECURITY = "security",
    AUTH = "auth",
    DATABASE = "database",
    API = "api",
    SOCKET = "socket",
    NOTIFICATION = "notification",
    ORDER = "order",
    PAYMENT = "payment",
    SYSTEM = "system",
    PERFORMANCE = "performance",
    AUDIT = "audit"
}
export interface LogMetadata {
    category?: LogCategory;
    userId?: string;
    sessionId?: string;
    orderId?: string;
    storeId?: string;
    ip?: string;
    userAgent?: string;
    duration?: number;
    statusCode?: number;
    requestId?: string;
    component?: string;
    action?: string;
    [key: string]: unknown;
}
export declare const maskSensitiveData: (data: unknown, depth?: number) => unknown;
export declare const serializeError: (error: unknown) => Record<string, unknown>;
declare class EnhancedLogger {
    private winston;
    constructor(existingLogger?: winston.Logger, skipInitializationLog?: boolean);
    get winstonInstance(): winston.Logger;
    error(message: string, metadata?: LogMetadata): void;
    warn(message: string, metadata?: LogMetadata): void;
    info(message: string, metadata?: LogMetadata): void;
    http(message: string, metadata?: LogMetadata): void;
    debug(message: string, metadata?: LogMetadata): void;
    verbose(message: string, metadata?: LogMetadata): void;
    security(message: string, metadata?: Omit<LogMetadata, 'category'>): void;
    auth(message: string, metadata?: Omit<LogMetadata, 'category'>): void;
    audit(message: string, metadata?: Omit<LogMetadata, 'category'>): void;
    performance(message: string, metadata?: Omit<LogMetadata, 'category'>): void;
    database(message: string, metadata?: Omit<LogMetadata, 'category'>): void;
    socket(message: string, metadata?: Omit<LogMetadata, 'category'>): void;
    order(message: string, metadata?: Omit<LogMetadata, 'category'>): void;
    payment(message: string, metadata?: Omit<LogMetadata, 'category'>): void;
    notification(message: string, metadata?: Omit<LogMetadata, 'category'>): void;
    logError(error: unknown, message?: string, metadata?: LogMetadata): void;
    timer(label: string, metadata?: LogMetadata): {
        end: () => number;
    };
    logRequest(req: {
        method?: string;
        url?: string;
        ip?: string;
        userAgent?: string;
        get?: (header: string) => string | undefined;
        id?: string;
        [key: string]: unknown;
    }, metadata?: LogMetadata): void;
    logResponse(req: {
        method?: string;
        url?: string;
        id?: string;
        [key: string]: unknown;
    }, res: {
        statusCode?: number;
        [key: string]: unknown;
    }, duration: number, metadata?: LogMetadata): void;
    getStats(): {
        level: string;
        transports: number;
        environment: "development" | "production" | "test";
        logsDirectory: string;
    };
    child(bindings: Record<string, unknown>): EnhancedLogger;
}
export declare const logger: EnhancedLogger;
export declare const winstonLogger: winston.Logger;
export default logger;
//# sourceMappingURL=loggerEnhanced.d.ts.map
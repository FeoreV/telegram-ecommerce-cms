export interface UserSession {
    userId: string;
    telegramId: string;
    token?: string;
    role?: string;
    currentStore?: string;
    currentCategory?: string;
    orderingStep?: 'selecting' | 'contact' | 'confirmation';
    tempData?: any;
    purchaseMode?: 'direct' | 'cart';
    cart?: any[];
    storeCreation?: {
        step: number | 'name' | 'description' | 'slug' | 'currency' | 'contact';
        data: any;
    } | null;
    botCreation?: {
        storeId: string;
        storeName: string;
        step: 'token' | 'username';
        token?: string;
        username?: string;
    } | null;
    pendingRejection?: {
        reason: string;
    } | null;
    paymentProofFlow?: {
        orderId: string;
        awaitingPhoto: boolean;
    } | null;
    lastActivity: Date;
}
declare class SessionManager {
    private sessions;
    private readonly SESSION_TIMEOUT;
    constructor();
    getSession(telegramId: string): UserSession;
    updateSession(telegramId: string, updates: Partial<UserSession>): void;
    clearSession(telegramId: string): void;
    private cleanupExpiredSessions;
    getStats(): {
        totalSessions: number;
        activeSessions: number;
    };
}
export declare const userSessions: SessionManager;
export {};
//# sourceMappingURL=sessionManager.d.ts.map
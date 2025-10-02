import { AxiosInstance } from 'axios';
import { AuthResponse, StoresListResponse, StoreResponse, SlugAvailabilityResponse, ProductsListResponse, ProductResponse, OrderResponse, OrdersListResponse, DashboardAnalyticsResponse, DashboardStatsResponse, InventoryAlertsResponse, BotsListResponse, BotResponse, BotStatsResponse, BotSettingsResponse, IntegrationMappingResponse } from '../types/apiResponses';
declare class ApiService {
    private client;
    private baseURL;
    initialize(baseURL: string): void;
    private getClient;
    private withAuthHeaders;
    private request;
    getHttpClient(): AxiosInstance;
    authenticateUser(telegramId: string, username?: string, firstName?: string, lastName?: string): Promise<AuthResponse>;
    getStores(userToken: string, page?: number, limit?: number): Promise<StoresListResponse>;
    getStore(storeId: string, userToken: string): Promise<StoreResponse>;
    createStore(storeData: any, userToken: string): Promise<StoreResponse>;
    checkSlugAvailability(slug: string, userToken: string): Promise<SlugAvailabilityResponse>;
    getProducts(storeId: string, userToken: string, page?: number, limit?: number): Promise<ProductsListResponse>;
    getProduct(productId: string, userToken: string): Promise<ProductResponse>;
    createOrder(orderData: any, userToken: string): Promise<OrderResponse>;
    getOrder(orderId: string, userToken: string): Promise<OrderResponse>;
    confirmPayment(orderId: string, adminToken: string): Promise<OrderResponse>;
    rejectOrder(orderId: string, reason: string, adminToken: string): Promise<OrderResponse>;
    getDashboardStats(adminToken: string): Promise<DashboardStatsResponse>;
    getIntegrationMapping(params: {
        source: string;
        entityType: string;
        externalId?: string;
        localId?: string;
    }, userToken: string): Promise<IntegrationMappingResponse>;
    getSystemAdminToken(source?: string): Promise<string>;
    getOrders(adminToken: string, filters?: any): Promise<OrdersListResponse>;
    uploadPaymentProof(orderId: string, fileBuffer: ArrayBuffer | Buffer, fileName: string, userToken: string): Promise<OrderResponse>;
    getDashboardAnalytics(userToken: string, params?: {
        period?: string;
        storeId?: string;
    }): Promise<DashboardAnalyticsResponse>;
    getInventoryAlerts(userToken: string, params?: {
        severity?: string;
        storeId?: string;
        limit?: number;
    }): Promise<InventoryAlertsResponse>;
    getUserStores(userToken: string): Promise<StoresListResponse>;
    getUserBots(userToken: string): Promise<BotsListResponse>;
    createStoreBot(botData: {
        storeId: string;
        botToken: string;
        botUsername?: string;
    }, userToken: string): Promise<BotResponse>;
    deleteBot(storeId: string, userToken: string): Promise<{
        success: boolean;
    }>;
    restartBot(storeId: string, userToken: string): Promise<{
        success: boolean;
    }>;
    getBotStats(storeId: string, userToken: string): Promise<BotStatsResponse>;
    getBotSettings(storeId: string, userToken: string): Promise<BotSettingsResponse>;
}
export declare const apiService: ApiService;
export {};
//# sourceMappingURL=apiService.d.ts.map
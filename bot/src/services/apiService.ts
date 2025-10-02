import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosHeaders } from 'axios';
import {
  AuthResponse,
  StoresListResponse,
  StoreResponse,
  SlugAvailabilityResponse,
  ProductsListResponse,
  ProductResponse,
  OrderResponse,
  OrdersListResponse,
  DashboardAnalyticsResponse,
  DashboardStatsResponse,
  InventoryAlertsResponse,
  BotsListResponse,
  BotResponse,
  BotStatsResponse,
  BotSettingsResponse,
  IntegrationMappingResponse
} from '../types/apiResponses';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

class ApiService {
  private client: AxiosInstance | null = null;
  private baseURL: string = '';

  initialize(baseURL: string) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: `${baseURL}/api`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        const correlationId = randomUUID();
        if (!config.headers) {
          config.headers = new axios.AxiosHeaders();
        }
        (config.headers as AxiosHeaders)['x-request-id'] = correlationId;

        logger.debug('API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          correlationId,
        });
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('API Response', {
          status: response.status,
          url: response.config.url,
          method: response.config.method?.toUpperCase(),
        });
        return response;
      },
      (error) => Promise.reject(error)
    );
  }

  private getClient(): AxiosInstance {
    if (!this.client) {
      throw new Error('API service not initialized');
    }
    return this.client;
  }

  private withAuthHeaders(token?: string, headers: Record<string, string> = {}): Record<string, string> {
    if (!token) {
      return { ...headers };
    }
    return {
      ...headers,
      Authorization: `Bearer ${token}`,
    };
  }

  private async request<T>(config: AxiosRequestConfig, context: { errorMessage: string }): Promise<T> {
    try {
      const response = await this.getClient().request<T>(config);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<any>;
      logger.error(context.errorMessage, {
        message: axiosError.message,
        status: axiosError.response?.status,
        url: axiosError.config?.url,
        method: axiosError.config?.method?.toUpperCase(),
        response: axiosError.response?.data,
      });
      throw error;
    }
  }

  getHttpClient(): AxiosInstance {
    return this.getClient();
  }

  // Authentication
  async authenticateUser(telegramId: string, username?: string, firstName?: string, lastName?: string): Promise<AuthResponse> {
    return this.request<AuthResponse>({
      url: '/auth/telegram',
      method: 'POST',
      data: { telegramId, username, firstName, lastName },
    }, { errorMessage: 'Authentication failed' });
  }

  // Get user balance
  async getUserBalance(userToken: string): Promise<{ balance: number }> {
    const response = await this.request<{ success: boolean; user: { balance?: number } }>({
      url: '/auth/profile',
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: 'Failed to get user balance' });
    
    return {
      balance: response.user?.balance ?? 0
    };
  }

  // Stores
  async getStores(userToken: string, page: number = 1, limit: number = 10): Promise<StoresListResponse> {
    const response = await this.request<StoresListResponse>({
      url: '/stores',
      method: 'GET',
      params: { page, limit, status: 'ACTIVE' },
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: 'Failed to get stores' });
    return response;
  }

  async getStore(storeId: string, userToken: string): Promise<StoreResponse> {
    return this.request<StoreResponse>({
      url: `/stores/${storeId}`,
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: `Failed to get store ${storeId}` });
  }

  async createStore(storeData: any, userToken: string): Promise<StoreResponse> {
    return this.request<StoreResponse>({
      url: '/stores',
      method: 'POST',
      data: storeData,
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: 'Failed to create store' });
  }

  async checkSlugAvailability(slug: string, userToken: string): Promise<SlugAvailabilityResponse> {
    return this.request<SlugAvailabilityResponse>({
      url: `/stores/check-slug/${slug}`,
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: `Failed to check slug availability for ${slug}` });
  }

  // Products
  async getProducts(storeId: string, userToken: string, page: number = 1, limit: number = 10): Promise<ProductsListResponse> {
    const response = await this.request<ProductsListResponse>({
      url: '/products',
      method: 'GET',
      params: { storeId, page, limit, isActive: true },
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: `Failed to get products for store ${storeId}` });
    return response;
  }

  async getProduct(productId: string, userToken: string): Promise<ProductResponse> {
    return this.request<ProductResponse>({
      url: `/products/${productId}`,
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: `Failed to get product ${productId}` });
  }

  // Orders
  async createOrder(orderData: any, userToken: string): Promise<OrderResponse> {
    return this.request<OrderResponse>({
      url: '/orders',
      method: 'POST',
      data: orderData,
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: 'Failed to create order' });
  }

  async getOrder(orderId: string, userToken: string): Promise<OrderResponse> {
    return this.request<OrderResponse>({
      url: `/orders/${orderId}`,
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: `Failed to get order ${orderId}` });
  }

  async confirmPayment(orderId: string, adminToken: string): Promise<OrderResponse> {
    return this.request<OrderResponse>({
      url: `/orders/${orderId}/confirm-payment`,
      method: 'POST',
      data: {},
      headers: this.withAuthHeaders(adminToken),
    }, { errorMessage: `Failed to confirm payment for order ${orderId}` });
  }

  async rejectOrder(orderId: string, reason: string, adminToken: string): Promise<OrderResponse> {
    return this.request<OrderResponse>({
      url: `/orders/${orderId}/reject`,
      method: 'POST',
      data: { reason },
      headers: this.withAuthHeaders(adminToken),
    }, { errorMessage: `Failed to reject order ${orderId}` });
  }

  // Admin
  async getDashboardStats(adminToken: string): Promise<DashboardStatsResponse> {
    const response = await this.request<DashboardStatsResponse>({
      url: '/admin/dashboard',
      method: 'GET',
      headers: this.withAuthHeaders(adminToken),
    }, { errorMessage: 'Failed to get dashboard stats' });
    return {
      stats: response.stats,
      recentOrders: response.recentOrders ?? [],
    };
  }

  // Integration mappings
  async getIntegrationMapping(params: { source: string; entityType: string; externalId?: string; localId?: string }, userToken: string): Promise<IntegrationMappingResponse> {
    return this.request<IntegrationMappingResponse>({
      url: '/integration/mappings',
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
      params,
    }, { errorMessage: 'Failed to get integration mapping' });
  }

  async getSystemAdminToken(source: string = 'SYSTEM_SERVICE'): Promise<string> {
    const data = await this.request<{ token?: string }>({
      url: '/auth/admin/system-login',
      method: 'POST',
      data: { source },
    }, { errorMessage: 'Failed to obtain system admin token' });

    if (!data?.token) {
      throw new Error('Empty admin token response');
    }

    return data.token;
  }

  async getOrders(adminToken: string, filters: any = {}): Promise<OrdersListResponse> {
    const response = await this.request<OrdersListResponse>({
      url: '/orders',
      method: 'GET',
      headers: this.withAuthHeaders(adminToken),
      params: filters,
    }, { errorMessage: 'Failed to get orders' });
    return response;
  }

  async uploadPaymentProof(orderId: string, fileBuffer: ArrayBuffer | Buffer, fileName: string, userToken: string): Promise<OrderResponse> {
    const formData = new FormData();
    const blobSource = fileBuffer instanceof Buffer ? fileBuffer : new Uint8Array(fileBuffer);
    formData.append('paymentProof', new Blob([blobSource]), fileName);

    return this.request({
      url: `/orders/${orderId}/payment-proof`,
      method: 'POST',
      data: formData,
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: `Failed to upload payment proof for order ${orderId}` });
  }


  async getDashboardAnalytics(userToken: string, params: { period?: string; storeId?: string } = {}): Promise<DashboardAnalyticsResponse> {
    const queryParams = new URLSearchParams();
    if (params.period) queryParams.append('period', params.period);
    if (params.storeId) queryParams.append('storeId', params.storeId);

    return this.request<DashboardAnalyticsResponse>({
      url: `/analytics/dashboard?${queryParams}`,
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: 'Failed to fetch analytics' });
  }

  async getInventoryAlerts(userToken: string, params: { severity?: string; storeId?: string; limit?: number } = {}): Promise<InventoryAlertsResponse> {
    const queryParams = new URLSearchParams();
    if (params.severity) queryParams.append('severity', params.severity);
    if (params.storeId) queryParams.append('storeId', params.storeId);
    if (params.limit) queryParams.append('limit', params.limit.toString());

    return this.request<InventoryAlertsResponse>({
      url: `/inventory/alerts?${queryParams}`,
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: 'Failed to fetch inventory alerts' });
  }

  // User stores (for bot owners)
  async getUserStores(userToken: string): Promise<StoresListResponse> {
    const response = await this.request<StoresListResponse>({
      url: '/stores/my',
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: 'Failed to get user stores' });
    return {
      ...response,
      stores: response.stores ?? [],
    };
  }

  // Bots management
  async getUserBots(userToken: string): Promise<BotsListResponse> {
    return this.request<BotsListResponse>({
      url: '/bots',
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: 'Failed to get user bots' });
  }

  async createStoreBot(botData: { storeId: string; botToken: string; botUsername?: string }, userToken: string): Promise<BotResponse> {
    return this.request<BotResponse>({
      url: '/bots',
      method: 'POST',
      data: botData,
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: 'Failed to create store bot' });
  }

  async deleteBot(storeId: string, userToken: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>({
      url: `/bots/${storeId}`,
      method: 'DELETE',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: `Failed to delete bot for store ${storeId}` });
  }

  async restartBot(storeId: string, userToken: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>({
      url: `/bots/${storeId}/restart`,
      method: 'POST',
      data: {},
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: `Failed to restart bot for store ${storeId}` });
  }

  async getBotStats(storeId: string, userToken: string): Promise<BotStatsResponse> {
    return this.request<BotStatsResponse>({
      url: `/bots/${storeId}/stats`,
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: `Failed to get bot stats for store ${storeId}` });
  }

  async getBotSettings(storeId: string, userToken: string): Promise<BotSettingsResponse> {
    return this.request<BotSettingsResponse>({
      url: `/bots/${storeId}/settings`,
      method: 'GET',
      headers: this.withAuthHeaders(userToken),
    }, { errorMessage: `Failed to get bot settings for store ${storeId}` });
  }

}

export const apiService = new ApiService();

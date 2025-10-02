"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const logger_1 = require("../utils/logger");
class ApiService {
    constructor() {
        this.client = null;
        this.baseURL = '';
    }
    initialize(baseURL) {
        this.baseURL = baseURL;
        this.client = axios_1.default.create({
            baseURL: `${baseURL}/api`,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.client.interceptors.request.use((config) => {
            const correlationId = (0, crypto_1.randomUUID)();
            if (!config.headers) {
                config.headers = new axios_1.default.AxiosHeaders();
            }
            config.headers['x-request-id'] = correlationId;
            logger_1.logger.debug('API Request', {
                method: config.method?.toUpperCase(),
                url: config.url,
                correlationId,
            });
            return config;
        }, (error) => Promise.reject(error));
        this.client.interceptors.response.use((response) => {
            logger_1.logger.debug('API Response', {
                status: response.status,
                url: response.config.url,
                method: response.config.method?.toUpperCase(),
            });
            return response;
        }, (error) => Promise.reject(error));
    }
    getClient() {
        if (!this.client) {
            throw new Error('API service not initialized');
        }
        return this.client;
    }
    withAuthHeaders(token, headers = {}) {
        if (!token) {
            return { ...headers };
        }
        return {
            ...headers,
            Authorization: `Bearer ${token}`,
        };
    }
    async request(config, context) {
        try {
            const response = await this.getClient().request(config);
            return response.data;
        }
        catch (error) {
            const axiosError = error;
            logger_1.logger.error(context.errorMessage, {
                message: axiosError.message,
                status: axiosError.response?.status,
                url: axiosError.config?.url,
                method: axiosError.config?.method?.toUpperCase(),
                response: axiosError.response?.data,
            });
            throw error;
        }
    }
    getHttpClient() {
        return this.getClient();
    }
    async authenticateUser(telegramId, username, firstName, lastName) {
        return this.request({
            url: '/auth/telegram',
            method: 'POST',
            data: { telegramId, username, firstName, lastName },
        }, { errorMessage: 'Authentication failed' });
    }
    async getStores(userToken, page = 1, limit = 10) {
        const response = await this.request({
            url: '/stores',
            method: 'GET',
            params: { page, limit, status: 'ACTIVE' },
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: 'Failed to get stores' });
        return response;
    }
    async getStore(storeId, userToken) {
        return this.request({
            url: `/stores/${storeId}`,
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: `Failed to get store ${storeId}` });
    }
    async createStore(storeData, userToken) {
        return this.request({
            url: '/stores',
            method: 'POST',
            data: storeData,
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: 'Failed to create store' });
    }
    async checkSlugAvailability(slug, userToken) {
        return this.request({
            url: `/stores/check-slug/${slug}`,
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: `Failed to check slug availability for ${slug}` });
    }
    async getProducts(storeId, userToken, page = 1, limit = 10) {
        const response = await this.request({
            url: '/products',
            method: 'GET',
            params: { storeId, page, limit, isActive: true },
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: `Failed to get products for store ${storeId}` });
        return response;
    }
    async getProduct(productId, userToken) {
        return this.request({
            url: `/products/${productId}`,
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: `Failed to get product ${productId}` });
    }
    async createOrder(orderData, userToken) {
        return this.request({
            url: '/orders',
            method: 'POST',
            data: orderData,
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: 'Failed to create order' });
    }
    async getOrder(orderId, userToken) {
        return this.request({
            url: `/orders/${orderId}`,
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: `Failed to get order ${orderId}` });
    }
    async confirmPayment(orderId, adminToken) {
        return this.request({
            url: `/orders/${orderId}/confirm-payment`,
            method: 'POST',
            data: {},
            headers: this.withAuthHeaders(adminToken),
        }, { errorMessage: `Failed to confirm payment for order ${orderId}` });
    }
    async rejectOrder(orderId, reason, adminToken) {
        return this.request({
            url: `/orders/${orderId}/reject`,
            method: 'POST',
            data: { reason },
            headers: this.withAuthHeaders(adminToken),
        }, { errorMessage: `Failed to reject order ${orderId}` });
    }
    async getDashboardStats(adminToken) {
        const response = await this.request({
            url: '/admin/dashboard',
            method: 'GET',
            headers: this.withAuthHeaders(adminToken),
        }, { errorMessage: 'Failed to get dashboard stats' });
        return {
            stats: response.stats,
            recentOrders: response.recentOrders ?? [],
        };
    }
    async getIntegrationMapping(params, userToken) {
        return this.request({
            url: '/integration/mappings',
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
            params,
        }, { errorMessage: 'Failed to get integration mapping' });
    }
    async getSystemAdminToken(source = 'SYSTEM_SERVICE') {
        const data = await this.request({
            url: '/auth/admin/system-login',
            method: 'POST',
            data: { source },
        }, { errorMessage: 'Failed to obtain system admin token' });
        if (!data?.token) {
            throw new Error('Empty admin token response');
        }
        return data.token;
    }
    async getOrders(adminToken, filters = {}) {
        const response = await this.request({
            url: '/orders',
            method: 'GET',
            headers: this.withAuthHeaders(adminToken),
            params: filters,
        }, { errorMessage: 'Failed to get orders' });
        return response;
    }
    async uploadPaymentProof(orderId, fileBuffer, fileName, userToken) {
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
    async getDashboardAnalytics(userToken, params = {}) {
        const queryParams = new URLSearchParams();
        if (params.period)
            queryParams.append('period', params.period);
        if (params.storeId)
            queryParams.append('storeId', params.storeId);
        return this.request({
            url: `/analytics/dashboard?${queryParams}`,
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: 'Failed to fetch analytics' });
    }
    async getInventoryAlerts(userToken, params = {}) {
        const queryParams = new URLSearchParams();
        if (params.severity)
            queryParams.append('severity', params.severity);
        if (params.storeId)
            queryParams.append('storeId', params.storeId);
        if (params.limit)
            queryParams.append('limit', params.limit.toString());
        return this.request({
            url: `/inventory/alerts?${queryParams}`,
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: 'Failed to fetch inventory alerts' });
    }
    async getUserStores(userToken) {
        const response = await this.request({
            url: '/stores/my',
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: 'Failed to get user stores' });
        return {
            ...response,
            stores: response.stores ?? [],
        };
    }
    async getUserBots(userToken) {
        return this.request({
            url: '/bots',
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: 'Failed to get user bots' });
    }
    async createStoreBot(botData, userToken) {
        return this.request({
            url: '/bots',
            method: 'POST',
            data: botData,
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: 'Failed to create store bot' });
    }
    async deleteBot(storeId, userToken) {
        return this.request({
            url: `/bots/${storeId}`,
            method: 'DELETE',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: `Failed to delete bot for store ${storeId}` });
    }
    async restartBot(storeId, userToken) {
        return this.request({
            url: `/bots/${storeId}/restart`,
            method: 'POST',
            data: {},
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: `Failed to restart bot for store ${storeId}` });
    }
    async getBotStats(storeId, userToken) {
        return this.request({
            url: `/bots/${storeId}/stats`,
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: `Failed to get bot stats for store ${storeId}` });
    }
    async getBotSettings(storeId, userToken) {
        return this.request({
            url: `/bots/${storeId}/settings`,
            method: 'GET',
            headers: this.withAuthHeaders(userToken),
        }, { errorMessage: `Failed to get bot settings for store ${storeId}` });
    }
}
exports.apiService = new ApiService();
//# sourceMappingURL=apiService.js.map
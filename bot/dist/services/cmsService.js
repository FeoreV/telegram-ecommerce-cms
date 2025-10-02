"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmsService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class CmsService {
    constructor() {
        this.client = null;
        this.baseURL = '';
    }
    initialize(baseURL) {
        this.baseURL = baseURL;
        this.client = axios_1.default.create({
            baseURL,
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
        });
        this.client.interceptors.request.use((config) => {
            logger_1.logger.debug(`CMS Request: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        });
        this.client.interceptors.response.use((resp) => resp, (error) => {
            logger_1.logger.error('CMS Response Error:', {
                status: error.response?.status,
                url: error.config?.url,
                message: error.response?.data || error.message,
            });
            return Promise.reject(error);
        });
    }
    getClient() {
        if (!this.client)
            throw new Error('CMS service not initialized');
        return this.client;
    }
    async listProducts(params = {}) {
        const { limit = 20, offset = 0, q } = params;
        const resp = await this.getClient().get('/store/products', { params: { limit, offset, q } });
        return resp.data;
    }
    async retrieveProduct(id) {
        const resp = await this.getClient().get(`/store/products/${id}`);
        return resp.data;
    }
    async listVariants(productId) {
        const resp = await this.getClient().get(`/store/variants`, { params: { product_id: productId } });
        return resp.data;
    }
}
exports.cmsService = new CmsService();
//# sourceMappingURL=cmsService.js.map
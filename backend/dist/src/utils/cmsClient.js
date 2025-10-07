"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmsClient = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("./env");
const logger_1 = require("./logger");
class MedusaClient {
    constructor() {
        this.client = null;
    }
    get() {
        if (!env_1.env.MEDUSA_BASE_URL) {
            throw new Error('MEDUSA_BASE_URL is not configured');
        }
        if (this.client)
            return this.client;
        this.client = axios_1.default.create({
            baseURL: env_1.env.MEDUSA_BASE_URL,
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
        });
        this.client.interceptors.response.use((r) => r, (e) => {
            logger_1.logger.error('Medusa client error', {
                url: e.config?.url,
                status: e.response?.status,
                data: e.response?.data,
            });
            return Promise.reject(e);
        });
        return this.client;
    }
    async listProducts(params = {}) {
        const client = this.get();
        const resp = await client.get('/store/products', { params });
        return resp.data;
    }
    async retrieveProduct(id) {
        const client = this.get();
        if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) {
            throw new Error('Invalid product ID format');
        }
        const encodedId = encodeURIComponent(id);
        const resp = await client.get(`/store/products/${encodedId}`);
        return resp.data;
    }
}
exports.cmsClient = new MedusaClient();
//# sourceMappingURL=cmsClient.js.map
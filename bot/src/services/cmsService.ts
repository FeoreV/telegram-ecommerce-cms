import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

class CmsService {
  private client: AxiosInstance | null = null;
  private baseURL = '';

  initialize(baseURL: string) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      logger.debug(`CMS Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    this.client.interceptors.response.use(
      (resp) => resp,
      (error) => {
        logger.error('CMS Response Error:', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.response?.data || error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  private getClient(): AxiosInstance {
    if (!this.client) throw new Error('CMS service not initialized');
    return this.client;
  }

  async listProducts(params: { limit?: number; offset?: number; q?: string } = {}) {
    const { limit = 20, offset = 0, q } = params;
    const resp = await this.getClient().get('/store/products', { params: { limit, offset, q } });
    return resp.data;
  }

  async retrieveProduct(id: string) {
    const resp = await this.getClient().get(`/store/products/${id}`);
    return resp.data;
  }

  async listVariants(productId: string) {
    const resp = await this.getClient().get(`/store/variants`, { params: { product_id: productId } });
    return resp.data;
  }
}

export const cmsService = new CmsService();



import axios, { AxiosInstance } from 'axios';
import { env } from './env';
import { logger } from './logger';

class MedusaClient {
  private client: AxiosInstance | null = null;

  get(): AxiosInstance {
    if (!env.MEDUSA_BASE_URL) {
      throw new Error('MEDUSA_BASE_URL is not configured');
    }
    if (this.client) return this.client;
    this.client = axios.create({
      baseURL: env.MEDUSA_BASE_URL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    this.client.interceptors.response.use(
      (r) => r,
      (e) => {
        logger.error('Medusa client error', {
          url: e.config?.url,
          status: e.response?.status,
          data: e.response?.data,
        });
        return Promise.reject(e);
      }
    );
    return this.client;
  }

  async listProducts(params: { limit?: number; offset?: number; q?: string } = {}) {
    const client = this.get();
    const resp = await client.get('/store/products', { params });
    return resp.data;
  }

  async retrieveProduct(id: string) {
    const client = this.get();
    const resp = await client.get(`/store/products/${id}`);
    return resp.data;
  }
}

export const cmsClient = new MedusaClient();

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface VaultConfig {
  address: string;
  roleId: string;
  secretId: string;
  namespace?: string;
}

export interface SecretData {
  [key: string]: any;
}

export interface VaultSecret {
  data: {
    data: SecretData;
    metadata: {
      created_time: string;
      version: number;
    };
  };
}

export class VaultService {
  private client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private config: VaultConfig;

  constructor(config: VaultConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.address,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      if (this.token) {
        config.headers['X-Vault-Token'] = this.token;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Vault API error:', {
          status: error.response?.status,
          message: error.response?.data?.errors || error.message,
          path: error.config?.url,
        });
        throw error;
      }
    );
  }

  /**
   * Authenticate with Vault using AppRole
   */
  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post(`${this.config.address}/v1/auth/approle/login`, {
        role_id: this.config.roleId,
        secret_id: this.config.secretId,
      });

      this.token = response.data.auth.client_token;
      const leaseDuration = response.data.auth.lease_duration;
      
      // Set expiry to 90% of lease duration to allow for refresh
      this.tokenExpiry = new Date(Date.now() + (leaseDuration * 900));

      logger.info('Successfully authenticated with Vault');
    } catch (error) {
      logger.error('Failed to authenticate with Vault:', error);
      throw new Error('Vault authentication failed');
    }
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.token || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  /**
   * Get secret from Vault
   */
  async getSecret(path: string): Promise<SecretData> {
    try {
      const response = await this.client.get<VaultSecret>(`/v1/kv/data/${path}`);
      return response.data.data.data;
    } catch (error) {
      logger.error(`Failed to get secret from path: ${path}`, error);
      throw new Error(`Failed to retrieve secret: ${path}`);
    }
  }

  /**
   * Store secret in Vault
   */
  async putSecret(path: string, data: SecretData): Promise<void> {
    try {
      await this.client.post(`/v1/kv/data/${path}`, { data });
      logger.info(`Secret stored successfully at path: ${path}`);
    } catch (error) {
      logger.error(`Failed to store secret at path: ${path}`, error);
      throw new Error(`Failed to store secret: ${path}`);
    }
  }

  /**
   * Delete secret from Vault
   */
  async deleteSecret(path: string): Promise<void> {
    try {
      await this.client.delete(`/v1/kv/data/${path}`);
      logger.info(`Secret deleted successfully from path: ${path}`);
    } catch (error) {
      logger.error(`Failed to delete secret from path: ${path}`, error);
      throw new Error(`Failed to delete secret: ${path}`);
    }
  }

  /**
   * List secrets at path
   */
  async listSecrets(path: string): Promise<string[]> {
    try {
      const response = await this.client.get(`/v1/kv/metadata/${path}?list=true`);
      return response.data.data.keys || [];
    } catch (error) {
      logger.error(`Failed to list secrets at path: ${path}`, error);
      throw new Error(`Failed to list secrets: ${path}`);
    }
  }

  /**
   * Generate dynamic database credentials
   */
  async getDatabaseCredentials(role: string): Promise<{ username: string; password: string }> {
    try {
      const response = await this.client.get(`/v1/database/creds/${role}`);
      return {
        username: response.data.data.username,
        password: response.data.data.password,
      };
    } catch (error) {
      logger.error(`Failed to get database credentials for role: ${role}`, error);
      throw new Error(`Failed to get database credentials: ${role}`);
    }
  }

  /**
   * Encrypt data using Vault's transit engine
   */
  async encrypt(keyName: string, plaintext: string): Promise<string> {
    try {
      const encodedPlaintext = Buffer.from(plaintext).toString('base64');
      const response = await this.client.post(`/v1/transit/encrypt/${keyName}`, {
        plaintext: encodedPlaintext,
      });
      return response.data.data.ciphertext;
    } catch (error) {
      logger.error(`Failed to encrypt data with key: ${keyName}`, error);
      throw new Error(`Failed to encrypt data: ${keyName}`);
    }
  }

  /**
   * Decrypt data using Vault's transit engine
   */
  async decrypt(keyName: string, ciphertext: string): Promise<string> {
    try {
      const response = await this.client.post(`/v1/transit/decrypt/${keyName}`, {
        ciphertext,
      });
      return Buffer.from(response.data.data.plaintext, 'base64').toString();
    } catch (error) {
      logger.error(`Failed to decrypt data with key: ${keyName}`, error);
      throw new Error(`Failed to decrypt data: ${keyName}`);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/v1/sys/health');
      return true;
    } catch (error) {
      logger.error('Vault health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
let vaultService: VaultService | null = null;

export const getVaultService = (): VaultService => {
  if (!vaultService) {
    const config: VaultConfig = {
      address: process.env.VAULT_ADDR || 'http://localhost:8200',
      roleId: process.env.VAULT_ROLE_ID as string,
      secretId: process.env.VAULT_SECRET_ID as string,
      namespace: process.env.VAULT_NAMESPACE,
    };

    // Validate required configuration
    if (!config.roleId || !config.secretId) {
      throw new Error('VAULT_ROLE_ID and VAULT_SECRET_ID are required');
    }

    vaultService = new VaultService(config);
  }

  return vaultService;
};

export default VaultService;

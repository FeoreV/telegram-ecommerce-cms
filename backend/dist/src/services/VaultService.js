"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVaultService = exports.VaultService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class VaultService {
    constructor(config) {
        this.token = null;
        this.tokenExpiry = null;
        this.config = config;
        this.client = axios_1.default.create({
            baseURL: config.address,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.client.interceptors.request.use(async (config) => {
            await this.ensureValidToken();
            if (this.token) {
                config.headers['X-Vault-Token'] = this.token;
            }
            return config;
        });
        this.client.interceptors.response.use((response) => response, (error) => {
            logger_1.logger.error('Vault API error:', {
                status: error.response?.status,
                message: error.response?.data?.errors || error.message,
                path: error.config?.url,
            });
            throw error;
        });
    }
    async authenticate() {
        try {
            const response = await axios_1.default.post(`${this.config.address}/v1/auth/approle/login`, {
                role_id: this.config.roleId,
                secret_id: this.config.secretId,
            });
            this.token = response.data.auth.client_token;
            const leaseDuration = response.data.auth.lease_duration;
            this.tokenExpiry = new Date(Date.now() + (leaseDuration * 900));
            logger_1.logger.info('Successfully authenticated with Vault');
        }
        catch (error) {
            logger_1.logger.error('Failed to authenticate with Vault:', error);
            throw new Error('Vault authentication failed');
        }
    }
    async ensureValidToken() {
        if (!this.token || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
            await this.authenticate();
        }
    }
    async getSecret(path) {
        try {
            const response = await this.client.get(`/v1/kv/data/${path}`);
            return response.data.data.data;
        }
        catch (error) {
            logger_1.logger.error(`Failed to get secret from path: ${path}`, error);
            throw new Error(`Failed to retrieve secret: ${path}`);
        }
    }
    async putSecret(path, data) {
        try {
            await this.client.post(`/v1/kv/data/${path}`, { data });
            logger_1.logger.info(`Secret stored successfully at path: ${path}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to store secret at path: ${path}`, error);
            throw new Error(`Failed to store secret: ${path}`);
        }
    }
    async deleteSecret(path) {
        try {
            await this.client.delete(`/v1/kv/data/${path}`);
            logger_1.logger.info(`Secret deleted successfully from path: ${path}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to delete secret from path: ${path}`, error);
            throw new Error(`Failed to delete secret: ${path}`);
        }
    }
    async listSecrets(path) {
        try {
            const response = await this.client.get(`/v1/kv/metadata/${path}?list=true`);
            return response.data.data.keys || [];
        }
        catch (error) {
            logger_1.logger.error(`Failed to list secrets at path: ${path}`, error);
            throw new Error(`Failed to list secrets: ${path}`);
        }
    }
    async getDatabaseCredentials(role) {
        try {
            const response = await this.client.get(`/v1/database/creds/${role}`);
            return {
                username: response.data.data.username,
                password: response.data.data.password,
            };
        }
        catch (error) {
            logger_1.logger.error(`Failed to get database credentials for role: ${role}`, error);
            throw new Error(`Failed to get database credentials: ${role}`);
        }
    }
    async encrypt(keyName, plaintext) {
        try {
            const encodedPlaintext = Buffer.from(plaintext).toString('base64');
            const response = await this.client.post(`/v1/transit/encrypt/${keyName}`, {
                plaintext: encodedPlaintext,
            });
            return response.data.data.ciphertext;
        }
        catch (error) {
            logger_1.logger.error(`Failed to encrypt data with key: ${keyName}`, error);
            throw new Error(`Failed to encrypt data: ${keyName}`);
        }
    }
    async decrypt(keyName, ciphertext) {
        try {
            const response = await this.client.post(`/v1/transit/decrypt/${keyName}`, {
                ciphertext,
            });
            return Buffer.from(response.data.data.plaintext, 'base64').toString();
        }
        catch (error) {
            logger_1.logger.error(`Failed to decrypt data with key: ${keyName}`, error);
            throw new Error(`Failed to decrypt data: ${keyName}`);
        }
    }
    async healthCheck() {
        try {
            await this.client.get('/v1/sys/health');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Vault health check failed:', error);
            return false;
        }
    }
}
exports.VaultService = VaultService;
let vaultService = null;
const getVaultService = () => {
    if (!vaultService) {
        const config = {
            address: process.env.VAULT_ADDR || 'http://localhost:8200',
            roleId: process.env.VAULT_ROLE_ID,
            secretId: process.env.VAULT_SECRET_ID,
            namespace: process.env.VAULT_NAMESPACE,
        };
        if (!config.roleId || !config.secretId) {
            throw new Error('VAULT_ROLE_ID and VAULT_SECRET_ID are required');
        }
        vaultService = new VaultService(config);
    }
    return vaultService;
};
exports.getVaultService = getVaultService;
exports.default = VaultService;
//# sourceMappingURL=VaultService.js.map
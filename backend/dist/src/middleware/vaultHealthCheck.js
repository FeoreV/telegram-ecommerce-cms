"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vaultHealthChecker = exports.vaultHealthEndpoint = exports.vaultHealthMiddleware = void 0;
const VaultService_1 = require("../services/VaultService");
const logger_1 = require("../utils/logger");
class VaultHealthChecker {
    constructor() {
        this.lastHealthCheck = null;
        this.checkInterval = null;
        this.startHealthChecks();
    }
    static getInstance() {
        if (!VaultHealthChecker.instance) {
            VaultHealthChecker.instance = new VaultHealthChecker();
        }
        return VaultHealthChecker.instance;
    }
    startHealthChecks() {
        this.checkInterval = setInterval(() => {
            this.performHealthCheck().catch(error => {
                logger_1.logger.error('Vault health check failed:', error);
            });
        }, 60000);
        this.performHealthCheck().catch(error => {
            logger_1.logger.error('Initial Vault health check failed:', error);
        });
    }
    async performHealthCheck() {
        const useVault = process.env.USE_VAULT === 'true';
        const status = {
            vault: {
                enabled: useVault,
                connected: false,
                lastCheck: new Date().toISOString(),
            },
            secretManager: {
                initialized: true,
                source: useVault ? 'vault' : 'environment',
            },
        };
        if (useVault) {
            try {
                const vault = (0, VaultService_1.getVaultService)();
                const isHealthy = await vault.healthCheck();
                status.vault.connected = isHealthy;
                if (!isHealthy) {
                    status.vault.error = 'Vault health check failed';
                }
            }
            catch (error) {
                status.vault.connected = false;
                status.vault.error = error instanceof Error ? error.message : 'Unknown error';
                logger_1.logger.warn('Vault health check failed:', error);
            }
        }
        else {
            status.vault.connected = true;
        }
        this.lastHealthCheck = status;
        return status;
    }
    async getHealthStatus() {
        if (!this.lastHealthCheck) {
            return await this.performHealthCheck();
        }
        return this.lastHealthCheck;
    }
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}
const vaultHealthChecker = VaultHealthChecker.getInstance();
exports.vaultHealthChecker = vaultHealthChecker;
const vaultHealthMiddleware = async (req, res, next) => {
    try {
        const healthStatus = await vaultHealthChecker.getHealthStatus();
        res.setHeader('X-Vault-Enabled', healthStatus.vault.enabled.toString());
        res.setHeader('X-Vault-Connected', healthStatus.vault.connected.toString());
        res.setHeader('X-Secret-Source', healthStatus.secretManager.source);
        if (healthStatus.vault.enabled && !healthStatus.vault.connected) {
            logger_1.logger.warn('Vault is enabled but not connected', {
                error: healthStatus.vault.error,
                lastCheck: healthStatus.vault.lastCheck,
            });
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Vault health middleware error:', error);
        next();
    }
};
exports.vaultHealthMiddleware = vaultHealthMiddleware;
const vaultHealthEndpoint = async (req, res) => {
    try {
        const healthStatus = await vaultHealthChecker.getHealthStatus();
        const statusCode = healthStatus.vault.enabled && !healthStatus.vault.connected ? 503 : 200;
        res.status(statusCode).json({
            status: statusCode === 200 ? 'healthy' : 'degraded',
            vault: healthStatus.vault,
            secretManager: healthStatus.secretManager,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('Vault health endpoint error:', error);
        res.status(500).json({
            status: 'error',
            error: 'Failed to check Vault health',
            timestamp: new Date().toISOString(),
        });
    }
};
exports.vaultHealthEndpoint = vaultHealthEndpoint;
//# sourceMappingURL=vaultHealthCheck.js.map
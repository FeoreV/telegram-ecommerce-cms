import { Request, Response, NextFunction } from 'express';
import { getVaultService } from '../services/VaultService';
import { logger } from '../utils/logger';

export interface VaultHealthStatus {
  vault: {
    enabled: boolean;
    connected: boolean;
    lastCheck: string;
    error?: string;
  };
  secretManager: {
    initialized: boolean;
    source: 'vault' | 'environment';
  };
}

class VaultHealthChecker {
  private static instance: VaultHealthChecker;
  private lastHealthCheck: VaultHealthStatus | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start periodic health checks
    this.startHealthChecks();
  }

  public static getInstance(): VaultHealthChecker {
    if (!VaultHealthChecker.instance) {
      VaultHealthChecker.instance = new VaultHealthChecker();
    }
    return VaultHealthChecker.instance;
  }

  private startHealthChecks(): void {
    // Check every 60 seconds
    this.checkInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        logger.error('Vault health check failed:', error);
      });
    }, 60000);

    // Initial check
    this.performHealthCheck().catch(error => {
      logger.error('Initial Vault health check failed:', error);
    });
  }

  private async performHealthCheck(): Promise<VaultHealthStatus> {
    const useVault = process.env.USE_VAULT === 'true';
    
    const status: VaultHealthStatus = {
      vault: {
        enabled: useVault,
        connected: false,
        lastCheck: new Date().toISOString(),
      },
      secretManager: {
        initialized: true, // Assume initialized if we got this far
        source: useVault ? 'vault' : 'environment',
      },
    };

    if (useVault) {
      try {
        const vault = getVaultService();
        const isHealthy = await vault.healthCheck();
        status.vault.connected = isHealthy;
        
        if (!isHealthy) {
          status.vault.error = 'Vault health check failed';
        }
      } catch (error) {
        status.vault.connected = false;
        status.vault.error = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('Vault health check failed:', error);
      }
    } else {
      status.vault.connected = true; // Not using Vault, so consider it "connected"
    }

    this.lastHealthCheck = status;
    return status;
  }

  public async getHealthStatus(): Promise<VaultHealthStatus> {
    if (!this.lastHealthCheck) {
      return await this.performHealthCheck();
    }
    return this.lastHealthCheck;
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

const vaultHealthChecker = VaultHealthChecker.getInstance();

/**
 * Middleware to check Vault health and add to response headers
 */
export const vaultHealthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const healthStatus = await vaultHealthChecker.getHealthStatus();
    
    // Add health status to response headers for debugging
    res.setHeader('X-Vault-Enabled', healthStatus.vault.enabled.toString());
    res.setHeader('X-Vault-Connected', healthStatus.vault.connected.toString());
    res.setHeader('X-Secret-Source', healthStatus.secretManager.source);

    // Log warning if Vault is enabled but not connected
    if (healthStatus.vault.enabled && !healthStatus.vault.connected) {
      logger.warn('Vault is enabled but not connected', {
        error: healthStatus.vault.error,
        lastCheck: healthStatus.vault.lastCheck,
      });
    }

    next();
  } catch (error) {
    logger.error('Vault health middleware error:', error);
    next(); // Continue even if health check fails
  }
};

/**
 * Express route handler for Vault health endpoint
 */
export const vaultHealthEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const healthStatus = await vaultHealthChecker.getHealthStatus();
    
    const statusCode = healthStatus.vault.enabled && !healthStatus.vault.connected ? 503 : 200;
    
    res.status(statusCode).json({
      status: statusCode === 200 ? 'healthy' : 'degraded',
      vault: healthStatus.vault,
      secretManager: healthStatus.secretManager,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Vault health endpoint error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to check Vault health',
      timestamp: new Date().toISOString(),
    });
  }
};

export { vaultHealthChecker };

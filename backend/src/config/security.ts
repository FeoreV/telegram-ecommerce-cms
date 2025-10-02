import { logger } from '../utils/logger';
import { secretManager } from '../utils/SecretManager';

export interface SecurityConfig {
  jwt: {
    secret: string;
    refreshSecret: string;
    accessExpiry: string;
    refreshExpiry: string;
    clockSkew: number;
    issuer: string;
    audience: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    authMaxRequests: number;
    uploadMaxRequests: number;
  };
  cors: {
    allowedOrigins: string[];
    credentials: boolean;
  };
  security: {
    enableBruteForceProtection: boolean;
    enableSecurityHeaders: boolean;
    enableRequestSanitization: boolean;
    adminIPWhitelist?: string[];
    maxRequestSize: string;
    enableSecurityMonitoring: boolean;
  };
  redis: {
    url?: string;
    enabled: boolean;
  };
}

// Environment validation
const validateEnvironment = (): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Basic validation - detailed validation is done in SecretManager
  if (process.env.USE_VAULT === 'true') {
    const requiredVaultVars = ['VAULT_ADDR', 'VAULT_ROLE_ID', 'VAULT_SECRET_ID'];
    const missing = requiredVaultVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
      logger.error('Missing required Vault environment variables:', { missingVars: missing });
      throw new Error(`Missing required Vault environment variables: ${missing.join(', ')}`);
    }
  } else if (!isDevelopment) {
    // In production, require all JWT secrets
    const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
      logger.error('Missing required environment variables for security:', { missingVars: missing });
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  } else {
    // In development, just warn if secrets are missing - SecretManager will provide defaults
    const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
      logger.warn('Missing JWT secrets in development mode:', { missingVars: missing });
      logger.warn('SecretManager will generate temporary secrets (insecure for production)');
    }
  }
};

// Load and validate security configuration
export const loadSecurityConfig = async (): Promise<SecurityConfig> => {
  // Initialize secret manager first
  await secretManager.initialize();
  
  validateEnvironment();

  const NODE_ENV = process.env.NODE_ENV || 'development';
  const isDevelopment = NODE_ENV === 'development';

  const jwtSecrets = secretManager.getJWTSecrets();
  const config: SecurityConfig = {
    jwt: {
      secret: jwtSecrets.secret,
      refreshSecret: jwtSecrets.refreshSecret,
      accessExpiry: jwtSecrets.expiresIn,
      refreshExpiry: jwtSecrets.refreshExpiresIn,
      clockSkew: parseInt(process.env.JWT_CLOCK_SKEW || '30'),
      issuer: process.env.JWT_ISSUER || 'botrt-ecommerce',
      audience: process.env.JWT_AUDIENCE || 'botrt-admin-panel',
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: isDevelopment ? 1000 : parseInt(process.env.RATE_LIMIT_MAX || '100'),
      authMaxRequests: isDevelopment ? 100 : parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
      uploadMaxRequests: isDevelopment ? 50 : parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '10'),
    },
    cors: {
      allowedOrigins: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        process.env.ADMIN_PANEL_URL || 'http://localhost:3001',
        ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(',') || [])
      ].filter(Boolean),
      credentials: true,
    },
    security: {
      enableBruteForceProtection: process.env.ENABLE_BRUTE_FORCE_PROTECTION !== 'false',
      enableSecurityHeaders: process.env.ENABLE_SECURITY_HEADERS !== 'false',
      enableRequestSanitization: process.env.ENABLE_REQUEST_SANITIZATION !== 'false',
      adminIPWhitelist: process.env.ADMIN_IP_WHITELIST?.split(',').map(ip => ip.trim()),
      maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
      enableSecurityMonitoring: process.env.ENABLE_SECURITY_MONITORING !== 'false',
    },
    redis: {
      url: process.env.REDIS_URL,
      enabled: !!process.env.REDIS_URL,
    },
  };

  // Log configuration (without secrets)
  logger.info('Security configuration loaded', {
    environment: NODE_ENV,
    jwtAccessExpiry: config.jwt.accessExpiry,
    jwtRefreshExpiry: config.jwt.refreshExpiry,
    rateLimitMax: config.rateLimit.maxRequests,
    authRateLimitMax: config.rateLimit.authMaxRequests,
    corsOrigins: config.cors.allowedOrigins,
    bruteForceProtection: config.security.enableBruteForceProtection,
    securityHeaders: config.security.enableSecurityHeaders,
    requestSanitization: config.security.enableRequestSanitization,
    adminIPWhitelist: !!config.security.adminIPWhitelist,
    redisEnabled: config.redis.enabled,
  });

  return config;
};

// Security health check
export const performSecurityHealthCheck = (): {
  status: 'healthy' | 'warning' | 'critical';
  checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; message: string }>;
} => {
  const checks = [];
  let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

  // Check environment variables
  try {
    validateEnvironment();
    checks.push({
      name: 'Environment Variables',
      status: 'pass' as const,
      message: 'All required environment variables are present'
    });
  } catch (error) {
    checks.push({
      name: 'Environment Variables',
      status: 'fail' as const,
      message: error instanceof Error ? error.message : 'Environment validation failed'
    });
    overallStatus = 'critical';
  }

  // Check JWT configuration
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length >= 32) {
    checks.push({
      name: 'JWT Secret Strength',
      status: 'pass' as const,
      message: 'JWT secret meets minimum length requirements'
    });
  } else {
    checks.push({
      name: 'JWT Secret Strength',
      status: 'warn' as const,
      message: 'JWT secret is shorter than recommended (32 characters)'
    });
    if (overallStatus === 'healthy') overallStatus = 'warning';
  }

  // Check HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const useHttps = process.env.USE_HTTPS === 'true' || process.env.HTTPS === 'true';
    if (useHttps) {
      checks.push({
        name: 'HTTPS Configuration',
        status: 'pass' as const,
        message: 'HTTPS is enabled in production'
      });
    } else {
      checks.push({
        name: 'HTTPS Configuration',
        status: 'warn' as const,
        message: 'HTTPS should be enabled in production'
      });
      if (overallStatus === 'healthy') overallStatus = 'warning';
    }
  }

  // Check Redis connection for session storage
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    checks.push({
      name: 'Redis Configuration',
      status: 'warn' as const,
      message: 'Redis is recommended for production session and cache storage'
    });
    if (overallStatus === 'healthy') overallStatus = 'warning';
  } else if (process.env.REDIS_URL) {
    checks.push({
      name: 'Redis Configuration',
      status: 'pass' as const,
      message: 'Redis is configured'
    });
  }

  return {
    status: overallStatus,
    checks
  };
};

// Security metrics for monitoring
export interface SecurityMetrics {
  rateLimitHits: number;
  bruteForceAttempts: number;
  invalidTokenAttempts: number;
  suspiciousRequests: number;
  blacklistedTokens: number;
  activeSessionsCount: number;
}

class SecurityMetricsCollector {
  private metrics: SecurityMetrics = {
    rateLimitHits: 0,
    bruteForceAttempts: 0,
    invalidTokenAttempts: 0,
    suspiciousRequests: 0,
    blacklistedTokens: 0,
    activeSessionsCount: 0,
  };

  incrementRateLimitHits(): void {
    this.metrics.rateLimitHits++;
  }

  incrementBruteForceAttempts(): void {
    this.metrics.bruteForceAttempts++;
  }

  incrementInvalidTokenAttempts(): void {
    this.metrics.invalidTokenAttempts++;
  }

  incrementSuspiciousRequests(): void {
    this.metrics.suspiciousRequests++;
  }

  incrementBlacklistedTokens(): void {
    this.metrics.blacklistedTokens++;
  }

  setActiveSessionsCount(count: number): void {
    this.metrics.activeSessionsCount = count;
  }

  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      rateLimitHits: 0,
      bruteForceAttempts: 0,
      invalidTokenAttempts: 0,
      suspiciousRequests: 0,
      blacklistedTokens: 0,
      activeSessionsCount: 0,
    };
  }
}

export const securityMetrics = new SecurityMetricsCollector();

// Export default configuration
export default loadSecurityConfig();

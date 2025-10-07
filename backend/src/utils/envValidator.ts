import { env } from './env';
import { logger } from './loggerEnhanced';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates environment configuration on startup
 */
export class EnvValidator {
  static validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    logger.info('Starting environment validation...', {
      environment: env.NODE_ENV,
      pid: process.pid
    });

    // Critical validations (errors)
    this.validateDatabaseConfig(errors);
    this.validateJWTConfig(errors);
    this.validateSecurityConfig(errors, warnings);
    this.validateTelegramConfig(errors, warnings);
    this.validateNetworkConfig(errors, warnings);
    this.validateLoggingConfig(warnings);
    this.validateFileUploadConfig(warnings);
    this.validateRedisConfig(warnings);
    this.validateSSLConfig(errors, warnings);
    this.validateRateLimitConfig(warnings);
    this.validateNotificationConfig(errors, warnings);

    const isValid = errors.length === 0;

    // Log results
    if (errors.length > 0) {
      logger.error('Environment validation failed', {
        errors,
        warnings,
        environment: env.NODE_ENV,
      });
    } else if (warnings.length > 0) {
      logger.warn('Environment validation passed with warnings', {
        warnings,
        environment: env.NODE_ENV,
      });
    } else {
      logger.info('Environment validation passed successfully', {
        environment: env.NODE_ENV,
      });
    }

    return { isValid, errors, warnings };
  }

  private static validateDatabaseConfig(errors: string[]) {
    if (!env.DATABASE_URL) {
      errors.push('DATABASE_URL is required');
    } else {
      // Validate database URL format
      const dbUrl = env.DATABASE_URL;
      const provider = process.env.DATABASE_PROVIDER;
      
      // SQLite uses file: URLs which don't need full URL validation
      if (provider === 'sqlite' || dbUrl.startsWith('file:')) {
        if (!dbUrl.startsWith('file:')) {
          errors.push('DATABASE_URL for SQLite must start with file:');
        }
      } else {
        // For other databases (MySQL, PostgreSQL), validate as URL
        try {
          new URL(dbUrl);
        } catch (_error) {
          errors.push('DATABASE_URL must be a valid URL');
        }
      }
    }

    // Check database provider consistency
    const dbUrl = env.DATABASE_URL || '';
    const provider = process.env.DATABASE_PROVIDER;

    if (provider === 'mysql' && !dbUrl.startsWith('mysql://')) {
      errors.push('DATABASE_PROVIDER is mysql but DATABASE_URL does not start with mysql://');
    }

    if (provider === 'sqlite' && !dbUrl.startsWith('file:')) {
      errors.push('DATABASE_PROVIDER is sqlite but DATABASE_URL does not start with file:');
    }
  }

  private static validateJWTConfig(errors: string[]) {
    if (!env.JWT_SECRET || env.JWT_SECRET === 'change-me') {
      if (env.NODE_ENV === 'production') {
        errors.push('JWT_SECRET must be set to a secure value in production');
      } else {
        // Still an error in dev, but less critical
        errors.push('JWT_SECRET should be changed from default value');
      }
    }

    if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET should be at least 32 characters long');
    }

    // Validate JWT expiry formats
    if (env.JWT_EXPIRES_IN && !this.isValidExpiryFormat(env.JWT_EXPIRES_IN)) {
      errors.push('JWT_EXPIRES_IN must be in format like "15m", "1h", "7d"');
    }

    if (env.JWT_REFRESH_EXPIRES_IN && !this.isValidExpiryFormat(env.JWT_REFRESH_EXPIRES_IN)) {
      errors.push('JWT_REFRESH_EXPIRES_IN must be in format like "15m", "1h", "7d"');
    }
  }

  private static validateSecurityConfig(errors: string[], warnings: string[]) {
    // CORS validation
    if (env.NODE_ENV === 'production' && !env.CORS_WHITELIST) {
      warnings.push('CORS_WHITELIST should be set in production for security');
    }

    if (env.CORS_WHITELIST) {
      const origins = env.CORS_WHITELIST.split(',').map(o => o.trim());
      for (const origin of origins) {
        try {
          new URL(origin);
        } catch (_error) {
          warnings.push(`Invalid CORS origin: ${origin}`);
        }
      }
    }

    // Admin IP whitelist validation for production
    if (env.NODE_ENV === 'production' && !process.env.ADMIN_IP_WHITELIST) {
      warnings.push('ADMIN_IP_WHITELIST should be set in production for enhanced security');
    }

    if (process.env.ADMIN_IP_WHITELIST) {
      const ips = process.env.ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim());
      for (const ip of ips) {
        if (!this.isValidIPOrCIDR(ip)) {
          warnings.push(`Invalid IP or CIDR in ADMIN_IP_WHITELIST: ${ip}`);
        }
      }
    }

    // Trusted IPs validation
    if (env.TRUSTED_IPS) {
      const ips = env.TRUSTED_IPS.split(',').map(ip => ip.trim());
      for (const ip of ips) {
        if (!this.isValidIPOrCIDR(ip)) {
          warnings.push(`Invalid IP or CIDR in TRUSTED_IPS: ${ip}`);
        }
      }
    }

    // Check if running in production with default secrets
    if (env.NODE_ENV === 'production') {
      const defaultSecrets = [
        'dev-jwt-secret-change-in-production',
        'your-secure-secret-key',
        'your-super-secret-jwt-key',
        'your-super-secret-refresh-key',
        'change-me',
        'default-secret'
      ];

      if (defaultSecrets.includes(env.JWT_SECRET)) {
        errors.push('Default JWT_SECRET detected in production environment');
      }

      // Check refresh secret
      if (defaultSecrets.includes(process.env.JWT_REFRESH_SECRET || '')) {
        errors.push('Default JWT_REFRESH_SECRET detected in production environment');
      }

      // Security headers validation
      if (!process.env.ENABLE_SECURITY_HEADERS || process.env.ENABLE_SECURITY_HEADERS !== 'true') {
        warnings.push('ENABLE_SECURITY_HEADERS should be true in production');
      }

      // Brute force protection
      if (!process.env.ENABLE_BRUTE_FORCE_PROTECTION || process.env.ENABLE_BRUTE_FORCE_PROTECTION !== 'true') {
        warnings.push('ENABLE_BRUTE_FORCE_PROTECTION should be true in production');
      }
    }
  }

  private static validateTelegramConfig(errors: string[], warnings: string[]) {
    // Telegram bot token format validation
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (telegramToken) {
      if (!telegramToken.match(/^\d{8,10}:[A-Za-z0-9_-]{35}$/)) {
        warnings.push('TELEGRAM_BOT_TOKEN format appears invalid');
      }
    } else if (env.NODE_ENV === 'production') {
      errors.push('TELEGRAM_BOT_TOKEN is required in production');
    }

    // SECURITY: SUPER_ADMIN_TELEGRAM_ID removed for security reasons
    // OWNER users must be created manually via admin tools
    // See SECURITY_OWNER_CREATION.md for details
    if (env.SUPER_ADMIN_TELEGRAM_ID) {
      warnings.push('⚠️  SUPER_ADMIN_TELEGRAM_ID is DEPRECATED and IGNORED for security');
      warnings.push('✅ Automatic OWNER creation is DISABLED - all new users are CUSTOMER by default');
      warnings.push('📝 To create OWNER users, use: node backend/tools/admin/promote_user.js <telegram-id> OWNER');
      warnings.push('📖 See SECURITY_OWNER_CREATION.md for details');
    }
  }

  private static validateLoggingConfig(warnings: string[]) {
    // Log level validation
    const validLogLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
    if (env.LOG_LEVEL && !validLogLevels.includes(env.LOG_LEVEL)) {
      warnings.push(`Invalid LOG_LEVEL: ${env.LOG_LEVEL}. Valid levels: ${validLogLevels.join(', ')}`);
    }

    // Log file size validation
    if (env.LOG_FILE_MAX_SIZE && !env.LOG_FILE_MAX_SIZE.match(/^\d+[kmg]?$/i)) {
      warnings.push('LOG_FILE_MAX_SIZE should be in format like "20m", "1g", "500k"');
    }

    // Log file retention validation
    if (env.LOG_FILE_MAX_FILES && !env.LOG_FILE_MAX_FILES.match(/^\d+[dwy]?$/)) {
      warnings.push('LOG_FILE_MAX_FILES should be in format like "14d", "2w", "1y"');
    }
  }

  private static validateFileUploadConfig(warnings: string[]) {
    const maxSize = process.env.MAX_FILE_SIZE;
    if (maxSize && isNaN(Number(maxSize))) {
      warnings.push('MAX_FILE_SIZE should be a number (bytes)');
    }

    const allowedTypes = process.env.ALLOWED_MIME_TYPES;
    if (allowedTypes) {
      const types = allowedTypes.split(',').map(t => t.trim());
      for (const type of types) {
        if (!type.includes('/')) {
          warnings.push(`Invalid MIME type in ALLOWED_MIME_TYPES: ${type}`);
        }
      }
    }
  }

  // Helper methods
  private static isValidExpiryFormat(expiry: string): boolean {
    return /^\d+[smhd]$/.test(expiry);
  }

  private static isValidIPOrCIDR(ip: string): boolean {
    // Basic IP/CIDR validation (could be more comprehensive)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}(\/\d{1,3})?$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Print environment summary for debugging
   */
  // New validation methods
  private static validateNetworkConfig(errors: string[], warnings: string[]) {
    // Port validation
    const port = env.PORT;
    if (port && (port < 1 || port > 65535)) {
      errors.push(`PORT must be between 1 and 65535, got: ${port}`);
    }

    // Frontend URL validation
    if (env.FRONTEND_URL) {
      try {
        const url = new URL(env.FRONTEND_URL);
        if (!['http:', 'https:'].includes(url.protocol)) {
          warnings.push('FRONTEND_URL should use http:// or https://');
        }
        if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
          warnings.push('FRONTEND_URL should use https:// in production');
        }
      } catch (_error) {
        warnings.push('FRONTEND_URL is not a valid URL');
      }
    }

    // Admin panel URL validation
    if (process.env.ADMIN_PANEL_URL) {
      try {
        new URL(process.env.ADMIN_PANEL_URL);
      } catch (error) {
        warnings.push('ADMIN_PANEL_URL is not a valid URL');
      }
    }
  }

  private static validateRedisConfig(warnings: string[]) {
    if (env.REDIS_URL) {
      try {
        const url = new URL(env.REDIS_URL);
        if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
          warnings.push('REDIS_URL should use redis:// or rediss:// protocol');
        }
      } catch (error) {
        warnings.push('REDIS_URL is not a valid URL');
      }
    } else if (env.NODE_ENV === 'production') {
      warnings.push('REDIS_URL should be configured in production for session storage and caching');
    }
  }

  private static validateSSLConfig(errors: string[], warnings: string[]) {
    if (env.NODE_ENV === 'production') {
      // Check HTTPS settings
      const httpsEnabled = process.env.USE_HTTPS === 'true' || process.env.HTTPS === 'true';
      if (!httpsEnabled) {
        warnings.push('HTTPS should be enabled in production (USE_HTTPS=true)');
      }

      // SSL certificate paths
      const sslKey = process.env.SSL_KEY_PATH;
      const sslCert = process.env.SSL_CERT_PATH;

      if (httpsEnabled && (!sslKey || !sslCert)) {
        errors.push('SSL_KEY_PATH and SSL_CERT_PATH must be provided when HTTPS is enabled');
      }
    }
  }

  private static validateRateLimitConfig(warnings: string[]) {
    const rateLimitMax = process.env.RATE_LIMIT_MAX;
    if (rateLimitMax && (isNaN(Number(rateLimitMax)) || Number(rateLimitMax) <= 0)) {
      warnings.push('RATE_LIMIT_MAX should be a positive number');
    }

    const authRateLimitMax = process.env.AUTH_RATE_LIMIT_MAX;
    if (authRateLimitMax && (isNaN(Number(authRateLimitMax)) || Number(authRateLimitMax) <= 0)) {
      warnings.push('AUTH_RATE_LIMIT_MAX should be a positive number');
    }

    const uploadRateLimitMax = process.env.UPLOAD_RATE_LIMIT_MAX;
    if (uploadRateLimitMax && (isNaN(Number(uploadRateLimitMax)) || Number(uploadRateLimitMax) <= 0)) {
      warnings.push('UPLOAD_RATE_LIMIT_MAX should be a positive number');
    }
  }

  private static validateNotificationConfig(errors: string[], warnings: string[]) {
    // Email configuration for notifications
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailHost = process.env.EMAIL_HOST;

    if (emailUser && !emailPass) {
      warnings.push('EMAIL_PASS is required when EMAIL_USER is set');
    }

    if (emailPass && !emailUser) {
      warnings.push('EMAIL_USER is required when EMAIL_PASS is set');
    }

    if ((emailUser || emailPass) && !emailHost) {
      warnings.push('EMAIL_HOST is required for email notifications');
    }

    // Telegram webhook validation
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const url = new URL(webhookUrl);
        if (url.protocol !== 'https:') {
          errors.push('TELEGRAM_WEBHOOK_URL must use HTTPS');
        }
      } catch (error) {
        warnings.push('TELEGRAM_WEBHOOK_URL is not a valid URL');
      }
    }
  }

  static printEnvironmentSummary() {
    const summary = {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      databaseProvider: process.env.DATABASE_PROVIDER || 'sqlite',
      databaseConnected: !!env.DATABASE_URL,
      redisConfigured: !!env.REDIS_URL,
      telegramConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      frontendUrl: env.FRONTEND_URL,
      logLevel: env.LOG_LEVEL || 'info',
      adminJsEnabled: false, // AdminJS completely disabled
      superAdminSet: false, // DEPRECATED: SUPER_ADMIN_TELEGRAM_ID removed for security
      httpsEnabled: process.env.USE_HTTPS === 'true' || process.env.HTTPS === 'true',
      securityHeadersEnabled: process.env.ENABLE_SECURITY_HEADERS !== 'false',
      bruteForceProtection: process.env.ENABLE_BRUTE_FORCE_PROTECTION !== 'false',
      corsWhitelistSet: !!env.CORS_WHITELIST,
      adminIpWhitelistSet: !!process.env.ADMIN_IP_WHITELIST,
      rateLimiting: {
        global: process.env.RATE_LIMIT_MAX || '100',
        auth: process.env.AUTH_RATE_LIMIT_MAX || '5',
        upload: process.env.UPLOAD_RATE_LIMIT_MAX || '10'
      },
      emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_HOST),
      webhookConfigured: !!process.env.TELEGRAM_WEBHOOK_URL
    };

    logger.info('🚀 Environment Configuration Summary', summary);

    // Additional security summary for production
    if (env.NODE_ENV === 'production') {
      const securityScore = this.calculateSecurityScore();
      logger.info('🔒 Production Security Score', securityScore);
    }

    return summary;
  }

  /**
   * Calculate security score for production environment
   */
  private static calculateSecurityScore(): { score: number; total: number; recommendations: string[] } {
    let score = 0;
    const total = 15;
    const recommendations: string[] = [];

    // Database security
    if (env.DATABASE_URL && !env.DATABASE_URL.includes('localhost')) score++;
    else recommendations.push('Use external database in production');

    // JWT security
    if (env.JWT_SECRET && env.JWT_SECRET.length >= 32) score++;
    else recommendations.push('Use stronger JWT secret (32+ chars)');

    // HTTPS
    if (process.env.USE_HTTPS === 'true') score++;
    else recommendations.push('Enable HTTPS in production');

    // CORS whitelist
    if (env.CORS_WHITELIST) score++;
    else recommendations.push('Configure CORS whitelist');

    // Admin IP whitelist
    if (process.env.ADMIN_IP_WHITELIST) score++;
    else recommendations.push('Configure admin IP whitelist');

    // Redis for session storage
    if (env.REDIS_URL) score++;
    else recommendations.push('Configure Redis for session storage');

    // Security headers
    if (process.env.ENABLE_SECURITY_HEADERS !== 'false') score++;
    else recommendations.push('Enable security headers');

    // Brute force protection
    if (process.env.ENABLE_BRUTE_FORCE_PROTECTION !== 'false') score++;
    else recommendations.push('Enable brute force protection');

    // Rate limiting configured
    if (process.env.RATE_LIMIT_MAX && Number(process.env.RATE_LIMIT_MAX) < 200) score++;
    else recommendations.push('Configure restrictive rate limits');

    // Strong auth rate limiting
    if (process.env.AUTH_RATE_LIMIT_MAX && Number(process.env.AUTH_RATE_LIMIT_MAX) <= 5) score++;
    else recommendations.push('Configure strict auth rate limits');

    // Log level appropriate for production
    if (env.LOG_LEVEL && ['error', 'warn', 'info'].includes(env.LOG_LEVEL)) score++;
    else recommendations.push('Use appropriate log level for production');

    // File upload limits
    if (process.env.UPLOAD_RATE_LIMIT_MAX && Number(process.env.UPLOAD_RATE_LIMIT_MAX) <= 10) score++;
    else recommendations.push('Configure upload rate limits');

    // Telegram webhook (more secure than polling)
    if (process.env.TELEGRAM_WEBHOOK_URL) score++;
    else recommendations.push('Use Telegram webhooks instead of polling');

    // Email notifications configured
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) score++;
    else recommendations.push('Configure email notifications');

    // Environment-specific secrets
    const hasDefaultSecrets = [
      'your-super-secret-jwt-key',
      'change-me',
      'default-secret'
    ].some(secret => env.JWT_SECRET?.includes(secret));

    if (!hasDefaultSecrets) score++;
    else recommendations.push('Replace default secrets with production values');

    return { score, total, recommendations: recommendations.slice(0, 5) }; // Top 5 recommendations
  }

  /**
   * Validate critical environment variables and exit if invalid
   */
  static validateOrExit(): void {
    const result = this.validate();

    if (!result.isValid) {
      logger.error('❌ Environment validation failed. Application cannot start safely.', {
        errors: result.errors,
        warnings: result.warnings
      });

      console.error('\n🚨 CRITICAL ENVIRONMENT ERRORS:');
      result.errors.forEach(error => console.error(`  ❌ ${error}`));

      if (result.warnings.length > 0) {
        console.warn('\n⚠️  ENVIRONMENT WARNINGS:');
        result.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
      }

      console.error('\n🛑 Please fix the above errors and restart the application.\n');
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      logger.warn('⚠️ Environment validation passed with warnings', {
        warnings: result.warnings
      });

      if (env.NODE_ENV !== 'production') {
        console.warn('\n⚠️  ENVIRONMENT WARNINGS:');
        result.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
        console.warn('');
      }
    }
  }

  /**
   * Get environment health status for monitoring
   */
  static getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    timestamp: string;
    environment: string;
    checks: Record<string, { status: string; message?: string; }>;
  } {
    const result = this.validate();
    const checks: Record<string, { status: string; message?: string; }> = {};

    // Database check
    checks.database = {
      status: env.DATABASE_URL ? 'pass' : 'fail',
      message: env.DATABASE_URL ? undefined : 'DATABASE_URL not configured'
    };

    // JWT check
    checks.jwt = {
      status: env.JWT_SECRET && env.JWT_SECRET.length >= 32 ? 'pass' : 'fail',
      message: !env.JWT_SECRET ? 'JWT_SECRET not configured' : env.JWT_SECRET.length < 32 ? 'JWT_SECRET too short' : undefined
    };

    // Redis check
    checks.redis = {
      status: env.REDIS_URL ? 'pass' : env.NODE_ENV === 'production' ? 'warn' : 'pass',
      message: !env.REDIS_URL && env.NODE_ENV === 'production' ? 'Redis recommended for production' : undefined
    };

    // HTTPS check
    checks.https = {
      status: env.NODE_ENV === 'production' && process.env.USE_HTTPS !== 'true' ? 'warn' : 'pass',
      message: env.NODE_ENV === 'production' && process.env.USE_HTTPS !== 'true' ? 'HTTPS recommended for production' : undefined
    };

    const status = result.errors.length > 0 ? 'critical' : result.warnings.length > 0 ? 'warning' : 'healthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV || 'unknown',
      checks
    };
  }
}

export default EnvValidator;

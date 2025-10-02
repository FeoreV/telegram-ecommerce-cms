/**
 * Authentication Configuration with User-Friendly Settings
 */

export interface AuthConfigOptions {
  // Token Configuration
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  
  // Session Management
  maxActiveSessions: number;
  sessionExtendOnActivity: boolean;
  
  // Security Settings
  bcryptRounds: number;
  enableAutoRefresh: boolean;
  refreshGracePeriod: number; // seconds before expiry to allow refresh
}

// Environment-based configuration with sensible defaults
export const AUTH_CONFIG: AuthConfigOptions = {
  // More user-friendly token expiry times
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '2h',  // 2 hours instead of 15min
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '30d', // 30 days instead of 7d
  
  // Session management
  maxActiveSessions: parseInt(process.env.MAX_ACTIVE_SESSIONS || '5'),
  sessionExtendOnActivity: process.env.SESSION_EXTEND_ON_ACTIVITY !== 'false',
  
  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  enableAutoRefresh: process.env.ENABLE_AUTO_REFRESH !== 'false',
  refreshGracePeriod: parseInt(process.env.REFRESH_GRACE_PERIOD || '300'), // 5 minutes
};

// Different presets for different environments
export const AUTH_PRESETS = {
  // Development - longer tokens for convenience
  development: {
    ...AUTH_CONFIG,
    accessTokenExpiry: '8h',
    refreshTokenExpiry: '90d',
    maxActiveSessions: 10,
  },
  
  // Production - balanced security and UX
  production: {
    ...AUTH_CONFIG,
    accessTokenExpiry: '2h', 
    refreshTokenExpiry: '30d',
    maxActiveSessions: 3,
  },
  
  // High Security - shorter tokens, stricter limits
  highSecurity: {
    ...AUTH_CONFIG,
    accessTokenExpiry: '30m',
    refreshTokenExpiry: '7d', 
    maxActiveSessions: 1,
  },
  
  // Mobile-friendly - longer tokens for mobile apps
  mobile: {
    ...AUTH_CONFIG,
    accessTokenExpiry: '4h',
    refreshTokenExpiry: '60d',
    sessionExtendOnActivity: true,
  }
};

// Get configuration based on environment
export function getAuthConfig(): AuthConfigOptions {
  const env = process.env.NODE_ENV;
  const preset = process.env.AUTH_PRESET;
  
  if (preset && AUTH_PRESETS[preset as keyof typeof AUTH_PRESETS]) {
    return AUTH_PRESETS[preset as keyof typeof AUTH_PRESETS];
  }
  
  switch (env) {
    case 'development':
      return AUTH_PRESETS.development;
    case 'production':
      return AUTH_PRESETS.production;
    default:
      return AUTH_CONFIG;
  }
}

// Helper to check if token needs refresh soon
export function shouldRefreshToken(tokenExp: number, gracePeriod: number = AUTH_CONFIG.refreshGracePeriod): boolean {
  const currentTime = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = tokenExp - currentTime;
  return timeUntilExpiry <= gracePeriod;
}

// Helper to parse expiry strings to seconds
export function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/(\d+)([smhd]?)/);
  if (!match) return 7200; // 2 hours default
  
  const [, value, unit] = match;
  const num = parseInt(value);
  
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return num * 60; // Default to minutes
  }
}

// Validate configuration
export function validateAuthConfig(config: AuthConfigOptions): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const accessSeconds = parseExpiryToSeconds(config.accessTokenExpiry);
  const refreshSeconds = parseExpiryToSeconds(config.refreshTokenExpiry);
  
  if (accessSeconds >= refreshSeconds) {
    errors.push('Access token expiry must be shorter than refresh token expiry');
  }
  
  if (accessSeconds < 300) { // 5 minutes
    errors.push('Access token expiry too short (minimum 5 minutes recommended)');
  }
  
  if (refreshSeconds > 86400 * 90) { // 90 days
    errors.push('Refresh token expiry too long (maximum 90 days recommended)');
  }
  
  if (config.bcryptRounds < 10 || config.bcryptRounds > 15) {
    errors.push('bcrypt rounds should be between 10-15 for good security/performance balance');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

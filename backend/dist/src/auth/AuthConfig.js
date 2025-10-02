"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_PRESETS = exports.AUTH_CONFIG = void 0;
exports.getAuthConfig = getAuthConfig;
exports.shouldRefreshToken = shouldRefreshToken;
exports.parseExpiryToSeconds = parseExpiryToSeconds;
exports.validateAuthConfig = validateAuthConfig;
exports.AUTH_CONFIG = {
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '2h',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '30d',
    maxActiveSessions: parseInt(process.env.MAX_ACTIVE_SESSIONS || '5'),
    sessionExtendOnActivity: process.env.SESSION_EXTEND_ON_ACTIVITY !== 'false',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    enableAutoRefresh: process.env.ENABLE_AUTO_REFRESH !== 'false',
    refreshGracePeriod: parseInt(process.env.REFRESH_GRACE_PERIOD || '300'),
};
exports.AUTH_PRESETS = {
    development: {
        ...exports.AUTH_CONFIG,
        accessTokenExpiry: '8h',
        refreshTokenExpiry: '90d',
        maxActiveSessions: 10,
    },
    production: {
        ...exports.AUTH_CONFIG,
        accessTokenExpiry: '2h',
        refreshTokenExpiry: '30d',
        maxActiveSessions: 3,
    },
    highSecurity: {
        ...exports.AUTH_CONFIG,
        accessTokenExpiry: '30m',
        refreshTokenExpiry: '7d',
        maxActiveSessions: 1,
    },
    mobile: {
        ...exports.AUTH_CONFIG,
        accessTokenExpiry: '4h',
        refreshTokenExpiry: '60d',
        sessionExtendOnActivity: true,
    }
};
function getAuthConfig() {
    const env = process.env.NODE_ENV;
    const preset = process.env.AUTH_PRESET;
    if (preset && exports.AUTH_PRESETS[preset]) {
        return exports.AUTH_PRESETS[preset];
    }
    switch (env) {
        case 'development':
            return exports.AUTH_PRESETS.development;
        case 'production':
            return exports.AUTH_PRESETS.production;
        default:
            return exports.AUTH_CONFIG;
    }
}
function shouldRefreshToken(tokenExp, gracePeriod = exports.AUTH_CONFIG.refreshGracePeriod) {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = tokenExp - currentTime;
    return timeUntilExpiry <= gracePeriod;
}
function parseExpiryToSeconds(expiry) {
    const match = expiry.match(/(\d+)([smhd]?)/);
    if (!match)
        return 7200;
    const [, value, unit] = match;
    const num = parseInt(value);
    switch (unit) {
        case 's': return num;
        case 'm': return num * 60;
        case 'h': return num * 3600;
        case 'd': return num * 86400;
        default: return num * 60;
    }
}
function validateAuthConfig(config) {
    const errors = [];
    const accessSeconds = parseExpiryToSeconds(config.accessTokenExpiry);
    const refreshSeconds = parseExpiryToSeconds(config.refreshTokenExpiry);
    if (accessSeconds >= refreshSeconds) {
        errors.push('Access token expiry must be shorter than refresh token expiry');
    }
    if (accessSeconds < 300) {
        errors.push('Access token expiry too short (minimum 5 minutes recommended)');
    }
    if (refreshSeconds > 86400 * 90) {
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
//# sourceMappingURL=AuthConfig.js.map
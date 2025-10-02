"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
function requireString(name, def) {
    const v = (process.env[name] ?? def);
    if (!v || v.length === 0)
        throw new Error(`Missing env ${String(name)}`);
    return v;
}
function optionalString(name) {
    const v = process.env[name];
    return v && v.length > 0 ? v : undefined;
}
function requireNumber(name, def) {
    const raw = process.env[name];
    const v = raw ? Number(raw) : def;
    if (!Number.isFinite(v))
        throw new Error(`Invalid number env ${String(name)}`);
    return v;
}
exports.env = {
    PORT: requireNumber('PORT', 3001),
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: requireString('DATABASE_URL'),
    REDIS_URL: optionalString('REDIS_URL'),
    FRONTEND_URL: optionalString('FRONTEND_URL'),
    JWT_SECRET: requireString('JWT_SECRET', 'change-me'),
    MEDUSA_BASE_URL: optionalString('MEDUSA_BASE_URL'),
    MEDUSA_WEBHOOK_TOKEN: optionalString('MEDUSA_WEBHOOK_TOKEN'),
    DEV_BYPASS_ROLES: optionalString('DEV_BYPASS_ROLES'),
    SUPER_ADMIN_TELEGRAM_ID: optionalString('SUPER_ADMIN_TELEGRAM_ID'),
    CORS_WHITELIST: optionalString('CORS_WHITELIST'),
    TRUSTED_IPS: optionalString('TRUSTED_IPS'),
    JWT_EXPIRES_IN: optionalString('JWT_EXPIRES_IN'),
    JWT_REFRESH_EXPIRES_IN: optionalString('JWT_REFRESH_EXPIRES_IN'),
    LOG_LEVEL: optionalString('LOG_LEVEL'),
    LOG_FILE_MAX_SIZE: optionalString('LOG_FILE_MAX_SIZE'),
    LOG_FILE_MAX_FILES: optionalString('LOG_FILE_MAX_FILES'),
};
//# sourceMappingURL=env.js.map
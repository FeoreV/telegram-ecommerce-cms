"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.checkAuthSystemHealth = exports.validateAuthConfig = exports.secureAuthRoutes = exports.RolePermissionManager = exports.RoleManager = exports.ROLE_PERMISSIONS = exports.PermissionChecker = exports.Permission = exports.PERMISSION_GROUPS = exports.verifyToken = exports.updateProfile = exports.setPassword = exports.refreshToken = exports.logout = exports.loginWithTelegram = exports.loginWithEmail = exports.getProfile = exports.changePassword = exports.securityMiddlewareStack = exports.securityLoggingMiddleware = exports.secureAuthMiddleware = exports.requireStoreAccess = exports.requireRole = exports.requirePermission = exports.ownerAuthMiddlewareStack = exports.optionalAuthMiddleware = exports.loginSlowDown = exports.generalRateLimit = exports.authRateLimit = exports.authMiddlewareStack = exports.adminAuthMiddlewareStack = exports.UserRole = exports.SecureAuthSystem = void 0;
var SecureAuthSystem_1 = require("./SecureAuthSystem");
Object.defineProperty(exports, "SecureAuthSystem", { enumerable: true, get: function () { return SecureAuthSystem_1.SecureAuthSystem; } });
Object.defineProperty(exports, "UserRole", { enumerable: true, get: function () { return SecureAuthSystem_1.UserRole; } });
var SecureAuthMiddleware_1 = require("./SecureAuthMiddleware");
Object.defineProperty(exports, "adminAuthMiddlewareStack", { enumerable: true, get: function () { return SecureAuthMiddleware_1.adminAuthMiddlewareStack; } });
Object.defineProperty(exports, "authMiddlewareStack", { enumerable: true, get: function () { return SecureAuthMiddleware_1.authMiddlewareStack; } });
Object.defineProperty(exports, "authRateLimit", { enumerable: true, get: function () { return SecureAuthMiddleware_1.authRateLimit; } });
Object.defineProperty(exports, "generalRateLimit", { enumerable: true, get: function () { return SecureAuthMiddleware_1.generalRateLimit; } });
Object.defineProperty(exports, "loginSlowDown", { enumerable: true, get: function () { return SecureAuthMiddleware_1.loginSlowDown; } });
Object.defineProperty(exports, "optionalAuthMiddleware", { enumerable: true, get: function () { return SecureAuthMiddleware_1.optionalAuthMiddleware; } });
Object.defineProperty(exports, "ownerAuthMiddlewareStack", { enumerable: true, get: function () { return SecureAuthMiddleware_1.ownerAuthMiddlewareStack; } });
Object.defineProperty(exports, "requirePermission", { enumerable: true, get: function () { return SecureAuthMiddleware_1.requirePermission; } });
Object.defineProperty(exports, "requireRole", { enumerable: true, get: function () { return SecureAuthMiddleware_1.requireRole; } });
Object.defineProperty(exports, "requireStoreAccess", { enumerable: true, get: function () { return SecureAuthMiddleware_1.requireStoreAccess; } });
Object.defineProperty(exports, "secureAuthMiddleware", { enumerable: true, get: function () { return SecureAuthMiddleware_1.secureAuthMiddleware; } });
Object.defineProperty(exports, "securityLoggingMiddleware", { enumerable: true, get: function () { return SecureAuthMiddleware_1.securityLoggingMiddleware; } });
Object.defineProperty(exports, "securityMiddlewareStack", { enumerable: true, get: function () { return SecureAuthMiddleware_1.securityMiddlewareStack; } });
var SecureAuthController_1 = require("./SecureAuthController");
Object.defineProperty(exports, "changePassword", { enumerable: true, get: function () { return SecureAuthController_1.changePassword; } });
Object.defineProperty(exports, "getProfile", { enumerable: true, get: function () { return SecureAuthController_1.getProfile; } });
Object.defineProperty(exports, "loginWithEmail", { enumerable: true, get: function () { return SecureAuthController_1.loginWithEmail; } });
Object.defineProperty(exports, "loginWithTelegram", { enumerable: true, get: function () { return SecureAuthController_1.loginWithTelegram; } });
Object.defineProperty(exports, "logout", { enumerable: true, get: function () { return SecureAuthController_1.logout; } });
Object.defineProperty(exports, "refreshToken", { enumerable: true, get: function () { return SecureAuthController_1.refreshToken; } });
Object.defineProperty(exports, "setPassword", { enumerable: true, get: function () { return SecureAuthController_1.setPassword; } });
Object.defineProperty(exports, "updateProfile", { enumerable: true, get: function () { return SecureAuthController_1.updateProfile; } });
Object.defineProperty(exports, "verifyToken", { enumerable: true, get: function () { return SecureAuthController_1.verifyToken; } });
var RolePermissionManager_1 = require("./RolePermissionManager");
Object.defineProperty(exports, "PERMISSION_GROUPS", { enumerable: true, get: function () { return RolePermissionManager_1.PERMISSION_GROUPS; } });
Object.defineProperty(exports, "Permission", { enumerable: true, get: function () { return RolePermissionManager_1.Permission; } });
Object.defineProperty(exports, "PermissionChecker", { enumerable: true, get: function () { return RolePermissionManager_1.PermissionChecker; } });
Object.defineProperty(exports, "ROLE_PERMISSIONS", { enumerable: true, get: function () { return RolePermissionManager_1.ROLE_PERMISSIONS; } });
Object.defineProperty(exports, "RoleManager", { enumerable: true, get: function () { return RolePermissionManager_1.RoleManager; } });
Object.defineProperty(exports, "RolePermissionManager", { enumerable: true, get: function () { return RolePermissionManager_1.RolePermissionManager; } });
var SecureAuthRoutes_1 = require("./SecureAuthRoutes");
Object.defineProperty(exports, "secureAuthRoutes", { enumerable: true, get: function () { return __importDefault(SecureAuthRoutes_1).default; } });
const validateAuthConfig = () => {
    const errors = [];
    if (!process.env.JWT_SECRET) {
        errors.push('JWT_SECRET environment variable is required');
    }
    if (!process.env.JWT_REFRESH_SECRET) {
        errors.push('JWT_REFRESH_SECRET environment variable is required');
    }
    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
        errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        errors.push('JWT_SECRET should be at least 32 characters long');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
};
exports.validateAuthConfig = validateAuthConfig;
const checkAuthSystemHealth = async () => {
    let status = 'healthy';
    const services = {};
    try {
        const { prisma } = await import('../lib/prisma');
        await prisma.user.count();
        services.database = 'connected';
    }
    catch {
        services.database = 'error';
        status = 'unhealthy';
    }
    if (process.env.REDIS_URL) {
        try {
            services.redis = 'connected';
        }
        catch {
            services.redis = 'error';
            status = 'degraded';
        }
    }
    else {
        services.redis = 'not_configured';
    }
    const configCheck = (0, exports.validateAuthConfig)();
    services.jwt = configCheck.isValid ? 'connected' : 'error';
    if (!configCheck.isValid) {
        status = 'unhealthy';
    }
    return {
        status,
        services,
        timestamp: new Date().toISOString()
    };
};
exports.checkAuthSystemHealth = checkAuthSystemHealth;
var SecureAuthRoutes_2 = require("./SecureAuthRoutes");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(SecureAuthRoutes_2).default; } });
//# sourceMappingURL=index.js.map
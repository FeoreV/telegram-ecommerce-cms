export { SecureAuthSystem, UserRole, AuthTokenPayload, RefreshTokenPayload, AuthenticatedRequest } from './SecureAuthSystem';
export { secureAuthMiddleware, optionalAuthMiddleware, requireRole, requirePermission, requireStoreAccess, authRateLimit, loginSlowDown, generalRateLimit, securityLoggingMiddleware, securityMiddlewareStack, authMiddlewareStack, adminAuthMiddlewareStack, ownerAuthMiddlewareStack } from './SecureAuthMiddleware';
export { loginWithEmail, loginWithTelegram, refreshToken, logout, getProfile, updateProfile, changePassword, setPassword, verifyToken } from './SecureAuthController';
export { Permission, ROLE_PERMISSIONS, PERMISSION_GROUPS, RolePermissionManager, RoleManager, PermissionChecker, PermissionContext } from './RolePermissionManager';
export { default as secureAuthRoutes } from './SecureAuthRoutes';
export declare const validateAuthConfig: () => {
    isValid: boolean;
    errors: string[];
};
export declare const checkAuthSystemHealth: () => Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    services: Record<string, "connected" | "error" | "not_configured">;
    timestamp: string;
}>;
export { default } from './SecureAuthRoutes';
//# sourceMappingURL=index.d.ts.map
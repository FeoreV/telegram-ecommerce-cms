export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: Date;
    refreshTokenExpiry: Date;
    sessionId: string;
}
export interface DeviceInfo {
    userAgent: string;
    ipAddress: string;
    deviceFingerprint: string;
    location?: string;
    platform?: string;
    browser?: string;
}
export interface SessionData {
    sessionId: string;
    userId: string;
    role: string;
    storeId?: string;
    deviceInfo: DeviceInfo;
    createdAt: Date;
    lastActivity: Date;
    isActive: boolean;
    refreshTokenHash: string;
    permissions: string[];
}
export interface AuthConfig {
    accessTokenTTL: number;
    refreshTokenTTL: number;
    maxSessionsPerUser: number;
    requireDeviceBinding: boolean;
    enableSessionTracking: boolean;
    rotateRefreshTokens: boolean;
    sessionInactivityTimeout: number;
}
export declare class SecureAuthService {
    private static instance;
    private config;
    private revokedTokens;
    private static createConfig;
    private constructor();
    static getInstance(): SecureAuthService;
    private generateSessionId;
    generateDeviceFingerprint(userAgent: string, ipAddress: string, additionalData?: any): string;
    private normalizeUserAgent;
    private hashIpAddress;
    createSession(userId: string, role: string, deviceInfo: DeviceInfo, storeId?: string, permissions?: string[]): Promise<TokenPair>;
    refreshToken(refreshToken: string, deviceInfo: DeviceInfo): Promise<TokenPair>;
    validateToken(accessToken: string, deviceInfo?: DeviceInfo): Promise<any>;
    revokeSession(sessionId: string): Promise<void>;
    revokeAllUserSessions(userId: string): Promise<void>;
    private storeSession;
    private getSession;
    getUserSessions(userId: string): Promise<SessionData[]>;
    private cleanupUserSessions;
    private removeSessionFromCache;
    private getRefreshTokenBySession;
    healthCheck(): Promise<{
        status: string;
        activeSessions: number;
        revokedTokens: number;
        config: AuthConfig;
    }>;
    getConfiguration(): AuthConfig;
}
export declare const secureAuthService: SecureAuthService;
//# sourceMappingURL=SecureAuthService.d.ts.map
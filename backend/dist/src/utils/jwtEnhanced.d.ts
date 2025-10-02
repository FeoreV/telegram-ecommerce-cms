export interface JWTPayload {
    userId: string;
    telegramId: string;
    role: string;
    sessionId?: string;
    type: 'access' | 'refresh';
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    refreshExpiresIn: number;
}
export declare class JWTService {
    private static readonly JWT_SECRET;
    private static readonly ACCESS_TOKEN_EXPIRY;
    private static readonly REFRESH_TOKEN_EXPIRY;
    private static readonly ISSUER;
    private static readonly AUDIENCE;
    static generateTokenPair(payload: Omit<JWTPayload, 'type' | 'sessionId'>): TokenPair;
    static verifyToken(token: string): JWTPayload;
    static refreshToken(refreshToken: string): Promise<TokenPair>;
    static blacklistToken(token: string): void;
    static blacklistAllUserTokens(userId: string): Promise<void>;
    static getUserSessions(userId: string): Array<{
        sessionId: string;
        createdAt: Date;
        lastUsed: Date;
    }>;
    static revokeSession(sessionId: string): void;
    private static isTokenBlacklisted;
    private static generateSessionId;
    private static parseExpiry;
    static getTokenStats(): {
        blacklistedTokens: number;
        activeSessions: number;
        sessionsByUser: Record<string, number>;
    };
}
export default JWTService;
//# sourceMappingURL=jwtEnhanced.d.ts.map
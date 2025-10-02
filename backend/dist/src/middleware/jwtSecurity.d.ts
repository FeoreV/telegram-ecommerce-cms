import { Request, Response, NextFunction } from 'express';
export interface JWTPayload {
    userId: string;
    role: string;
    telegramId: string;
    sessionId?: string;
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
}
export interface RefreshTokenPayload {
    userId: string;
    tokenFamily: string;
    version: number;
    iat?: number;
    exp?: number;
}
export declare class JWTSecurity {
    static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string;
    static generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string;
    static verifyAccessToken(token: string): Promise<JWTPayload>;
    static verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
    static blacklistToken(token: string, reason?: string): Promise<void>;
    static isTokenBlacklisted(token: string): Promise<boolean>;
    static extractTokenFromHeader(authHeader?: string): string | null;
    private static hashToken;
    static generateSessionId(): string;
    static validateSession(userId: string, sessionId?: string): Promise<boolean>;
    static cleanupBlacklist(): Promise<void>;
    static getBlacklistStats(): Promise<{
        total: number;
        active: number;
    }>;
    static generateTokenFamily(): string;
}
export declare const enhancedAuthMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const tokenRefreshMiddleware: (req: Request, res: Response, _next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const logoutMiddleware: (req: Request, res: Response) => Promise<void>;
export default enhancedAuthMiddleware;
//# sourceMappingURL=jwtSecurity.d.ts.map
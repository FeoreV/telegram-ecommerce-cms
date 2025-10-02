import { Request } from 'express';
import { Prisma } from '@prisma/client';
type UserWithPermissions = Prisma.UserGetPayload<{
    select: {
        id: true;
        telegramId: true;
        email: true;
        username: true;
        firstName: true;
        lastName: true;
        role: true;
        isActive: true;
    };
} & {
    permissions?: string[];
}>;
export declare enum UserRole {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    VENDOR = "VENDOR",
    CUSTOMER = "CUSTOMER"
}
export interface AuthTokenPayload {
    userId: string;
    telegramId?: string;
    email?: string;
    role: UserRole;
    sessionId: string;
    tokenType: 'access';
    iat?: number;
    exp?: number;
}
export interface RefreshTokenPayload {
    userId: string;
    tokenFamily: string;
    version: number;
    tokenType: 'refresh';
    iat?: number;
    exp?: number;
}
export interface AuthenticatedRequest extends Request {
    user: UserWithPermissions;
    sessionId?: string;
    token: string;
}
export declare class SecureAuthSystem {
    static hashPassword(password: string): Promise<string>;
    static verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
    static generateSessionId(): string;
    static generateTokenFamily(): string;
    static createSession(userId: string, sessionId: string): Promise<void>;
    static validateSession(sessionId: string, userId: string): Promise<boolean>;
    static destroySession(sessionId: string): Promise<void>;
    static generateAccessToken(payload: Omit<AuthTokenPayload, 'iat' | 'exp' | 'tokenType'>): string;
    static generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp' | 'tokenType'>): string;
    static verifyAccessToken(token: string): Promise<AuthTokenPayload>;
    static verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
    static blacklistToken(token: string, reason?: string): Promise<void>;
    static isTokenBlacklisted(token: string): Promise<boolean>;
    private static hashToken;
    static authenticateWithEmail(email: string, password: string): Promise<{
        user: UserWithPermissions;
        accessToken: string;
        refreshToken: string;
    }>;
    static authenticateWithTelegram(telegramId: string, telegramData?: {
        username?: string;
        firstName?: string;
        lastName?: string;
    }): Promise<{
        user: UserWithPermissions;
        accessToken: string;
        refreshToken: string;
    }>;
    private static generateTokenPair;
    static refreshTokenPair(refreshToken: string): Promise<{
        user: UserWithPermissions;
        accessToken: string;
        refreshToken: string;
    }>;
    static logout(accessToken: string, refreshToken?: string, sessionId?: string): Promise<void>;
    static setPassword(userId: string, password: string): Promise<void>;
    static changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    static isTokenNearExpiry(token: string): boolean;
    static autoRefreshIfNeeded(accessToken: string, refreshToken: string): Promise<{
        needsRefresh: boolean;
        newTokens?: {
            accessToken: string;
            refreshToken: string;
            user: UserWithPermissions;
        };
    }>;
    static updateSessionActivity(sessionId: string, userId: string): Promise<void>;
    static extractTokenFromHeader(authHeader?: string): string | null;
    static getUserPermissions(userId: string): Promise<string[]>;
    static cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=SecureAuthSystem.d.ts.map
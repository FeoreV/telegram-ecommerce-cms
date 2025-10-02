export declare enum UserRole {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    VENDOR = "VENDOR",
    CUSTOMER = "CUSTOMER"
}
export interface TokenPayload {
    userId: string;
    telegramId: string;
    role: UserRole;
}
export interface RefreshTokenPayload {
    userId: string;
    type: 'refresh';
}
export declare function generateToken(payload: TokenPayload): string;
export declare function generateRefreshToken(userId: string): string;
export declare function verifyToken(token: string): TokenPayload;
export declare function verifyRefreshToken(token: string): RefreshTokenPayload;
export declare function getTokenInfo(token: string): Record<string, unknown> | null;
export declare function isTokenExpired(token: string): boolean;
export declare function getTokenTimeToExpiry(token: string): number | null;
export declare function isValidTokenFormat(token: string): boolean;
export declare function generateTemporaryToken(payload: TokenPayload, expiresIn?: string): string;
export declare function validateTokenSecurity(token: string, _userAgent?: string, _ipAddress?: string): {
    isValid: boolean;
    warnings: string[];
};
//# sourceMappingURL=jwt.d.ts.map
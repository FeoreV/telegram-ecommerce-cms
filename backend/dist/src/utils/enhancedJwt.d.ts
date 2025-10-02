export interface JWTKeyPair {
    id: string;
    secret: string;
    createdAt: Date;
    expiresAt: Date;
    isActive: boolean;
}
export interface EnhancedTokenPayload {
    userId: string;
    telegramId: string;
    role: string;
    storeId?: string;
    permissions?: string[];
    sessionId: string;
    iat: number;
    exp: number;
    iss: string;
    aud: string;
    kid: string;
}
export declare class EnhancedJWTService {
    private static instance;
    private activeKeys;
    private currentKeyId;
    private rotationInterval;
    private constructor();
    static getInstance(): EnhancedJWTService;
    private initializeKeys;
    private generateKeyId;
    private createNewKeyPair;
    private startKeyRotation;
    rotateKeys(): Promise<void>;
    generateAccessToken(payload: {
        userId: string;
        telegramId: string;
        role: string;
        storeId?: string;
        permissions?: string[];
        sessionId: string;
    }): string;
    verifyToken(token: string): EnhancedTokenPayload;
    getKeyInfo(): {
        currentKeyId: string;
        totalKeys: number;
        activeKeys: number;
        oldestKeyAge: number;
    };
    forceKeyRotation(): Promise<void>;
    destroy(): void;
}
export declare const enhancedJWTService: EnhancedJWTService;
//# sourceMappingURL=enhancedJwt.d.ts.map
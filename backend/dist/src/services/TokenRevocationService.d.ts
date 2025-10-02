export interface RevokedToken {
    tokenId: string;
    tokenType: 'access' | 'refresh';
    userId: string;
    sessionId: string;
    revokedAt: Date;
    revokedBy: string;
    reason: string;
    expiresAt: Date;
}
export interface RevocationStats {
    totalRevoked: number;
    revokedToday: number;
    revokedByReason: Record<string, number>;
    activeRevocations: number;
}
export declare class TokenRevocationService {
    private static instance;
    private memoryRevocationList;
    private maxMemorySize;
    private constructor();
    static getInstance(): TokenRevocationService;
    private loadRecentRevocations;
    revokeToken(tokenId: string, tokenType: 'access' | 'refresh', userId: string, sessionId: string, revokedBy: string, reason: string, expiresAt: Date): Promise<void>;
    isTokenRevoked(tokenId: string): Promise<boolean>;
    revokeAllUserTokens(userId: string, revokedBy: string, reason?: string): Promise<number>;
    revokeSessionTokens(sessionId: string, revokedBy: string, reason?: string): Promise<void>;
    private storeRevocation;
    private getRevocationData;
    cleanupExpiredRevocations(): Promise<number>;
    private cleanupMemoryRevocationList;
    getRevocationStats(): Promise<RevocationStats>;
    bulkRevokeTokens(criteria: {
        userId?: string;
        sessionIds?: string[];
        olderThan?: Date;
        tokenType?: 'access' | 'refresh';
    }, revokedBy: string, reason: string): Promise<number>;
    healthCheck(): Promise<{
        status: string;
        memoryListSize: number;
        stats: RevocationStats;
    }>;
}
export declare const tokenRevocationService: TokenRevocationService;
//# sourceMappingURL=TokenRevocationService.d.ts.map
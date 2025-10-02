export interface AuthConfigOptions {
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    maxActiveSessions: number;
    sessionExtendOnActivity: boolean;
    bcryptRounds: number;
    enableAutoRefresh: boolean;
    refreshGracePeriod: number;
}
export declare const AUTH_CONFIG: AuthConfigOptions;
export declare const AUTH_PRESETS: {
    development: {
        accessTokenExpiry: string;
        refreshTokenExpiry: string;
        maxActiveSessions: number;
        sessionExtendOnActivity: boolean;
        bcryptRounds: number;
        enableAutoRefresh: boolean;
        refreshGracePeriod: number;
    };
    production: {
        accessTokenExpiry: string;
        refreshTokenExpiry: string;
        maxActiveSessions: number;
        sessionExtendOnActivity: boolean;
        bcryptRounds: number;
        enableAutoRefresh: boolean;
        refreshGracePeriod: number;
    };
    highSecurity: {
        accessTokenExpiry: string;
        refreshTokenExpiry: string;
        maxActiveSessions: number;
        sessionExtendOnActivity: boolean;
        bcryptRounds: number;
        enableAutoRefresh: boolean;
        refreshGracePeriod: number;
    };
    mobile: {
        accessTokenExpiry: string;
        refreshTokenExpiry: string;
        sessionExtendOnActivity: boolean;
        maxActiveSessions: number;
        bcryptRounds: number;
        enableAutoRefresh: boolean;
        refreshGracePeriod: number;
    };
};
export declare function getAuthConfig(): AuthConfigOptions;
export declare function shouldRefreshToken(tokenExp: number, gracePeriod?: number): boolean;
export declare function parseExpiryToSeconds(expiry: string): number;
export declare function validateAuthConfig(config: AuthConfigOptions): {
    isValid: boolean;
    errors: string[];
};
//# sourceMappingURL=AuthConfig.d.ts.map
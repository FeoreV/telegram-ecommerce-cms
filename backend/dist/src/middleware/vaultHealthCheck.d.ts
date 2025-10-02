import { Request, Response, NextFunction } from 'express';
export interface VaultHealthStatus {
    vault: {
        enabled: boolean;
        connected: boolean;
        lastCheck: string;
        error?: string;
    };
    secretManager: {
        initialized: boolean;
        source: 'vault' | 'environment';
    };
}
declare class VaultHealthChecker {
    private static instance;
    private lastHealthCheck;
    private checkInterval;
    private constructor();
    static getInstance(): VaultHealthChecker;
    private startHealthChecks;
    private performHealthCheck;
    getHealthStatus(): Promise<VaultHealthStatus>;
    stop(): void;
}
declare const vaultHealthChecker: VaultHealthChecker;
export declare const vaultHealthMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const vaultHealthEndpoint: (req: Request, res: Response) => Promise<void>;
export { vaultHealthChecker };
//# sourceMappingURL=vaultHealthCheck.d.ts.map
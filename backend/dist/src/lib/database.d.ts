import { PrismaClient } from '@prisma/client';
export declare class DatabaseService {
    private static instance;
    private prisma;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectInterval;
    private constructor();
    static getInstance(): DatabaseService;
    initialize(): Promise<PrismaClient>;
    private testConnection;
    reconnect(): Promise<void>;
    disconnect(): Promise<void>;
    getPrisma(): PrismaClient;
    healthCheck(): Promise<{
        status: string;
        latency: number;
        tlsEnabled: boolean;
        connectionInfo: any;
    }>;
    executeTransaction<T>(fn: (prisma: PrismaClient) => Promise<T>, maxRetries?: number): Promise<T>;
    getConnectionStatus(): {
        isConnected: boolean;
        reconnectAttempts: number;
        maxReconnectAttempts: number;
    };
}
export declare const databaseService: DatabaseService;
export declare const getPrisma: () => PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare const disconnectPrisma: () => Promise<void>;
//# sourceMappingURL=database.d.ts.map
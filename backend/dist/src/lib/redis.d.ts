export declare class RedisService {
    private static instance;
    private client;
    private subscriber;
    private publisher;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectInterval;
    private constructor();
    static getInstance(): RedisService;
    initialize(): Promise<any>;
    private initializePubSub;
    private setupEventHandlers;
    private extractHost;
    private extractPort;
    disconnect(): Promise<void>;
    getClient(): any;
    getSubscriber(): any;
    getPublisher(): any;
    healthCheck(): Promise<{
        status: string;
        latency: number;
        tlsEnabled: boolean;
        connectionInfo: any;
        clients: {
            main: boolean;
            subscriber: boolean;
            publisher: boolean;
        };
    }>;
    private parseRedisInfo;
    executeWithRetry<T>(operation: (client: any) => Promise<T>, maxRetries?: number): Promise<T>;
    setSecure(key: string, value: any, ttl?: number): Promise<void>;
    getSecure<T>(key: string): Promise<T | null>;
    publish(channel: string, message: any): Promise<number>;
    subscribe(channel: string, callback: (message: any) => void): Promise<void>;
    unsubscribe(channel: string): Promise<void>;
    getConnectionStatus(): {
        main: string;
        subscriber: string;
        publisher: string;
        reconnectAttempts: number;
        maxReconnectAttempts: number;
    };
}
export declare const redisService: RedisService;
//# sourceMappingURL=redis.d.ts.map
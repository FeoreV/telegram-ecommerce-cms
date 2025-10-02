export declare class RedisSessionStore<T = unknown> {
    private client;
    private readonly ttlSeconds;
    private readonly prefix;
    private lastErrorLog;
    constructor(ttlSeconds?: number, prefix?: string);
    init(url: string): Promise<void>;
    private ensureClient;
    private key;
    get(telegramId: string): Promise<T | null>;
    set(telegramId: string, session: T): Promise<void>;
    del(telegramId: string): Promise<void>;
    disconnect(): Promise<void>;
}
export declare const redisSessionStore: RedisSessionStore<unknown>;
//# sourceMappingURL=redisStore.d.ts.map
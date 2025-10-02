export declare class TTLCache {
    private store;
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T, ttlMs: number): void;
    wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T>;
    delete(key: string): void;
    clear(prefix?: string): void;
    size(): number;
}
export declare const ttlCache: TTLCache;
//# sourceMappingURL=cache.d.ts.map
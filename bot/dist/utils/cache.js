"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ttlCache = exports.TTLCache = void 0;
class TTLCache {
    constructor() {
        this.store = new Map();
    }
    get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            return undefined;
        }
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }
    set(key, value, ttlMs) {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    }
    async wrap(key, ttlMs, loader) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const value = await loader();
        this.set(key, value, ttlMs);
        return value;
    }
    delete(key) {
        this.store.delete(key);
    }
    clear(prefix) {
        if (!prefix) {
            this.store.clear();
            return;
        }
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }
    size() {
        return this.store.size;
    }
}
exports.TTLCache = TTLCache;
exports.ttlCache = new TTLCache();
//# sourceMappingURL=cache.js.map
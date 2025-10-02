"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheShredderService = exports.CacheShredderService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const loggerEnhanced_1 = require("../utils/loggerEnhanced");
const redis_1 = require("../lib/redis");
const unlink = (0, util_1.promisify)(fs_1.default.unlink);
const readdir = (0, util_1.promisify)(fs_1.default.readdir);
const stat = (0, util_1.promisify)(fs_1.default.stat);
class CacheShredderService {
    constructor() {
        this.config = {
            enabled: process.env.CACHE_SHREDDER_ENABLED !== 'false',
            shredPaths: (process.env.CACHE_SHRED_PATHS || 'storage/logs,uploads/tmp').split(',').map(s => s.trim()).filter(Boolean),
            shredPatterns: (process.env.CACHE_SHRED_PATTERNS || '.log,.tmp,.cache').split(',').map(s => s.trim()).filter(Boolean),
            flushRedis: process.env.CACHE_SHRED_FLUSH_REDIS === 'true'
        };
    }
    static getInstance() {
        if (!CacheShredderService.instance) {
            CacheShredderService.instance = new CacheShredderService();
        }
        return CacheShredderService.instance;
    }
    async initialize() {
        loggerEnhanced_1.logger.info('CacheShredder initialized', { paths: this.config.shredPaths });
    }
    async shredAll() {
        if (!this.config.enabled)
            return;
        try {
            for (const dir of this.config.shredPaths) {
                await this.shredDirectorySafe(path_1.default.resolve(process.cwd(), dir));
            }
            if (this.config.flushRedis) {
                try {
                    const client = redis_1.redisService.getClient();
                    await client.flushall('ASYNC');
                    loggerEnhanced_1.logger.warn('Redis flushed (ASYNC) by CacheShredder');
                }
                catch (e) {
                    loggerEnhanced_1.logger.warn('Redis flush failed in CacheShredder', { error: e?.message });
                }
            }
        }
        catch (error) {
            loggerEnhanced_1.logger.error('CacheShredder failed', { error: error?.message });
        }
    }
    async shredDirectorySafe(dir) {
        try {
            const items = await readdir(dir).catch(() => []);
            for (const name of items) {
                const p = path_1.default.join(dir, name);
                const s = await stat(p).catch(() => null);
                if (!s)
                    continue;
                if (s.isDirectory()) {
                    await this.shredDirectorySafe(p);
                    continue;
                }
                if (this.shouldShredFile(name)) {
                    await this.secureDelete(p).catch(() => { });
                }
            }
        }
        catch (error) {
        }
    }
    shouldShredFile(filename) {
        return this.config.shredPatterns.some(pat => filename.endsWith(pat));
    }
    async secureDelete(filePath) {
        try {
            const size = (await stat(filePath)).size;
            const fd = fs_1.default.openSync(filePath, 'r+');
            try {
                const passes = 2;
                for (let i = 0; i < passes; i++) {
                    const buf = Buffer.alloc(64 * 1024, i % 2 === 0 ? 0x00 : 0xFF);
                    let written = 0;
                    while (written < size) {
                        const chunk = Math.min(buf.length, size - written);
                        fs_1.default.writeSync(fd, buf, 0, chunk, written);
                        written += chunk;
                    }
                    fs_1.default.fsyncSync(fd);
                }
            }
            finally {
                fs_1.default.closeSync(fd);
            }
            await unlink(filePath);
            loggerEnhanced_1.logger.debug('Securely deleted', { filePath });
        }
        catch (e) {
            loggerEnhanced_1.logger.warn('Secure delete failed', { filePath, error: e?.message });
            try {
                await unlink(filePath);
            }
            catch (error) { }
        }
    }
}
exports.CacheShredderService = CacheShredderService;
exports.cacheShredderService = CacheShredderService.getInstance();
//# sourceMappingURL=CacheShredderService.js.map
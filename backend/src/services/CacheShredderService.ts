import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { logger } from '../utils/loggerEnhanced';
import { redisService } from '../lib/redis';

const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export interface CacheShredderConfig {
  enabled: boolean;
  shredPaths: string[]; // directories to wipe
  shredPatterns: string[]; // filename suffixes/patterns to match
  flushRedis: boolean;
}

export class CacheShredderService {
  private static instance: CacheShredderService;
  private config: CacheShredderConfig;

  private constructor() {
    this.config = {
      enabled: process.env.CACHE_SHREDDER_ENABLED !== 'false',
      shredPaths: (process.env.CACHE_SHRED_PATHS || 'storage/logs,uploads/tmp').split(',').map(s => s.trim()).filter(Boolean),
      shredPatterns: (process.env.CACHE_SHRED_PATTERNS || '.log,.tmp,.cache').split(',').map(s => s.trim()).filter(Boolean),
      flushRedis: process.env.CACHE_SHRED_FLUSH_REDIS === 'true'
    };
  }

  public static getInstance(): CacheShredderService {
    if (!CacheShredderService.instance) {
      CacheShredderService.instance = new CacheShredderService();
    }
    return CacheShredderService.instance;
  }

  public async initialize(): Promise<void> {
    logger.info('CacheShredder initialized', { paths: this.config.shredPaths });
  }

  public async shredAll(): Promise<void> {
    if (!this.config.enabled) return;
    try {
      for (const dir of this.config.shredPaths) {
        await this.shredDirectorySafe(path.resolve(process.cwd(), dir));
      }
      if (this.config.flushRedis) {
        try {
          const client = redisService.getClient();
          await client.flushall('ASYNC');
          logger.warn('Redis flushed (ASYNC) by CacheShredder');
        } catch (e: any) {
          logger.warn('Redis flush failed in CacheShredder', { error: e?.message });
        }
      }
    } catch (error: any) {
      logger.error('CacheShredder failed', { error: error?.message });
    }
  }

  private async shredDirectorySafe(dir: string): Promise<void> {
    try {
      const items = await readdir(dir).catch(() => []);
      for (const name of items) {
        const p = path.join(dir, name);
        const s = await stat(p).catch(() => null);
        if (!s) continue;
        if (s.isDirectory()) {
          await this.shredDirectorySafe(p);
          continue;
        }
        if (this.shouldShredFile(name)) {
          await this.secureDelete(p).catch(() => {});
        }
      }
    } catch (error) {
      // ignore path errors
    }
  }

  private shouldShredFile(filename: string): boolean {
    return this.config.shredPatterns.some(pat => filename.endsWith(pat));
  }

  private async secureDelete(filePath: string): Promise<void> {
    try {
      const size = (await stat(filePath)).size;
      const fd = fs.openSync(filePath, 'r+');
      try {
        const passes = 2;
        for (let i = 0; i < passes; i++) {
          const buf = Buffer.alloc(64 * 1024, i % 2 === 0 ? 0x00 : 0xFF);
          let written = 0;
          while (written < size) {
            const chunk = Math.min(buf.length, size - written);
            fs.writeSync(fd, buf, 0, chunk, written);
            written += chunk;
          }
          fs.fsyncSync(fd);
        }
      } finally {
        fs.closeSync(fd);
      }
      await unlink(filePath);
      logger.debug('Securely deleted', { filePath });
    } catch (e: any) {
      logger.warn('Secure delete failed', { filePath, error: e?.message });
      try { await unlink(filePath); } catch (error) { /* ignore secondary cleanup failure */ }
    }
  }
}

export const cacheShredderService = CacheShredderService.getInstance();



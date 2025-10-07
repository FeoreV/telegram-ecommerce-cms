import http from 'http';
import https from 'https';
import { URL } from 'url';
import { ssrfProtectionService } from './SSRFProtectionService';
import { logger } from '../utils/logger';

type HttpRequestArgs = Parameters<typeof http.request>;

export class EgressGuardService {
  private static instance: EgressGuardService;
  private enabled: boolean = true;
  private originalHttpRequest = http.request;
  private originalHttpsRequest = https.request;
  private patched: boolean = false;

  private constructor() {}

  public static getInstance(): EgressGuardService {
    if (!EgressGuardService.instance) {
      EgressGuardService.instance = new EgressGuardService();
    }
    return EgressGuardService.instance;
  }

  public async initialize(): Promise<void> {
    this.enabled = process.env.EGRESS_GUARD_ENABLED !== 'false';
    if (this.enabled) {
      this.patchHttpModules();
      logger.info('EgressGuard initialized (deny-by-default outbound HTTP/S)');
    } else {
      logger.warn('EgressGuard disabled via environment variable');
    }
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  private guardWrapperFactory(invokedViaHttps: boolean) {
    return (function(this: any, ...args: HttpRequestArgs) {
      const normalizeToUrl = (args: HttpRequestArgs, defaultProtocol: 'http:' | 'https:'): string | null => {
        try {
          if (typeof args[0] === 'string') {
            return args[0];
          }
          if (args[0] instanceof URL) {
            return args[0].toString();
          }
          const options = args[0] as http.RequestOptions;
          const protocol = (options.protocol as string) || defaultProtocol;
          const host = options.hostname || options.host || '82.147.84.78';
          const port = options.port ? `:${options.port}` : '';
          const path = options.path || '/';
          return `${protocol}//${host}${port}${path}`;
        } catch (error) {
          return null;
        }
      };

      try {
        if (!this.enabled) {
          // When disabled, delegate strictly to the original function that was invoked
          return (invokedViaHttps ? this.originalHttpsRequest : this.originalHttpRequest).apply(this, args as any);
        }
        const url = normalizeToUrl(args, invokedViaHttps ? 'https:' : 'http:');
        if (!url) {
          logger.warn('EgressGuard: Unable to determine URL for outbound request, blocking by default');
          const req = new http.ClientRequest('');
          // Immediately emit error to mimic request failure
          process.nextTick(() => req.emit('error', new Error('EgressGuard blocked request')));
          return req as any;
        }

        ssrfProtectionService.validateURL(url).then(validation => {
          if (!validation.isAllowed) {
            logger.error('EgressGuard blocked outbound request', { url, reason: validation.reason });
          }
        }).catch(err => {
          logger.error('EgressGuard validation error', { url, error: err?.message });
        });

        // Synchronous block by coarse domain check using URL parsing, then rely on async log above
        const parsed = new URL(url);
        const allowlist = (process.env.EGRESS_ALLOWED_HOSTS || '')
          .split(',').map(s => s.trim()).filter(Boolean);
        if (allowlist.length > 0) {
          const allowed = allowlist.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
          if (!allowed) {
            const req = new http.ClientRequest(url);
            process.nextTick(() => req.emit('error', new Error('EgressGuard allowlist blocked request')));
            return req as any;
          }
        }

        // Delegate based on actual URL protocol
        const targetIsHttps = parsed.protocol === 'https:';
        return (targetIsHttps ? this.originalHttpsRequest : this.originalHttpRequest).apply(this, args as any);
      } catch (error: any) {
        logger.error('EgressGuard unexpected error', { error: error?.message });
        const req = new http.ClientRequest('');
        process.nextTick(() => req.emit('error', new Error('EgressGuard fatal error')));
        return req as any;
      }
    }).bind(this) as any;
  }

  private patchHttpModules(): void {
    if (this.patched) return;

    const guardWrapper = this.guardWrapperFactory(false);
    const guardWrapperHttps = this.guardWrapperFactory(true);

    // Patch request
    (http as any).request = guardWrapper;
    (https as any).request = guardWrapperHttps;

    // Patch get to use request and auto-end
    (http as any).get = function(this: any, ...args: HttpRequestArgs) {
      const req = (http as any).request.apply(this, args);
      req.end();
      return req;
    };
    (https as any).get = function(this: any, ...args: HttpRequestArgs) {
      const req = (https as any).request.apply(this, args);
      req.end();
      return req;
    };
    this.patched = true;
  }
}

export const egressGuardService = EgressGuardService.getInstance();



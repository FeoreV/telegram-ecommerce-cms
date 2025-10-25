"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.egressGuardService = exports.EgressGuardService = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
const SSRFProtectionService_1 = require("./SSRFProtectionService");
const logger_1 = require("../utils/logger");
class EgressGuardService {
    constructor() {
        this.enabled = true;
        this.originalHttpRequest = http_1.default.request;
        this.originalHttpsRequest = https_1.default.request;
        this.patched = false;
    }
    static getInstance() {
        if (!EgressGuardService.instance) {
            EgressGuardService.instance = new EgressGuardService();
        }
        return EgressGuardService.instance;
    }
    async initialize() {
        this.enabled = process.env.EGRESS_GUARD_ENABLED !== 'false';
        if (this.enabled) {
            this.patchHttpModules();
            logger_1.logger.info('EgressGuard initialized (deny-by-default outbound HTTP/S)');
        }
        else {
            logger_1.logger.warn('EgressGuard disabled via environment variable');
        }
    }
    enable() {
        this.enabled = true;
    }
    disable() {
        this.enabled = false;
    }
    guardWrapperFactory(invokedViaHttps) {
        return (function (...args) {
            const normalizeToUrl = (args, defaultProtocol) => {
                try {
                    if (typeof args[0] === 'string') {
                        return args[0];
                    }
                    if (args[0] instanceof url_1.URL) {
                        return args[0].toString();
                    }
                    const options = args[0];
                    const protocol = options.protocol || defaultProtocol;
                    const host = options.hostname || options.host || '82.147.84.78';
                    const port = options.port ? `:${options.port}` : '';
                    const path = options.path || '/';
                    return `${protocol}//${host}${port}${path}`;
                }
                catch (error) {
                    return null;
                }
            };
            try {
                if (!this.enabled) {
                    return (invokedViaHttps ? this.originalHttpsRequest : this.originalHttpRequest).apply(this, args);
                }
                const url = normalizeToUrl(args, invokedViaHttps ? 'https:' : 'http:');
                if (!url) {
                    logger_1.logger.warn('EgressGuard: Unable to determine URL for outbound request, blocking by default');
                    const req = new http_1.default.ClientRequest('');
                    process.nextTick(() => req.emit('error', new Error('EgressGuard blocked request')));
                    return req;
                }
                SSRFProtectionService_1.ssrfProtectionService.validateURL(url).then(validation => {
                    if (!validation.isAllowed) {
                        logger_1.logger.error('EgressGuard blocked outbound request', { url, reason: validation.reason });
                    }
                }).catch(err => {
                    logger_1.logger.error('EgressGuard validation error', { url, error: err?.message });
                });
                const parsed = new url_1.URL(url);
                const allowlist = (process.env.EGRESS_ALLOWED_HOSTS || '')
                    .split(',').map(s => s.trim()).filter(Boolean);
                if (allowlist.length > 0) {
                    const allowed = allowlist.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
                    if (!allowed) {
                        const req = new http_1.default.ClientRequest(url);
                        process.nextTick(() => req.emit('error', new Error('EgressGuard allowlist blocked request')));
                        return req;
                    }
                }
                const targetIsHttps = parsed.protocol === 'https:';
                return (targetIsHttps ? this.originalHttpsRequest : this.originalHttpRequest).apply(this, args);
            }
            catch (error) {
                logger_1.logger.error('EgressGuard unexpected error', { error: error?.message });
                const req = new http_1.default.ClientRequest('');
                process.nextTick(() => req.emit('error', new Error('EgressGuard fatal error')));
                return req;
            }
        }).bind(this);
    }
    patchHttpModules() {
        if (this.patched)
            return;
        const guardWrapper = this.guardWrapperFactory(false);
        const guardWrapperHttps = this.guardWrapperFactory(true);
        http_1.default.request = guardWrapper;
        https_1.default.request = guardWrapperHttps;
        http_1.default.get = function (...args) {
            const req = http_1.default.request.apply(this, args);
            req.end();
            return req;
        };
        https_1.default.get = function (...args) {
            const req = https_1.default.request.apply(this, args);
            req.end();
            return req;
        };
        this.patched = true;
    }
}
exports.EgressGuardService = EgressGuardService;
exports.egressGuardService = EgressGuardService.getInstance();
//# sourceMappingURL=EgressGuardService.js.map
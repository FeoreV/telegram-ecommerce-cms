"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cspReportEndpoint = exports.outputSanitizationMiddleware = exports.cspMiddleware = exports.contentSecurityService = exports.ContentSecurityService = void 0;
const isomorphic_dompurify_1 = __importDefault(require("isomorphic-dompurify"));
const logger_1 = require("../utils/logger");
const crypto = __importStar(require("crypto"));
class ContentSecurityService {
    constructor() {
        this.nonceCache = new Map();
        this.nonceTTL = 5 * 60 * 1000;
        this.config = {
            enableCSP: process.env.ENABLE_CSP !== 'false',
            enableXSSProtection: process.env.ENABLE_XSS_PROTECTION !== 'false',
            enableOutputSanitization: process.env.ENABLE_OUTPUT_SANITIZATION !== 'false',
            enableFrameProtection: process.env.ENABLE_FRAME_PROTECTION !== 'false',
            cspDirectives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-hashes'"],
                styleSrc: ["'self'", "'unsafe-hashes'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "wss:", "https:"],
                fontSrc: ["'self'", "https:"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
                childSrc: ["'none'"],
                workerSrc: ["'self'"],
                manifestSrc: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"],
                baseUri: ["'self'"],
                upgradeInsecureRequests: process.env.NODE_ENV === 'production',
                blockAllMixedContent: process.env.NODE_ENV === 'production'
            },
            reportUri: process.env.CSP_REPORT_URI,
            reportOnly: process.env.CSP_REPORT_ONLY === 'true',
            nonce: process.env.CSP_USE_NONCE === 'true',
            allowedTags: [
                'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'span', 'div',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'ul', 'ol', 'li',
                'a', 'img',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'blockquote', 'pre', 'code'
            ],
            allowedAttributes: [
                'href', 'src', 'alt', 'title', 'class', 'id',
                'target', 'rel', 'width', 'height'
            ],
            sanitizationOptions: {
                allowHTML: true,
                allowSVG: false,
                allowMathML: false,
                keepComments: false,
                keepWhitespace: true
            }
        };
        this.startNonceCleanup();
        logger_1.logger.info('Content security service initialized', {
            enableCSP: this.config.enableCSP,
            enableXSSProtection: this.config.enableXSSProtection,
            reportOnly: this.config.reportOnly
        });
    }
    static getInstance() {
        if (!ContentSecurityService.instance) {
            ContentSecurityService.instance = new ContentSecurityService();
        }
        return ContentSecurityService.instance;
    }
    generateCSPHeader(nonce) {
        const directives = [];
        Object.entries(this.config.cspDirectives).forEach(([key, value]) => {
            if (key === 'upgradeInsecureRequests' || key === 'blockAllMixedContent') {
                if (value) {
                    directives.push(this.camelToKebab(key));
                }
                return;
            }
            if (Array.isArray(value) && value.length > 0) {
                let directiveValue = value.join(' ');
                if (nonce && (key === 'scriptSrc' || key === 'styleSrc')) {
                    directiveValue += ` 'nonce-${nonce}'`;
                }
                directives.push(`${this.camelToKebab(key)} ${directiveValue}`);
            }
        });
        if (this.config.reportUri) {
            directives.push(`report-uri ${this.config.reportUri}`);
        }
        return directives.join('; ');
    }
    camelToKebab(str) {
        return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    }
    generateNonce(requestId) {
        const nonce = crypto.randomBytes(16).toString('base64');
        if (requestId) {
            this.nonceCache.set(requestId, {
                nonce,
                timestamp: Date.now()
            });
        }
        return nonce;
    }
    getNonce(requestId) {
        const cached = this.nonceCache.get(requestId);
        if (cached && Date.now() - cached.timestamp < this.nonceTTL) {
            return cached.nonce;
        }
        return null;
    }
    getCSPMiddleware() {
        return (req, res, next) => {
            if (!this.config.enableCSP) {
                return next();
            }
            let nonce;
            if (this.config.nonce) {
                const requestId = req.requestId || req.get('X-Request-ID');
                nonce = this.generateNonce(requestId);
                req.nonce = nonce;
                res.locals.nonce = nonce;
            }
            const cspHeader = this.generateCSPHeader(nonce);
            const headerName = this.config.reportOnly ?
                'Content-Security-Policy-Report-Only' :
                'Content-Security-Policy';
            res.set(headerName, cspHeader);
            if (this.config.enableXSSProtection) {
                res.set('X-XSS-Protection', '1; mode=block');
            }
            if (this.config.enableFrameProtection) {
                res.set('X-Frame-Options', 'DENY');
            }
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
                'Cross-Origin-Embedder-Policy': 'require-corp',
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Resource-Policy': 'same-origin'
            });
            next();
        };
    }
    getOutputSanitizationMiddleware() {
        return (req, res, next) => {
            if (!this.config.enableOutputSanitization) {
                return next();
            }
            const originalJson = res.json.bind(res);
            res.json = (body) => {
                const sanitizedBody = this.sanitizeOutput(body);
                return originalJson(sanitizedBody);
            };
            const originalSend = res.send.bind(res);
            res.send = (body) => {
                if (typeof body === 'string' && res.get('Content-Type')?.includes('text/html')) {
                    body = this.sanitizeHTML(body);
                }
                return originalSend(body);
            };
            next();
        };
    }
    sanitizeOutput(data) {
        if (typeof data === 'string') {
            return this.sanitizeString(data);
        }
        else if (Array.isArray(data)) {
            return data.map(item => this.sanitizeOutput(item));
        }
        else if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                sanitized[key] = this.sanitizeOutput(value);
            }
            return sanitized;
        }
        return data;
    }
    sanitizeString(str) {
        if (typeof str !== 'string')
            return str;
        let sanitized = str
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
        sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
        return sanitized;
    }
    sanitizeHTML(html) {
        if (!html || typeof html !== 'string')
            return html;
        try {
            const purifyConfig = {
                ALLOWED_TAGS: this.config.allowedTags,
                ALLOWED_ATTR: this.config.allowedAttributes,
                KEEP_CONTENT: this.config.sanitizationOptions.keepWhitespace,
                ALLOW_DATA_ATTR: false,
                ALLOW_UNKNOWN_PROTOCOLS: false,
                SANITIZE_DOM: true,
                SANITIZE_NAMED_PROPS: true,
                FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
                USE_PROFILES: {
                    html: this.config.sanitizationOptions.allowHTML,
                    svg: this.config.sanitizationOptions.allowSVG,
                    mathMl: this.config.sanitizationOptions.allowMathML
                }
            };
            const sanitized = isomorphic_dompurify_1.default.sanitize(html, purifyConfig);
            const sanitizedStr = String(sanitized);
            if (sanitizedStr.length < html.length * 0.8) {
                logger_1.logger.warn('Significant content removed during HTML sanitization', {
                    originalLength: html.length,
                    sanitizedLength: sanitizedStr.length,
                    reductionPercent: Math.round((1 - sanitizedStr.length / html.length) * 100)
                });
            }
            return sanitizedStr;
        }
        catch (error) {
            logger_1.logger.error('HTML sanitization error:', error);
            return this.sanitizeString(html);
        }
    }
    sanitizeUserInput(input, options = {}) {
        if (!input || typeof input !== 'string')
            return input;
        let sanitized = input;
        sanitized = sanitized.trim();
        if (options.maxLength && sanitized.length > options.maxLength) {
            sanitized = sanitized.substring(0, options.maxLength);
        }
        if (options.stripTags || !options.allowHTML) {
            sanitized = this.sanitizeString(sanitized);
        }
        else if (options.allowHTML) {
            sanitized = this.sanitizeHTML(sanitized);
        }
        sanitized = sanitized.normalize('NFKC');
        return sanitized;
    }
    getCSPReportEndpoint() {
        return (req, res) => {
            try {
                const report = req.body;
                logger_1.logger.security('CSP violation reported', {
                    report,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip,
                    timestamp: new Date().toISOString()
                });
                this.storeCSPViolation(report, req);
                res.status(204).send();
            }
            catch (error) {
                logger_1.logger.error('CSP report processing error:', error);
                res.status(400).json({
                    error: 'Invalid report format',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }
    storeCSPViolation(report, req) {
        const violation = {
            ...report,
            metadata: {
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                referer: req.get('Referer'),
                timestamp: new Date().toISOString()
            }
        };
        if (report['csp-report']) {
            const cspReport = report['csp-report'];
            const suspiciousPatterns = [
                /javascript:/i,
                /data:text\/html/i,
                /eval\(/i,
                /onclick=/i,
                /onerror=/i
            ];
            const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(cspReport['blocked-uri'] || '') ||
                pattern.test(cspReport['script-sample'] || ''));
            if (isSuspicious) {
                logger_1.logger.security('Suspicious CSP violation detected', {
                    violation,
                    severity: 'HIGH'
                });
            }
        }
    }
    startNonceCleanup() {
        setInterval(() => {
            const now = Date.now();
            let cleanedCount = 0;
            for (const [requestId, data] of this.nonceCache.entries()) {
                if (now - data.timestamp > this.nonceTTL) {
                    this.nonceCache.delete(requestId);
                    cleanedCount++;
                }
            }
            if (cleanedCount > 0) {
                logger_1.logger.debug('Nonce cache cleaned up', {
                    cleanedCount,
                    remainingNonces: this.nonceCache.size
                });
            }
        }, this.nonceTTL);
    }
    updateCSPDirective(directive, values) {
        const camelCaseDirective = directive.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        if (camelCaseDirective in this.config.cspDirectives) {
            this.config.cspDirectives[camelCaseDirective] = values;
            logger_1.logger.info('CSP directive updated', {
                directive: camelCaseDirective,
                values
            });
        }
    }
    addAllowedSource(directive, source) {
        const camelCaseDirective = directive.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        if (camelCaseDirective in this.config.cspDirectives) {
            const currentValues = this.config.cspDirectives[camelCaseDirective];
            if (Array.isArray(currentValues) && !currentValues.includes(source)) {
                currentValues.push(source);
                logger_1.logger.info('Source added to CSP directive', {
                    directive: camelCaseDirective,
                    source
                });
            }
        }
    }
    getStats() {
        return {
            config: this.config,
            activenonces: this.nonceCache.size
        };
    }
    async healthCheck() {
        try {
            const stats = this.getStats();
            return {
                status: 'healthy',
                stats
            };
        }
        catch (error) {
            logger_1.logger.error('Content security service health check failed:', error);
            return {
                status: 'error',
                stats: null
            };
        }
    }
    getConfiguration() {
        return { ...this.config };
    }
}
exports.ContentSecurityService = ContentSecurityService;
exports.contentSecurityService = ContentSecurityService.getInstance();
exports.cspMiddleware = exports.contentSecurityService.getCSPMiddleware();
exports.outputSanitizationMiddleware = exports.contentSecurityService.getOutputSanitizationMiddleware();
exports.cspReportEndpoint = exports.contentSecurityService.getCSPReportEndpoint();
//# sourceMappingURL=contentSecurityMiddleware.js.map
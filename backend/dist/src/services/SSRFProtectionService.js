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
exports.ssrfProtectionService = exports.SSRFProtectionService = void 0;
const url_1 = require("url");
const promises_1 = __importDefault(require("dns/promises"));
const net_1 = __importDefault(require("net"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
class SSRFProtectionService {
    constructor() {
        this.dnsCache = new Map();
        this.dnsCacheTTL = 5 * 60 * 1000;
        this.config = {
            enableProtection: process.env.ENABLE_SSRF_PROTECTION !== 'false',
            allowedDomains: this.parseList(process.env.SSRF_ALLOWED_DOMAINS || ''),
            allowedIPs: this.parseList(process.env.SSRF_ALLOWED_IPS || ''),
            blockedDomains: this.parseList(process.env.SSRF_BLOCKED_DOMAINS || 'localhost,127.0.0.1,::1,metadata.google.internal'),
            blockedIPs: this.parseList(process.env.SSRF_BLOCKED_IPS || ''),
            allowPrivateIPs: process.env.SSRF_ALLOW_PRIVATE_IPS === 'true',
            allowLoopback: process.env.SSRF_ALLOW_LOOPBACK === 'true',
            allowLinkLocal: process.env.SSRF_ALLOW_LINK_LOCAL === 'true',
            allowMulticast: process.env.SSRF_ALLOW_MULTICAST === 'true',
            allowBroadcast: process.env.SSRF_ALLOW_BROADCAST === 'true',
            maxRedirects: parseInt(process.env.SSRF_MAX_REDIRECTS || '3'),
            requestTimeout: parseInt(process.env.SSRF_REQUEST_TIMEOUT || '10000'),
            userAgent: process.env.SSRF_USER_AGENT || 'BotRT-Security-Scanner/1.0',
            enableDNSValidation: process.env.SSRF_ENABLE_DNS_VALIDATION !== 'false',
            enableSchemeValidation: process.env.SSRF_ENABLE_SCHEME_VALIDATION !== 'false',
            allowedSchemes: this.parseList(process.env.SSRF_ALLOWED_SCHEMES || 'http,https')
        };
        this.startDNSCacheCleanup();
        logger_1.logger.info('SSRF protection service initialized', {
            enableProtection: this.config.enableProtection,
            allowedDomains: this.config.allowedDomains.length,
            blockedDomains: this.config.blockedDomains.length
        });
    }
    static getInstance() {
        if (!SSRFProtectionService.instance) {
            SSRFProtectionService.instance = new SSRFProtectionService();
        }
        return SSRFProtectionService.instance;
    }
    parseList(str) {
        return str.split(',').map(item => item.trim()).filter(Boolean);
    }
    async validateURL(url) {
        const result = {
            isAllowed: false,
            originalURL: url
        };
        try {
            if (!this.config.enableProtection) {
                result.isAllowed = true;
                return result;
            }
            let parsedURL;
            try {
                parsedURL = new url_1.URL(url);
                result.normalizedURL = parsedURL.toString();
            }
            catch (error) {
                result.reason = 'Invalid URL format';
                return result;
            }
            if (this.config.enableSchemeValidation) {
                if (!this.config.allowedSchemes.includes(parsedURL.protocol.slice(0, -1))) {
                    result.reason = `Scheme '${parsedURL.protocol}' not allowed`;
                    return result;
                }
            }
            if (this.config.allowedDomains.length > 0) {
                const isAllowedDomain = this.config.allowedDomains.some(domain => this.matchesDomain(parsedURL.hostname, domain));
                if (isAllowedDomain) {
                    result.isAllowed = true;
                    return result;
                }
            }
            const isBlockedDomain = this.config.blockedDomains.some(domain => this.matchesDomain(parsedURL.hostname, domain));
            if (isBlockedDomain) {
                result.reason = `Domain '${parsedURL.hostname}' is blocked`;
                return result;
            }
            if (this.config.enableDNSValidation) {
                const resolvedIP = await this.resolveHostname(parsedURL.hostname);
                if (!resolvedIP) {
                    result.reason = 'DNS resolution failed';
                    return result;
                }
                result.resolvedIP = resolvedIP;
                if (this.config.allowedIPs.length > 0) {
                    const isAllowedIP = this.config.allowedIPs.some(ip => this.matchesIP(resolvedIP, ip));
                    if (isAllowedIP) {
                        result.isAllowed = true;
                        return result;
                    }
                }
                const isBlockedIP = this.config.blockedIPs.some(ip => this.matchesIP(resolvedIP, ip));
                if (isBlockedIP) {
                    result.reason = `IP address '${resolvedIP}' is blocked`;
                    return result;
                }
                const ipValidation = this.validateIPAddress(resolvedIP);
                if (!ipValidation.isAllowed) {
                    result.reason = ipValidation.reason;
                    return result;
                }
            }
            if (this.config.allowedDomains.length === 0 && this.config.allowedIPs.length === 0) {
                result.isAllowed = true;
            }
            else {
                result.reason = 'URL not in allowlist';
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('SSRF validation error:', error);
            result.reason = 'Validation process failed';
            return result;
        }
    }
    async resolveHostname(hostname) {
        try {
            const cached = this.dnsCache.get(hostname);
            if (cached && Date.now() - cached.timestamp < this.dnsCacheTTL) {
                return cached.ip;
            }
            const addresses = await promises_1.default.resolve4(hostname);
            if (addresses.length === 0) {
                return null;
            }
            const ip = addresses[0];
            this.dnsCache.set(hostname, {
                ip,
                timestamp: Date.now()
            });
            return ip;
        }
        catch (error) {
            logger_1.logger.debug('DNS resolution failed', {
                hostname,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            return null;
        }
    }
    validateIPAddress(ip) {
        if (!net_1.default.isIP(ip)) {
            return { isAllowed: false, reason: 'Invalid IP address' };
        }
        if (net_1.default.isIPv6(ip)) {
            if (ip === '::1' && !this.config.allowLoopback) {
                return { isAllowed: false, reason: 'Loopback IPv6 address not allowed' };
            }
            return { isAllowed: true };
        }
        const ipParts = ip.split('.').map(Number);
        if (ipParts[0] === 127) {
            if (!this.config.allowLoopback) {
                return { isAllowed: false, reason: 'Loopback address not allowed' };
            }
            return { isAllowed: true };
        }
        const isPrivate = this.isPrivateIP(ipParts);
        if (isPrivate && !this.config.allowPrivateIPs) {
            return { isAllowed: false, reason: 'Private IP address not allowed' };
        }
        if (ipParts[0] === 169 && ipParts[1] === 254) {
            if (!this.config.allowLinkLocal) {
                return { isAllowed: false, reason: 'Link-local address not allowed' };
            }
            return { isAllowed: true };
        }
        if (ipParts[0] >= 224 && ipParts[0] <= 239) {
            if (!this.config.allowMulticast) {
                return { isAllowed: false, reason: 'Multicast address not allowed' };
            }
            return { isAllowed: true };
        }
        if (ip === '255.255.255.255') {
            if (!this.config.allowBroadcast) {
                return { isAllowed: false, reason: 'Broadcast address not allowed' };
            }
            return { isAllowed: true };
        }
        if (ipParts[0] === 0 || ipParts[0] === 240) {
            return { isAllowed: false, reason: 'Reserved IP address range not allowed' };
        }
        return { isAllowed: true };
    }
    isPrivateIP(ipParts) {
        if (ipParts[0] === 10)
            return true;
        if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31)
            return true;
        if (ipParts[0] === 192 && ipParts[1] === 168)
            return true;
        return false;
    }
    matchesDomain(hostname, pattern) {
        if (hostname === pattern)
            return true;
        if (pattern.startsWith('*.')) {
            const baseDomain = pattern.slice(2);
            return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
        }
        return false;
    }
    matchesIP(ip, pattern) {
        if (ip === pattern)
            return true;
        if (pattern.includes('/')) {
            const [networkIP, prefixLength] = pattern.split('/');
            const prefix = parseInt(prefixLength, 10);
            if (prefix < 0 || prefix > 32)
                return false;
            try {
                const ipInt = this.ipToInt(ip);
                const networkInt = this.ipToInt(networkIP);
                const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
                return (ipInt & mask) === (networkInt & mask);
            }
            catch (error) {
                return false;
            }
        }
        return false;
    }
    ipToInt(ip) {
        const parts = ip.split('.').map(Number);
        return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    }
    async makeSecureRequest(url, options = {}) {
        const validation = await this.validateURL(url);
        if (!validation.isAllowed) {
            const error = new Error(`SSRF protection: ${validation.reason}`);
            error.name = 'SSRFProtectionError';
            throw error;
        }
        const targetURL = validation.normalizedURL || url;
        logger_1.logger.info('Making secure HTTP request', {
            originalURL: url,
            targetURL,
            resolvedIP: validation.resolvedIP,
            method: options.method || 'GET'
        });
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const requestOptions = {
                method: options.method || 'GET',
                headers: {
                    'User-Agent': this.config.userAgent,
                    ...options.headers
                },
                body: options.body,
                timeout: options.timeout || this.config.requestTimeout,
                redirect: (options.followRedirects === false ? 'manual' : 'follow')
            };
            const response = await fetch(targetURL, requestOptions);
            logger_1.logger.debug('Secure HTTP request completed', {
                url: targetURL,
                status: response.status,
                statusText: response.statusText
            });
            return response;
        }
        catch (error) {
            logger_1.logger.error('Secure HTTP request failed', {
                url: targetURL,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    async validateWebhookURL(url) {
        const result = await this.validateURL(url);
        if (result.isAllowed) {
            try {
                const parsedURL = new url_1.URL(url);
                if (process.env.NODE_ENV === 'production' && parsedURL.protocol !== 'https:') {
                    result.isAllowed = false;
                    result.reason = 'HTTPS required for webhooks in production';
                    return result;
                }
                const suspiciousPaths = ['/admin', '/internal', '/debug', '/test'];
                if (suspiciousPaths.some(path => parsedURL.pathname.includes(path))) {
                    result.isAllowed = false;
                    result.reason = 'Webhook URL contains suspicious path';
                    return result;
                }
            }
            catch (error) {
                result.isAllowed = false;
                result.reason = 'Invalid webhook URL';
            }
        }
        return result;
    }
    addAllowedDomain(domain) {
        if (!this.config.allowedDomains.includes(domain)) {
            this.config.allowedDomains.push(domain);
            logger_1.logger.info('Domain added to SSRF allowlist', { domain });
        }
    }
    removeAllowedDomain(domain) {
        const index = this.config.allowedDomains.indexOf(domain);
        if (index > -1) {
            this.config.allowedDomains.splice(index, 1);
            logger_1.logger.info('Domain removed from SSRF allowlist', { domain });
        }
    }
    addBlockedDomain(domain) {
        if (!this.config.blockedDomains.includes(domain)) {
            this.config.blockedDomains.push(domain);
            logger_1.logger.info('Domain added to SSRF blocklist', { domain });
        }
    }
    startDNSCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            let cleanedCount = 0;
            for (const [hostname, data] of this.dnsCache.entries()) {
                if (now - data.timestamp > this.dnsCacheTTL) {
                    this.dnsCache.delete(hostname);
                    cleanedCount++;
                }
            }
            if (cleanedCount > 0) {
                logger_1.logger.debug('DNS cache cleaned up', {
                    cleanedCount,
                    remainingEntries: this.dnsCache.size
                });
            }
        }, this.dnsCacheTTL);
    }
    getStats() {
        return {
            config: this.config,
            dnsCacheSize: this.dnsCache.size,
            allowedDomains: this.config.allowedDomains.length,
            blockedDomains: this.config.blockedDomains.length,
            allowedIPs: this.config.allowedIPs.length,
            blockedIPs: this.config.blockedIPs.length
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
            logger_1.logger.error('SSRF protection service health check failed:', error);
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
exports.SSRFProtectionService = SSRFProtectionService;
exports.ssrfProtectionService = SSRFProtectionService.getInstance();
//# sourceMappingURL=SSRFProtectionService.js.map
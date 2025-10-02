"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wafSecurityService = exports.WAFSecurityService = void 0;
const logger_1 = require("../utils/logger");
const TenantCacheService_1 = require("./TenantCacheService");
const axios_1 = __importDefault(require("axios"));
class WAFSecurityService {
    constructor() {
        this.threatIntelligence = new Map();
        this.rateLimitStates = new Map();
        this.anomalyBaseline = new Map();
        this.securityEvents = [];
        this.config = {
            enableWAF: process.env.ENABLE_WAF !== 'false',
            enableBotProtection: process.env.ENABLE_BOT_PROTECTION !== 'false',
            enableAnomalyDetection: process.env.ENABLE_ANOMALY_DETECTION !== 'false',
            enableIPReputation: process.env.ENABLE_IP_REPUTATION !== 'false',
            enableGeoBlocking: process.env.ENABLE_GEO_BLOCKING === 'true',
            enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
            challengeMode: process.env.CHALLENGE_MODE || 'javascript',
            botScoreThreshold: parseInt(process.env.BOT_SCORE_THRESHOLD || '80'),
            suspiciousUserAgentThreshold: parseInt(process.env.SUSPICIOUS_UA_THRESHOLD || '70'),
            globalRateLimit: parseInt(process.env.GLOBAL_RATE_LIMIT || '10000'),
            perIPRateLimit: parseInt(process.env.PER_IP_RATE_LIMIT || '100'),
            perUserRateLimit: parseInt(process.env.PER_USER_RATE_LIMIT || '500'),
            burstLimit: parseInt(process.env.BURST_LIMIT || '20'),
            anomalyThreshold: parseInt(process.env.ANOMALY_THRESHOLD || '85'),
            learningPeriod: parseInt(process.env.LEARNING_PERIOD || '7'),
            enableMLDetection: process.env.ENABLE_ML_DETECTION === 'true',
            blockedCountries: (process.env.BLOCKED_COUNTRIES || '').split(',').filter(Boolean),
            allowedCountries: (process.env.ALLOWED_COUNTRIES || '').split(',').filter(Boolean),
            reputationSources: ['internal', 'cloudflare', 'abuseipdb'],
            reputationThreshold: parseInt(process.env.REPUTATION_THRESHOLD || '75'),
            blockAction: process.env.BLOCK_ACTION || 'block',
            challengeAction: process.env.CHALLENGE_ACTION || 'js_challenge'
        };
        this.initializeSecurityPatterns();
        this.startCleanupTimer();
        logger_1.logger.info('WAF Security Service initialized', {
            wafEnabled: this.config.enableWAF,
            botProtection: this.config.enableBotProtection,
            rateLimiting: this.config.enableRateLimiting,
            anomalyDetection: this.config.enableAnomalyDetection
        });
    }
    static getInstance() {
        if (!WAFSecurityService.instance) {
            WAFSecurityService.instance = new WAFSecurityService();
        }
        return WAFSecurityService.instance;
    }
    initializeSecurityPatterns() {
        this.botSignatures = [
            /bot|crawler|spider|scraper/i,
            /googlebot|bingbot|slurp|duckduckbot/i,
            /facebookexternalhit|twitterbot|linkedinbot/i,
            /nikto|sqlmap|nessus|openvas|w3af/i,
            /masscan|nmap|zmap|zgrab/i,
            /curl|wget|python-requests|go-http-client/i,
            /headlesschrome|phantomjs|selenium|puppeteer/i,
            /chromedriver|geckodriver|webdriver/i,
            /^$/,
            /mozilla\/[45]\.0$/i,
            /^[a-z]{1,3}$/i,
        ];
        this.maliciousPatterns = [
            /union\s+select|select\s+.*\s+from|insert\s+into|delete\s+from/i,
            /or\s+1\s*=\s*1|and\s+1\s*=\s*1|'\s+or\s+'1'\s*=\s*'1/i,
            /<script|javascript:|onload=|onerror=|onclick=/i,
            /alert\(|confirm\(|prompt\(|document\.cookie/i,
            /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/i,
            /;\s*(cat|ls|pwd|whoami|id|uname)/i,
            /\|\s*(cat|ls|pwd|whoami|id|uname)/i,
            /<!entity|<!doctype.*entity|file:\/\/|http:\/\/localhost/i,
            /\{\{.*\}\}|\$\{.*\}|<%.*%>/i,
            /[\u0000-\u0005]/,
        ];
    }
    getWAFMiddleware() {
        return async (req, res, next) => {
            if (!this.config.enableWAF) {
                return next();
            }
            try {
                const startTime = Date.now();
                const ipAddress = this.getClientIP(req);
                const userAgent = req.get('User-Agent') || '';
                const path = req.path;
                const method = req.method;
                const securityContext = {
                    ipAddress,
                    userAgent,
                    path,
                    method,
                    headers: req.headers,
                    query: req.query,
                    body: req.body,
                    timestamp: new Date()
                };
                if (this.config.enableIPReputation) {
                    const reputationResult = await this.checkIPReputation(ipAddress);
                    if (reputationResult.blocked) {
                        return this.handleSecurityEvent(req, res, {
                            type: 'reputation_blocked',
                            severity: 'high',
                            details: reputationResult,
                            score: reputationResult.score
                        });
                    }
                }
                if (this.config.enableGeoBlocking) {
                    const geoResult = await this.checkGeographicRestrictions(ipAddress);
                    if (geoResult.blocked) {
                        return this.handleSecurityEvent(req, res, {
                            type: 'geo_blocked',
                            severity: 'medium',
                            details: geoResult,
                            score: 100
                        });
                    }
                }
                if (this.config.enableRateLimiting) {
                    const rateLimitResult = this.checkRateLimit(ipAddress, req);
                    if (rateLimitResult.blocked) {
                        return this.handleSecurityEvent(req, res, {
                            type: 'rate_limit_exceeded',
                            severity: 'medium',
                            details: rateLimitResult,
                            score: 90
                        });
                    }
                }
                if (this.config.enableBotProtection) {
                    const botResult = await this.detectBot(securityContext);
                    if (botResult.isBot && botResult.score >= this.config.botScoreThreshold) {
                        return this.handleSecurityEvent(req, res, {
                            type: 'bot_detected',
                            severity: botResult.isMalicious ? 'high' : 'medium',
                            details: botResult,
                            score: botResult.score
                        });
                    }
                }
                if (this.config.enableAnomalyDetection) {
                    const anomalyResult = await this.detectAnomalies(securityContext);
                    if (anomalyResult.isAnomalous && anomalyResult.score >= this.config.anomalyThreshold) {
                        return this.handleSecurityEvent(req, res, {
                            type: 'anomaly_detected',
                            severity: 'high',
                            details: anomalyResult,
                            score: anomalyResult.score
                        });
                    }
                }
                const payloadResult = this.analyzePayload(securityContext);
                if (payloadResult.isMalicious) {
                    return this.handleSecurityEvent(req, res, {
                        type: 'anomaly_detected',
                        severity: 'critical',
                        details: payloadResult,
                        score: 100
                    });
                }
                this.addSecurityHeaders(res);
                const processingTime = Date.now() - startTime;
                logger_1.logger.debug('WAF analysis completed', {
                    ipAddress,
                    path,
                    method,
                    processingTime,
                    allowed: true
                });
                next();
            }
            catch (error) {
                logger_1.logger.error('WAF middleware error:', error);
                next();
            }
        };
    }
    async checkIPReputation(ipAddress) {
        try {
            const cached = await TenantCacheService_1.tenantCacheService.get('system', `threat_${ipAddress}`, { namespace: 'waf' });
            let intelligence;
            if (cached && Date.now() - cached.lastSeen.getTime() < 3600000) {
                intelligence = cached;
            }
            else {
                intelligence = await this.fetchThreatIntelligence(ipAddress);
                await TenantCacheService_1.tenantCacheService.set('system', `threat_${ipAddress}`, intelligence, { ttl: 3600, namespace: 'waf' });
            }
            const blocked = intelligence.reputation >= this.config.reputationThreshold || intelligence.isMalicious;
            return {
                blocked,
                score: intelligence.reputation,
                sources: intelligence.sources,
                details: {
                    categories: intelligence.categories,
                    confidence: intelligence.confidence,
                    geolocation: intelligence.geolocation
                }
            };
        }
        catch (error) {
            logger_1.logger.error('IP reputation check failed:', error);
            return { blocked: false, score: 0, sources: [], details: {} };
        }
    }
    async fetchThreatIntelligence(ipAddress) {
        const intelligence = {
            ipAddress,
            reputation: 0,
            categories: [],
            lastSeen: new Date(),
            sources: [],
            confidence: 0,
            isBot: false,
            isMalicious: false,
            geolocation: {
                country: 'Unknown',
                region: 'Unknown',
                city: 'Unknown',
                asn: 0,
                organization: 'Unknown'
            }
        };
        const internalRep = await this.getInternalReputation(ipAddress);
        if (internalRep.reputation > 0) {
            intelligence.reputation = Math.max(intelligence.reputation, internalRep.reputation);
            intelligence.sources.push('internal');
            intelligence.categories.push(...internalRep.categories);
        }
        return intelligence;
    }
    async getInternalReputation(ipAddress) {
        try {
            const recentEvents = this.securityEvents.filter(event => event.ipAddress === ipAddress &&
                Date.now() - event.timestamp.getTime() < 24 * 60 * 60 * 1000);
            let reputation = 0;
            const categories = [];
            for (const event of recentEvents) {
                switch (event.severity) {
                    case 'critical':
                        reputation += 30;
                        break;
                    case 'high':
                        reputation += 20;
                        break;
                    case 'medium':
                        reputation += 10;
                        break;
                    case 'low':
                        reputation += 5;
                        break;
                }
                if (!categories.includes(event.type)) {
                    categories.push(event.type);
                }
            }
            return { reputation: Math.min(100, reputation), categories };
        }
        catch (error) {
            logger_1.logger.error('Internal reputation check failed:', error);
            return { reputation: 0, categories: [] };
        }
    }
    async checkGeographicRestrictions(ipAddress) {
        try {
            const country = await this.getCountryFromIP(ipAddress);
            if (this.config.blockedCountries.length > 0 && this.config.blockedCountries.includes(country)) {
                return {
                    blocked: true,
                    country,
                    reason: `Country ${country} is blocked`
                };
            }
            if (this.config.allowedCountries.length > 0 && !this.config.allowedCountries.includes(country)) {
                return {
                    blocked: true,
                    country,
                    reason: `Country ${country} is not in allowlist`
                };
            }
            return { blocked: false, country, reason: 'Allowed' };
        }
        catch (error) {
            logger_1.logger.error('Geographic check failed:', error);
            return { blocked: false, country: 'Unknown', reason: 'Check failed' };
        }
    }
    async getCountryFromIP(ipAddress) {
        try {
            if (ipAddress.startsWith('127.') ||
                ipAddress.startsWith('192.168.') ||
                ipAddress.startsWith('10.') ||
                ipAddress.startsWith('172.16.') ||
                ipAddress === '::1' ||
                ipAddress.startsWith('fc00:') ||
                ipAddress.startsWith('fe80:')) {
                return 'LOCAL';
            }
            const geoSources = [
                {
                    name: 'ip-api',
                    url: `http://ip-api.com/json/${ipAddress}`,
                    parser: (data) => data.countryCode
                },
                {
                    name: 'ipapi',
                    url: `https://ipapi.co/${ipAddress}/country_code/`,
                    parser: (data) => data.trim()
                },
                {
                    name: 'ipinfo',
                    url: `https://ipinfo.io/${ipAddress}/country`,
                    parser: (data) => data.trim()
                }
            ];
            for (const source of geoSources) {
                try {
                    const response = await axios_1.default.get(source.url, {
                        timeout: 2000,
                        headers: { 'User-Agent': 'WAF-Security-Service/1.0' }
                    });
                    if (response.status === 200) {
                        const country = source.parser(response.data);
                        if (country && country !== 'undefined' && country.length >= 2) {
                            logger_1.logger.debug(`IP ${ipAddress} resolved to country ${country} via ${source.name}`);
                            return country.toUpperCase();
                        }
                    }
                }
                catch (sourceError) {
                    logger_1.logger.debug(`Failed to get country from ${source.name} for IP ${ipAddress}:`, sourceError);
                    continue;
                }
            }
            return this.getCountryFromInternalDB(ipAddress);
        }
        catch (error) {
            logger_1.logger.error(`Error getting country for IP ${ipAddress}:`, error);
            return 'UNKNOWN';
        }
    }
    getCountryFromInternalDB(ipAddress) {
        const ipRanges = {
            '8.8.': 'US',
            '1.1.': 'US',
            '4.4.': 'US',
            '114.114.': 'CN',
            '223.5.': 'CN',
            '77.88.': 'RU',
            '95.108.': 'RU',
            '195.': 'EU',
            '213.': 'EU'
        };
        for (const [prefix, country] of Object.entries(ipRanges)) {
            if (ipAddress.startsWith(prefix)) {
                return country;
            }
        }
        return 'UNKNOWN';
    }
    checkRateLimit(ipAddress, _req) {
        const now = Date.now();
        const windowSize = 60000;
        const key = `rate:${ipAddress}`;
        let state = this.rateLimitStates.get(key);
        if (!state || now > state.resetTime) {
            state = {
                requests: 0,
                resetTime: now + windowSize,
                blocked: false,
                lastRequest: now
            };
        }
        state.requests++;
        state.lastRequest = now;
        const limit = this.config.perIPRateLimit;
        const blocked = state.requests > limit;
        if (blocked) {
            state.blocked = true;
        }
        this.rateLimitStates.set(key, state);
        return {
            blocked,
            limit,
            remaining: Math.max(0, limit - state.requests),
            resetTime: state.resetTime,
            details: {
                requests: state.requests,
                windowSize: windowSize / 1000,
                burstAllowed: this.config.burstLimit
            }
        };
    }
    async detectBot(context) {
        const reasons = [];
        let score = 0;
        let isBot = false;
        let isMalicious = false;
        const userAgent = context.userAgent;
        for (const pattern of this.botSignatures) {
            if (pattern.test(userAgent)) {
                isBot = true;
                score += 20;
                reasons.push('suspicious_user_agent');
                if (/nikto|sqlmap|nessus|masscan|nmap/i.test(userAgent)) {
                    isMalicious = true;
                    score += 50;
                    reasons.push('malicious_bot_signature');
                }
                break;
            }
        }
        if (!context.headers.accept) {
            score += 15;
            reasons.push('missing_accept_header');
        }
        if (!context.headers['accept-language']) {
            score += 10;
            reasons.push('missing_accept_language');
        }
        if (!context.headers['accept-encoding']) {
            score += 10;
            reasons.push('missing_accept_encoding');
        }
        if (context.method === 'GET' && Object.keys(context.query).length > 10) {
            score += 15;
            reasons.push('excessive_query_parameters');
        }
        if (context.headers['x-requested-with'] === 'XMLHttpRequest' &&
            !context.headers.referer) {
            score += 20;
            reasons.push('ajax_without_referer');
        }
        if (userAgent.length < 10 || userAgent.length > 500) {
            score += 25;
            reasons.push('unusual_user_agent_length');
        }
        return {
            isBot: isBot || score >= this.config.suspiciousUserAgentThreshold,
            isMalicious,
            score,
            reasons,
            details: {
                userAgent,
                headerCount: Object.keys(context.headers).length,
                hasReferer: !!context.headers.referer,
                hasAcceptLanguage: !!context.headers['accept-language']
            }
        };
    }
    async detectAnomalies(context) {
        const anomalies = [];
        let score = 0;
        const bodySize = JSON.stringify(context.body || '').length;
        if (bodySize > 100000) {
            score += 30;
            anomalies.push('large_request_body');
        }
        const headerCount = Object.keys(context.headers).length;
        if (headerCount > 50) {
            score += 25;
            anomalies.push('excessive_headers');
        }
        const pathLength = context.path.length;
        if (pathLength > 1000) {
            score += 35;
            anomalies.push('extremely_long_path');
        }
        const queryParamCount = Object.keys(context.query).length;
        if (queryParamCount > 20) {
            score += 20;
            anomalies.push('excessive_query_params');
        }
        const hour = new Date().getHours();
        if (hour >= 2 && hour <= 5) {
            score += 10;
            anomalies.push('unusual_time_access');
        }
        return {
            isAnomalous: score >= this.config.anomalyThreshold,
            score,
            anomalies,
            details: {
                bodySize,
                headerCount,
                pathLength,
                queryParamCount,
                hour
            }
        };
    }
    analyzePayload(context) {
        const threats = [];
        let score = 0;
        const textContent = [
            context.path,
            JSON.stringify(context.query),
            JSON.stringify(context.body),
            Object.values(context.headers).join(' ')
        ].join(' ');
        for (const pattern of this.maliciousPatterns) {
            if (pattern.test(textContent)) {
                score += 40;
                threats.push(pattern.source.substring(0, 50));
            }
        }
        if (/%[0-9a-f]{2}/gi.test(textContent)) {
            const decodedContent = decodeURIComponent(textContent);
            for (const pattern of this.maliciousPatterns) {
                if (pattern.test(decodedContent)) {
                    score += 50;
                    threats.push('encoded_malicious_payload');
                }
            }
        }
        return {
            isMalicious: score >= 40,
            threats,
            score,
            details: {
                contentLength: textContent.length,
                hasEncodedContent: /%[0-9a-f]{2}/gi.test(textContent),
                threatCount: threats.length
            }
        };
    }
    handleSecurityEvent(req, res, eventData) {
        const event = {
            id: this.generateEventId(),
            type: eventData.type,
            severity: eventData.severity,
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent') || '',
            path: req.path,
            method: req.method,
            timestamp: new Date(),
            details: eventData.details || {},
            action: 'blocked',
            score: eventData.score || 100
        };
        this.securityEvents.push(event);
        if (this.securityEvents.length > 10000) {
            this.securityEvents.shift();
        }
        logger_1.logger.security('WAF security event', {
            eventId: event.id,
            type: event.type,
            severity: event.severity,
            ipAddress: event.ipAddress,
            path: event.path,
            score: event.score,
            action: event.action
        });
        switch (this.config.blockAction) {
            case 'block':
                this.sendBlockResponse(res, event);
                break;
            case 'challenge':
                this.sendChallengeResponse(res, event);
                break;
            case 'monitor':
                event.action = 'allowed';
                break;
        }
    }
    sendBlockResponse(res, event) {
        res.status(403).json({
            error: 'Access Denied',
            message: 'Your request has been blocked by our security system',
            eventId: event.id,
            timestamp: event.timestamp.toISOString()
        });
    }
    sendChallengeResponse(res, event) {
        const challengeHtml = this.generateChallengeHTML(event);
        res.status(429)
            .set('Content-Type', 'text/html')
            .send(challengeHtml);
    }
    generateChallengeHTML(event) {
        const challengeId = this.generateChallengeId();
        return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Security Check</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .challenge-box { max-width: 500px; margin: 0 auto; }
            .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
    </head>
    <body>
        <div class="challenge-box">
            <h2>Security Check</h2>
            <p>Please wait while we verify your request...</p>
            <div class="spinner"></div>
            <p><small>Event ID: ${event.id}</small></p>
        </div>
        <script>
            // JavaScript challenge - simple proof of work
            setTimeout(function() {
                fetch('/api/security/verify-challenge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ challengeId: '${challengeId}', eventId: '${event.id}' })
                }).then(function() {
                    location.reload();
                });
            }, 3000);
        </script>
    </body>
    </html>
    `;
    }
    addSecurityHeaders(res) {
        res.set({
            'X-WAF-Status': 'Protected',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        });
    }
    getClientIP(req) {
        return (req.get('CF-Connecting-IP') ||
            req.get('X-Forwarded-For')?.split(',')[0] ||
            req.get('X-Real-IP') ||
            req.connection.remoteAddress ||
            req.ip ||
            'unknown').trim();
    }
    generateEventId() {
        return 'waf_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    generateChallengeId() {
        return 'ch_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupOldData();
        }, 5 * 60 * 1000);
    }
    cleanupOldData() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;
        for (const [key, state] of this.rateLimitStates.entries()) {
            if (now > state.resetTime + maxAge) {
                this.rateLimitStates.delete(key);
            }
        }
        this.securityEvents = this.securityEvents.filter(event => now - event.timestamp.getTime() < maxAge);
        for (const [ip, intel] of this.threatIntelligence.entries()) {
            if (now - intel.lastSeen.getTime() > maxAge) {
                this.threatIntelligence.delete(ip);
            }
        }
    }
    getStats() {
        const eventsByType = {};
        const eventsBySeverity = {};
        this.securityEvents.forEach(event => {
            eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
            eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
        });
        return {
            config: this.config,
            activeRateLimits: this.rateLimitStates.size,
            threatIntelligenceEntries: this.threatIntelligence.size,
            recentEvents: this.securityEvents.length,
            eventsByType,
            eventsBySeverity
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
            logger_1.logger.error('WAF security service health check failed:', error);
            return {
                status: 'error',
                stats: null
            };
        }
    }
}
exports.WAFSecurityService = WAFSecurityService;
exports.wafSecurityService = WAFSecurityService.getInstance();
//# sourceMappingURL=WAFSecurityService.js.map
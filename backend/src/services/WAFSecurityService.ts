import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { tenantCacheService } from './TenantCacheService';
import axios from 'axios';

export interface WAFConfig {
  enableWAF: boolean;
  enableBotProtection: boolean;
  enableAnomalyDetection: boolean;
  enableIPReputation: boolean;
  enableGeoBlocking: boolean;
  enableRateLimiting: boolean;
  
  // Bot protection settings
  challengeMode: 'captcha' | 'javascript' | 'proof_of_work' | 'behavioral';
  botScoreThreshold: number;
  suspiciousUserAgentThreshold: number;
  
  // Rate limiting
  globalRateLimit: number; // requests per minute
  perIPRateLimit: number;
  perUserRateLimit: number;
  burstLimit: number;
  
  // Anomaly detection
  anomalyThreshold: number;
  learningPeriod: number; // days
  enableMLDetection: boolean;
  
  // Geographic restrictions
  blockedCountries: string[];
  allowedCountries: string[];
  
  // IP reputation
  reputationSources: string[];
  reputationThreshold: number;
  
  // Response actions
  blockAction: 'block' | 'challenge' | 'monitor';
  challengeAction: 'captcha' | 'js_challenge' | 'managed_challenge';
}

export interface ThreatIntelligence {
  ipAddress: string;
  reputation: number;
  categories: string[];
  lastSeen: Date;
  sources: string[];
  confidence: number;
  isBot: boolean;
  isMalicious: boolean;
  geolocation: {
    country: string;
    region: string;
    city: string;
    asn: number;
    organization: string;
  };
}

export interface SecurityEvent {
  id: string;
  type: 'bot_detected' | 'anomaly_detected' | 'rate_limit_exceeded' | 'geo_blocked' | 'reputation_blocked';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress: string;
  userAgent: string;
  path: string;
  method: string;
  timestamp: Date;
  details: Record<string, any>;
  action: 'allowed' | 'blocked' | 'challenged';
  score: number;
}

export interface RateLimitState {
  requests: number;
  resetTime: number;
  blocked: boolean;
  lastRequest: number;
}

export class WAFSecurityService {
  private static instance: WAFSecurityService;
  private config: WAFConfig;
  private threatIntelligence: Map<string, ThreatIntelligence> = new Map();
  private rateLimitStates: Map<string, RateLimitState> = new Map();
  private anomalyBaseline: Map<string, number> = new Map();
  private securityEvents: SecurityEvent[] = [];
  private botSignatures!: RegExp[];
  private maliciousPatterns!: RegExp[];

  private constructor() {
    this.config = {
      enableWAF: process.env.ENABLE_WAF !== 'false',
      enableBotProtection: process.env.ENABLE_BOT_PROTECTION !== 'false',
      enableAnomalyDetection: process.env.ENABLE_ANOMALY_DETECTION !== 'false',
      enableIPReputation: process.env.ENABLE_IP_REPUTATION !== 'false',
      enableGeoBlocking: process.env.ENABLE_GEO_BLOCKING === 'true',
      enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
      
      challengeMode: (process.env.CHALLENGE_MODE as any) || 'javascript',
      botScoreThreshold: parseInt(process.env.BOT_SCORE_THRESHOLD || '80'),
      suspiciousUserAgentThreshold: parseInt(process.env.SUSPICIOUS_UA_THRESHOLD || '70'),
      
      globalRateLimit: parseInt(process.env.GLOBAL_RATE_LIMIT || '10000'), // 10k req/min
      perIPRateLimit: parseInt(process.env.PER_IP_RATE_LIMIT || '100'), // 100 req/min
      perUserRateLimit: parseInt(process.env.PER_USER_RATE_LIMIT || '500'), // 500 req/min
      burstLimit: parseInt(process.env.BURST_LIMIT || '20'),
      
      anomalyThreshold: parseInt(process.env.ANOMALY_THRESHOLD || '85'),
      learningPeriod: parseInt(process.env.LEARNING_PERIOD || '7'),
      enableMLDetection: process.env.ENABLE_ML_DETECTION === 'true',
      
      blockedCountries: (process.env.BLOCKED_COUNTRIES || '').split(',').filter(Boolean),
      allowedCountries: (process.env.ALLOWED_COUNTRIES || '').split(',').filter(Boolean),
      
      reputationSources: ['internal', 'cloudflare', 'abuseipdb'],
      reputationThreshold: parseInt(process.env.REPUTATION_THRESHOLD || '75'),
      
      blockAction: (process.env.BLOCK_ACTION as any) || 'block',
      challengeAction: (process.env.CHALLENGE_ACTION as any) || 'js_challenge'
    };

    this.initializeSecurityPatterns();
    this.startCleanupTimer();

    logger.info('WAF Security Service initialized', {
      wafEnabled: this.config.enableWAF,
      botProtection: this.config.enableBotProtection,
      rateLimiting: this.config.enableRateLimiting,
      anomalyDetection: this.config.enableAnomalyDetection
    });
  }

  public static getInstance(): WAFSecurityService {
    if (!WAFSecurityService.instance) {
      WAFSecurityService.instance = new WAFSecurityService();
    }
    return WAFSecurityService.instance;
  }

  private initializeSecurityPatterns(): void {
    // Bot detection patterns
    this.botSignatures = [
      // Common bots
      /bot|crawler|spider|scraper/i,
      /googlebot|bingbot|slurp|duckduckbot/i,
      /facebookexternalhit|twitterbot|linkedinbot/i,
      
      // Malicious bots
      /nikto|sqlmap|nessus|openvas|w3af/i,
      /masscan|nmap|zmap|zgrab/i,
      /curl|wget|python-requests|go-http-client/i,
      
      // Headless browsers
      /headlesschrome|phantomjs|selenium|puppeteer/i,
      /chromedriver|geckodriver|webdriver/i,
      
      // Suspicious patterns
      /^$/,  // Empty user agent
      /mozilla\/[45]\.0$/i,  // Generic Mozilla
      /^[a-z]{1,3}$/i,  // Very short user agents
    ];

    // Malicious request patterns
    this.maliciousPatterns = [
      // SQL Injection
      /union\s+select|select\s+.*\s+from|insert\s+into|delete\s+from/i,
      /or\s+1\s*=\s*1|and\s+1\s*=\s*1|'\s+or\s+'1'\s*=\s*'1/i,
      
      // XSS
      /<script|javascript:|onload=|onerror=|onclick=/i,
      /alert\(|confirm\(|prompt\(|document\.cookie/i,
      
      // Path traversal
      /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/i,
      
      // Command injection
      /;\s*(cat|ls|pwd|whoami|id|uname)/i,
      /\|\s*(cat|ls|pwd|whoami|id|uname)/i,
      
      // XXE/SSRF
      /<!entity|<!doctype.*entity|file:\/\/|http:\/\/localhost/i,
      
      // Template injection
      /\{\{.*\}\}|\$\{.*\}|<%.*%>/i,
      
      // Binary content in requests
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u0005]/,
    ];
  }

  /**
   * Main WAF middleware
   */
  getWAFMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableWAF) {
        return next();
      }

      try {
        const startTime = Date.now();
        const ipAddress = this.getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const path = req.path;
        const method = req.method;

        // Create security context
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

        // 1. IP Reputation Check
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

        // 2. Geographic Blocking
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

        // 3. Rate Limiting
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

        // 4. Bot Detection
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

        // 5. Anomaly Detection
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

        // 6. Payload Analysis
        const payloadResult = this.analyzePayload(securityContext);
        if (payloadResult.isMalicious) {
          return this.handleSecurityEvent(req, res, {
            type: 'anomaly_detected',
            severity: 'critical',
            details: payloadResult,
            score: 100
          });
        }

        // Add security headers
        this.addSecurityHeaders(res);

        // Log successful request
        const processingTime = Date.now() - startTime;
        logger.debug('WAF analysis completed', {
          ipAddress,
          path,
          method,
          processingTime,
          allowed: true
        });

        next();

      } catch (error) {
        logger.error('WAF middleware error:', error);
        // Fail open for availability, but log the error
        next();
      }
    };
  }

  /**
   * Check IP reputation
   */
  private async checkIPReputation(ipAddress: string): Promise<{
    blocked: boolean;
    score: number;
    sources: string[];
    details: any;
  }> {
    try {
      // Check cache first
      const cached = await tenantCacheService.get<ThreatIntelligence>(
        'system',
        `threat_${ipAddress}`,
        { namespace: 'waf' }
      );

      let intelligence: ThreatIntelligence;

      if (cached && Date.now() - cached.lastSeen.getTime() < 3600000) { // 1 hour cache
        intelligence = cached;
      } else {
        // Fetch from multiple sources
        intelligence = await this.fetchThreatIntelligence(ipAddress);
        
        // Cache result
        await tenantCacheService.set(
          'system',
          `threat_${ipAddress}`,
          intelligence,
          { ttl: 3600, namespace: 'waf' }
        );
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

    } catch (error) {
      logger.error('IP reputation check failed:', error);
      return { blocked: false, score: 0, sources: [], details: {} };
    }
  }

  /**
   * Fetch threat intelligence from multiple sources
   */
  private async fetchThreatIntelligence(ipAddress: string): Promise<ThreatIntelligence> {
    const intelligence: ThreatIntelligence = {
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

    // Internal reputation (from our own data)
    const internalRep = await this.getInternalReputation(ipAddress);
    if (internalRep.reputation > 0) {
      intelligence.reputation = Math.max(intelligence.reputation, internalRep.reputation);
      intelligence.sources.push('internal');
      intelligence.categories.push(...internalRep.categories);
    }

    // External reputation sources would be integrated here
    // For now, we'll use placeholder logic

    return intelligence;
  }

  /**
   * Get internal IP reputation from our data
   */
  private async getInternalReputation(ipAddress: string): Promise<{
    reputation: number;
    categories: string[];
  }> {
    try {
      // Check our security events for this IP
      const recentEvents = this.securityEvents.filter(
        event => event.ipAddress === ipAddress &&
        Date.now() - event.timestamp.getTime() < 24 * 60 * 60 * 1000 // 24 hours
      );

      let reputation = 0;
      const categories: string[] = [];

      // Calculate reputation based on recent events
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

    } catch (error) {
      logger.error('Internal reputation check failed:', error);
      return { reputation: 0, categories: [] };
    }
  }

  /**
   * Check geographic restrictions
   */
  private async checkGeographicRestrictions(ipAddress: string): Promise<{
    blocked: boolean;
    country: string;
    reason: string;
  }> {
    try {
      // Get geolocation (placeholder - would use real GeoIP service)
      const country = await this.getCountryFromIP(ipAddress);

      // Check blocked countries
      if (this.config.blockedCountries.length > 0 && this.config.blockedCountries.includes(country)) {
        return {
          blocked: true,
          country,
          reason: `Country ${country} is blocked`
        };
      }

      // Check allowed countries (if allowlist is configured)
      if (this.config.allowedCountries.length > 0 && !this.config.allowedCountries.includes(country)) {
        return {
          blocked: true,
          country,
          reason: `Country ${country} is not in allowlist`
        };
      }

      return { blocked: false, country, reason: 'Allowed' };

    } catch (error) {
      logger.error('Geographic check failed:', error);
      return { blocked: false, country: 'Unknown', reason: 'Check failed' };
    }
  }

  /**
   * Get country from IP address using multiple data sources
   */
  private async getCountryFromIP(ipAddress: string): Promise<string> {
    try {
      // Check for private/local IPs
      if (ipAddress.startsWith('127.') || 
          ipAddress.startsWith('192.168.') || 
          ipAddress.startsWith('10.') ||
          ipAddress.startsWith('172.16.') ||
          ipAddress === '::1' ||
          ipAddress.startsWith('fc00:') ||
          ipAddress.startsWith('fe80:')) {
        return 'LOCAL';
      }

      // Enhanced IP geolocation with multiple fallback sources
      const geoSources = [
        {
          name: 'ip-api',
          url: `http://ip-api.com/json/${ipAddress}`,
          parser: (data: any) => data.countryCode
        },
        {
          name: 'ipapi',
          url: `https://ipapi.co/${ipAddress}/country_code/`,
          parser: (data: string) => data.trim()
        },
        {
          name: 'ipinfo',
          url: `https://ipinfo.io/${ipAddress}/country`,
          parser: (data: string) => data.trim()
        }
      ];

      // Try each source with timeout
      for (const source of geoSources) {
        try {
          const response = await axios.get(source.url, { 
            timeout: 2000,
            headers: { 'User-Agent': 'WAF-Security-Service/1.0' }
          });
          
          if (response.status === 200) {
            const country = source.parser(response.data);
            if (country && country !== 'undefined' && country.length >= 2) {
              logger.debug(`IP ${ipAddress} resolved to country ${country} via ${source.name}`);
              return country.toUpperCase();
            }
          }
        } catch (sourceError) {
          logger.debug(`Failed to get country from ${source.name} for IP ${ipAddress}:`, sourceError);
          continue;
        }
      }

      // Fallback to internal database or return unknown
      return this.getCountryFromInternalDB(ipAddress);
      
    } catch (error) {
      logger.error(`Error getting country for IP ${ipAddress}:`, error);
      return 'UNKNOWN';
    }
  }

  /**
   * Fallback internal GeoIP database lookup
   */
  private getCountryFromInternalDB(ipAddress: string): string {
    // Basic IP range to country mapping for common ranges
    const ipRanges: { [key: string]: string } = {
      // US ranges (simplified)
      '8.8.': 'US',
      '1.1.': 'US',
      '4.4.': 'US',
      // China ranges  
      '114.114.': 'CN',
      '223.5.': 'CN',
      // Russia ranges
      '77.88.': 'RU',
      '95.108.': 'RU',
      // European ranges
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

  /**
   * Check rate limits
   */
  private checkRateLimit(ipAddress: string, _req: Request): {
    blocked: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    details: any;
  } {
    const now = Date.now();
    const windowSize = 60000; // 1 minute
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

    // Check if rate limit exceeded
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

  /**
   * Detect bots
   */
  private async detectBot(context: any): Promise<{
    isBot: boolean;
    isMalicious: boolean;
    score: number;
    reasons: string[];
    details: any;
  }> {
    const reasons: string[] = [];
    let score = 0;
    let isBot = false;
    let isMalicious = false;

    const userAgent = context.userAgent;

    // Check user agent patterns
    for (const pattern of this.botSignatures) {
      if (pattern.test(userAgent)) {
        isBot = true;
        score += 20;
        reasons.push('suspicious_user_agent');
        
        // Check if it's a malicious bot
        if (/nikto|sqlmap|nessus|masscan|nmap/i.test(userAgent)) {
          isMalicious = true;
          score += 50;
          reasons.push('malicious_bot_signature');
        }
        break;
      }
    }

    // Check for missing common headers
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

    // Check request patterns
    if (context.method === 'GET' && Object.keys(context.query).length > 10) {
      score += 15;
      reasons.push('excessive_query_parameters');
    }

    // Check for automation indicators
    if (context.headers['x-requested-with'] === 'XMLHttpRequest' && 
        !context.headers.referer) {
      score += 20;
      reasons.push('ajax_without_referer');
    }

    // Very short or very long user agents
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

  /**
   * Detect anomalies
   */
  private async detectAnomalies(context: any): Promise<{
    isAnomalous: boolean;
    score: number;
    anomalies: string[];
    details: any;
  }> {
    const anomalies: string[] = [];
    let score = 0;

    // Request size anomalies
    const bodySize = JSON.stringify(context.body || '').length;
    if (bodySize > 100000) { // 100KB
      score += 30;
      anomalies.push('large_request_body');
    }

    // Header anomalies
    const headerCount = Object.keys(context.headers).length;
    if (headerCount > 50) {
      score += 25;
      anomalies.push('excessive_headers');
    }

    // Path anomalies
    const pathLength = context.path.length;
    if (pathLength > 1000) {
      score += 35;
      anomalies.push('extremely_long_path');
    }

    // Query parameter anomalies
    const queryParamCount = Object.keys(context.query).length;
    if (queryParamCount > 20) {
      score += 20;
      anomalies.push('excessive_query_params');
    }

    // Time-based anomalies (requests at unusual hours)
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 5) { // 2-5 AM
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

  /**
   * Analyze request payload for malicious content
   */
  private analyzePayload(context: any): {
    isMalicious: boolean;
    threats: string[];
    score: number;
    details: any;
  } {
    const threats: string[] = [];
    let score = 0;

    // Combine all text content for analysis
    const textContent = [
      context.path,
      JSON.stringify(context.query),
      JSON.stringify(context.body),
      Object.values(context.headers).join(' ')
    ].join(' ');

    // Check malicious patterns
    for (const pattern of this.maliciousPatterns) {
      if (pattern.test(textContent)) {
        score += 40;
        threats.push(pattern.source.substring(0, 50));
      }
    }

    // Check for encoded payloads
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

  /**
   * Handle security events
   */
  private handleSecurityEvent(
    req: Request,
    res: Response,
    eventData: Partial<SecurityEvent>
  ): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      type: eventData.type!,
      severity: eventData.severity!,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || '',
      path: req.path,
      method: req.method,
      timestamp: new Date(),
      details: eventData.details || {},
      action: 'blocked',
      score: eventData.score || 100
    };

    // Store event
    this.securityEvents.push(event);
    if (this.securityEvents.length > 10000) {
      this.securityEvents.shift(); // Remove oldest events
    }

    // Log event
    logger.security('WAF security event', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      ipAddress: event.ipAddress,
      path: event.path,
      score: event.score,
      action: event.action
    });

    // Determine response based on configuration
    switch (this.config.blockAction) {
      case 'block':
        this.sendBlockResponse(res, event);
        break;
      case 'challenge':
        this.sendChallengeResponse(res, event);
        break;
      case 'monitor':
        event.action = 'allowed';
        // Continue to next middleware (monitoring only)
        break;
    }
  }

  /**
   * Send block response
   */
  private sendBlockResponse(res: Response, event: SecurityEvent): void {
    res.status(403).json({
      error: 'Access Denied',
      message: 'Your request has been blocked by our security system',
      eventId: event.id,
      timestamp: event.timestamp.toISOString()
    });
  }

  /**
   * Send challenge response
   */
  private sendChallengeResponse(res: Response, event: SecurityEvent): void {
    const challengeHtml = this.generateChallengeHTML(event);
    
    res.status(429)
      .set('Content-Type', 'text/html')
      .send(challengeHtml);
  }

  /**
   * Generate challenge HTML
   */
  private generateChallengeHTML(event: SecurityEvent): string {
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

  /**
   * Add security headers
   */
  private addSecurityHeaders(res: Response): void {
    res.set({
      'X-WAF-Status': 'Protected',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    });
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (req.get('CF-Connecting-IP') ||
            req.get('X-Forwarded-For')?.split(',')[0] ||
            req.get('X-Real-IP') ||
            req.connection.remoteAddress ||
            req.ip ||
            'unknown').trim();
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return 'waf_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Generate challenge ID
   */
  private generateChallengeId(): string {
    return 'ch_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up rate limit states
    for (const [key, state] of this.rateLimitStates.entries()) {
      if (now > state.resetTime + maxAge) {
        this.rateLimitStates.delete(key);
      }
    }

    // Clean up old security events
    this.securityEvents = this.securityEvents.filter(
      event => now - event.timestamp.getTime() < maxAge
    );

    // Clean up threat intelligence cache
    for (const [ip, intel] of this.threatIntelligence.entries()) {
      if (now - intel.lastSeen.getTime() > maxAge) {
        this.threatIntelligence.delete(ip);
      }
    }
  }

  /**
   * Get security statistics
   */
  getStats(): {
    config: WAFConfig;
    activeRateLimits: number;
    threatIntelligenceEntries: number;
    recentEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};

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

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: any;
  }> {
    try {
      const stats = this.getStats();
      
      return {
        status: 'healthy',
        stats
      };

    } catch (error) {
      logger.error('WAF security service health check failed:', error);
      return {
        status: 'error',
        stats: null
      };
    }
  }
}

// Export singleton instance
export const wafSecurityService = WAFSecurityService.getInstance();

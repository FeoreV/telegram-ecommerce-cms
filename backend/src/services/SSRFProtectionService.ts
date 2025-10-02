import { URL } from 'url';
import dns from 'dns/promises';
import net from 'net';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';

export interface SSRFConfig {
  enableProtection: boolean;
  allowedDomains: string[];
  allowedIPs: string[];
  blockedDomains: string[];
  blockedIPs: string[];
  allowPrivateIPs: boolean;
  allowLoopback: boolean;
  allowLinkLocal: boolean;
  allowMulticast: boolean;
  allowBroadcast: boolean;
  maxRedirects: number;
  requestTimeout: number;
  userAgent: string;
  enableDNSValidation: boolean;
  enableSchemeValidation: boolean;
  allowedSchemes: string[];
}

export interface ValidationResult {
  isAllowed: boolean;
  reason?: string;
  resolvedIP?: string;
  originalURL: string;
  normalizedURL?: string;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  maxRedirects?: number;
  followRedirects?: boolean;
}

export class SSRFProtectionService {
  private static instance: SSRFProtectionService;
  private config: SSRFConfig;
  private dnsCache: Map<string, { ip: string; timestamp: number }> = new Map();
  private dnsCacheTTL: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {
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
    logger.info('SSRF protection service initialized', {
      enableProtection: this.config.enableProtection,
      allowedDomains: this.config.allowedDomains.length,
      blockedDomains: this.config.blockedDomains.length
    });
  }

  public static getInstance(): SSRFProtectionService {
    if (!SSRFProtectionService.instance) {
      SSRFProtectionService.instance = new SSRFProtectionService();
    }
    return SSRFProtectionService.instance;
  }

  private parseList(str: string): string[] {
    return str.split(',').map(item => item.trim()).filter(Boolean);
  }

  /**
   * Validate URL for SSRF protection
   */
  async validateURL(url: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isAllowed: false,
      originalURL: url
    };

    try {
      if (!this.config.enableProtection) {
        result.isAllowed = true;
        return result;
      }

      // Parse and normalize URL
      let parsedURL: URL;
      try {
        parsedURL = new URL(url);
        result.normalizedURL = parsedURL.toString();
      } catch (error) {
        result.reason = 'Invalid URL format';
        return result;
      }

      // Validate scheme
      if (this.config.enableSchemeValidation) {
        if (!this.config.allowedSchemes.includes(parsedURL.protocol.slice(0, -1))) {
          result.reason = `Scheme '${parsedURL.protocol}' not allowed`;
          return result;
        }
      }

      // Check domain allowlist first
      if (this.config.allowedDomains.length > 0) {
        const isAllowedDomain = this.config.allowedDomains.some(domain => 
          this.matchesDomain(parsedURL.hostname, domain)
        );
        
        if (isAllowedDomain) {
          result.isAllowed = true;
          return result;
        }
      }

      // Check blocked domains
      const isBlockedDomain = this.config.blockedDomains.some(domain => 
        this.matchesDomain(parsedURL.hostname, domain)
      );
      
      if (isBlockedDomain) {
        result.reason = `Domain '${parsedURL.hostname}' is blocked`;
        return result;
      }

      // DNS resolution and IP validation
      if (this.config.enableDNSValidation) {
        const resolvedIP = await this.resolveHostname(parsedURL.hostname);
        if (!resolvedIP) {
          result.reason = 'DNS resolution failed';
          return result;
        }

        result.resolvedIP = resolvedIP;

        // Check IP allowlist
        if (this.config.allowedIPs.length > 0) {
          const isAllowedIP = this.config.allowedIPs.some(ip => 
            this.matchesIP(resolvedIP, ip)
          );
          
          if (isAllowedIP) {
            result.isAllowed = true;
            return result;
          }
        }

        // Check blocked IPs
        const isBlockedIP = this.config.blockedIPs.some(ip => 
          this.matchesIP(resolvedIP, ip)
        );
        
        if (isBlockedIP) {
          result.reason = `IP address '${resolvedIP}' is blocked`;
          return result;
        }

        // Check IP address type restrictions
        const ipValidation = this.validateIPAddress(resolvedIP);
        if (!ipValidation.isAllowed) {
          result.reason = ipValidation.reason;
          return result;
        }
      }

      // If we reach here and no allowlist is configured, allow the request
      if (this.config.allowedDomains.length === 0 && this.config.allowedIPs.length === 0) {
        result.isAllowed = true;
      } else {
        result.reason = 'URL not in allowlist';
      }

      return result;

    } catch (error) {
      logger.error('SSRF validation error:', error);
      result.reason = 'Validation process failed';
      return result;
    }
  }

  /**
   * Resolve hostname to IP address with caching
   */
  private async resolveHostname(hostname: string): Promise<string | null> {
    try {
      // Check cache first
      const cached = this.dnsCache.get(hostname);
      if (cached && Date.now() - cached.timestamp < this.dnsCacheTTL) {
        return cached.ip;
      }

      // Resolve hostname
      const addresses = await dns.resolve4(hostname);
      if (addresses.length === 0) {
        return null;
      }

      const ip = addresses[0];
      
      // Cache result
      this.dnsCache.set(hostname, {
        ip,
        timestamp: Date.now()
      });

      return ip;

    } catch (error) {
      logger.debug('DNS resolution failed', {
        hostname,
        error: getErrorMessage(error)
      });
      return null;
    }
  }

  /**
   * Validate IP address type
   */
  private validateIPAddress(ip: string): { isAllowed: boolean; reason?: string } {
    // Check if it's a valid IP
    if (!net.isIP(ip)) {
      return { isAllowed: false, reason: 'Invalid IP address' };
    }

    // IPv6 support (basic)
    if (net.isIPv6(ip)) {
      // For now, allow all IPv6 addresses except loopback
      if (ip === '::1' && !this.config.allowLoopback) {
        return { isAllowed: false, reason: 'Loopback IPv6 address not allowed' };
      }
      return { isAllowed: true };
    }

    // IPv4 validation
    const ipParts = ip.split('.').map(Number);
    
    // Loopback (127.x.x.x)
    if (ipParts[0] === 127) {
      if (!this.config.allowLoopback) {
        return { isAllowed: false, reason: 'Loopback address not allowed' };
      }
      return { isAllowed: true };
    }

    // Private IP ranges
    const isPrivate = this.isPrivateIP(ipParts);
    if (isPrivate && !this.config.allowPrivateIPs) {
      return { isAllowed: false, reason: 'Private IP address not allowed' };
    }

    // Link-local (169.254.x.x)
    if (ipParts[0] === 169 && ipParts[1] === 254) {
      if (!this.config.allowLinkLocal) {
        return { isAllowed: false, reason: 'Link-local address not allowed' };
      }
      return { isAllowed: true };
    }

    // Multicast (224.x.x.x - 239.x.x.x)
    if (ipParts[0] >= 224 && ipParts[0] <= 239) {
      if (!this.config.allowMulticast) {
        return { isAllowed: false, reason: 'Multicast address not allowed' };
      }
      return { isAllowed: true };
    }

    // Broadcast (255.255.255.255)
    if (ip === '255.255.255.255') {
      if (!this.config.allowBroadcast) {
        return { isAllowed: false, reason: 'Broadcast address not allowed' };
      }
      return { isAllowed: true };
    }

    // Reserved ranges
    if (ipParts[0] === 0 || ipParts[0] === 240) {
      return { isAllowed: false, reason: 'Reserved IP address range not allowed' };
    }

    return { isAllowed: true };
  }

  /**
   * Check if IP is in private range
   */
  private isPrivateIP(ipParts: number[]): boolean {
    // 10.x.x.x
    if (ipParts[0] === 10) return true;
    
    // 172.16.x.x - 172.31.x.x
    if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return true;
    
    // 192.168.x.x
    if (ipParts[0] === 192 && ipParts[1] === 168) return true;
    
    return false;
  }

  /**
   * Match domain against pattern (supports wildcards)
   */
  private matchesDomain(hostname: string, pattern: string): boolean {
    // Exact match
    if (hostname === pattern) return true;
    
    // Wildcard support (*.example.com)
    if (pattern.startsWith('*.')) {
      const baseDomain = pattern.slice(2);
      return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
    }
    
    return false;
  }

  /**
   * Match IP against pattern (supports CIDR)
   */
  private matchesIP(ip: string, pattern: string): boolean {
    // Exact match
    if (ip === pattern) return true;
    
    // CIDR support (basic implementation)
    if (pattern.includes('/')) {
      const [networkIP, prefixLength] = pattern.split('/');
      const prefix = parseInt(prefixLength, 10);
      
      if (prefix < 0 || prefix > 32) return false;
      
      try {
        const ipInt = this.ipToInt(ip);
        const networkInt = this.ipToInt(networkIP);
        const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
        
        return (ipInt & mask) === (networkInt & mask);
      } catch (error) {
        return false;
      }
    }
    
    return false;
  }

  /**
   * Convert IP address to integer
   */
  private ipToInt(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  /**
   * Make secure HTTP request with SSRF protection
   */
  async makeSecureRequest(url: string, options: RequestOptions = {}): Promise<any> {
    // Validate URL first
    const validation = await this.validateURL(url);
    if (!validation.isAllowed) {
      const error = new Error(`SSRF protection: ${validation.reason}`);
      error.name = 'SSRFProtectionError';
      throw error;
    }

    // Use the validated/normalized URL
    const targetURL = validation.normalizedURL || url;

    logger.info('Making secure HTTP request', {
      originalURL: url,
      targetURL,
      resolvedIP: validation.resolvedIP,
      method: options.method || 'GET'
    });

    try {
      // Import fetch dynamically (if using node-fetch)
      const fetch = (await import('node-fetch')).default;
      
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'User-Agent': this.config.userAgent,
          ...options.headers
        },
        body: options.body,
        timeout: options.timeout || this.config.requestTimeout,
        redirect: (options.followRedirects === false ? 'manual' : 'follow') as any
      };

      const response = await fetch(targetURL, requestOptions);
      
      // Log successful request
      logger.debug('Secure HTTP request completed', {
        url: targetURL,
        status: response.status,
        statusText: response.statusText
      });

      return response;

    } catch (error) {
      logger.error('Secure HTTP request failed', {
        url: targetURL,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  /**
   * Validate webhook URL for security
   */
  async validateWebhookURL(url: string): Promise<ValidationResult> {
    const result = await this.validateURL(url);
    
    // Additional webhook-specific validations
    if (result.isAllowed) {
      try {
        const parsedURL = new URL(url);
        
        // Ensure HTTPS for webhooks in production
        if (process.env.NODE_ENV === 'production' && parsedURL.protocol !== 'https:') {
          result.isAllowed = false;
          result.reason = 'HTTPS required for webhooks in production';
          return result;
        }
        
        // Check for suspicious paths
        const suspiciousPaths = ['/admin', '/internal', '/debug', '/test'];
        if (suspiciousPaths.some(path => parsedURL.pathname.includes(path))) {
          result.isAllowed = false;
          result.reason = 'Webhook URL contains suspicious path';
          return result;
        }
        
      } catch (error) {
        result.isAllowed = false;
        result.reason = 'Invalid webhook URL';
      }
    }
    
    return result;
  }

  /**
   * Add domain to allowlist
   */
  addAllowedDomain(domain: string): void {
    if (!this.config.allowedDomains.includes(domain)) {
      this.config.allowedDomains.push(domain);
      logger.info('Domain added to SSRF allowlist', { domain });
    }
  }

  /**
   * Remove domain from allowlist
   */
  removeAllowedDomain(domain: string): void {
    const index = this.config.allowedDomains.indexOf(domain);
    if (index > -1) {
      this.config.allowedDomains.splice(index, 1);
      logger.info('Domain removed from SSRF allowlist', { domain });
    }
  }

  /**
   * Add domain to blocklist
   */
  addBlockedDomain(domain: string): void {
    if (!this.config.blockedDomains.includes(domain)) {
      this.config.blockedDomains.push(domain);
      logger.info('Domain added to SSRF blocklist', { domain });
    }
  }

  /**
   * Start DNS cache cleanup timer
   */
  private startDNSCacheCleanup(): void {
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
        logger.debug('DNS cache cleaned up', {
          cleanedCount,
          remainingEntries: this.dnsCache.size
        });
      }
    }, this.dnsCacheTTL);
  }

  /**
   * Get service statistics
   */
  getStats(): {
    config: SSRFConfig;
    dnsCacheSize: number;
    allowedDomains: number;
    blockedDomains: number;
    allowedIPs: number;
    blockedIPs: number;
  } {
    return {
      config: this.config,
      dnsCacheSize: this.dnsCache.size,
      allowedDomains: this.config.allowedDomains.length,
      blockedDomains: this.config.blockedDomains.length,
      allowedIPs: this.config.allowedIPs.length,
      blockedIPs: this.config.blockedIPs.length
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
      logger.error('SSRF protection service health check failed:', error);
      return {
        status: 'error',
        stats: null
      };
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): SSRFConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const ssrfProtectionService = SSRFProtectionService.getInstance();

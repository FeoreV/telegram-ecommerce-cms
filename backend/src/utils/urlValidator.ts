/**
 * URL Validator Utility
 * Prevents SSRF attacks by validating and sanitizing URLs
 */

import { URL } from 'url';

/**
 * Blocked private IP ranges and localhost
 */
const BLOCKED_IP_PATTERNS = [
  /^127\./,                    // 127.0.0.0/8 - Loopback
  /^10\./,                     // 10.0.0.0/8 - Private
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 - Private
  /^192\.168\./,               // 192.168.0.0/16 - Private
  /^169\.254\./,               // 169.254.0.0/16 - Link-local
  /^0\./,                      // 0.0.0.0/8
  /^::1$/,                     // IPv6 loopback
  /^fe80:/i,                   // IPv6 link-local
  /^fc00:/i,                   // IPv6 unique local
  /^fd00:/i,                   // IPv6 unique local
];

/**
 * Allowed protocols for external requests
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Validate URL to prevent SSRF attacks
 */
export function validateUrl(urlString: string, options: {
  allowPrivateIPs?: boolean;
  allowedProtocols?: string[];
  allowedDomains?: string[];
} = {}): { valid: boolean; error?: string; url?: URL } {
  const {
    allowPrivateIPs = false,
    allowedProtocols = ALLOWED_PROTOCOLS,
    allowedDomains = []
  } = options;

  try {
    const url = new URL(urlString);

    // Check protocol
    if (!allowedProtocols.includes(url.protocol)) {
      return {
        valid: false,
        error: `Protocol ${url.protocol} is not allowed. Allowed protocols: ${allowedProtocols.join(', ')}`
      };
    }

    // Check for localhost and private IPs
    if (!allowPrivateIPs) {
      const hostname = url.hostname.toLowerCase();

      // Check for localhost variants
      if (hostname === 'localhost' || hostname === '0.0.0.0') {
        return {
          valid: false,
          error: 'Requests to localhost are not allowed'
        };
      }

      // Check for private IP ranges
      for (const pattern of BLOCKED_IP_PATTERNS) {
        if (pattern.test(hostname)) {
          return {
            valid: false,
            error: 'Requests to private IP addresses are not allowed'
          };
        }
      }
    }

    // Check domain whitelist if provided
    if (allowedDomains.length > 0) {
      const hostname = url.hostname.toLowerCase();
      const isAllowed = allowedDomains.some(domain => {
        const domainLower = domain.toLowerCase();
        return hostname === domainLower || hostname.endsWith('.' + domainLower);
      });

      if (!isAllowed) {
        return {
          valid: false,
          error: `Domain ${url.hostname} is not in the allowed list`
        };
      }
    }

    return { valid: true, url };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Sanitize URL by removing potentially dangerous components
 */
export function sanitizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    
    // Remove username and password
    url.username = '';
    url.password = '';
    
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Check if URL points to Telegram API
 */
export function isTelegramApiUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.hostname === 'api.telegram.org';
  } catch {
    return false;
  }
}

/**
 * Validate and sanitize URL for safe use
 */
export function getSafeUrl(urlString: string, options?: Parameters<typeof validateUrl>[1]): string {
  const validation = validateUrl(urlString, options);
  
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid URL');
  }
  
  return sanitizeUrl(urlString);
}


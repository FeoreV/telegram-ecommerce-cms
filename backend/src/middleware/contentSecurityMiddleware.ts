import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';

export interface ContentSecurityConfig {
  enableCSP: boolean;
  enableXSSProtection: boolean;
  enableOutputSanitization: boolean;
  enableFrameProtection: boolean;
  cspDirectives: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    connectSrc: string[];
    fontSrc: string[];
    objectSrc: string[];
    mediaSrc: string[];
    frameSrc: string[];
    childSrc: string[];
    workerSrc: string[];
    manifestSrc: string[];
    formAction: string[];
    frameAncestors: string[];
    baseUri: string[];
    upgradeInsecureRequests: boolean;
    blockAllMixedContent: boolean;
  };
  reportUri?: string;
  reportOnly: boolean;
  nonce: boolean;
  allowedTags: string[];
  allowedAttributes: string[];
  sanitizationOptions: {
    allowHTML: boolean;
    allowSVG: boolean;
    allowMathML: boolean;
    keepComments: boolean;
    keepWhitespace: boolean;
  };
}

export class ContentSecurityService {
  private static instance: ContentSecurityService;
  private config: ContentSecurityConfig;
  private nonceCache: Map<string, { nonce: string; timestamp: number }> = new Map();
  private nonceTTL: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.config = {
      enableCSP: process.env.ENABLE_CSP !== 'false',
      enableXSSProtection: process.env.ENABLE_XSS_PROTECTION !== 'false',
      enableOutputSanitization: process.env.ENABLE_OUTPUT_SANITIZATION !== 'false',
      enableFrameProtection: process.env.ENABLE_FRAME_PROTECTION !== 'false',
      cspDirectives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-hashes'"], // No unsafe-inline
        styleSrc: ["'self'", "'unsafe-hashes'"], // No unsafe-inline
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
    logger.info('Content security service initialized', {
      enableCSP: this.config.enableCSP,
      enableXSSProtection: this.config.enableXSSProtection,
      reportOnly: this.config.reportOnly
    });
  }

  public static getInstance(): ContentSecurityService {
    if (!ContentSecurityService.instance) {
      ContentSecurityService.instance = new ContentSecurityService();
    }
    return ContentSecurityService.instance;
  }

  /**
   * Generate Content Security Policy header
   */
  generateCSPHeader(nonce?: string): string {
    const directives: string[] = [];

    // Add each directive
    Object.entries(this.config.cspDirectives).forEach(([key, value]) => {
      if (key === 'upgradeInsecureRequests' || key === 'blockAllMixedContent') {
        if (value) {
          directives.push(this.camelToKebab(key));
        }
        return;
      }

      if (Array.isArray(value) && value.length > 0) {
        let directiveValue = value.join(' ');
        
        // Add nonce to script-src and style-src if enabled
        if (nonce && (key === 'scriptSrc' || key === 'styleSrc')) {
          directiveValue += ` 'nonce-${nonce}'`;
        }
        
        directives.push(`${this.camelToKebab(key)} ${directiveValue}`);
      }
    });

    // Add report-uri if configured
    if (this.config.reportUri) {
      directives.push(`report-uri ${this.config.reportUri}`);
    }

    return directives.join('; ');
  }

  /**
   * Convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Generate cryptographic nonce
   */
  generateNonce(requestId?: string): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    
    if (requestId) {
      this.nonceCache.set(requestId, {
        nonce,
        timestamp: Date.now()
      });
    }

    return nonce;
  }

  /**
   * Get nonce for request
   */
  getNonce(requestId: string): string | null {
    const cached = this.nonceCache.get(requestId);
    
    if (cached && Date.now() - cached.timestamp < this.nonceTTL) {
      return cached.nonce;
    }
    
    return null;
  }

  /**
   * Content Security Policy middleware
   */
  getCSPMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableCSP) {
        return next();
      }

      let nonce: string | undefined;
      
      // Generate nonce if enabled
      if (this.config.nonce) {
        const requestId = (req as any).requestId || req.get('X-Request-ID');
        nonce = this.generateNonce(requestId);
        
        // Make nonce available to templates
        (req as any).nonce = nonce;
        res.locals.nonce = nonce;
      }

      // Generate CSP header
      const cspHeader = this.generateCSPHeader(nonce);
      const headerName = this.config.reportOnly ? 
        'Content-Security-Policy-Report-Only' : 
        'Content-Security-Policy';

      res.set(headerName, cspHeader);

      // Add other security headers
      if (this.config.enableXSSProtection) {
        res.set('X-XSS-Protection', '1; mode=block');
      }

      if (this.config.enableFrameProtection) {
        res.set('X-Frame-Options', 'DENY');
      }

      // Additional security headers
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

  /**
   * Output sanitization middleware
   */
  getOutputSanitizationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableOutputSanitization) {
        return next();
      }

      // Override res.json to sanitize output
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        const sanitizedBody = this.sanitizeOutput(body);
        return originalJson(sanitizedBody);
      };

      // Override res.send for HTML responses
      const originalSend = res.send.bind(res);
      res.send = (body: any) => {
        if (typeof body === 'string' && res.get('Content-Type')?.includes('text/html')) {
          body = this.sanitizeHTML(body);
        }
        return originalSend(body);
      };

      next();
    };
  }

  /**
   * Sanitize output data recursively
   */
  private sanitizeOutput(data: any): any {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    } else if (Array.isArray(data)) {
      return data.map(item => this.sanitizeOutput(item));
    } else if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeOutput(value);
      }
      return sanitized;
    }
    return data;
  }

  /**
   * Sanitize string content
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return str;

    // Basic XSS protection
    let sanitized = str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // Remove null bytes and control characters
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

    return sanitized;
  }

  /**
   * Sanitize HTML content using DOMPurify
   */
  sanitizeHTML(html: string): string {
    if (!html || typeof html !== 'string') return html;

    try {
      const purifyConfig: any = {
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

      const sanitized = DOMPurify.sanitize(html, purifyConfig);
      const sanitizedStr = String(sanitized);
      
      // Log if significant changes were made
      if (sanitizedStr.length < html.length * 0.8) {
        logger.warn('Significant content removed during HTML sanitization', {
          originalLength: html.length,
          sanitizedLength: sanitizedStr.length,
          reductionPercent: Math.round((1 - sanitizedStr.length / html.length) * 100)
        });
      }

      return sanitizedStr;

    } catch (error) {
      logger.error('HTML sanitization error:', error);
      // Fallback to aggressive sanitization
      return this.sanitizeString(html);
    }
  }

  /**
   * Validate and sanitize user input
   */
  sanitizeUserInput(input: string, options: {
    allowHTML?: boolean;
    maxLength?: number;
    stripTags?: boolean;
  } = {}): string {
    if (!input || typeof input !== 'string') return input;

    let sanitized = input;

    // Trim whitespace
    sanitized = sanitized.trim();

    // Enforce max length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Remove or sanitize HTML
    if (options.stripTags || !options.allowHTML) {
      sanitized = this.sanitizeString(sanitized);
    } else if (options.allowHTML) {
      sanitized = this.sanitizeHTML(sanitized);
    }

    // Normalize Unicode
    sanitized = sanitized.normalize('NFKC');

    return sanitized;
  }

  /**
   * CSP violation report endpoint
   */
  getCSPReportEndpoint() {
    return (req: Request, res: Response) => {
      try {
        const report = req.body;
        
        logger.security('CSP violation reported', {
          report,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          timestamp: new Date().toISOString()
        });

        // Store violation for analysis
        this.storeCSPViolation(report, req);

        res.status(204).send();

      } catch (error) {
        logger.error('CSP report processing error:', error);
        res.status(400).json({
          error: 'Invalid report format',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Store CSP violation for analysis
   */
  private storeCSPViolation(report: any, req: Request): void {
    // This could be enhanced to store in database or send to monitoring service
    const violation = {
      ...report,
      metadata: {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        referer: req.get('Referer'),
        timestamp: new Date().toISOString()
      }
    };

    // For now, just log critical violations
    if (report['csp-report']) {
      const cspReport = report['csp-report'];
      
      // Check for potentially malicious violations
      const suspiciousPatterns = [
        /javascript:/i,
        /data:text\/html/i,
        /eval\(/i,
        /onclick=/i,
        /onerror=/i
      ];

      const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(cspReport['blocked-uri'] || '') ||
        pattern.test(cspReport['script-sample'] || '')
      );

      if (isSuspicious) {
        logger.security('Suspicious CSP violation detected', {
          violation,
          severity: 'HIGH'
        });
      }
    }
  }

  /**
   * Clean up expired nonces
   */
  private startNonceCleanup(): void {
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
        logger.debug('Nonce cache cleaned up', {
          cleanedCount,
          remainingNonces: this.nonceCache.size
        });
      }

    }, this.nonceTTL);
  }

  /**
   * Update CSP directive
   */
  updateCSPDirective(directive: string, values: string[]): void {
    const camelCaseDirective = directive.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    
    if (camelCaseDirective in this.config.cspDirectives) {
      (this.config.cspDirectives as any)[camelCaseDirective] = values;
      logger.info('CSP directive updated', {
        directive: camelCaseDirective,
        values
      });
    }
  }

  /**
   * Add allowed source to CSP directive
   */
  addAllowedSource(directive: string, source: string): void {
    const camelCaseDirective = directive.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    
    if (camelCaseDirective in this.config.cspDirectives) {
      const currentValues = (this.config.cspDirectives as any)[camelCaseDirective];
      if (Array.isArray(currentValues) && !currentValues.includes(source)) {
        currentValues.push(source);
        logger.info('Source added to CSP directive', {
          directive: camelCaseDirective,
          source
        });
      }
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    config: ContentSecurityConfig;
    activenonces: number;
  } {
    return {
      config: this.config,
      activenonces: this.nonceCache.size
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
      logger.error('Content security service health check failed:', error);
      return {
        status: 'error',
        stats: null
      };
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): ContentSecurityConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const contentSecurityService = ContentSecurityService.getInstance();

// Export middleware functions
export const cspMiddleware = contentSecurityService.getCSPMiddleware();
export const outputSanitizationMiddleware = contentSecurityService.getOutputSanitizationMiddleware();
export const cspReportEndpoint = contentSecurityService.getCSPReportEndpoint();

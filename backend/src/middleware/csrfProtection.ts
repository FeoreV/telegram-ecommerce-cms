/**
 * CSRF Protection Middleware
 * 
 * Protects against Cross-Site Request Forgery (CSRF) attacks - CWE-352
 * Implements Double Submit Cookie pattern with additional security measures
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { sanitizeForLog } from '../utils/inputSanitizer';

interface CsrfConfig {
  cookieName: string;
  headerName: string;
  cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    path: string;
  };
  excludePaths: string[];
  excludeMethods: string[];
}

const DEFAULT_CONFIG: CsrfConfig = {
  cookieName: '_csrf',
  headerName: 'X-CSRF-Token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000, // 1 hour
    path: '/'
  },
  excludePaths: [
    '/health',
    '/metrics',
    '/api/webhook',
    '/webhook',
  ],
  excludeMethods: ['GET', 'HEAD', 'OPTIONS']
};

/**
 * Generate a secure CSRF token
 * @returns A cryptographically random token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-time comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    );
  } catch {
    return false;
  }
}

/**
 * Create CSRF protection middleware
 * @param config - Optional configuration overrides
 * @returns Express middleware function
 */
export function csrfProtection(config?: Partial<CsrfConfig>) {
  const fullConfig: CsrfConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    cookieOptions: {
      ...DEFAULT_CONFIG.cookieOptions,
      ...config?.cookieOptions
    }
  };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF protection in development mode or if explicitly disabled
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_CSRF_PROTECTION === 'false') {
      return next();
    }
    
    // Skip CSRF protection for excluded methods
    if (fullConfig.excludeMethods.includes(req.method)) {
      return next();
    }
    
    // Skip CSRF protection for excluded paths
    const isExcluded = fullConfig.excludePaths.some(path => 
      req.path.startsWith(path)
    );
    if (isExcluded) {
      return next();
    }
    
    // For state-changing methods, verify CSRF token
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      // Support both production and development CSRF cookie names
      const cookieToken =
        req.cookies?.[fullConfig.cookieName] ||
        req.cookies?.['__Host-csrf.token'] ||
        req.cookies?.['csrf-token'];
      const headerToken = req.headers[fullConfig.headerName.toLowerCase()] as string;
      const bodyToken = req.body?._csrf;
      
      // Get token from header or body
      const clientToken = headerToken || bodyToken;
      
      if (!cookieToken || !clientToken) {
        logger.warn('CSRF token missing', {
          method: req.method,
          path: sanitizeForLog(req.path),
          ip: sanitizeForLog(req.ip),
          hasCookie: !!cookieToken,
          hasHeader: !!headerToken,
          hasBody: !!bodyToken
        });
        
        return res.status(403).json({
          error: 'CSRF token missing',
          code: 'CSRF_TOKEN_MISSING'
        });
      }
      
      // Verify tokens match using timing-safe comparison
      if (!timingSafeEqual(cookieToken, clientToken)) {
        logger.warn('CSRF token mismatch', {
          method: req.method,
          path: sanitizeForLog(req.path),
          ip: sanitizeForLog(req.ip)
        });
        
        return res.status(403).json({
          error: 'Invalid CSRF token',
          code: 'CSRF_TOKEN_INVALID'
        });
      }
    }
    
    // Generate new token for the response if not present
    if (!req.cookies?.[fullConfig.cookieName]) {
      const newToken = generateCsrfToken();
      res.cookie(fullConfig.cookieName, newToken, fullConfig.cookieOptions);
      
      // Expose token in response header for client-side JavaScript
      res.setHeader(fullConfig.headerName, newToken);
      
      // Attach token to request for easy access in route handlers
      (req as any).csrfToken = newToken;
    } else {
      (req as any).csrfToken = req.cookies[fullConfig.cookieName];
    }
    
    next();
  };
}

/**
 * Middleware to attach CSRF token to all responses
 * Useful for APIs that need to provide tokens to clients
 */
export function csrfTokenProvider(config?: Partial<CsrfConfig>) {
  const fullConfig: CsrfConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    cookieOptions: {
      ...DEFAULT_CONFIG.cookieOptions,
      ...config?.cookieOptions
    }
  };
  
  return (req: Request, res: Response, next: NextFunction) => {
    let token = req.cookies?.[fullConfig.cookieName];
    
    if (!token) {
      token = generateCsrfToken();
      res.cookie(fullConfig.cookieName, token, fullConfig.cookieOptions);
    }
    
    // Expose token in response header
    res.setHeader(fullConfig.headerName, token);
    
    // Attach helper function to get token
    (req as any).csrfToken = () => token;
    
    next();
  };
}

/**
 * Express route handler to get CSRF token
 * Can be used to provide tokens to clients
 */
export function getCsrfTokenHandler(req: Request, res: Response) {
  const token = (req as any).csrfToken || generateCsrfToken();
  
  res.json({
    csrfToken: token
  });
}

/**
 * Validate CSRF token manually
 * Useful for WebSocket or custom authentication flows
 * @param cookieToken - Token from cookie
 * @param clientToken - Token from client (header or body)
 * @returns True if tokens are valid and match
 */
export function validateCsrfToken(cookieToken: string, clientToken: string): boolean {
  if (!cookieToken || !clientToken) {
    return false;
  }
  
  return timingSafeEqual(cookieToken, clientToken);
}

/**
 * Create a CSRF protection middleware for specific routes
 * @param routes - Array of route patterns to protect
 * @param config - Optional configuration
 * @returns Express middleware function
 */
export function csrfProtectionForRoutes(routes: string[], config?: Partial<CsrfConfig>) {
  const fullConfig: CsrfConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    cookieOptions: {
      ...DEFAULT_CONFIG.cookieOptions,
      ...config?.cookieOptions
    }
  };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if current route matches any protected route
    const isProtected = routes.some(route => {
      if (route.includes('*')) {
        const pattern = route.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(req.path);
      }
      return req.path.startsWith(route);
    });
    
    if (!isProtected) {
      return next();
    }
    
    // Apply CSRF protection
    return csrfProtection(fullConfig)(req, res, next);
  };
}

/**
 * Middleware to set secure headers for CSRF protection
 */
export function setCsrfSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Enable XSS protection
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Set Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; frame-ancestors 'self'"
    );
    
    // Set Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
  };
}

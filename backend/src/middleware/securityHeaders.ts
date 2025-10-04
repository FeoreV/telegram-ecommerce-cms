/**
 * Security Headers Middleware
 * Implements various security headers to protect against common attacks
 */

import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

/**
 * Comprehensive security headers using Helmet.js
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for AdminJS
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow for AdminJS
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // Enable XSS filter
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'same-origin'
  },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // Frame guard (prevent clickjacking)
  frameguard: {
    action: 'deny'
  }
});

/**
 * Additional custom security headers
 */
export const customSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  
  // Expect-CT header for Certificate Transparency
  res.setHeader('Expect-CT', 
    'max-age=86400, enforce'
  );
  
  // Cross-Origin headers
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  
  next();
};

/**
 * Development-friendly security headers (less strict for local development)
 */
export const devSecurityHeaders = helmet({
  contentSecurityPolicy: false, // Disable CSP in development
  hsts: false, // Disable HSTS in development
});


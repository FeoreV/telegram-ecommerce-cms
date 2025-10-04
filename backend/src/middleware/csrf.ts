/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks (CWE-352)
 *
 * SECURITY FIX: Replaced csurf package with custom implementation
 * to avoid dependency on unmaintained package
 */

import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { CorsSecurityService } from './corsSecurityMiddleware';

const corsSecurityService = CorsSecurityService.getInstance();

/**
 * CSRF protection middleware
 * Use on all state-changing routes (POST, PUT, PATCH, DELETE)
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF if disabled
  if (process.env.ENABLE_CSRF_PROTECTION === 'false') {
    return next();
  }

  // Extract token from header, body, or query
  const token =
    req.get('X-CSRF-Token') ||
    req.get('csrf-token') ||
    (req.body && req.body._csrf) ||
    (req.query && req.query._csrf);

  if (!token) {
    logger.warn('CSRF token missing', {
      ip: req.ip,
      method: req.method,
      path: req.path
    });
    return res.status(403).json({
      error: 'CSRF token is missing',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  // Get user context
  const userId = (req as any).user?.id;
  const sessionId = (req as any).session?.id;
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

  // Validate token
  const isValid = corsSecurityService.validateCSRFToken(
    token as string,
    userId,
    sessionId,
    ipAddress
  );

  if (!isValid) {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      method: req.method,
      path: req.path,
      userAgent: req.get('user-agent')
    });
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_VALIDATION_FAILED'
    });
  }

  next();
};

/**
 * Middleware to attach CSRF token to response
 * Should be used on routes that render forms or pages
 */
export const attachCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  const sessionId = (req as any).session?.id;
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

  const token = corsSecurityService.generateCSRFToken(userId, sessionId, ipAddress);

  // Attach CSRF token to response locals for templates
  res.locals.csrfToken = token;

  // Also send in response header for SPA applications
  res.setHeader('X-CSRF-Token', token);

  // Set as cookie for JavaScript access
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // JavaScript needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000 // 1 hour
  });

  next();
};

/**
 * Error handler for CSRF token validation failures
 */
export const csrfErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code !== 'EBADCSRFTOKEN' && err.message !== 'Invalid CSRF token') {
    return next(err);
  }

  // Log CSRF validation failure
  logger.warn('CSRF token validation failed', {
    ip: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent')
  });

  // Respond with forbidden error
  res.status(403).json({
    error: 'Invalid CSRF token',
    code: 'CSRF_VALIDATION_FAILED'
  });
};

/**
 * Get CSRF token endpoint
 * Allows clients to fetch a CSRF token before making state-changing requests
 */
export const getCsrfToken = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const sessionId = (req as any).session?.id;
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

  const token = corsSecurityService.generateCSRFToken(userId, sessionId, ipAddress);

  res.json({
    csrfToken: token
  });
};


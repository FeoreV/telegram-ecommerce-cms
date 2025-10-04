/**
 * Content-Type Validation Middleware
 * SECURITY: Prevents content-type confusion attacks (CWE-436)
 */

import { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * Validates Content-Type header for state-changing operations
 * Ensures that POST/PUT/PATCH/DELETE requests use application/json
 */
export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
  // Skip validation for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'DELETE'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip validation for multipart/form-data (file uploads)
  const contentType = req.headers['content-type'];
  if (contentType && contentType.includes('multipart/form-data')) {
    return next();
  }

  // Skip validation for application/x-www-form-urlencoded (legacy forms)
  if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
    return next();
  }

  // For POST/PUT/PATCH with body, require application/json
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Check if request has a body (Content-Length > 0)
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > 0) {
      if (!contentType || !contentType.includes('application/json')) {
        logger.warn('Invalid Content-Type for request with body', {
          method: req.method,
          url: req.url,
          contentType: contentType || 'none',
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        throw new AppError(
          'Content-Type must be application/json for requests with body',
          415 // Unsupported Media Type
        );
      }
    }
  }

  next();
};

/**
 * Conditional Content-Type validation
 * Only applies validation if enabled in configuration
 */
export const conditionalContentTypeValidation = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.ENABLE_CONTENT_TYPE_VALIDATION === 'false') {
    return next();
  }
  return validateContentType(req, res, next);
};

/**
 * Strict Content-Type validation for API routes
 * Always requires application/json for POST/PUT/PATCH
 */
export const strictContentTypeValidation = (req: Request, res: Response, next: NextFunction) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'DELETE'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // For POST/PUT/PATCH, always require application/json
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      throw new AppError(
        'Content-Type must be application/json',
        415
      );
    }
  }

  next();
};


/**
 * Input Validation Middleware
 * SECURITY: Validates and sanitizes request inputs
 */

import { Request, Response, NextFunction } from 'express';
import { sanitizeHtml, sanitizeObjectForLog } from '../utils/sanitizer';
import { validateEmail, validateUrl, validateInteger } from '../utils/validator';
import { logger } from '../utils/logger';
import { AppError } from './errorHandler';

/**
 * Sanitize all string values in request body
 */
export const sanitizeBody = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};

/**
 * Sanitize all string values in query parameters
 */
export const sanitizeQuery = (req: Request, res: Response, next: NextFunction) => {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
};

/**
 * Recursively sanitize object
 */
function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 10) return obj; // Prevent infinite recursion
  
  if (typeof obj === 'string') {
    return sanitizeHtml(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate email in request body
 */
export const validateEmailField = (field: string = 'email') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const email = req.body[field];
    
    if (!email) {
      return next(new AppError(`${field} is required`, 400));
    }
    
    if (!validateEmail(email)) {
      return next(new AppError(`Invalid ${field} format`, 400));
    }
    
    next();
  };
};

/**
 * Validate URL in request body
 */
export const validateUrlField = (field: string = 'url') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const url = req.body[field];
    
    if (!url) {
      return next(new AppError(`${field} is required`, 400));
    }
    
    if (!validateUrl(url)) {
      return next(new AppError(`Invalid ${field} format`, 400));
    }
    
    next();
  };
};

/**
 * Validate integer field with optional range
 */
export const validateIntegerField = (field: string, min?: number, max?: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (value === undefined || value === null) {
      return next(new AppError(`${field} is required`, 400));
    }
    
    const validation = validateInteger(value, min, max);
    
    if (!validation.valid) {
      return next(new AppError(`Invalid ${field}: ${validation.error}`, 400));
    }
    
    // Replace with validated integer
    req.body[field] = validation.value;
    next();
  };
};

/**
 * Validate required fields exist
 */
export const validateRequired = (...fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter(field => !req.body[field]);
    
    if (missing.length > 0) {
      return next(new AppError(`Missing required fields: ${missing.join(', ')}`, 400));
    }
    
    next();
  };
};

/**
 * Validate request body size
 */
export const validateBodySize = (maxSize: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const bodySize = JSON.stringify(req.body).length;
    
    if (bodySize > maxSize) {
      logger.warn('Request body too large', {
        size: bodySize,
        maxSize,
        ip: req.ip
      });
      return next(new AppError('Request body too large', 413));
    }
    
    next();
  };
};

/**
 * Validate array field
 */
export const validateArrayField = (field: string, maxLength: number = 100) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (!Array.isArray(value)) {
      return next(new AppError(`${field} must be an array`, 400));
    }
    
    if (value.length > maxLength) {
      return next(new AppError(`${field} exceeds maximum length of ${maxLength}`, 400));
    }
    
    next();
  };
};

/**
 * Validate string length
 */
export const validateStringLength = (field: string, min: number, max: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (typeof value !== 'string') {
      return next(new AppError(`${field} must be a string`, 400));
    }
    
    if (value.length < min) {
      return next(new AppError(`${field} must be at least ${min} characters`, 400));
    }
    
    if (value.length > max) {
      return next(new AppError(`${field} must be at most ${max} characters`, 400));
    }
    
    next();
  };
};

/**
 * Validate enum field
 */
export const validateEnum = (field: string, allowedValues: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (!allowedValues.includes(value)) {
      return next(new AppError(
        `${field} must be one of: ${allowedValues.join(', ')}`,
        400
      ));
    }
    
    next();
  };
};

/**
 * Log validated request (for audit)
 */
export const logValidatedRequest = (req: Request, res: Response, next: NextFunction) => {
  logger.info('Validated request', {
    method: req.method,
    path: req.path,
    body: sanitizeObjectForLog(req.body),
    query: sanitizeObjectForLog(req.query),
    user: (req as any).user?.id
  });
  
  next();
};

/**
 * Combine multiple validation middlewares
 * 
 * Usage:
 *   router.post('/api/user', 
 *     validateAll(
 *       validateRequired('name', 'email'),
 *       validateEmailField('email'),
 *       validateStringLength('name', 2, 100)
 *     ),
 *     controller
 *   );
 */
export function validateAll(...validators: any[]) {
  return validators;
}


import { NextFunction, Request, Response } from 'express';
import { NotificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let { statusCode = 500, message } = err;

  const reqLogger = (req as any).logger || logger;
  // SECURITY FIX: Sanitize logs to prevent CWE-117 (Log Injection)
  const { sanitizeObjectForLog, sanitizeError } = require('../utils/sanitizer');
  const sanitizedError = sanitizeError(err);

  // Log error
  reqLogger.error({
    error: {
      message: sanitizedError.message,
      stack: sanitizedError.stack,
      statusCode,
    },
    request: {
      method: req.method,
      url: sanitizeObjectForLog(req.url),
      headers: sanitizeObjectForLog(req.headers),
      body: sanitizeObjectForLog(req.body), // Sanitize body to prevent sensitive data exposure
    },
  });

  // Send system error notification for critical errors
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    setImmediate(async () => {
      try {
        await NotificationService.notifySystemError(
          err.message,
          {
            statusCode,
            stack: err.stack,
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            timestamp: new Date().toISOString(),
          }
        );
      } catch (notificationError) {
        reqLogger.error('Failed to send system error notification:', notificationError);
      }
    });
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    if ((err as any).code === 'P2002') {
      statusCode = 409;
      message = 'Resource already exists';
    } else if ((err as any).code === 'P2025') {
      statusCode = 404;
      message = 'Resource not found';
    }
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired token';
  }

  // SECURITY: Generic error messages in production (CWE-209)
  if (process.env.NODE_ENV === 'production') {
    // Don't expose internal error details
    if (statusCode >= 500) {
      message = 'Internal server error';
    }
    // Only send safe error messages
    res.status(statusCode).json({
      error: message,
      statusCode,
      timestamp: new Date().toISOString()
    });
  } else {
    // Development: send detailed errors
    res.status(statusCode).json({
      error: message,
      statusCode,
      stack: err.stack,
      name: err.name,
      timestamp: new Date().toISOString()
    });
  }
};

export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
};

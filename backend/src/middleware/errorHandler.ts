import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { NotificationService } from '../services/notificationService';

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
  // Log error
  reqLogger.error({
    error: {
      message: err.message,
      stack: err.stack,
      statusCode,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
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

  // Send error response
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
};

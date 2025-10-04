import { Request, Response, NextFunction } from 'express';
import { logger, LogCategory } from '../utils/loggerEnhanced';

export interface RequestWithTiming extends Request {
  startTime?: number;
  requestId?: string;
}

/**
 * HTTP request/response logging middleware
 */
export const httpLogger = (req: RequestWithTiming, res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  
  // Skip logging for health checks and static assets
  const skipPaths = ['/health', '/favicon.ico', '/robots.txt'];
  const isStaticAsset = req.path.match(/\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/);
  
  if (skipPaths.includes(req.path) || isStaticAsset) {
    return next();
  }

  // Log incoming request (only in production to reduce console spam)
  if (process.env.NODE_ENV === 'production') {
    logger.http('Incoming request', {
      category: LogCategory.API,
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      ip: getClientIP(req),
      userAgent: req.get('User-Agent') || 'Unknown',
      requestId: req.requestId,
      contentLength: req.get('Content-Length'),
      referer: req.get('Referer'),
      acceptEncoding: req.get('Accept-Encoding'),
      acceptLanguage: req.get('Accept-Language'),
      host: req.get('Host'),
    });
  }

  // Capture response data
  const originalSend = res.send;
  
  res.send = function(data: any) {
    // Response body captured but not logged for security
    return originalSend.call(this, data);
  };

  // Log response when finished
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const statusCode = res.statusCode;
    
    // Determine log level based on status code
    let logLevel: 'error' | 'warn' | 'info' | 'http' = 'http';
    if (statusCode >= 500) logLevel = 'error';
    else if (statusCode >= 400) logLevel = 'warn';
    else if (statusCode >= 300) logLevel = 'info';

    const logData: Record<string, any> = {
      category: LogCategory.API,
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      statusCode,
      duration,
      ip: getClientIP(req),
      userAgent: req.get('User-Agent') || 'Unknown',
      requestId: req.requestId,
      responseSize: res.get('Content-Length'),
      contentType: res.get('Content-Type'),
    };

    // Add error context for error responses
    if (statusCode >= 400) {
      logData['errorContext'] = {
        query: req.query,
        params: req.params,
        // Don't log sensitive body data, just the structure
        bodyStructure: req.body ? Object.keys(req.body) : undefined,
      };
    }

    // Log based on determined level (only errors/warnings in development)
    if (logLevel === 'error') {
      logger.error('Request failed', logData);
    } else if (logLevel === 'warn') {
      logger.warn('Request warning', logData);
    } else if (process.env.NODE_ENV === 'production') {
      logger.http('Request completed', logData);
    }

    // Log slow requests as performance warnings
    if (duration > 1000) { // > 1 second
      logger.performance('Slow request detected', {
        ...logData,
        category: LogCategory.PERFORMANCE,
        threshold: 1000,
      });
    }
  });

  // Log errors if they occur
  res.on('error', (error) => {
    logger.logError(error, 'Response error', {
      category: LogCategory.API,
      method: req.method,
      url: req.originalUrl || req.url,
      requestId: req.requestId,
    });
  });

  next();
};

/**
 * Extract real client IP address
 */
function getClientIP(req: Request): string {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    'unknown'
  );
}

/**
 * Request ID middleware - should be used before httpLogger
 */
export const requestIdLogger = (req: RequestWithTiming, res: Response, next: NextFunction) => {
  // Use existing request ID or generate new one
  req.requestId = req.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to response headers for debugging
  res.setHeader('X-Request-ID', req.requestId);
  
  next();
};

export default {
  httpLogger,
  requestIdLogger,
};

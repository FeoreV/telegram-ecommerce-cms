import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { UserRole } from '../utils/jwt';

interface NotFoundRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    telegramId: string;
  };
}

// 404 handler for API routes
export const apiNotFoundHandler = (req: NotFoundRequest, res: Response, _next: NextFunction) => {
  const requestInfo = {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    userRole: req.user?.role,
    timestamp: new Date().toISOString(),
    headers: {
      accept: req.get('Accept'),
      contentType: req.get('Content-Type'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
    }
  };

  // Log the 404 attempt
  logger.warn('API endpoint not found', requestInfo);

  // Determine response format based on Accept header
  const acceptsJson = req.accepts(['json', 'html']) === 'json';
  
  if (acceptsJson || req.originalUrl.startsWith('/api/')) {
    // API endpoints should return JSON
    return res.status(404).json({
      error: 'Endpoint not found',
      message: `The requested endpoint ${req.method} ${req.originalUrl} was not found`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      availableEndpoints: getAvailableEndpoints(req.user?.role),
    });
  }

  // For non-API routes, let the frontend handle it
  return res.status(404).json({
    error: 'Route not found',
    message: 'This route is not handled by the API. Please check if this should be a frontend route.',
    statusCode: 404,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
};

// Get available endpoints based on user role
const getAvailableEndpoints = (userRole?: string): Record<string, string[]> => {
  const publicEndpoints = [
    'GET /health',
    'GET /api',
    'POST /api/auth/telegram',
  ];

  const authenticatedEndpoints = [
    'GET /api/stores',
    'GET /api/products',
    'GET /api/orders',
    'GET /api/notifications',
  ];

  const adminEndpoints = [
    'GET /api/admin/dashboard',
    'GET /api/admin/stats',
    'GET /api/admin/users',
    'POST /api/admin/stores',
  ];

  const ownerEndpoints = [
    'GET /api/users',
    'POST /api/users',
    'DELETE /api/users/:id',
    'GET /api/security/status',
    'GET /api/backup',
  ];

  const endpoints: Record<string, string[]> = {
    public: publicEndpoints,
  };

  if (userRole) {
    endpoints.authenticated = authenticatedEndpoints;
    
    if (userRole === 'ADMIN' || userRole === 'OWNER') {
      endpoints.admin = adminEndpoints;
    }
    
    if (userRole === 'OWNER') {
      endpoints.owner = ownerEndpoints;
    }
  }

  return endpoints;
};

// Enhanced 404 handler with security considerations
export const secureNotFoundHandler = (req: NotFoundRequest, res: Response, next: NextFunction) => {
  const requestInfo = {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    userRole: req.user?.role,
    timestamp: new Date().toISOString(),
  };

  // Check for potential security threats
  const suspiciousPatterns = [
    /\.env$/i,
    /\.git/i,
    /admin/i,
    /wp-admin/i,
    /phpmyadmin/i,
    /\.php$/i,
    /\.asp$/i,
    /\.jsp$/i,
    /backup/i,
    /config/i,
    /database/i,
    /\.sql$/i,
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.originalUrl) || pattern.test(req.url)
  );

  if (isSuspicious) {
    logger.warn('Suspicious 404 request detected', {
      ...requestInfo,
      suspicious: true,
      pattern: 'security_scan'
    });

    // Return generic response for security
    return res.status(404).json({
      error: 'Not found',
      statusCode: 404,
    });
  }

  // Check for admin panel access attempts
  if (req.originalUrl.includes('/admin') && (!req.user || !['ADMIN', 'OWNER'].includes(req.user.role))) {
    logger.warn('Unauthorized admin access attempt', {
      ...requestInfo,
      threat: 'unauthorized_admin_access'
    });

    return res.status(404).json({
      error: 'Not found',
      statusCode: 404,
    });
  }

  // Call standard 404 handler
  return apiNotFoundHandler(req, res, next);
};

// Middleware to handle different types of 404s
export const notFoundMiddleware = (req: NotFoundRequest, res: Response, next: NextFunction) => {
  // Skip if response already sent
  if (res.headersSent) {
    return next();
  }

  // Use secure handler for enhanced security
  return secureNotFoundHandler(req, res, next);
};

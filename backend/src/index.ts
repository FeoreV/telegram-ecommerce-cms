import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { loginSlowDown } from './auth';
import { authMiddleware } from './middleware/auth';
import { enhancedAuthMiddleware } from './middleware/jwtSecurity';
import {
    adminIPWhitelist,
    adminRateLimit,
    apiRateLimit,
    authRateLimit,
    bruteForce,
    securityMiddlewareBundle,
    uploadRateLimit
} from './middleware/security';
import { env } from './utils/env';

import { databaseService } from './lib/database';
import { disconnectPrisma, prisma } from './lib/prisma';
// import { setupAdminJS } from './admin'; // DISABLED - AdminJS removed
import secureAuthRoutes from './auth/SecureAuthRoutes';
import { AuthenticatedRequest } from './auth/SecureAuthSystem';
import { initSocket } from './lib/socket';
import { compromiseGuard } from './middleware/compromiseGuard';
import { validateContentType } from './middleware/contentTypeValidation';
import { errorHandler } from './middleware/errorHandler';
import { exfiltrationTrap } from './middleware/exfiltrationTrap';
import { httpLogger, requestIdLogger } from './middleware/httpLogger';
import { getMetrics, metricsMiddleware } from './middleware/metrics';
import { notFoundMiddleware } from './middleware/notFoundHandler';
import { performanceTracker } from './middleware/performanceTracker';
import { responseDLP } from './middleware/responseDLP';
import { vaultHealthEndpoint, vaultHealthMiddleware } from './middleware/vaultHealthCheck';
import { webhookQuarantineGuard } from './middleware/webhookQuarantineGuard';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import backupRoutes from './routes/backup';
import botRoutes from './routes/bots';
import bulkRoutes from './routes/bulk';
import categoryRoutes from './routes/categories';
import cmsRoutes from './routes/cms';
import configRoutes from './routes/config';
import customRoleRoutes from './routes/customRoleRoutes';
import employeeRoutes from './routes/employeeRoutes';
import healthRoutes from './routes/health';
import integrationRoutes from './routes/integration';
import invitationRoutes from './routes/invitationRoutes';
import inviteLinkRoutes from './routes/inviteLinkRoutes';
import notificationRoutes from './routes/notifications';
import orderRoutes from './routes/orders';
import productRoutes from './routes/products';
import securityRoutes from './routes/security';
import storeRoutes from './routes/stores';
import userRoutes from './routes/users';
import { BackupService } from './services/backupService';
import { botFactoryService } from './services/botFactoryService';
import { compromiseResponseService } from './services/CompromiseResponseService';
import { honeytokenService } from './services/HoneytokenService';
import EnvValidator from './utils/envValidator';
import { logger, toLogMetadata } from './utils/loggerEnhanced';
import { secretManager } from './utils/SecretManager';

// Load environment variables
dotenv.config();

// Initialize secret manager early
const initializeSecrets = async () => {
  try {
    await secretManager.initialize();
    logger.info('✅ Secret manager initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize secret manager:', { error: (error as Error).message });
    process.exit(1);
  }
};

// Initialize database service
const initializeDatabase = async () => {
  try {
    await databaseService.initialize();
    logger.info('✅ Database service initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize database service:', { error: (error as Error).message });
    process.exit(1);
  }
};

// Initialize critical services before app setup
const initializeCriticalServices = async () => {
  await initializeSecrets();
  await initializeDatabase();
};

// Validate environment configuration
const envValidation = EnvValidator.validate();
if (!envValidation.isValid) {
  console.error('Environment validation failed. Exiting...');
  console.error('Errors:', envValidation.errors);
  console.error('Warnings:', envValidation.warnings);
  process.exit(1);
}

// Print environment summary
EnvValidator.printEnvironmentSummary();

// AdminJS setup - DISABLED
const initializeAdminJS = async () => {
  logger.info('⚠️ AdminJS completely disabled - no setup required');
};

// Initialize services with proper sequencing
(async () => {
  try {
    // First, initialize critical services
    await initializeCriticalServices();
    logger.info('✅ Critical services initialized successfully');

    // AdminJS is disabled - no initialization needed
    await initializeAdminJS();
    logger.info('✅ Application initialization completed');
  } catch (error) {
    logger.error('❌ Failed to initialize application services:', error);
    process.exit(1);
  }
})();

// Create Express app
const app = express();
const server = createServer(app);

// Trust proxy (nginx reverse proxy)
// Use number of proxies instead of 'true' for security
app.set('trust proxy', 1); // Trust first proxy (nginx)

// Initialize Socket.IO
const io = initSocket(server, env.FRONTEND_URL || "http://82.147.84.78:3000");

// Enhanced security middleware bundle
app.use(securityMiddlewareBundle);
app.use(validateContentType); // SECURITY: Content-Type validation (CWE-436)
app.use(compromiseGuard);
app.use(exfiltrationTrap);
app.use(responseDLP);
app.use(requestIdLogger);
app.use(httpLogger);
app.use(performanceTracker);
app.use(metricsMiddleware);
app.use(vaultHealthMiddleware);

// Security status endpoint (before rate limiting)
app.get('/api/security/status', authMiddleware, (req, res) => {
  try {
    // Return basic security status
    res.json({
      security: {
        status: 'active',
        features: ['rate-limiting', 'csrf-protection', 'helmet', 'sanitization']
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting security status:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply specific rate limiting and security to different routes
app.use('/api/auth', authRateLimit);
app.post('/api/auth/login/email', loginSlowDown);
app.post('/api/auth/login/telegram', loginSlowDown);
app.use('/api/auth/telegram', bruteForce.prevent); // Brute force protection for login
app.use('/api/admin', adminRateLimit); // Strict rate limiting for admin
app.use('/api/upload', uploadRateLimit);
app.use('/api/api', apiRateLimit); // API-specific rate limiting

// Additional security for sensitive endpoints
app.use('/api/admin', adminIPWhitelist); // IP whitelist for admin routes
app.use('/api/security', adminIPWhitelist); // Protect security endpoints

// SECURITY: Content-Type validation middleware (CWE-20)
app.use((req, res, next) => {
  // Skip validation for GET, HEAD, OPTIONS, DELETE
  if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Skip for webhook endpoints that need raw body
  if (req.path.includes('/webhooks/')) {
    return next();
  }

  // Check Content-Type for POST, PUT, PATCH
  const contentType = req.get('Content-Type');

  if (!contentType) {
    logger.warn('Request without Content-Type header', {
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    return res.status(415).json({
      error: 'Unsupported Media Type',
      message: 'Content-Type header is required'
    });
  }

  // Allow only application/json and application/x-www-form-urlencoded
  const isValidContentType =
    contentType.includes('application/json') ||
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');

  if (!isValidContentType) {
    logger.warn('Invalid Content-Type header', {
      method: req.method,
      path: req.path,
      contentType,
      ip: req.ip
    });
    return res.status(415).json({
      error: 'Unsupported Media Type',
      message: 'Only application/json, application/x-www-form-urlencoded, and multipart/form-data are supported'
    });
  }

  next();
});

// Use raw body for CMS webhooks to verify signatures (guarded in quarantine)
app.use('/api/cms/webhooks/medusa', webhookQuarantineGuard, express.raw({ type: 'application/json', limit: '2mb' }));

// SECURITY: Limit payload size to prevent DoS attacks (CWE-400)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(cookieParser());

// SECURITY: CSRF Protection (CWE-352)
// Note: __Host- prefix requires HTTPS. Use regular name for development/HTTP
const isProduction = process.env.NODE_ENV === 'production';
const csrfProtection = doubleCsrf({
  getSecret: () => secretManager.getEncryptionSecrets().masterKey,
  getSessionIdentifier: (req) => {
    // Use user ID if authenticated, otherwise use session ID or IP
    const user = (req as AuthenticatedRequest).user;
    return user?.id || req.ip || 'anonymous';
  },
  cookieName: isProduction ? '__Host-csrf.token' : 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

const { doubleCsrfProtection } = csrfProtection;

// (Removed legacy CSRF token endpoint using double-csrf generateToken)

// Apply CSRF protection to state-changing routes
app.use('/api/*', (req, res, next) => {
  // Skip CSRF for specific paths
  // NOTE: Use originalUrl to get the full path including mount point
  const fullPath = req.originalUrl.split('?')[0]; // Remove query string
  const skipPaths = [
    '/api/health',
    '/api/csrf-token',
    '/api/webhooks',
    '/api/cms/webhooks',
    '/api/auth/telegram', // Telegram auth has its own verification
    '/api/auth/login/telegram', // Telegram login
    '/api/auth/login/email', // Email login
    '/api/auth/refresh-token', // Token refresh
    '/api/auth/auto-refresh', // Auto refresh
    '/api/auth/verify-token', // Token verification
  ];

  if (skipPaths.some(path => fullPath.startsWith(path))) {
    return next();
  }

  // Skip for read-only methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // TEMPORARY: Disable CSRF in development for debugging
  if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_CSRF === 'true') {
    logger.warn('⚠️ CSRF protection disabled in development mode');
    return next();
  }

  // Apply CSRF protection with detailed logging
  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      logger.error('CSRF validation failed - DETAILED DEBUG', {
        error: err.message,
        errorStack: err.stack,
        path: req.path,
        method: req.method,
        allHeaders: req.headers,
        allCookies: req.cookies,
        cookiesCsrf: {
          'csrf-token': req.cookies?.['csrf-token'],
          '__Host-csrf.token': req.cookies?.['__Host-csrf.token'],
          '_csrf': req.cookies?.['_csrf']
        },
        headersCsrf: {
          'x-csrf-token': req.get('x-csrf-token'),
          'X-CSRF-Token': req.get('X-CSRF-Token'),
          'csrf-token': req.get('csrf-token')
        },
        ip: req.ip,
        user: (req as any).user?.id
      });
    }
    next(err);
  });
});

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Vault health check
app.get('/health/vault', vaultHealthEndpoint);

// Prometheus metrics endpoint (public for Prometheus scraping)
app.get('/metrics', async (req, res) => {
  try {
    const prometheusModule = await import('./services/prometheusService.js') as any;
    const PrometheusService = prometheusModule.default;
    const prometheusService = PrometheusService.getInstance();
    const metrics = await prometheusService.getMetrics();
    res.set('Content-Type', prometheusService.registry.contentType);
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating Prometheus metrics:', error as Record<string, unknown>);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// JSON metrics endpoint (authenticated, for admin dashboard)
app.get('/api/metrics', authMiddleware, (req, res) => {
  const metrics = getMetrics();
  res.json(metrics);
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Telegram E-commerce Bot API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/telegram (POST)',
      stores: '/api/stores (GET)',
      products: '/api/products (GET)',
      orders: '/api/orders (GET)',
      admin: '/api/admin/dashboard (GET)',
      csrf: '/api/csrf-token (GET)'
    },
    health: '/health',
    timestamp: new Date().toISOString()
  });
});

// CSRF token endpoint
import { getCsrfTokenHandler } from './middleware/csrfProtection';
app.get('/api/csrf-token', getCsrfTokenHandler, (req, res) => {
  res.json({
    csrfToken: res.locals.csrfToken,
    message: 'CSRF token generated successfully'
  });
});

// Initialize backup service
BackupService.initialize().catch(error => {
  logger.error('Failed to initialize backup service:', { error: error instanceof Error ? error.message : String(error) });
});

// Health and monitoring routes (before other middlewares for public endpoints)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes); // Alternative path for API consistency

// Health and diagnostics (public)
app.use('/api/health', healthRoutes);

// Security routes (enhanced auth for sensitive operations)
app.use('/api/security', securityRoutes);

// API Routes with enhanced security and authentication
app.use('/api/auth', secureAuthRoutes); // New secure auth routes
app.use('/auth', secureAuthRoutes); // Legacy auth route for backward compatibility
// Keep old routes as fallback for any legacy endpoints
app.use('/api/auth/legacy', authRoutes);
app.use('/api/stores', enhancedAuthMiddleware, storeRoutes);
app.use('/api/products', enhancedAuthMiddleware, productRoutes);
app.use('/api/categories', enhancedAuthMiddleware, categoryRoutes);
app.use('/api/orders', enhancedAuthMiddleware, orderRoutes);
app.use('/api/admin', authMiddleware, adminRoutes); // Admin routes (temporarily using standard auth middleware)
// app.use('/api/admin/data', authMiddleware, adminDataRoutes); // Admin data management routes - TODO: import properly
// AdminJS is disabled
app.use('/api/bots', enhancedAuthMiddleware, botRoutes); // Bot management routes
app.use('/api/bulk', bulkRoutes); // Bulk routes have their own auth middleware
app.use('/api/notifications', notificationRoutes); // Notifications have their own auth middleware
app.use('/api/backup', enhancedAuthMiddleware, backupRoutes); // Enhanced auth for backup routes
app.use('/api/cms', cmsRoutes);
app.use('/api/integration', enhancedAuthMiddleware, integrationRoutes);
app.use('/api/config', enhancedAuthMiddleware, configRoutes); // Configuration endpoints
app.use('/api/employees', enhancedAuthMiddleware, employeeRoutes); // Employee management
app.use('/api/invitations', invitationRoutes); // Employee invitations (public + protected)
app.use('/api/invite-links', inviteLinkRoutes); // Invite links (public + protected)
app.use('/api/custom-roles', customRoleRoutes); // Custom roles management
app.use('/api/users', enhancedAuthMiddleware, userRoutes); // User management

// Additional security logging for admin actions
app.use('/api/admin/*', (req, res, next) => {
  const originalSend = res.send;
  res.send = function(data: string | object | Buffer) {
    logger.info('Admin action performed', {
      user: req.user?.id,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      timestamp: new Date().toISOString()
    });
    return originalSend.call(this, data);
  };
  next();
});

// 404 handling (must be after all routes but before error handler)
app.use(notFoundMiddleware);

// Error handling
app.use(errorHandler);

// Socket.IO connection handling
import { AuthenticatedSocket, socketAuthMiddleware } from './middleware/socketAuth.js';
import { SocketRoomService } from './services/socketRoomService.js';

// Apply authentication middleware
io.use(socketAuthMiddleware);

io.on('connection', async (socket: AuthenticatedSocket) => {
  const { sanitizeForLog } = require('./utils/sanitizer');
  logger.info(`New authenticated socket connection: ${sanitizeForLog(socket.id)} for user ${sanitizeForLog(socket.user?.id)} (${sanitizeForLog(socket.user?.role)})`);

  // Join user to appropriate rooms based on role and permissions
  await SocketRoomService.joinUserToRooms(socket);

  // Handle custom room joining requests
  socket.on('join_room', async (roomName: string) => {
    if (!socket.user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Validate room access based on user role and permissions
    const canJoin = await validateRoomAccess({ ...socket.user, role: socket.user.role as any }, roomName);
    if (canJoin) {
      socket.join(roomName);
      socket.emit('room_joined', { room: roomName });
      logger.info(`User ${socket.user.id} joined custom room: ${sanitizeForLog(roomName)}`);
    } else {
      socket.emit('error', { message: `Access denied to room: ${roomName}` });
      logger.warn(`User ${sanitizeForLog(socket.user.id)} denied access to room: ${sanitizeForLog(roomName)}`);
    }
  });

  // Handle leaving rooms
  socket.on('leave_room', (roomName: string) => {
    socket.leave(roomName);
    socket.emit('room_left', { room: roomName });
    logger.info(`User ${socket.user?.id} left room: ${sanitizeForLog(roomName)}`);
  });

  // Handle room info requests
  socket.on('get_room_info', async (roomName: string) => {
    if (!socket.user || !['OWNER', 'ADMIN'].includes(socket.user.role)) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    const roomInfo = await SocketRoomService.getRoomInfo(roomName);
    socket.emit('room_info', { room: roomName, ...roomInfo });
  });

  // Handle socket stats requests (admin only)
  socket.on('get_socket_stats', async () => {
    if (!socket.user || !['OWNER', 'ADMIN'].includes(socket.user.role)) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    const stats = await SocketRoomService.getSocketStats();
    socket.emit('socket_stats', stats);
  });

  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id} (${sanitizeForLog(reason)}) for user ${socket.user?.id}`);
    SocketRoomService.leaveUserFromRooms(socket);
  });

  socket.on('error', (error: unknown) => {
    logger.error(`Socket error for ${sanitizeForLog(socket.id)}:`, toLogMetadata(error));
  });
});

// Helper function to validate room access
async function validateRoomAccess(user: AuthenticatedRequest['user'], roomName: string): Promise<boolean> {
  try {
    // Basic room patterns
    if (!user) return false;
    if (roomName.startsWith('user_')) {
      const targetUserId = roomName.replace('user_', '');
      return targetUserId === user.id; // Users can only join their own room
    }

    if (roomName.startsWith('admin_')) {
      return ['OWNER', 'ADMIN'].includes(user.role);
    }

    if (roomName === 'admins') {
      return ['OWNER', 'ADMIN'].includes(user.role);
    }

    if (roomName === 'owners') {
      return user.role === 'OWNER';
    }

    if (roomName.startsWith('store_')) {
      const storeId = roomName.replace('store_', '');

      // OWNER has access to all stores
      if (user.role === 'OWNER') {
        return true;
      }

      // Check if user has access to this specific store
      const hasAccess = await prisma.store.findFirst({
        where: {
          id: storeId,
          OR: [
            { ownerId: user.id },
            { admins: { some: { userId: user.id } } },
            { vendors: { some: { userId: user.id } } }
          ]
        }
      });

      return !!hasAccess;
    }

    // Default deny for unknown room patterns
    return false;
  } catch (error: unknown) {
    logger.error('Error validating room access:', { error });
    return false;
  }
}

// Initialize services
const initializeServices = async () => {
  try {
    // Initialize Prometheus Service
    logger.info('📊 Initializing Prometheus Service...');
    const prometheusModule = await import('./services/prometheusService.js') as any;
    const PrometheusService = prometheusModule.default;
    const prometheusService = (PrometheusService as any).getInstance();
    prometheusService.startPeriodicCollection(10000); // Collect system metrics every 10 seconds
    logger.info('✅ Prometheus Service initialized successfully');

    // Initialize Bot Factory Service
    await botFactoryService.initialize();
    logger.info('✅ Bot Factory Service initialized successfully');
  } catch (error: unknown) {
    logger.error('❌ Failed to initialize services:', { error });
    // Don't exit - let the rest of the app start
  }
};

// Start server
const PORT = env.PORT || 3001;

server.listen(PORT, async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Admin panel: http://82.147.84.78:3000`);
  logger.info(`🔧 API: http://82.147.84.78:${PORT}/api`);

  // Initialize services after server starts
  try {
    await initializeServices();
    await compromiseResponseService.initialize();
    await honeytokenService.initialize();
    logger.info('✅ All services initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize some services:', { error: (error as Error).message, stack: (error as Error).stack });
    // Don't exit - let the server continue running even if some services fail
  }
});

// Export app for testing
export { app };

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await disconnectPrisma();
  process.exit(0);
});

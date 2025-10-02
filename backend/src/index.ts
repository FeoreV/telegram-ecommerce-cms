import express from 'express';
import dotenv from 'dotenv';
import { env } from './utils/env';
import { createServer } from 'http';
import { 
  securityMiddlewareBundle,
  authRateLimit,
  uploadRateLimit,
  apiRateLimit,
  adminRateLimit,
  bruteForce,
  adminIPWhitelist,
  getSecurityStatus
} from './middleware/security';
import { enhancedAuthMiddleware } from './middleware/jwtSecurity';
import { authMiddleware } from './middleware/auth';
import { loginSlowDown } from './auth';

import { prisma, disconnectPrisma } from './lib/prisma';
import { databaseService } from './lib/database';
// import { setupAdminJS } from './admin'; // DISABLED - AdminJS removed
import { initSocket } from './lib/socket';
import { BackupService } from './services/backupService';
import { botFactoryService } from './services/botFactoryService';
import authRoutes from './routes/auth';
import secureAuthRoutes from './auth/SecureAuthRoutes';
import storeRoutes from './routes/stores';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';
import cmsRoutes from './routes/cms';
import integrationRoutes from './routes/integration';
import bulkRoutes from './routes/bulk';
import notificationRoutes from './routes/notifications';
import backupRoutes from './routes/backup';
import healthRoutes from './routes/health';
import securityRoutes from './routes/security';
import configRoutes from './routes/config';
import botRoutes from './routes/bots';
import categoryRoutes from './routes/categories';
import employeeRoutes from './routes/employeeRoutes';
import invitationRoutes from './routes/invitationRoutes';
import inviteLinkRoutes from './routes/inviteLinkRoutes';
import customRoleRoutes from './routes/customRoleRoutes';
import userRoutes from './routes/users';
import { errorHandler } from './middleware/errorHandler';
import { notFoundMiddleware } from './middleware/notFoundHandler';
import { logger, toLogMetadata } from './utils/loggerEnhanced';
import EnvValidator from './utils/envValidator';
import { httpLogger, requestIdLogger } from './middleware/httpLogger';
import { metricsMiddleware, getMetrics } from './middleware/metrics';
import { performanceTracker } from './middleware/performanceTracker';
import { secretManager } from './utils/SecretManager';
import { vaultHealthMiddleware, vaultHealthEndpoint } from './middleware/vaultHealthCheck';
import { compromiseGuard } from './middleware/compromiseGuard';
import { compromiseResponseService } from './services/CompromiseResponseService';
import { exfiltrationTrap } from './middleware/exfiltrationTrap';
import { honeytokenService } from './services/HoneytokenService';
import { webhookQuarantineGuard } from './middleware/webhookQuarantineGuard';
import { responseDLP } from './middleware/responseDLP';
import { AuthenticatedRequest } from './auth/SecureAuthSystem';

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
  process.exit(1);
}

// Print environment summary
EnvValidator.printEnvironmentSummary();

// Create Express app
const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = initSocket(server, env.FRONTEND_URL || "http://localhost:3000");

// Enhanced security middleware bundle
app.use(securityMiddlewareBundle);
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
    const status = getSecurityStatus();
    res.json({
      security: status,
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
// Use raw body for CMS webhooks to verify signatures (guarded in quarantine)
app.use('/api/cms/webhooks/medusa', webhookQuarantineGuard, express.raw({ type: 'application/json', limit: '2mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
    const PrometheusService = (await import('./services/prometheusService')).default;
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
      admin: '/api/admin/dashboard (GET)'
    },
    health: '/health',
    timestamp: new Date().toISOString()
  });
});

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

// Initialize backup service
BackupService.initialize().catch(error => {
  logger.error('Failed to initialize backup service:', error);
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
import { socketAuthMiddleware, AuthenticatedSocket } from './middleware/socketAuth.js';
import { SocketRoomService } from './services/socketRoomService.js';

// Apply authentication middleware
io.use(socketAuthMiddleware);

io.on('connection', async (socket: AuthenticatedSocket) => {
  logger.info(`New authenticated socket connection: ${socket.id} for user ${socket.user?.id} (${socket.user?.role})`);
  
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
      logger.info(`User ${socket.user.id} joined custom room: ${roomName}`);
    } else {
      socket.emit('error', { message: `Access denied to room: ${roomName}` });
      logger.warn(`User ${socket.user.id} denied access to room: ${roomName}`);
    }
  });

  // Handle leaving rooms
  socket.on('leave_room', (roomName: string) => {
    socket.leave(roomName);
    socket.emit('room_left', { room: roomName });
    logger.info(`User ${socket.user?.id} left room: ${roomName}`);
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
    logger.info(`Socket disconnected: ${socket.id} (${reason}) for user ${socket.user?.id}`);
    SocketRoomService.leaveUserFromRooms(socket);
  });

  socket.on('error', (error: unknown) => {
    logger.error(`Socket error for ${socket.id}:`, toLogMetadata(error));
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
    const PrometheusService = (await import('./services/prometheusService')).default;
    const prometheusService = PrometheusService.getInstance();
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
  logger.info(`📊 Admin panel: http://localhost:3000`);
  logger.info(`🔧 API: http://localhost:${PORT}/api`);
  
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

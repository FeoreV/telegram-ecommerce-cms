"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const env_1 = require("./utils/env");
const http_1 = require("http");
const security_1 = require("./middleware/security");
const jwtSecurity_1 = require("./middleware/jwtSecurity");
const auth_1 = require("./middleware/auth");
const auth_2 = require("./auth");
const prisma_1 = require("./lib/prisma");
const database_1 = require("./lib/database");
const socket_1 = require("./lib/socket");
const backupService_1 = require("./services/backupService");
const botFactoryService_1 = require("./services/botFactoryService");
const auth_3 = __importDefault(require("./routes/auth"));
const SecureAuthRoutes_1 = __importDefault(require("./auth/SecureAuthRoutes"));
const stores_1 = __importDefault(require("./routes/stores"));
const products_1 = __importDefault(require("./routes/products"));
const orders_1 = __importDefault(require("./routes/orders"));
const admin_1 = __importDefault(require("./routes/admin"));
const cms_1 = __importDefault(require("./routes/cms"));
const integration_1 = __importDefault(require("./routes/integration"));
const bulk_1 = __importDefault(require("./routes/bulk"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const backup_1 = __importDefault(require("./routes/backup"));
const health_1 = __importDefault(require("./routes/health"));
const security_2 = __importDefault(require("./routes/security"));
const config_1 = __importDefault(require("./routes/config"));
const bots_1 = __importDefault(require("./routes/bots"));
const categories_1 = __importDefault(require("./routes/categories"));
const employeeRoutes_1 = __importDefault(require("./routes/employeeRoutes"));
const invitationRoutes_1 = __importDefault(require("./routes/invitationRoutes"));
const inviteLinkRoutes_1 = __importDefault(require("./routes/inviteLinkRoutes"));
const customRoleRoutes_1 = __importDefault(require("./routes/customRoleRoutes"));
const users_1 = __importDefault(require("./routes/users"));
const errorHandler_1 = require("./middleware/errorHandler");
const notFoundHandler_1 = require("./middleware/notFoundHandler");
const loggerEnhanced_1 = require("./utils/loggerEnhanced");
const envValidator_1 = __importDefault(require("./utils/envValidator"));
const httpLogger_1 = require("./middleware/httpLogger");
const metrics_1 = require("./middleware/metrics");
const performanceTracker_1 = require("./middleware/performanceTracker");
const SecretManager_1 = require("./utils/SecretManager");
const vaultHealthCheck_1 = require("./middleware/vaultHealthCheck");
const compromiseGuard_1 = require("./middleware/compromiseGuard");
const CompromiseResponseService_1 = require("./services/CompromiseResponseService");
const exfiltrationTrap_1 = require("./middleware/exfiltrationTrap");
const HoneytokenService_1 = require("./services/HoneytokenService");
const webhookQuarantineGuard_1 = require("./middleware/webhookQuarantineGuard");
const responseDLP_1 = require("./middleware/responseDLP");
dotenv_1.default.config();
const initializeSecrets = async () => {
    try {
        await SecretManager_1.secretManager.initialize();
        loggerEnhanced_1.logger.info('✅ Secret manager initialized successfully');
    }
    catch (error) {
        loggerEnhanced_1.logger.error('❌ Failed to initialize secret manager:', { error: error.message });
        process.exit(1);
    }
};
const initializeDatabase = async () => {
    try {
        await database_1.databaseService.initialize();
        loggerEnhanced_1.logger.info('✅ Database service initialized successfully');
    }
    catch (error) {
        loggerEnhanced_1.logger.error('❌ Failed to initialize database service:', { error: error.message });
        process.exit(1);
    }
};
const initializeCriticalServices = async () => {
    await initializeSecrets();
    await initializeDatabase();
};
const envValidation = envValidator_1.default.validate();
if (!envValidation.isValid) {
    console.error('Environment validation failed. Exiting...');
    process.exit(1);
}
envValidator_1.default.printEnvironmentSummary();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = (0, socket_1.initSocket)(server, env_1.env.FRONTEND_URL || "http://localhost:3000");
app.use(security_1.securityMiddlewareBundle);
app.use(compromiseGuard_1.compromiseGuard);
app.use(exfiltrationTrap_1.exfiltrationTrap);
app.use(responseDLP_1.responseDLP);
app.use(httpLogger_1.requestIdLogger);
app.use(httpLogger_1.httpLogger);
app.use(performanceTracker_1.performanceTracker);
app.use(metrics_1.metricsMiddleware);
app.use(vaultHealthCheck_1.vaultHealthMiddleware);
app.get('/api/security/status', auth_1.authMiddleware, (req, res) => {
    try {
        const status = (0, security_1.getSecurityStatus)();
        res.json({
            security: status,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        loggerEnhanced_1.logger.error('Error getting security status:', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.use('/api/auth', security_1.authRateLimit);
app.post('/api/auth/login/email', auth_2.loginSlowDown);
app.post('/api/auth/login/telegram', auth_2.loginSlowDown);
app.use('/api/auth/telegram', security_1.bruteForce.prevent);
app.use('/api/admin', security_1.adminRateLimit);
app.use('/api/upload', security_1.uploadRateLimit);
app.use('/api/api', security_1.apiRateLimit);
app.use('/api/admin', security_1.adminIPWhitelist);
app.use('/api/security', security_1.adminIPWhitelist);
app.use('/api/cms/webhooks/medusa', webhookQuarantineGuard_1.webhookQuarantineGuard, express_1.default.raw({ type: 'application/json', limit: '2mb' }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/uploads', express_1.default.static('uploads'));
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/health/vault', vaultHealthCheck_1.vaultHealthEndpoint);
app.get('/metrics', async (req, res) => {
    try {
        const PrometheusService = (await Promise.resolve().then(() => __importStar(require('./services/prometheusService')))).default;
        const prometheusService = PrometheusService.getInstance();
        const metrics = await prometheusService.getMetrics();
        res.set('Content-Type', prometheusService.registry.contentType);
        res.send(metrics);
    }
    catch (error) {
        loggerEnhanced_1.logger.error('Error generating Prometheus metrics:', error);
        res.status(500).json({ error: 'Failed to generate metrics' });
    }
});
app.get('/api/metrics', auth_1.authMiddleware, (req, res) => {
    const metrics = (0, metrics_1.getMetrics)();
    res.json(metrics);
});
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
const initializeAdminJS = async () => {
    loggerEnhanced_1.logger.info('⚠️ AdminJS completely disabled - no setup required');
};
(async () => {
    try {
        await initializeCriticalServices();
        loggerEnhanced_1.logger.info('✅ Critical services initialized successfully');
        await initializeAdminJS();
        loggerEnhanced_1.logger.info('✅ Application initialization completed');
    }
    catch (error) {
        loggerEnhanced_1.logger.error('❌ Failed to initialize application services:', error);
        process.exit(1);
    }
})();
backupService_1.BackupService.initialize().catch(error => {
    loggerEnhanced_1.logger.error('Failed to initialize backup service:', error);
});
app.use('/health', health_1.default);
app.use('/api/health', health_1.default);
app.use('/api/health', health_1.default);
app.use('/api/security', security_2.default);
app.use('/api/auth', SecureAuthRoutes_1.default);
app.use('/auth', SecureAuthRoutes_1.default);
app.use('/api/auth/legacy', auth_3.default);
app.use('/api/stores', jwtSecurity_1.enhancedAuthMiddleware, stores_1.default);
app.use('/api/products', jwtSecurity_1.enhancedAuthMiddleware, products_1.default);
app.use('/api/categories', jwtSecurity_1.enhancedAuthMiddleware, categories_1.default);
app.use('/api/orders', jwtSecurity_1.enhancedAuthMiddleware, orders_1.default);
app.use('/api/admin', auth_1.authMiddleware, admin_1.default);
app.use('/api/bots', jwtSecurity_1.enhancedAuthMiddleware, bots_1.default);
app.use('/api/bulk', bulk_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/backup', jwtSecurity_1.enhancedAuthMiddleware, backup_1.default);
app.use('/api/cms', cms_1.default);
app.use('/api/integration', jwtSecurity_1.enhancedAuthMiddleware, integration_1.default);
app.use('/api/config', jwtSecurity_1.enhancedAuthMiddleware, config_1.default);
app.use('/api/employees', jwtSecurity_1.enhancedAuthMiddleware, employeeRoutes_1.default);
app.use('/api/invitations', invitationRoutes_1.default);
app.use('/api/invite-links', inviteLinkRoutes_1.default);
app.use('/api/custom-roles', customRoleRoutes_1.default);
app.use('/api/users', jwtSecurity_1.enhancedAuthMiddleware, users_1.default);
app.use('/api/admin/*', (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
        loggerEnhanced_1.logger.info('Admin action performed', {
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
app.use(notFoundHandler_1.notFoundMiddleware);
app.use(errorHandler_1.errorHandler);
const socketAuth_js_1 = require("./middleware/socketAuth.js");
const socketRoomService_js_1 = require("./services/socketRoomService.js");
io.use(socketAuth_js_1.socketAuthMiddleware);
io.on('connection', async (socket) => {
    loggerEnhanced_1.logger.info(`New authenticated socket connection: ${socket.id} for user ${socket.user?.id} (${socket.user?.role})`);
    await socketRoomService_js_1.SocketRoomService.joinUserToRooms(socket);
    socket.on('join_room', async (roomName) => {
        if (!socket.user) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        const canJoin = await validateRoomAccess({ ...socket.user, role: socket.user.role }, roomName);
        if (canJoin) {
            socket.join(roomName);
            socket.emit('room_joined', { room: roomName });
            loggerEnhanced_1.logger.info(`User ${socket.user.id} joined custom room: ${roomName}`);
        }
        else {
            socket.emit('error', { message: `Access denied to room: ${roomName}` });
            loggerEnhanced_1.logger.warn(`User ${socket.user.id} denied access to room: ${roomName}`);
        }
    });
    socket.on('leave_room', (roomName) => {
        socket.leave(roomName);
        socket.emit('room_left', { room: roomName });
        loggerEnhanced_1.logger.info(`User ${socket.user?.id} left room: ${roomName}`);
    });
    socket.on('get_room_info', async (roomName) => {
        if (!socket.user || !['OWNER', 'ADMIN'].includes(socket.user.role)) {
            socket.emit('error', { message: 'Access denied' });
            return;
        }
        const roomInfo = await socketRoomService_js_1.SocketRoomService.getRoomInfo(roomName);
        socket.emit('room_info', { room: roomName, ...roomInfo });
    });
    socket.on('get_socket_stats', async () => {
        if (!socket.user || !['OWNER', 'ADMIN'].includes(socket.user.role)) {
            socket.emit('error', { message: 'Access denied' });
            return;
        }
        const stats = await socketRoomService_js_1.SocketRoomService.getSocketStats();
        socket.emit('socket_stats', stats);
    });
    socket.on('disconnect', (reason) => {
        loggerEnhanced_1.logger.info(`Socket disconnected: ${socket.id} (${reason}) for user ${socket.user?.id}`);
        socketRoomService_js_1.SocketRoomService.leaveUserFromRooms(socket);
    });
    socket.on('error', (error) => {
        loggerEnhanced_1.logger.error(`Socket error for ${socket.id}:`, (0, loggerEnhanced_1.toLogMetadata)(error));
    });
});
async function validateRoomAccess(user, roomName) {
    try {
        if (!user)
            return false;
        if (roomName.startsWith('user_')) {
            const targetUserId = roomName.replace('user_', '');
            return targetUserId === user.id;
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
            if (user.role === 'OWNER') {
                return true;
            }
            const hasAccess = await prisma_1.prisma.store.findFirst({
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
        return false;
    }
    catch (error) {
        loggerEnhanced_1.logger.error('Error validating room access:', { error });
        return false;
    }
}
const initializeServices = async () => {
    try {
        loggerEnhanced_1.logger.info('📊 Initializing Prometheus Service...');
        const PrometheusService = (await Promise.resolve().then(() => __importStar(require('./services/prometheusService')))).default;
        const prometheusService = PrometheusService.getInstance();
        prometheusService.startPeriodicCollection(10000);
        loggerEnhanced_1.logger.info('✅ Prometheus Service initialized successfully');
        await botFactoryService_1.botFactoryService.initialize();
        loggerEnhanced_1.logger.info('✅ Bot Factory Service initialized successfully');
    }
    catch (error) {
        loggerEnhanced_1.logger.error('❌ Failed to initialize services:', { error });
    }
};
const PORT = env_1.env.PORT || 3001;
server.listen(PORT, async () => {
    loggerEnhanced_1.logger.info(`🚀 Server running on port ${PORT}`);
    loggerEnhanced_1.logger.info(`📊 Admin panel: http://localhost:3000`);
    loggerEnhanced_1.logger.info(`🔧 API: http://localhost:${PORT}/api`);
    try {
        await initializeServices();
        await CompromiseResponseService_1.compromiseResponseService.initialize();
        await HoneytokenService_1.honeytokenService.initialize();
        loggerEnhanced_1.logger.info('✅ All services initialized successfully');
    }
    catch (error) {
        loggerEnhanced_1.logger.error('❌ Failed to initialize some services:', { error: error.message, stack: error.stack });
    }
});
process.on('SIGTERM', async () => {
    loggerEnhanced_1.logger.info('SIGTERM received, shutting down gracefully');
    await (0, prisma_1.disconnectPrisma)();
    process.exit(0);
});
process.on('SIGINT', async () => {
    loggerEnhanced_1.logger.info('SIGINT received, shutting down gracefully');
    await (0, prisma_1.disconnectPrisma)();
    process.exit(0);
});
//# sourceMappingURL=index.js.map
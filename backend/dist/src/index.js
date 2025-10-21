"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const csrf_csrf_1 = require("csrf-csrf");
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const auth_1 = require("./auth");
const auth_2 = require("./middleware/auth");
const jwtSecurity_1 = require("./middleware/jwtSecurity");
const security_1 = require("./middleware/security");
const env_1 = require("./utils/env");
const database_1 = require("./lib/database");
const prisma_1 = require("./lib/prisma");
const SecureAuthRoutes_1 = __importDefault(require("./auth/SecureAuthRoutes"));
const socket_1 = require("./lib/socket");
const compromiseGuard_1 = require("./middleware/compromiseGuard");
const contentTypeValidation_1 = require("./middleware/contentTypeValidation");
const errorHandler_1 = require("./middleware/errorHandler");
const exfiltrationTrap_1 = require("./middleware/exfiltrationTrap");
const httpLogger_1 = require("./middleware/httpLogger");
const metrics_1 = require("./middleware/metrics");
const notFoundHandler_1 = require("./middleware/notFoundHandler");
const performanceTracker_1 = require("./middleware/performanceTracker");
const responseDLP_1 = require("./middleware/responseDLP");
const vaultHealthCheck_1 = require("./middleware/vaultHealthCheck");
const webhookQuarantineGuard_1 = require("./middleware/webhookQuarantineGuard");
const admin_1 = __importDefault(require("./routes/admin"));
const auth_3 = __importDefault(require("./routes/auth"));
const backup_1 = __importDefault(require("./routes/backup"));
const bots_1 = __importDefault(require("./routes/bots"));
const bulk_1 = __importDefault(require("./routes/bulk"));
const categories_1 = __importDefault(require("./routes/categories"));
const cms_1 = __importDefault(require("./routes/cms"));
const config_1 = __importDefault(require("./routes/config"));
const customRoleRoutes_1 = __importDefault(require("./routes/customRoleRoutes"));
const employeeRoutes_1 = __importDefault(require("./routes/employeeRoutes"));
const health_1 = __importDefault(require("./routes/health"));
const integration_1 = __importDefault(require("./routes/integration"));
const invitationRoutes_1 = __importDefault(require("./routes/invitationRoutes"));
const inviteLinkRoutes_1 = __importDefault(require("./routes/inviteLinkRoutes"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const orders_1 = __importDefault(require("./routes/orders"));
const products_1 = __importDefault(require("./routes/products"));
const security_2 = __importDefault(require("./routes/security"));
const stores_1 = __importDefault(require("./routes/stores"));
const users_1 = __importDefault(require("./routes/users"));
const backupService_1 = require("./services/backupService");
const botFactoryService_1 = require("./services/botFactoryService");
const CompromiseResponseService_1 = require("./services/CompromiseResponseService");
const HoneytokenService_1 = require("./services/HoneytokenService");
const envValidator_1 = __importDefault(require("./utils/envValidator"));
const loggerEnhanced_1 = require("./utils/loggerEnhanced");
const SecretManager_1 = require("./utils/SecretManager");
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
    console.error('Errors:', envValidation.errors);
    console.error('Warnings:', envValidation.warnings);
    process.exit(1);
}
envValidator_1.default.printEnvironmentSummary();
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
const io = (0, socket_1.initSocket)(server, env_1.env.FRONTEND_URL || "http://82.147.84.78:3000");
app.use(security_1.securityMiddlewareBundle);
app.use(contentTypeValidation_1.validateContentType);
app.use(compromiseGuard_1.compromiseGuard);
app.use(exfiltrationTrap_1.exfiltrationTrap);
app.use(responseDLP_1.responseDLP);
app.use(httpLogger_1.requestIdLogger);
app.use(httpLogger_1.httpLogger);
app.use(performanceTracker_1.performanceTracker);
app.use(metrics_1.metricsMiddleware);
app.use(vaultHealthCheck_1.vaultHealthMiddleware);
app.get('/api/security/status', auth_2.authMiddleware, (req, res) => {
    try {
        res.json({
            security: {
                status: 'active',
                features: ['rate-limiting', 'csrf-protection', 'helmet', 'sanitization']
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        loggerEnhanced_1.logger.error('Error getting security status:', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.use('/api/auth', security_1.authRateLimit);
app.post('/api/auth/login/email', auth_1.loginSlowDown);
app.post('/api/auth/login/telegram', auth_1.loginSlowDown);
app.use('/api/auth/telegram', security_1.bruteForce.prevent);
app.use('/api/admin', security_1.adminRateLimit);
app.use('/api/upload', security_1.uploadRateLimit);
app.use('/api/api', security_1.apiRateLimit);
app.use('/api/admin', security_1.adminIPWhitelist);
app.use('/api/security', security_1.adminIPWhitelist);
app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method)) {
        return next();
    }
    if (req.path.includes('/webhooks/')) {
        return next();
    }
    const contentType = req.get('Content-Type');
    if (!contentType) {
        loggerEnhanced_1.logger.warn('Request without Content-Type header', {
            method: req.method,
            path: req.path,
            ip: req.ip
        });
        return res.status(415).json({
            error: 'Unsupported Media Type',
            message: 'Content-Type header is required'
        });
    }
    const isValidContentType = contentType.includes('application/json') ||
        contentType.includes('application/x-www-form-urlencoded') ||
        contentType.includes('multipart/form-data');
    if (!isValidContentType) {
        loggerEnhanced_1.logger.warn('Invalid Content-Type header', {
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
app.use('/api/cms/webhooks/medusa', webhookQuarantineGuard_1.webhookQuarantineGuard, express_1.default.raw({ type: 'application/json', limit: '2mb' }));
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ limit: '1mb', extended: true }));
app.use((0, cookie_parser_1.default)());
const isProduction = process.env.NODE_ENV === 'production';
const csrfProtection = (0, csrf_csrf_1.doubleCsrf)({
    getSecret: () => SecretManager_1.secretManager.getEncryptionSecrets().masterKey,
    getSessionIdentifier: (req) => {
        const user = req.user;
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
app.use('/api/*', (req, res, next) => {
    const fullPath = req.originalUrl.split('?')[0];
    const skipPaths = [
        '/api/health',
        '/api/csrf-token',
        '/api/webhooks',
        '/api/cms/webhooks',
        '/api/auth/telegram',
        '/api/auth/login/telegram',
        '/api/auth/login/email',
        '/api/auth/refresh-token',
        '/api/auth/auto-refresh',
        '/api/auth/verify-token',
    ];
    if (skipPaths.some(path => fullPath.startsWith(path))) {
        return next();
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_CSRF === 'true') {
        loggerEnhanced_1.logger.warn('⚠️ CSRF protection disabled in development mode');
        return next();
    }
    doubleCsrfProtection(req, res, (err) => {
        if (err) {
            loggerEnhanced_1.logger.error('CSRF validation failed - DETAILED DEBUG', {
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
                user: req.user?.id
            });
        }
        next(err);
    });
});
app.use('/uploads', express_1.default.static('uploads'));
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/health/vault', vaultHealthCheck_1.vaultHealthEndpoint);
app.get('/metrics', async (req, res) => {
    try {
        const prometheusModule = await import('./services/prometheusService.js');
        const PrometheusService = prometheusModule.default;
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
app.get('/api/metrics', auth_2.authMiddleware, (req, res) => {
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
            admin: '/api/admin/dashboard (GET)',
            csrf: '/api/csrf-token (GET)'
        },
        health: '/health',
        timestamp: new Date().toISOString()
    });
});
const csrfProtection_1 = require("./middleware/csrfProtection");
app.get('/api/csrf-token', csrfProtection_1.getCsrfTokenHandler, (req, res) => {
    res.json({
        csrfToken: res.locals.csrfToken,
        message: 'CSRF token generated successfully'
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
    loggerEnhanced_1.logger.error('Failed to initialize backup service:', { error: error instanceof Error ? error.message : String(error) });
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
app.use('/api/admin', auth_2.authMiddleware, admin_1.default);
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
    const { sanitizeForLog } = require('./utils/sanitizer');
    loggerEnhanced_1.logger.info(`New authenticated socket connection: ${sanitizeForLog(socket.id)} for user ${sanitizeForLog(socket.user?.id)} (${sanitizeForLog(socket.user?.role)})`);
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
            loggerEnhanced_1.logger.info(`User ${socket.user.id} joined custom room: ${sanitizeForLog(roomName)}`);
        }
        else {
            socket.emit('error', { message: `Access denied to room: ${roomName}` });
            loggerEnhanced_1.logger.warn(`User ${sanitizeForLog(socket.user.id)} denied access to room: ${sanitizeForLog(roomName)}`);
        }
    });
    socket.on('leave_room', (roomName) => {
        socket.leave(roomName);
        socket.emit('room_left', { room: roomName });
        loggerEnhanced_1.logger.info(`User ${socket.user?.id} left room: ${sanitizeForLog(roomName)}`);
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
        loggerEnhanced_1.logger.info(`Socket disconnected: ${socket.id} (${sanitizeForLog(reason)}) for user ${socket.user?.id}`);
        socketRoomService_js_1.SocketRoomService.leaveUserFromRooms(socket);
    });
    socket.on('error', (error) => {
        loggerEnhanced_1.logger.error(`Socket error for ${sanitizeForLog(socket.id)}:`, (0, loggerEnhanced_1.toLogMetadata)(error));
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
        const prometheusModule = await import('./services/prometheusService.js');
        const PrometheusService = prometheusModule.default;
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
    loggerEnhanced_1.logger.info(`📊 Admin panel: http://82.147.84.78:3000`);
    loggerEnhanced_1.logger.info(`🔧 API: http://82.147.84.78:${PORT}/api`);
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
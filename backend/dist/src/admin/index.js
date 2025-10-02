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
exports.setupAdminJS = void 0;
const adminjs_1 = __importDefault(require("adminjs"));
const express_1 = __importDefault(require("@adminjs/express"));
const prisma_1 = require("@adminjs/prisma");
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const jwt_1 = require("../utils/jwt");
const auditLog_1 = require("../middleware/auditLog");
const notificationService_1 = require("../services/notificationService");
adminjs_1.default.registerAdapter({ Database: prisma_1.Database, Resource: prisma_1.Resource });
const prisma = new client_1.PrismaClient();
let adminJsInstance;
let adapterRegistered = false;
const authenticate = async (email, password) => {
    try {
        logger_1.logger.info(`Admin login attempt for: ${email}`);
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { telegramId: email },
                ],
                role: { in: ['OWNER', 'ADMIN'] },
                isActive: true,
            },
        });
        if (!user) {
            logger_1.logger.warn(`Admin login failed - user not found: ${email}`);
            return null;
        }
        if (!user.email) {
            logger_1.logger.warn(`Admin login failed - telegram-only user attempted AdminJS access: ${user.telegramId}`);
            return null;
        }
        const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe123!';
        let isValidAuth = false;
        if (password.startsWith('eyJ')) {
            try {
                const decoded = (0, jwt_1.verifyToken)(password);
                if (decoded.userId === user.id && ['OWNER', 'ADMIN'].includes(decoded.role)) {
                    isValidAuth = true;
                    logger_1.logger.info(`Admin login via JWT token for user: ${user.id}`);
                }
            }
            catch (err) {
                logger_1.logger.warn('Invalid JWT token provided for admin login:', err);
            }
        }
        if (!isValidAuth && password === ADMIN_DEFAULT_PASSWORD) {
            isValidAuth = true;
            logger_1.logger.info(`Admin login via default password for user: ${user.id}`);
        }
        if (!isValidAuth) {
            logger_1.logger.warn(`Admin login failed - invalid credentials for: ${email}`);
            return null;
        }
        logger_1.logger.info(`Admin login successful for user: ${user.id} (${user.role})`);
        setImmediate(() => {
            auditLog_1.AuditLogService.log(user.id, {
                action: auditLog_1.AuditAction.ADMIN_LOGIN,
                details: {
                    platform: 'AdminJS',
                    email: user.email,
                    role: user.role,
                    timestamp: new Date().toISOString(),
                }
            });
        });
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
        };
    }
    catch (error) {
        logger_1.logger.error('Authentication error:', error);
        return null;
    }
};
const setupAdminJS = async (app) => {
    try {
        logger_1.logger.info('🚀 STARTING AdminJS setup function...');
        logger_1.logger.info('🔧 Environment ENABLE_ADMINJS:', { value: process.env.ENABLE_ADMINJS });
        if (!adapterRegistered) {
            try {
                if (!prisma_1.Database || !prisma_1.Resource) {
                    throw new Error('AdminJS Prisma adapter components not found after direct import');
                }
                adapterRegistered = true;
                logger_1.logger.info('✅ Prisma adapter registered successfully');
            }
            catch (adapterError) {
                logger_1.logger.error('❌ Failed to register AdminJS Prisma adapter:', adapterError);
                logger_1.logger.info('🔄 Continuing without Prisma adapter - using manual resource management');
                adapterRegistered = true;
            }
        }
        try {
            const modelNames = ['User', 'Store', 'Product', 'Order', 'Category', 'StoreAdmin', 'OrderItem', 'Notification'];
            logger_1.logger.info('📋 Available Prisma models in runtime data model:', { models: modelNames });
        }
        catch (prismaError) {
            logger_1.logger.warn('Could not access Prisma model information:', prismaError);
        }
        logger_1.logger.info('🧪 Trying minimal AdminJS configuration first...');
        try {
            adminJsInstance = new adminjs_1.default({
                branding: {
                    companyName: 'Telegram E-commerce Admin',
                    logo: false,
                    theme: {
                        colors: {
                            primary100: '#3b82f6',
                            primary80: '#3b82f6',
                            primary60: '#3b82f6',
                            primary40: '#3b82f6',
                            primary20: '#dbeafe',
                        },
                    },
                },
                rootPath: '/admin',
                locale: {
                    language: 'ru',
                    availableLanguages: ['ru', 'en'],
                },
                pages: {
                    dashboard: {
                        handler: async (request, response, context) => {
                            try {
                                const stats = {
                                    users: await prisma.user.count(),
                                    stores: await prisma.store.count(),
                                    products: await prisma.product.count(),
                                    orders: await prisma.order.count(),
                                    categories: await prisma.category.count(),
                                };
                                if (context.currentAdmin && stats.orders > 0) {
                                    notificationService_1.NotificationService.getInstance().send({
                                        type: notificationService_1.NotificationType.ADMIN_LOGIN,
                                        title: 'Admin Dashboard Accessed',
                                        message: `Admin ${context.currentAdmin.email} accessed the dashboard. Total orders: ${stats.orders}`,
                                        priority: notificationService_1.NotificationPriority.LOW,
                                        channels: [notificationService_1.NotificationChannel.SOCKET],
                                        recipients: [context.currentAdmin.id],
                                        data: { adminId: context.currentAdmin.id, email: context.currentAdmin.email }
                                    });
                                }
                                return {
                                    ...context,
                                    stats,
                                    message: 'Добро пожаловать в админ-панель!'
                                };
                            }
                            catch (pageError) {
                                return {
                                    ...context,
                                    error: 'Ошибка загрузки данных',
                                    message: 'Админ-панель запущена в ограниченном режиме',
                                    details: pageError
                                };
                            }
                        },
                        component: 'dashboard'
                    },
                    users: {
                        handler: async (request, response, context) => {
                            try {
                                const users = await prisma.user.findMany({
                                    take: 50,
                                    orderBy: { createdAt: 'desc' },
                                    select: {
                                        id: true,
                                        telegramId: true,
                                        username: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        role: true,
                                        isActive: true,
                                        createdAt: true
                                    }
                                });
                                return {
                                    ...context,
                                    users,
                                    totalUsers: await prisma.user.count()
                                };
                            }
                            catch (pageError) {
                                return {
                                    ...context,
                                    error: 'Ошибка загрузки пользователей',
                                    details: pageError
                                };
                            }
                        },
                        component: 'users'
                    },
                    stores: {
                        handler: async (request, response, context) => {
                            try {
                                const stores = await prisma.store.findMany({
                                    take: 50,
                                    orderBy: { createdAt: 'desc' },
                                    select: {
                                        id: true,
                                        name: true,
                                        slug: true,
                                        status: true,
                                        currency: true,
                                        botStatus: true,
                                        createdAt: true
                                    }
                                });
                                return {
                                    ...context,
                                    stores,
                                    totalStores: await prisma.store.count()
                                };
                            }
                            catch (pageError) {
                                return {
                                    ...context,
                                    error: 'Ошибка загрузки магазинов',
                                    details: pageError
                                };
                            }
                        },
                        component: 'stores'
                    },
                    monitoring: {
                        handler: async (request, response, context) => {
                            try {
                                const PrometheusService = (await Promise.resolve().then(() => __importStar(require('../services/prometheusService')))).default;
                                const prometheusService = PrometheusService.getInstance();
                                const metricsJSON = await prometheusService.getMetricsJSON();
                                return {
                                    ...context,
                                    metrics: metricsJSON,
                                    message: 'Мониторинг системы'
                                };
                            }
                            catch (pageError) {
                                return {
                                    ...context,
                                    error: 'Ошибка загрузки метрик',
                                    details: pageError
                                };
                            }
                        },
                        component: 'monitoring'
                    }
                },
                dashboard: {
                    handler: async () => {
                        try {
                            const stats = {
                                users: await prisma.user.count(),
                                stores: await prisma.store.count(),
                                products: await prisma.product.count(),
                                orders: await prisma.order.count(),
                                categories: await prisma.category.count(),
                            };
                            return {
                                message: '🎯 Telegram E-commerce Admin Dashboard',
                                stats,
                                timestamp: new Date().toISOString()
                            };
                        }
                        catch (err) {
                            logger_1.logger.error('Dashboard error:', err);
                            return {
                                message: 'Админ-панель загружена',
                                error: 'Ошибка загрузки статистики',
                                details: err
                            };
                        }
                    },
                },
            });
            logger_1.logger.info('✅ Minimal AdminJS created successfully, now adding resources...');
            logger_1.logger.info('✅ AdminJS minimal configuration completed successfully');
        }
        catch (adminInitError) {
            logger_1.logger.error('❌ AdminJS initialization failed while creating minimal instance:', {
                error: adminInitError instanceof Error ? adminInitError.message : String(adminInitError),
                stack: adminInitError instanceof Error ? adminInitError.stack : undefined,
            });
            throw adminInitError;
        }
        const adminRouter = express_1.default.buildAuthenticatedRouter(adminJsInstance, {
            authenticate,
            cookieName: 'telegram-ecommerce-admin-session',
            cookiePassword: process.env.ADMIN_COOKIE_SECRET || 'default-insecure-secret-change-in-production',
        }, null, {
            secret: process.env.ADMIN_SESSION_SECRET || 'default-insecure-session-secret-change-in-production',
            saveUninitialized: false,
            resave: false,
            name: 'telegram-ecommerce-admin-sid',
        });
        app.use(adminJsInstance.options.rootPath, adminRouter);
        logger_1.logger.info(`✅ AdminJS successfully started on ${adminJsInstance.options.rootPath} with AUTHENTICATION ENABLED`);
        logger_1.logger.warn(`⚠️  IMPORTANT: Set ADMIN_DEFAULT_PASSWORD, ADMIN_COOKIE_SECRET, ADMIN_SESSION_SECRET in environment`);
        return adminJsInstance;
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to setup AdminJS:', error);
        throw error;
    }
};
exports.setupAdminJS = setupAdminJS;
exports.default = exports.setupAdminJS;
//# sourceMappingURL=index.js.map
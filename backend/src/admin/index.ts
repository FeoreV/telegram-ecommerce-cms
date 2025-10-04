import AdminJSExpress from '@adminjs/express';
import { Database, Resource } from '@adminjs/prisma';
import { PrismaClient } from '@prisma/client';
import AdminJS from 'adminjs';
import { Express, Request, Response } from 'express';
import { AuditAction, AuditLogService } from '../middleware/auditLog';
import {
    NotificationChannel,
    NotificationPriority,
    NotificationService,
    NotificationType
} from '../services/notificationService';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { sanitizeForLog } from '../utils/sanitizer';

interface CurrentAdmin {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

interface ThemeColors {
  primary100: string;
  primary80: string;
  primary60: string;
  primary40: string;
  primary20: string;
  [key: string]: string;
}

AdminJS.registerAdapter({ Database, Resource });

const prisma = new PrismaClient();

let adminJsInstance: AdminJS;
let adapterRegistered = false;

const authenticate = async (email: string, password: string): Promise<CurrentAdmin | null> => {
  try {
    logger.info(`Admin login attempt for: ${sanitizeForLog(email)}`);

    // Find user by email or telegram ID
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
      logger.warn(`Admin login failed - user not found: ${sanitizeForLog(email)}`);
      return null;
    }

    // For security: require a proper admin password system
    // If no email set, this is a telegram-only user - they can't use AdminJS
    if (!user.email) {
      logger.warn(`Admin login failed - telegram-only user attempted AdminJS access: ${sanitizeForLog(user.telegramId || '')}`);
      return null;
    }

    // ENHANCED AUTH: Support multiple authentication methods
    // Method 1: Default password (for emergency access)
    const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD;

    if (!ADMIN_DEFAULT_PASSWORD) {
      logger.error('SECURITY: ADMIN_DEFAULT_PASSWORD environment variable not set');
      return null;
    }

    // Method 2: JWT token authentication (preferred method)
    let isValidAuth = false;

    // Check if password is a JWT token
    if (password.startsWith('eyJ')) {
      try {
        const decoded = verifyToken(password);
        if (decoded.userId === user.id && ['OWNER', 'ADMIN'].includes(decoded.role)) {
          isValidAuth = true;
          logger.info(`Admin login via JWT token for user: ${user.id}`);
        }
      } catch (err: unknown) {
        logger.warn('Invalid JWT token provided for admin login:', err as Record<string, unknown>);
      }
    }

    // Fallback to default password - use timing-safe comparison to prevent timing attacks (CWE-208)
    if (!isValidAuth && ADMIN_DEFAULT_PASSWORD) {
      const crypto = await import('crypto');
      try {
        isValidAuth = crypto.timingSafeEqual(
          Buffer.from(password),
          Buffer.from(ADMIN_DEFAULT_PASSWORD)
        );
        if (isValidAuth) {
          logger.info(`Admin login via default password for user: ${user.id}`);
        }
      } catch {
        // Lengths don't match, not equal
        isValidAuth = false;
      }
    }

    if (!isValidAuth) {
      logger.warn('Admin login failed - invalid credentials', { email: sanitizeForLog(email) });
      return null;
    }

    logger.info('Admin login successful', { userId: user.id, role: user.role });

    // Audit log the AdminJS login
    setImmediate(() => {
      AuditLogService.log(user.id, {
        action: AuditAction.ADMIN_LOGIN,
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
  } catch (error: unknown) {
    logger.error('Authentication error:', error as Record<string, unknown>);
    return null;
  }
};

export const setupAdminJS = async (app: Express) => {
  try {
    logger.info('🚀 STARTING AdminJS setup function...');
    logger.info('🔧 Environment ENABLE_ADMINJS:', { value: process.env.ENABLE_ADMINJS });

    if (!adapterRegistered) {
      try {
        if (!Database || !Resource) {
          throw new Error('AdminJS Prisma adapter components not found after direct import');
        }
        adapterRegistered = true;
        logger.info('✅ Prisma adapter registered successfully');
      } catch (adapterError: unknown) {
        logger.error('❌ Failed to register AdminJS Prisma adapter:', adapterError as Record<string, unknown>);
        logger.info('🔄 Continuing without Prisma adapter - using manual resource management');
        adapterRegistered = true; // Prevent retry attempts
      }
    }

    // Log available Prisma models for debugging
    try {
      const modelNames = ['User', 'Store', 'Product', 'Order', 'Category', 'StoreAdmin', 'OrderItem', 'Notification'];
      logger.info('📋 Available Prisma models in runtime data model:', { models: modelNames });
    } catch (prismaError: unknown) {
      logger.warn('Could not access Prisma model information:', prismaError as Record<string, unknown>);
    }

    // Try minimal AdminJS configuration first
    logger.info('🧪 Trying minimal AdminJS configuration first...');

    try {
      adminJsInstance = new AdminJS({
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
            } as ThemeColors,
          },
        },
        rootPath: '/admin',
        locale: {
          language: 'ru',
          availableLanguages: ['ru', 'en'],
        },
        pages: {
          dashboard: {
            handler: async (request: Request, response: Response, context: any) => {
              try {
                const stats = {
                  users: await prisma.user.count(),
                  stores: await prisma.store.count(),
                  products: await prisma.product.count(),
                  orders: await prisma.order.count(),
                  categories: await prisma.category.count(),
                };

                // Example: Send a low-priority notification to owner on dashboard load
                if (context.currentAdmin && stats.orders > 0) {
                  NotificationService.getInstance().send({
                    type: NotificationType.ADMIN_LOGIN,
                    title: 'Admin Dashboard Accessed',
                    message: `Admin ${context.currentAdmin.email} accessed the dashboard. Total orders: ${stats.orders}`,
                    priority: NotificationPriority.LOW,
                    channels: [NotificationChannel.SOCKET],
                    recipients: [context.currentAdmin.id],
                    data: { adminId: context.currentAdmin.id, email: context.currentAdmin.email }
                  });
                }

                return {
                  ...context,
                  stats,
                  message: 'Добро пожаловать в админ-панель!'
                };
              } catch (pageError: unknown) {
                return {
                  ...context,
                  error: 'Ошибка загрузки данных',
                  message: 'Админ-панель запущена в ограниченном режиме',
                  details: pageError as Record<string, unknown>
                };
              }
            },
            component: 'dashboard'
          },
          users: {
            handler: async (request: Request, response: Response, context: any) => {
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
              } catch (pageError: unknown) {
                return {
                  ...context,
                  error: 'Ошибка загрузки пользователей',
                  details: pageError as Record<string, unknown>
                };
              }
            },
            component: 'users'
          },
          stores: {
            handler: async (request: Request, response: Response, context: any) => {
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
              } catch (pageError: unknown) {
                return {
                  ...context,
                  error: 'Ошибка загрузки магазинов',
                  details: pageError as Record<string, unknown>
                };
              }
            },
            component: 'stores'
          },
          monitoring: {
            handler: async (request: Request, response: Response, context: any) => {
              try {
                // Get basic metrics for the monitoring page
                const PrometheusService = (await import('../services/prometheusService')).default;
                const prometheusService = PrometheusService.getInstance();
                const metricsJSON = await prometheusService.getMetricsJSON();

                return {
                  ...context,
                  metrics: metricsJSON,
                  message: 'Мониторинг системы'
                };
              } catch (pageError: unknown) {
                return {
                  ...context,
                  error: 'Ошибка загрузки метрик',
                  details: pageError as Record<string, unknown>
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
            } catch (err: unknown) {
              logger.error('Dashboard error:', err as Record<string, unknown>);
              return {
                message: 'Админ-панель загружена',
                error: 'Ошибка загрузки статистики',
                details: err as Record<string, unknown>
              };
            }
          },
        },
      });
      logger.info('✅ Minimal AdminJS created successfully, now adding resources...');

      // AdminJS is ready with minimal configuration
      logger.info('✅ AdminJS minimal configuration completed successfully');
    } catch (adminInitError: unknown) {
      logger.error('❌ AdminJS initialization failed while creating minimal instance:', {
        error: adminInitError instanceof Error ? adminInitError.message : String(adminInitError),
        stack: adminInitError instanceof Error ? adminInitError.stack : undefined,
      } as Record<string, unknown>);
      throw adminInitError;
    }

    // Create authenticated router
    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
      adminJsInstance,
      {
        authenticate,
        cookieName: 'telegram-ecommerce-admin-session',
        cookiePassword: process.env.ADMIN_COOKIE_SECRET || 'default-insecure-secret-change-in-production',
      },
      null,
      {
        secret: process.env.ADMIN_SESSION_SECRET || 'default-insecure-session-secret-change-in-production',
        saveUninitialized: false,
        resave: false,
        name: 'telegram-ecommerce-admin-sid',
      }
    );

    app.use(adminJsInstance.options.rootPath, adminRouter);

    logger.info(`✅ AdminJS successfully started on ${adminJsInstance.options.rootPath} with AUTHENTICATION ENABLED`);
    logger.warn(`⚠️  IMPORTANT: Set ADMIN_DEFAULT_PASSWORD, ADMIN_COOKIE_SECRET, ADMIN_SESSION_SECRET in environment`);

    return adminJsInstance;
  } catch (error: unknown) {
    logger.error('❌ Failed to setup AdminJS:', error as Record<string, unknown>);
    throw error;
  }
};

export default setupAdminJS;

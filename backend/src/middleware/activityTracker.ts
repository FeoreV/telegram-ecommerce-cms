import { NextFunction, Response } from 'express';
import { EmployeeService } from '../services/employeeService';
import { sanitizeObjectForLog } from '../utils/sanitizer';
import { AuthenticatedRequest } from './auth';

/**
 * Middleware для отслеживания активности сотрудников
 */
export const activityTracker = (action: string, getDetails?: (req: AuthenticatedRequest) => unknown) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Продолжаем выполнение запроса
    next();

    // Асинхронно логируем активность после ответа
    if (req.user && req.user.role !== 'CUSTOMER') {
      try {
        const storeId = req.params.storeId || req.body.storeId || req.query.storeId as string;

        if (storeId) {
          const details = getDetails ? getDetails(req) : undefined;

          // Не ждем результата, чтобы не замедлять ответ
          EmployeeService.logActivity(
            req.user.id,
            storeId,
            action,
            (details || {}) as Record<string, unknown>,
            req.ip,
            req.get('User-Agent')
          ).catch((err: unknown) => {
            // Молча игнорируем ошибки логирования
            console.warn('Failed to log employee activity:', sanitizeObjectForLog(err));
          });
        }
      } catch (err: unknown) {
        // Молча игнорируем ошибки
        console.warn('Activity tracker error:', err as Record<string, unknown>);
      }
    }
  };
};

/**
 * Предустановленные трекеры для различных действий
 */
export const ActivityTrackers = {
  // Действия с продуктами
  productCreated: activityTracker('PRODUCT_CREATED', (req) => ({
    productId: req.body.id,
    productName: req.body.name
  })),

  productUpdated: activityTracker('PRODUCT_UPDATED', (req) => ({
    productId: req.params.id || req.body.id,
    changes: req.body
  })),

  productDeleted: activityTracker('PRODUCT_DELETED', (req) => ({
    productId: req.params.id
  })),

  // Действия с заказами
  orderViewed: activityTracker('ORDER_VIEWED', (req) => ({
    orderId: req.params.id
  })),

  orderUpdated: activityTracker('ORDER_UPDATED', (req) => ({
    orderId: req.params.id || req.body.orderId,
    newStatus: req.body.status,
    changes: req.body
  })),

  orderConfirmed: activityTracker('ORDER_CONFIRMED', (req) => ({
    orderId: req.params.id || req.body.orderId
  })),

  orderRejected: activityTracker('ORDER_REJECTED', (req) => ({
    orderId: req.params.id || req.body.orderId,
    reason: req.body.rejectionReason
  })),

  // Действия со складом
  inventoryUpdated: activityTracker('INVENTORY_UPDATED', (req) => ({
    productId: req.params.productId || req.body.productId,
    variantId: req.params.variantId || req.body.variantId,
    previousQty: req.body.previousQty,
    newQty: req.body.newQty,
    changeType: req.body.changeType
  })),

  // Действия с сотрудниками
  employeeInvited: activityTracker('EMPLOYEE_INVITED', (req) => ({
    invitedEmail: req.body.email,
    role: req.body.role
  })),

  employeeRoleChanged: activityTracker('EMPLOYEE_ROLE_CHANGED', (req) => ({
    targetUserId: req.body.userId,
    newRole: req.body.role,
    permissions: req.body.permissions
  })),

  employeeRemoved: activityTracker('EMPLOYEE_REMOVED', (req) => ({
    removedUserId: req.params.userId,
    reason: req.body.reason
  })),

  // Системные действия
  login: activityTracker('LOGIN'),
  logout: activityTracker('LOGOUT'),

  settingsChanged: activityTracker('SETTINGS_CHANGED', (req) => ({
    section: req.body.section,
    changes: req.body.changes
  })),

  // Действия с аналитикой
  analyticsExported: activityTracker('ANALYTICS_EXPORTED', (req) => ({
    reportType: req.query.type,
    dateRange: { from: req.query.from, to: req.query.to }
  })),

  reportGenerated: activityTracker('REPORT_GENERATED', (req) => ({
    reportType: req.body.type,
    parameters: req.body.parameters
  }))
};

/**
 * Middleware для логирования входа в систему
 */
export const logLoginActivity = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.role !== 'CUSTOMER') {
    try {
      // Получаем все магазины пользователя для логирования
      const { prisma } = await import('../lib/prisma.js');

      const stores = await prisma.store.findMany({
        where: {
          OR: [
            { ownerId: req.user.id },
            { admins: { some: { userId: req.user.id } } },
            { vendors: { some: { userId: req.user.id } } }
          ]
        },
        select: { id: true }
      });

      // Логируем вход для каждого магазина
      for (const store of stores) {
        EmployeeService.logActivity(
          req.user.id,
          store.id,
          'LOGIN',
          {
            loginTime: new Date().toISOString(),
            method: 'web'
          },
          req.ip,
          req.get('User-Agent')
        ).catch((err: unknown) => {
          console.warn('Failed to log login activity:', sanitizeObjectForLog(err));
        });
      }
    } catch (err: unknown) {
      console.warn('Login activity tracker error:', err as Record<string, unknown>);
    }
  }

  next();
};

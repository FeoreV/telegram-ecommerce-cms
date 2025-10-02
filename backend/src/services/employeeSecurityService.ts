import { prisma } from '../lib/prisma';
import { logger, toLogMetadata } from '../utils/logger';
import { NotificationService, NotificationPriority, NotificationType, NotificationChannel } from './notificationService';
import * as crypto from 'crypto';

export interface SecurityAlert {
  type: 'SUSPICIOUS_ACTIVITY' | 'UNAUTHORIZED_ACCESS' | 'PERMISSION_ESCALATION' | 'BULK_CHANGES' | 'LOGIN_ANOMALY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId: string;
  storeId: string;
  description: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLog {
  userId: string;
  storeId: string;
  action: string;
  resource: string;
  resourceId?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}

/**
 * Сервис безопасности для управления сотрудниками
 */
export class EmployeeSecurityService {
  
  /**
   * Создание алерта безопасности
   */
  static async createSecurityAlert(alert: SecurityAlert): Promise<void> {
    try {
      // Сохраняем алерт в базу
      await prisma.$executeRaw`
        INSERT INTO security_alerts (
          id, type, severity, user_id, store_id, description, 
          details, ip_address, user_agent, created_at
        ) VALUES (
          ${this.generateId()}, ${alert.type}, ${alert.severity}, 
          ${alert.userId}, ${alert.storeId}, ${alert.description},
          ${JSON.stringify(alert.details)}, ${alert.ipAddress || null}, 
          ${alert.userAgent || null}, ${new Date()}
        )
      `;

      // Отправляем уведомления администраторам
      await this.notifyAdmins(alert);

      logger.warn('Security alert created', toLogMetadata(alert));
    } catch (error) {
      logger.error('Error creating security alert:', { alert, error });
    }
  }

  /**
   * Аудит действий сотрудников
   */
  static async auditAction(auditLog: AuditLog): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO employee_audit_logs (
          id, user_id, store_id, action, resource, resource_id,
          previous_value, new_value, ip_address, user_agent,
          success, reason, created_at
        ) VALUES (
          ${this.generateId()}, ${auditLog.userId}, ${auditLog.storeId},
          ${auditLog.action}, ${auditLog.resource}, ${auditLog.resourceId || null},
          ${auditLog.previousValue ? JSON.stringify(auditLog.previousValue) : null},
          ${auditLog.newValue ? JSON.stringify(auditLog.newValue) : null},
          ${auditLog.ipAddress || null}, ${auditLog.userAgent || null},
          ${auditLog.success}, ${auditLog.reason || null}, ${new Date()}
        )
      `;

      // Проверяем на подозрительную активность
      await this.analyzeSuspiciousActivity(auditLog);
    } catch (error) {
      logger.error('Error creating audit log:', { auditLog, error });
    }
  }

  /**
   * Анализ подозрительной активности
   */
  private static async analyzeSuspiciousActivity(auditLog: AuditLog): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Проверка на массовые изменения (более 10 действий за час)
      const recentActions = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM employee_audit_logs 
        WHERE user_id = ${auditLog.userId} 
        AND store_id = ${auditLog.storeId}
        AND created_at > ${oneHourAgo}
      `;

      if (recentActions[0]?.count > 10) {
        await this.createSecurityAlert({
          type: 'BULK_CHANGES',
          severity: 'MEDIUM',
          userId: auditLog.userId,
          storeId: auditLog.storeId,
          description: 'Обнаружена высокая активность пользователя',
          details: {
            actionsCount: recentActions[0].count,
            timeframe: '1 hour',
            lastAction: auditLog.action
          },
          ipAddress: auditLog.ipAddress,
          userAgent: auditLog.userAgent
        });
      }

      // Проверка на попытки доступа к запрещенным ресурсам
      if (!auditLog.success && auditLog.reason?.includes('permission')) {
        const failedAttempts = await prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*) as count 
          FROM employee_audit_logs 
          WHERE user_id = ${auditLog.userId} 
          AND success = false 
          AND reason LIKE '%permission%'
          AND created_at > ${oneHourAgo}
        `;

        if (failedAttempts[0]?.count > 3) {
          await this.createSecurityAlert({
            type: 'UNAUTHORIZED_ACCESS',
            severity: 'HIGH',
            userId: auditLog.userId,
            storeId: auditLog.storeId,
            description: 'Множественные попытки несанкционированного доступа',
            details: {
              failedAttempts: failedAttempts[0].count,
              lastAttempt: auditLog.action,
              reason: auditLog.reason
            },
            ipAddress: auditLog.ipAddress,
            userAgent: auditLog.userAgent
          });
        }
      }

      // Проверка на изменение критичных настроек
      if (['EMPLOYEE_ROLE_CHANGED', 'PERMISSIONS_UPDATED', 'EMPLOYEE_REMOVED'].includes(auditLog.action)) {
        await this.createSecurityAlert({
          type: 'PERMISSION_ESCALATION',
          severity: 'HIGH',
          userId: auditLog.userId,
          storeId: auditLog.storeId,
          description: 'Изменение критичных настроек безопасности',
          details: {
            action: auditLog.action,
            resource: auditLog.resource,
            previousValue: auditLog.previousValue,
            newValue: auditLog.newValue
          },
          ipAddress: auditLog.ipAddress,
          userAgent: auditLog.userAgent
        });
      }

    } catch (error) {
      logger.error('Error analyzing suspicious activity:', { auditLog, error });
    }
  }

  /**
   * Уведомление администраторов о проблемах безопасности
   */
  private static async notifyAdmins(alert: SecurityAlert): Promise<void> {
    try {
      // Получаем всех администраторов магазина
      const admins = await prisma.storeAdmin.findMany({
        where: {
          storeId: alert.storeId
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Получаем владельца магазина
      const store = await prisma.store.findUnique({
        where: { id: alert.storeId },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      const recipients = [
        ...admins.map(admin => admin.user),
        ...(store?.owner ? [store.owner] : [])
      ];

      // Отправляем уведомления
      for (const recipient of recipients) {
        await NotificationService.sendNotification({
          type: NotificationType.SECURITY_ALERT,
          priority: alert.severity === 'CRITICAL' ? NotificationPriority.CRITICAL :
                   alert.severity === 'HIGH' ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
          title: `🚨 Алерт безопасности: ${alert.type}`,
          message: alert.description,
          channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL],
          recipients: [recipient.id],
          storeId: alert.storeId,
          data: {
            alertType: alert.type,
            severity: alert.severity,
            details: alert.details,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      logger.error('Error notifying admins about security alert:', { alert, error });
    }
  }

  /**
   * Получение статистики безопасности
   */
  static async getSecurityStats(storeId: string, days: number = 7): Promise<{
    totalAlerts: number;
    alertsByType: Record<string, number>;
    alertsBySeverity: Record<string, number>;
    topRiskUsers: Array<{ userId: string; userName: string; riskScore: number }>;
    recentIncidents: SecurityAlert[];
  }> {
    try {
      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Получаем алерты за период
      const alerts = await prisma.$queryRaw<Array<unknown>>`
        SELECT type, severity, user_id, description, details, created_at
        FROM security_alerts 
        WHERE store_id = ${storeId} 
        AND created_at > ${dateFrom}
        ORDER BY created_at DESC
      `;

      const totalAlerts = alerts.length;

      // Группировка по типам
      const alertsByType: Record<string, number> = {};
      const alertsBySeverity: Record<string, number> = {};

      alerts.forEach((alert: any) => {
        alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
        alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
      });

      // Подсчет рискованных пользователей
      const userRisks: Record<string, number> = {};
      alerts.forEach((alert: any) => {
        const severity_score = {
          'LOW': 1,
          'MEDIUM': 3,
          'HIGH': 7,
          'CRITICAL': 15
        }[alert.severity] || 1;

        userRisks[alert.user_id] = (userRisks[alert.user_id] || 0) + severity_score;
      });

      // Получаем информацию о пользователях с высоким риском
      const topRiskUsers = [];
      for (const [userId, riskScore] of Object.entries(userRisks)) {
        if (riskScore > 5) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true }
          });
          
          if (user) {
            topRiskUsers.push({
              userId,
              userName: `${user.firstName} ${user.lastName}`,
              riskScore
            });
          }
        }
      }

      // Сортируем по риску
      topRiskUsers.sort((a, b) => b.riskScore - a.riskScore);

      return {
        totalAlerts,
        alertsByType,
        alertsBySeverity,
        topRiskUsers: topRiskUsers.slice(0, 10),
        recentIncidents: alerts.slice(0, 20) as any[]
      };
    } catch (error) {
      logger.error('Error getting security stats:', { storeId, error });
      return {
        totalAlerts: 0,
        alertsByType: {},
        alertsBySeverity: {},
        topRiskUsers: [],
        recentIncidents: []
      };
    }
  }

  /**
   * Блокировка пользователя при подозрительной активности
   */
  static async blockUser(userId: string, storeId: string, reason: string): Promise<void> {
    try {
      // Деактивируем все назначения пользователя в магазине
      await Promise.all([
        prisma.storeAdmin.updateMany({
          where: { userId, storeId },
          data: { /* добавляем поле isBlocked если нужно */ }
        }),
        prisma.storeVendor.updateMany({
          where: { userId, storeId },
          data: { isActive: false }
        })
      ]);

      // Логируем блокировку
      await this.auditAction({
        userId: 'SYSTEM',
        storeId,
        action: 'USER_BLOCKED',
        resource: 'user',
        resourceId: userId,
        newValue: { blocked: true, reason },
        success: true,
        reason: `Security block: ${reason}`
      });

      // Создаем алерт
      await this.createSecurityAlert({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'CRITICAL',
        userId,
        storeId,
        description: `Пользователь заблокирован из-за подозрительной активности`,
        details: { reason, timestamp: new Date().toISOString() }
      });

      logger.warn('User blocked for suspicious activity', { userId, storeId, reason });
    } catch (error) {
      logger.error('Error blocking user:', { userId, storeId, reason, error });
    }
  }

  /**
   * Очистка старых логов аудита и алертов
   */
  static async cleanupOldLogs(days: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [alertsDeleted, auditLogsDeleted] = await Promise.all([
        prisma.$executeRaw`
          DELETE FROM security_alerts 
          WHERE created_at < ${cutoffDate}
        `,
        prisma.$executeRaw`
          DELETE FROM employee_audit_logs 
          WHERE created_at < ${cutoffDate}
        `
      ]);

      logger.info('Cleaned up old security logs', {
        alertsDeleted,
        auditLogsDeleted,
        cutoffDate
      });
    } catch (error) {
      logger.error('Error cleaning up old logs:', { days, error });
    }
  }

  private static generateId(): string {
    return crypto.randomBytes(12).toString('hex');
  }
}

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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeSecurityService = void 0;
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
const notificationService_1 = require("./notificationService");
const crypto = __importStar(require("crypto"));
class EmployeeSecurityService {
    static async createSecurityAlert(alert) {
        try {
            await prisma_1.prisma.$executeRaw `
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
            await this.notifyAdmins(alert);
            logger_1.logger.warn('Security alert created', (0, logger_1.toLogMetadata)(alert));
        }
        catch (error) {
            logger_1.logger.error('Error creating security alert:', { alert, error });
        }
    }
    static async auditAction(auditLog) {
        try {
            await prisma_1.prisma.$executeRaw `
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
            await this.analyzeSuspiciousActivity(auditLog);
        }
        catch (error) {
            logger_1.logger.error('Error creating audit log:', { auditLog, error });
        }
    }
    static async analyzeSuspiciousActivity(auditLog) {
        try {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const recentActions = await prisma_1.prisma.$queryRaw `
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
            if (!auditLog.success && auditLog.reason?.includes('permission')) {
                const failedAttempts = await prisma_1.prisma.$queryRaw `
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
        }
        catch (error) {
            logger_1.logger.error('Error analyzing suspicious activity:', { auditLog, error });
        }
    }
    static async notifyAdmins(alert) {
        try {
            const admins = await prisma_1.prisma.storeAdmin.findMany({
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
            const store = await prisma_1.prisma.store.findUnique({
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
            for (const recipient of recipients) {
                await notificationService_1.NotificationService.sendNotification({
                    type: notificationService_1.NotificationType.SECURITY_ALERT,
                    priority: alert.severity === 'CRITICAL' ? notificationService_1.NotificationPriority.CRITICAL :
                        alert.severity === 'HIGH' ? notificationService_1.NotificationPriority.HIGH : notificationService_1.NotificationPriority.MEDIUM,
                    title: `🚨 Алерт безопасности: ${alert.type}`,
                    message: alert.description,
                    channels: [notificationService_1.NotificationChannel.TELEGRAM, notificationService_1.NotificationChannel.EMAIL],
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
        }
        catch (error) {
            logger_1.logger.error('Error notifying admins about security alert:', { alert, error });
        }
    }
    static async getSecurityStats(storeId, days = 7) {
        try {
            const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            const alerts = await prisma_1.prisma.$queryRaw `
        SELECT type, severity, user_id, description, details, created_at
        FROM security_alerts 
        WHERE store_id = ${storeId} 
        AND created_at > ${dateFrom}
        ORDER BY created_at DESC
      `;
            const totalAlerts = alerts.length;
            const alertsByType = {};
            const alertsBySeverity = {};
            alerts.forEach((alert) => {
                alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
                alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
            });
            const userRisks = {};
            alerts.forEach((alert) => {
                const severity_score = {
                    'LOW': 1,
                    'MEDIUM': 3,
                    'HIGH': 7,
                    'CRITICAL': 15
                }[alert.severity] || 1;
                userRisks[alert.user_id] = (userRisks[alert.user_id] || 0) + severity_score;
            });
            const topRiskUsers = [];
            for (const [userId, riskScore] of Object.entries(userRisks)) {
                if (riskScore > 5) {
                    const user = await prisma_1.prisma.user.findUnique({
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
            topRiskUsers.sort((a, b) => b.riskScore - a.riskScore);
            return {
                totalAlerts,
                alertsByType,
                alertsBySeverity,
                topRiskUsers: topRiskUsers.slice(0, 10),
                recentIncidents: alerts.slice(0, 20)
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting security stats:', { storeId, error });
            return {
                totalAlerts: 0,
                alertsByType: {},
                alertsBySeverity: {},
                topRiskUsers: [],
                recentIncidents: []
            };
        }
    }
    static async blockUser(userId, storeId, reason) {
        try {
            await Promise.all([
                prisma_1.prisma.storeAdmin.updateMany({
                    where: { userId, storeId },
                    data: {}
                }),
                prisma_1.prisma.storeVendor.updateMany({
                    where: { userId, storeId },
                    data: { isActive: false }
                })
            ]);
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
            await this.createSecurityAlert({
                type: 'SUSPICIOUS_ACTIVITY',
                severity: 'CRITICAL',
                userId,
                storeId,
                description: `Пользователь заблокирован из-за подозрительной активности`,
                details: { reason, timestamp: new Date().toISOString() }
            });
            logger_1.logger.warn('User blocked for suspicious activity', { userId, storeId, reason });
        }
        catch (error) {
            logger_1.logger.error('Error blocking user:', { userId, storeId, reason, error });
        }
    }
    static async cleanupOldLogs(days = 90) {
        try {
            const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            const [alertsDeleted, auditLogsDeleted] = await Promise.all([
                prisma_1.prisma.$executeRaw `
          DELETE FROM security_alerts 
          WHERE created_at < ${cutoffDate}
        `,
                prisma_1.prisma.$executeRaw `
          DELETE FROM employee_audit_logs 
          WHERE created_at < ${cutoffDate}
        `
            ]);
            logger_1.logger.info('Cleaned up old security logs', {
                alertsDeleted,
                auditLogsDeleted,
                cutoffDate
            });
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up old logs:', { days, error });
        }
    }
    static generateId() {
        return crypto.randomBytes(12).toString('hex');
    }
}
exports.EmployeeSecurityService = EmployeeSecurityService;
//# sourceMappingURL=employeeSecurityService.js.map
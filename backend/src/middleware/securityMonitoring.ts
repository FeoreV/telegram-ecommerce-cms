/**
 * Security Monitoring Middleware
 * Мониторинг безопасности в реальном времени
 *
 * SECURITY: Обнаружение и реагирование на подозрительную активность
 */

import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

interface SecurityEvent {
  timestamp: Date;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  ip: string;
  userId?: string;
  path: string;
  method: string;
  details: Record<string, any>;
}

// Хранилище событий безопасности (в продакшене использовать SIEM)
const securityEvents: SecurityEvent[] = [];
const MAX_EVENTS = 10000; // Максимум событий в памяти

// Счетчики для обнаружения аномалий
const anomalyDetection = {
  failedLogins: new Map<string, { count: number; lastAttempt: Date }>(),
  suspiciousPatterns: new Map<string, number>(),
  blockedIPs: new Set<string>(),
};

/**
 * Логирование события безопасности
 */
function logSecurityEvent(event: SecurityEvent): void {
  // Добавляем в память
  securityEvents.push(event);

  // Ограничиваем размер массива
  if (securityEvents.length > MAX_EVENTS) {
    securityEvents.shift(); // Удаляем самое старое
  }

  // Логируем в основную систему логирования
  const eventMetadata = {
    ...event,
    timestamp: event.timestamp.toISOString()
  };

  if (event.severity === 'critical') {
    logger.error('SECURITY EVENT', eventMetadata as any);
  } else if (event.severity === 'warning') {
    logger.warn('SECURITY EVENT', eventMetadata as any);
  } else {
    logger.info('SECURITY EVENT', eventMetadata as any);
  }
}

/**
 * Обнаружение brute force атак на аутентификацию
 */
export function detectBruteForce(ip: string, success: boolean): boolean {
  const key = `auth:${ip}`;
  const record = anomalyDetection.failedLogins.get(key);
  const now = new Date();

  if (!success) {
    // Неудачная попытка входа
    if (record) {
      record.count++;
      record.lastAttempt = now;

      // Если более 10 неудачных попыток за 15 минут - блокируем
      const timeDiff = now.getTime() - record.lastAttempt.getTime();
      if (record.count > 10 && timeDiff < 15 * 60 * 1000) {
        logSecurityEvent({
          timestamp: now,
          type: 'BRUTE_FORCE_DETECTED',
          severity: 'critical',
          ip,
          path: '/auth',
          method: 'POST',
          details: {
            failedAttempts: record.count,
            timeWindow: '15min',
          },
        });

        anomalyDetection.blockedIPs.add(ip);
        return true; // Brute force detected
      }
    } else {
      anomalyDetection.failedLogins.set(key, {
        count: 1,
        lastAttempt: now,
      });
    }
  } else {
    // Успешный вход - сбрасываем счетчик
    anomalyDetection.failedLogins.delete(key);
  }

  return false;
}

/**
 * Проверка IP в блок-листе
 */
export function isIpBlocked(ip: string): boolean {
  return anomalyDetection.blockedIPs.has(ip);
}

/**
 * Middleware для мониторинга безопасности
 */
export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const ip = req.ip || 'unknown';

  // Проверка заблокированных IP
  if (isIpBlocked(ip)) {
    logSecurityEvent({
      timestamp: new Date(),
      type: 'BLOCKED_IP_ATTEMPT',
      severity: 'warning',
      ip,
      userId: (req as any).user?.id,
      path: req.path,
      method: req.method,
      details: {
        reason: 'IP blocked due to suspicious activity',
      },
    });

    return res.status(403).json({
      error: 'Access forbidden',
      code: 'IP_BLOCKED',
      message: 'Your IP has been temporarily blocked due to suspicious activity',
    });
  }

  // Мониторинг времени ответа
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Логируем подозрительную активность
    if (statusCode === 401 || statusCode === 403) {
      logSecurityEvent({
        timestamp: new Date(),
        type: statusCode === 401 ? 'UNAUTHORIZED_ACCESS' : 'FORBIDDEN_ACCESS',
        severity: 'warning',
        ip,
        userId: (req as any).user?.id,
        path: req.path,
        method: req.method,
        details: {
          statusCode,
          duration,
          userAgent: req.get('User-Agent'),
        },
      });
    }

    // Логируем очень медленные запросы (возможная DoS атака)
    if (duration > 30000) { // Более 30 секунд
      logSecurityEvent({
        timestamp: new Date(),
        type: 'SLOW_REQUEST',
        severity: 'warning',
        ip,
        userId: (req as any).user?.id,
        path: req.path,
        method: req.method,
        details: {
          duration,
          possibleDoS: true,
        },
      });
    }

    // Логируем ошибки сервера
    if (statusCode >= 500) {
      logSecurityEvent({
        timestamp: new Date(),
        type: 'SERVER_ERROR',
        severity: 'warning',
        ip,
        userId: (req as any).user?.id,
        path: req.path,
        method: req.method,
        details: {
          statusCode,
          duration,
        },
      });
    }
  });

  next();
};

/**
 * Получение статистики событий безопасности
 */
export function getSecurityStats(): {
  totalEvents: number;
  criticalEvents: number;
  warningEvents: number;
  blockedIPs: number;
  recentEvents: SecurityEvent[];
} {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentEvents = securityEvents.filter(e => e.timestamp >= last24Hours);

  return {
    totalEvents: securityEvents.length,
    criticalEvents: securityEvents.filter(e => e.severity === 'critical').length,
    warningEvents: securityEvents.filter(e => e.severity === 'warning').length,
    blockedIPs: anomalyDetection.blockedIPs.size,
    recentEvents: recentEvents.slice(-100), // Последние 100 событий
  };
}

/**
 * Очистка заблокированных IP (для администратора)
 */
export function clearBlockedIp(ip: string): void {
  anomalyDetection.blockedIPs.delete(ip);
  anomalyDetection.failedLogins.delete(`auth:${ip}`);

  logger.info('IP unblocked by administrator', { ip });
}

/**
 * Очистка всех блокировок
 */
export function clearAllBlocks(): void {
  anomalyDetection.blockedIPs.clear();
  anomalyDetection.failedLogins.clear();

  logger.info('All IP blocks cleared by administrator');
}


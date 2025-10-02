import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import PrometheusService from '../services/prometheusService';

interface RequestMetrics {
  totalRequests: number;
  requestsByMethod: { [key: string]: number };
  requestsByPath: { [key: string]: number };
  responseTimeSum: number;
  errorCount: number;
  statusCodes: { [key: string]: number };
}

const metrics: RequestMetrics = {
  totalRequests: 0,
  requestsByMethod: {},
  requestsByPath: {},
  responseTimeSum: 0,
  errorCount: 0,
  statusCodes: {},
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const method = req.method;
  const path = req.route?.path || req.path;

  // Get Prometheus service instance
  const prometheusService = PrometheusService.getInstance();

  // Track request in progress
  prometheusService.httpRequestsInProgress.inc({ method, route: path });

  // Track request
  metrics.totalRequests++;
  metrics.requestsByMethod[method] = (metrics.requestsByMethod[method] || 0) + 1;
  metrics.requestsByPath[path] = (metrics.requestsByPath[path] || 0) + 1;

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any): any {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode.toString();

    // Track response metrics
    metrics.responseTimeSum += responseTime;
    metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;

    if (res.statusCode >= 400) {
      metrics.errorCount++;
    }

    // Record metrics in Prometheus
    prometheusService.recordHttpRequest(method, path, res.statusCode, responseTime);
    prometheusService.httpRequestsInProgress.dec({ method, route: path });

    // Log request details
    logger.info('Request completed', {
      method,
      path,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      requestId: (req as any).requestId,
    });

    // Call original end
    if (typeof encoding === 'function') {
      cb = encoding;
      encoding = undefined;
    }
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

export const getMetrics = () => {
  const avgResponseTime = metrics.totalRequests > 0 
    ? metrics.responseTimeSum / metrics.totalRequests 
    : 0;

  const errorRate = metrics.totalRequests > 0 
    ? (metrics.errorCount / metrics.totalRequests) * 100 
    : 0;

  return {
    ...metrics,
    averageResponseTime: Math.round(avgResponseTime * 100) / 100,
    errorRate: Math.round(errorRate * 100) / 100,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  };
};

export const resetMetrics = () => {
  metrics.totalRequests = 0;
  metrics.requestsByMethod = {};
  metrics.requestsByPath = {};
  metrics.responseTimeSum = 0;
  metrics.errorCount = 0;
  metrics.statusCodes = {};
};

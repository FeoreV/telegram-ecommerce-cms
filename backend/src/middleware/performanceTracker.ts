import { Request, Response, NextFunction } from 'express';
import { HealthService } from '../services/healthService';
import { logger, toLogMetadata } from '../utils/logger';

export interface PerformanceData {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  userId?: string;
  error?: boolean;
}

// Extend global namespace to include performanceHistory
declare global {
  var performanceHistory: PerformanceData[] | undefined;
}

export const performanceTracker = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  
  // Store original end function
  const originalEnd = res.end;
  
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    // Calculate response time
    const endTime = process.hrtime.bigint();
    const responseTimeMs = Number(endTime - startTime) / 1_000_000; // Convert nanoseconds to milliseconds
    
    // Determine if this was an error response
    const isError = res.statusCode >= 400;
    
    // Record performance data
    HealthService.recordRequest(responseTimeMs, isError);
    
    // Create performance data object
    const performanceData: PerformanceData = {
      method: req.method,
      path: req.route?.path || req.path,
      statusCode: res.statusCode,
      responseTime: responseTimeMs,
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      userId: (req as any).user?.id,
      error: isError,
    };
    
    // Log slow requests
    if (responseTimeMs > 1000) {
      logger.warn('Slow request detected', toLogMetadata(performanceData));
    }
    
    // Log error responses (if not already logged by error handler)
    if (isError && res.statusCode >= 500) {
      logger.error('Server error response', toLogMetadata(performanceData));
    }
    
    // Store performance data for analytics
    setImmediate(() => {
      storePerformanceData(performanceData);
    });
    
    // Call original end function
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
};

// Store performance data for historical analysis
function storePerformanceData(data: PerformanceData) {
  // In a production system, you would:
  // 1. Store this in a time-series database (like InfluxDB, TimescaleDB, or MongoDB)
  // 2. Aggregate data for performance dashboards
  // 3. Set up alerts for performance degradation
  
  // For now, we'll just store a rolling window in memory
  const maxEntries = 1000;
  
  if (!global.performanceHistory) {
    global.performanceHistory = [];
  }
  
  global.performanceHistory.push(data);
  
  // Keep only the last 1000 entries
  if (global.performanceHistory.length > maxEntries) {
    global.performanceHistory = global.performanceHistory.slice(-maxEntries);
  }
}

// Get performance analytics
export function getPerformanceAnalytics(timeWindow: number = 60 * 60 * 1000): {
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  slowestRequests: PerformanceData[];
  topEndpoints: { path: string; count: number; avgResponseTime: number }[];
  statusCodeDistribution: Record<string, number>;
} {
  const history: PerformanceData[] = global.performanceHistory || [];
  const cutoff = new Date(Date.now() - timeWindow);
  
  // Filter to time window
  const recentRequests = history.filter(req => req.timestamp >= cutoff);
  
  if (recentRequests.length === 0) {
    return {
      averageResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      slowestRequests: [],
      topEndpoints: [],
      statusCodeDistribution: {},
    };
  }
  
  // Calculate metrics
  const totalResponseTime = recentRequests.reduce((sum, req) => sum + req.responseTime, 0);
  const averageResponseTime = totalResponseTime / recentRequests.length;
  
  const timeWindowSeconds = timeWindow / 1000;
  const requestsPerSecond = recentRequests.length / timeWindowSeconds;
  
  const errorCount = recentRequests.filter(req => req.error).length;
  const errorRate = (errorCount / recentRequests.length) * 100;
  
  // Get slowest requests
  const slowestRequests = recentRequests
    .sort((a, b) => b.responseTime - a.responseTime)
    .slice(0, 10);
  
  // Group by endpoint
  const endpointStats = recentRequests.reduce((acc, req) => {
    const key = `${req.method} ${req.path}`;
    if (!acc[key]) {
      acc[key] = { count: 0, totalTime: 0 };
    }
    acc[key].count++;
    acc[key].totalTime += req.responseTime;
    return acc;
  }, {} as Record<string, { count: number; totalTime: number }>);
  
  const topEndpoints = Object.entries(endpointStats)
    .map(([path, stats]) => ({
      path,
      count: stats.count,
      avgResponseTime: stats.totalTime / stats.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Status code distribution
  const statusCodeDistribution = recentRequests.reduce((acc, req) => {
    const code = Math.floor(req.statusCode / 100) * 100; // Group by 100s (200, 300, 400, 500)
    const key = `${code}xx`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    averageResponseTime,
    requestsPerSecond,
    errorRate,
    slowestRequests,
    topEndpoints,
    statusCodeDistribution,
  };
}

// Clear performance history (useful for testing)
export function clearPerformanceHistory() {
  global.performanceHistory = [];
}

export default performanceTracker;

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth';

// Rate limit store interface for tracking uploads
interface UploadAttempt {
  userId: string;
  orderId?: string;
  timestamp: number;
  ip: string;
}

// In-memory store for upload attempts (in production, use Redis)
class UploadRateLimitStore {
  public attempts: Map<string, UploadAttempt[]> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old attempts every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - (24 * 60 * 60 * 1000); // 24 hours

    for (const [key, attempts] of this.attempts.entries()) {
      const filteredAttempts = attempts.filter(attempt => attempt.timestamp > cutoff);
      if (filteredAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, filteredAttempts);
      }
    }
  }

  addAttempt(userId: string, orderId: string | undefined, ip: string): void {
    const now = Date.now();
    const userKey = `user:${userId}`;
    const orderKey = orderId ? `order:${orderId}` : undefined;

    // Track by user
    if (!this.attempts.has(userKey)) {
      this.attempts.set(userKey, []);
    }
    const attempts = this.attempts.get(userKey);
    if (attempts) {
      attempts.push({ userId, orderId, timestamp: now, ip });
    }

    // Track by order if specified
    if (orderKey) {
      if (!this.attempts.has(orderKey)) {
        this.attempts.set(orderKey, []);
      }
      const attempts = this.attempts.get(orderKey);
      if (attempts) {
        attempts.push({ userId, orderId, timestamp: now, ip });
      }
    }
  }

  getAttempts(key: string, windowMs: number): UploadAttempt[] {
    const attempts = this.attempts.get(key) || [];
    const cutoff = Date.now() - windowMs;
    return attempts.filter(attempt => attempt.timestamp > cutoff);
  }

  getUserAttempts(userId: string, windowMs: number): UploadAttempt[] {
    return this.getAttempts(`user:${userId}`, windowMs);
  }

  getOrderAttempts(orderId: string, windowMs: number): UploadAttempt[] {
    return this.getAttempts(`order:${orderId}`, windowMs);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

const uploadStore = new UploadRateLimitStore();

// Global upload rate limit (all users)
export const globalUploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 uploads per 15 minutes globally
  message: {
    error: 'Too many upload requests from all users, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Global upload rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    res.status(429).json({
      error: 'Too many upload requests, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Per-user upload rate limit
export const userUploadRateLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = req.user.id;
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxUploads = 20; // Max 20 uploads per user per hour

  const userAttempts = uploadStore.getUserAttempts(userId, windowMs);
  
  if (userAttempts.length >= maxUploads) {
    logger.warn('User upload rate limit exceeded', {
      userId,
      attempts: userAttempts.length,
      maxUploads,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(429).json({
      error: `Too many uploads. Maximum ${maxUploads} uploads per hour allowed.`,
      attempts: userAttempts.length,
      maxUploads,
      retryAfter: '1 hour'
    });
  }

  // Track this attempt
  const orderId = req.params.id || req.body.orderId;
  uploadStore.addAttempt(userId, orderId, req.ip || 'unknown');

  next();
};

// Per-order upload rate limit
export const orderUploadRateLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const orderId = req.params.id || req.body.orderId;
  
  if (!orderId) {
    return next(); // Skip if no order ID
  }

  const windowMs = 24 * 60 * 60 * 1000; // 24 hours
  const maxUploads = 5; // Max 5 uploads per order per day

  const orderAttempts = uploadStore.getOrderAttempts(orderId, windowMs);
  
  if (orderAttempts.length >= maxUploads) {
    logger.warn('Order upload rate limit exceeded', {
      orderId,
      userId: req.user?.id,
      attempts: orderAttempts.length,
      maxUploads,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(429).json({
      error: `Too many uploads for this order. Maximum ${maxUploads} uploads per order per day allowed.`,
      orderId,
      attempts: orderAttempts.length,
      maxUploads,
      retryAfter: '24 hours'
    });
  }

  next();
};

// IP-based upload rate limit (as additional protection)
export const ipUploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 uploads per IP per hour
  keyGenerator: (req: Request) => req.ip || 'unknown',
  message: {
    error: 'Too many upload requests from this IP address, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('IP upload rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    res.status(429).json({
      error: 'Too many upload requests from this IP, please try again later.',
      retryAfter: '1 hour'
    });
  }
});

// Combined upload rate limiting middleware
export const uploadRateLimitMiddleware = [
  globalUploadRateLimit,
  ipUploadRateLimit,
  userUploadRateLimit,
  orderUploadRateLimit
];

// Get upload statistics for monitoring
export const getUploadStats = (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const stats = {
    totalUsers: 0,
    totalOrders: 0,
    recentUploads: 0,
    timestamp: new Date().toISOString()
  };

  // Count unique users and orders from the last 24 hours
  const windowMs = 24 * 60 * 60 * 1000;
  const users = new Set<string>();
  const orders = new Set<string>();
  let recentCount = 0;

  for (const [key, attempts] of uploadStore.attempts.entries()) {
    const recentAttempts = attempts.filter((attempt: UploadAttempt) => 
      attempt.timestamp > Date.now() - windowMs
    );
    
    if (recentAttempts.length > 0) {
      recentCount += recentAttempts.length;
      
      if (key.startsWith('user:')) {
        users.add(key.substring(5));
      } else if (key.startsWith('order:')) {
        orders.add(key.substring(6));
      }
    }
  }

  stats.totalUsers = users.size;
  stats.totalOrders = orders.size;
  stats.recentUploads = recentCount;

  res.json({
    success: true,
    stats
  });
};

// Cleanup function for graceful shutdown
export const cleanupUploadRateLimit = () => {
  uploadStore.destroy();
};

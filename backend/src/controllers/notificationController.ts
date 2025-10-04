import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
// SECURITY FIX: Import sanitization and validation utilities
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { sanitizeObjectForLog } from '../utils/sanitizer';
import { validateJson } from '../utils/validator';

// Get user notifications
export const getNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    page = 1,
    limit = 20,
    unreadOnly = false,
    type,
    priority,
  } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const offset = (Number(page) - 1) * Number(limit);

  const whereClause: Prisma.NotificationWhereInput = {
    userId: req.user.id,
  };

  // Filter by read status
  if (unreadOnly === 'true') {
    whereClause.readAt = null;
  }

  // Filter by type
  if (type) {
    whereClause.type = type as any; // Type 'any' is needed because 'type' from req.query is string and needs to be cast to NotificationType
  }

  // Filter by priority
  if (priority) {
    whereClause.priority = priority as any; // Type 'any' is needed because 'priority' from req.query is string and needs to be cast to NotificationPriority
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: Number(limit),
    }),
    prisma.notification.count({ where: whereClause }),
    prisma.notification.count({
      where: {
        userId: req.user.id,
        readAt: null,
      },
    }),
  ]);

  // SECURITY FIX: Sanitize notification data before sending to client (CWE-79)
  res.json({
    notifications: notifications.map(notification => {
      let channels: string[] = [];
      let data: Record<string, any> | null = null;

      try {
        if (notification.channels && validateJson(notification.channels)) {
          channels = JSON.parse(notification.channels) as string[];
        }
        if (notification.data && validateJson(notification.data)) {
          data = JSON.parse(notification.data) as Record<string, any>;
          // Sanitize data to prevent XSS
          data = sanitizeObjectForLog(data) as Record<string, any>;
        }
      } catch (error) {
        logger.error('Failed to parse notification data', {
          notificationId: notification.id,
          error
        });
      }

      return {
        ...notification,
        channels,
        data,
      };
    }),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    unreadCount,
  });
});

// Mark notification as read
export const markNotificationAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  if (notification.userId !== req.user.id) {
    throw new AppError('Unauthorized to access this notification', 403);
  }

  const updatedNotification = await prisma.notification.update({
    where: { id },
    data: {
      readAt: new Date(),
    },
  });

  // SECURITY FIX: Safely parse JSON data with validation and sanitization (CWE-79, CWE-502)
  let channels: string[] = [];
  let data: Record<string, any> | null = null;

  try {
    if (updatedNotification.channels && validateJson(updatedNotification.channels)) {
      channels = JSON.parse(updatedNotification.channels) as string[];
      // Sanitize channel names to prevent XSS
      channels = channels.map(ch => sanitizeObjectForLog({ ch }) as any).map((obj: any) => obj.ch);
    }

    if (updatedNotification.data && validateJson(updatedNotification.data)) {
      data = JSON.parse(updatedNotification.data) as Record<string, any>;
      // Sanitize data for safe output to prevent XSS
      data = sanitizeObjectForLog(data) as Record<string, any>;
    }
  } catch (error) {
    logger.error('Failed to parse notification data', {
      notificationId: updatedNotification.id,
      error
    });
    channels = [];
    data = null;
  }

  // SECURITY FIX: Return sanitized notification data
  res.json({
    notification: {
      id: updatedNotification.id,
      userId: updatedNotification.userId,
      title: updatedNotification.title,
      message: updatedNotification.message,
      type: updatedNotification.type,
      priority: updatedNotification.priority,
      storeId: updatedNotification.storeId,
      orderId: updatedNotification.orderId,
      readAt: updatedNotification.readAt,
      createdAt: updatedNotification.createdAt,
      channels,
      data,
    },
    message: 'Notification marked as read',
  });
});

// Mark all notifications as read
export const markAllNotificationsAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const result = await prisma.notification.updateMany({
    where: {
      userId: req.user.id,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  res.json({
    message: `Marked ${result.count} notifications as read`,
    count: result.count,
  });
});

// Delete notification
export const deleteNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  if (notification.userId !== req.user.id) {
    throw new AppError('Unauthorized to delete this notification', 403);
  }

  await prisma.notification.delete({
    where: { id },
  });

  res.json({
    message: 'Notification deleted successfully',
  });
});

// Get notification statistics
export const getNotificationStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const [totalCount, unreadCount, typeCounts, priorityCounts] = await Promise.all([
    prisma.notification.count({
      where: { userId: req.user.id },
    }),
    prisma.notification.count({
      where: {
        userId: req.user.id,
        readAt: null,
      },
    }),
    prisma.notification.groupBy({
      by: ['type'],
      where: { userId: req.user.id },
      _count: {
        _all: true,
      },
    }),
    prisma.notification.groupBy({
      by: ['priority'],
      where: { userId: req.user.id },
      _count: {
        _all: true,
      },
    }),
  ]);

  const typeStats = typeCounts.reduce((acc: Record<string, number>, item) => {
    acc[item.type] = item._count._all;
    return acc;
  }, {});

  const priorityStats = priorityCounts.reduce((acc: Record<string, number>, item) => {
    acc[item.priority] = item._count._all;
    return acc;
  }, {});

  res.json({
    stats: {
      total: totalCount,
      unread: unreadCount,
      read: totalCount - unreadCount,
      byType: typeStats,
      byPriority: priorityStats,
    },
  });
});

export default {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationStats,
};

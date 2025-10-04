"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationStats = exports.deleteNotification = exports.markAllNotificationsAsRead = exports.markNotificationAsRead = exports.getNotifications = void 0;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
const validator_1 = require("../utils/validator");
exports.getNotifications = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly = false, type, priority, } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const offset = (Number(page) - 1) * Number(limit);
    const whereClause = {
        userId: req.user.id,
    };
    if (unreadOnly === 'true') {
        whereClause.readAt = null;
    }
    if (type) {
        whereClause.type = type;
    }
    if (priority) {
        whereClause.priority = priority;
    }
    const [notifications, total, unreadCount] = await Promise.all([
        prisma_1.prisma.notification.findMany({
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
        prisma_1.prisma.notification.count({ where: whereClause }),
        prisma_1.prisma.notification.count({
            where: {
                userId: req.user.id,
                readAt: null,
            },
        }),
    ]);
    res.json({
        notifications: notifications.map(notification => {
            let channels = [];
            let data = null;
            try {
                if (notification.channels && (0, validator_1.validateJson)(notification.channels)) {
                    channels = JSON.parse(notification.channels);
                }
                if (notification.data && (0, validator_1.validateJson)(notification.data)) {
                    data = JSON.parse(notification.data);
                    data = (0, sanitizer_1.sanitizeObjectForLog)(data);
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to parse notification data', {
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
exports.markNotificationAsRead = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const notification = await prisma_1.prisma.notification.findUnique({
        where: { id },
    });
    if (!notification) {
        throw new errorHandler_1.AppError('Notification not found', 404);
    }
    if (notification.userId !== req.user.id) {
        throw new errorHandler_1.AppError('Unauthorized to access this notification', 403);
    }
    const updatedNotification = await prisma_1.prisma.notification.update({
        where: { id },
        data: {
            readAt: new Date(),
        },
    });
    let channels = [];
    let data = null;
    try {
        if (updatedNotification.channels && (0, validator_1.validateJson)(updatedNotification.channels)) {
            channels = JSON.parse(updatedNotification.channels);
            channels = channels.map(ch => (0, sanitizer_1.sanitizeObjectForLog)({ ch })).map((obj) => obj.ch);
        }
        if (updatedNotification.data && (0, validator_1.validateJson)(updatedNotification.data)) {
            data = JSON.parse(updatedNotification.data);
            data = (0, sanitizer_1.sanitizeObjectForLog)(data);
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to parse notification data', {
            notificationId: updatedNotification.id,
            error
        });
        channels = [];
        data = null;
    }
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
exports.markAllNotificationsAsRead = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const result = await prisma_1.prisma.notification.updateMany({
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
exports.deleteNotification = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const notification = await prisma_1.prisma.notification.findUnique({
        where: { id },
    });
    if (!notification) {
        throw new errorHandler_1.AppError('Notification not found', 404);
    }
    if (notification.userId !== req.user.id) {
        throw new errorHandler_1.AppError('Unauthorized to delete this notification', 403);
    }
    await prisma_1.prisma.notification.delete({
        where: { id },
    });
    res.json({
        message: 'Notification deleted successfully',
    });
});
exports.getNotificationStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const [totalCount, unreadCount, typeCounts, priorityCounts] = await Promise.all([
        prisma_1.prisma.notification.count({
            where: { userId: req.user.id },
        }),
        prisma_1.prisma.notification.count({
            where: {
                userId: req.user.id,
                readAt: null,
            },
        }),
        prisma_1.prisma.notification.groupBy({
            by: ['type'],
            where: { userId: req.user.id },
            _count: {
                _all: true,
            },
        }),
        prisma_1.prisma.notification.groupBy({
            by: ['priority'],
            where: { userId: req.user.id },
            _count: {
                _all: true,
            },
        }),
    ]);
    const typeStats = typeCounts.reduce((acc, item) => {
        acc[item.type] = item._count._all;
        return acc;
    }, {});
    const priorityStats = priorityCounts.reduce((acc, item) => {
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
exports.default = {
    getNotifications: exports.getNotifications,
    markNotificationAsRead: exports.markNotificationAsRead,
    markAllNotificationsAsRead: exports.markAllNotificationsAsRead,
    deleteNotification: exports.deleteNotification,
    getNotificationStats: exports.getNotificationStats,
};
//# sourceMappingURL=notificationController.js.map
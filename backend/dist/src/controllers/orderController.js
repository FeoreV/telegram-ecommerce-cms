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
exports.exportOrders = exports.getOrderStats = exports.getPaymentProof = exports.uploadOrderPaymentProof = exports.cancelOrder = exports.deliverOrder = exports.shipOrder = exports.getOrder = exports.rejectOrder = exports.confirmPayment = exports.createOrder = exports.getOrders = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const prisma_1 = require("../lib/prisma");
const socket_1 = require("../lib/socket");
const errorHandler_1 = require("../middleware/errorHandler");
const uploadPaymentProof_1 = require("../middleware/uploadPaymentProof");
const notificationService_1 = require("../services/notificationService");
const telegramNotificationService_1 = require("../services/telegramNotificationService");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
exports.getOrders = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20, status, statuses, storeId, customerId, search, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const whereClause = {};
    if (req.user.role !== 'OWNER') {
        whereClause.store = {
            OR: [
                { ownerId: req.user.id },
                { admins: { some: { userId: req.user.id } } }
            ]
        };
    }
    if (statuses) {
        const statusArray = Array.isArray(statuses) ? statuses : [statuses];
        whereClause.status = { in: statusArray };
    }
    else if (status) {
        whereClause.status = status;
    }
    if (storeId) {
        whereClause.storeId = storeId;
    }
    if (customerId) {
        whereClause.customerId = customerId;
    }
    if (search) {
        whereClause.OR = [
            { orderNumber: { contains: search } },
            { customerInfo: { contains: search } },
            { customer: {
                    OR: [
                        { firstName: { contains: search } },
                        { lastName: { contains: search } },
                        { username: { contains: search } }
                    ]
                } }
        ];
    }
    if (dateFrom || dateTo) {
        whereClause.createdAt = {};
        if (dateFrom) {
            whereClause.createdAt.gte = new Date(dateFrom);
        }
        if (dateTo) {
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            whereClause.createdAt.lte = endDate;
        }
    }
    try {
        const total = await prisma_1.prisma.order.count({ where: whereClause });
        const orders = await prisma_1.prisma.order.findMany({
            where: whereClause,
            include: {
                customer: {
                    select: {
                        id: true,
                        telegramId: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    }
                },
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        currency: true,
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                images: true,
                                sku: true,
                            }
                        },
                        variant: {
                            select: {
                                id: true,
                                name: true,
                                value: true,
                            }
                        }
                    }
                },
                adminLogs: {
                    include: {
                        admin: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            },
            orderBy: {
                [sortBy]: sortOrder
            },
            skip,
            take: Number(limit),
        });
        const ordersWithUrls = orders.map(order => ({
            ...order,
            paymentProof: order.paymentProof
                ? `/orders/${order.id}/payment-proof`
                : null
        }));
        res.json({
            items: ordersWithUrls,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching orders:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to fetch orders', 500);
    }
});
exports.createOrder = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId, items, customerInfo, notes, clientRequestId } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!storeId || !items || !Array.isArray(items) || items.length === 0) {
        throw new errorHandler_1.AppError('Store ID and items are required', 400);
    }
    if (!customerInfo || !customerInfo.name) {
        throw new errorHandler_1.AppError('Customer information is required', 400);
    }
    const store = await prisma_1.prisma.store.findFirst({
        where: {
            id: storeId,
            ...(req.user.role !== 'OWNER' ? {
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            } : {})
        },
        include: {
            owner: true,
        }
    });
    if (!store) {
        throw new errorHandler_1.AppError('Store not found or access denied', 404);
    }
    let totalAmount = 0;
    const validatedItems = [];
    for (const item of items) {
        const { productId, variantId, quantity, price } = item;
        if (!productId || !quantity || quantity <= 0) {
            throw new errorHandler_1.AppError('Invalid item data', 400);
        }
        const product = await prisma_1.prisma.product.findFirst({
            where: {
                id: productId,
                storeId: storeId,
            },
            include: {
                variants: variantId ? {
                    where: { id: variantId }
                } : undefined
            }
        });
        if (!product) {
            throw new errorHandler_1.AppError(`Product not found: ${productId}`, 400);
        }
        let variant = null;
        let itemPrice = price || product.price;
        if (variantId) {
            variant = product.variants.find(v => v.id === variantId);
            if (!variant) {
                throw new errorHandler_1.AppError(`Product variant not found: ${variantId}`, 400);
            }
            itemPrice = variant.price || product.price;
        }
        const availableStock = variant?.stock ?? product.stock;
        if (availableStock !== null && availableStock < quantity) {
            throw new errorHandler_1.AppError(`Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${quantity}`, 400);
        }
        validatedItems.push({
            productId,
            variantId: variantId || null,
            quantity,
            price: itemPrice,
        });
        totalAmount += itemPrice * quantity;
    }
    if (clientRequestId) {
        const existingOrder = await prisma_1.prisma.order.findUnique({
            where: { clientRequestId }
        });
        if (existingOrder) {
            return res.status(200).json({
                order: existingOrder,
                message: 'Order already exists'
            });
        }
    }
    const orderDate = new Date();
    const orderPrefix = `${(orderDate.getMonth() + 1).toString().padStart(2, '0')}${orderDate.getFullYear().toString().slice(-2)}`;
    const lastOrder = await prisma_1.prisma.order.findFirst({
        where: {
            orderNumber: {
                startsWith: orderPrefix
            }
        },
        orderBy: {
            orderNumber: 'desc'
        }
    });
    let orderNumber;
    if (lastOrder) {
        const lastNumber = parseInt(lastOrder.orderNumber.split('-')[1]) || 0;
        orderNumber = `${orderPrefix}-${(lastNumber + 1).toString().padStart(5, '0')}`;
    }
    else {
        orderNumber = `${orderPrefix}-00001`;
    }
    try {
        const order = await prisma_1.prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    orderNumber,
                    storeId,
                    customerId: req.user.id,
                    totalAmount,
                    currency: store.currency,
                    customerInfo: JSON.stringify(customerInfo),
                    notes,
                    clientRequestId,
                    status: 'PENDING_ADMIN',
                },
                include: {
                    customer: true,
                    store: true,
                    items: {
                        include: {
                            product: true,
                            variant: true,
                        }
                    }
                }
            });
            for (const item of validatedItems) {
                await tx.orderItem.create({
                    data: {
                        orderId: newOrder.id,
                        productId: item.productId,
                        variantId: item.variantId,
                        quantity: item.quantity,
                        price: item.price,
                    }
                });
                if (item.variantId) {
                    const variant = await tx.productVariant.findUnique({
                        where: { id: item.variantId },
                        select: { stock: true }
                    });
                    if (variant && variant.stock !== null) {
                        await tx.productVariant.update({
                            where: { id: item.variantId },
                            data: { stock: variant.stock - item.quantity }
                        });
                    }
                }
                else {
                    const product = await tx.product.findUnique({
                        where: { id: item.productId },
                        select: { stock: true }
                    });
                    if (product && product.stock !== null) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { stock: product.stock - item.quantity }
                        });
                    }
                }
            }
            return newOrder;
        });
        await prisma_1.prisma.adminLog.create({
            data: {
                action: 'create_order',
                adminId: req.user.id,
                orderId: order.id,
                details: JSON.stringify({
                    orderNumber: order.orderNumber,
                    totalAmount: totalAmount.toString(),
                    itemCount: validatedItems.length,
                }),
            },
        });
        await notificationService_1.NotificationService.send({
            title: 'Новый заказ',
            message: `Получен новый заказ #${order.orderNumber} на сумму ${totalAmount} ${store.currency}`,
            type: notificationService_1.NotificationType.ORDER_CREATED,
            priority: notificationService_1.NotificationPriority.HIGH,
            recipients: [store.ownerId],
            channels: [notificationService_1.NotificationChannel.SOCKET, notificationService_1.NotificationChannel.TELEGRAM],
            data: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                storeId: store.id,
                totalAmount,
                currency: store.currency,
            }
        });
        const { SocketRoomService } = await import('../services/socketRoomService.js');
        SocketRoomService.notifyOrderUpdate(order.id, store.id, 'order:new', {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerId: req.user.id,
            store: {
                id: store.id,
                name: store.name,
            },
            totalAmount,
            currency: store.currency,
            itemCount: validatedItems.length,
        });
        logger_1.logger.info('Order created', { orderNumber: (0, sanitizer_1.sanitizeForLog)(order.orderNumber), userId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
        res.status(201).json({ order });
    }
    catch (error) {
        logger_1.logger.error('Error creating order:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to create order', 500);
    }
});
exports.confirmPayment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    const order = await prisma_1.prisma.order.findUnique({
        where: { id },
        include: {
            store: true,
            customer: true,
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    if (order.status !== 'PENDING_ADMIN') {
        throw new errorHandler_1.AppError('Order cannot be confirmed in current status', 400);
    }
    if (req.user.role !== 'OWNER') {
        const hasAccess = await prisma_1.prisma.store.findFirst({
            where: {
                id: order.storeId,
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            }
        });
        if (!hasAccess) {
            throw new errorHandler_1.AppError('No access to this store', 403);
        }
    }
    const updatedOrder = await prisma_1.prisma.order.update({
        where: { id },
        data: {
            status: 'PAID',
            paidAt: new Date(),
        },
        include: {
            customer: true,
            store: true,
        },
    });
    await prisma_1.prisma.adminLog.create({
        data: {
            action: 'confirm_payment',
            adminId: req.user.id,
            orderId: id,
            details: JSON.stringify({
                orderNumber: order.orderNumber,
                amount: order.totalAmount.toString(),
            }),
        },
    });
    await notifyCustomerPaymentConfirmed(updatedOrder);
    const { SocketRoomService } = await import('../services/socketRoomService.js');
    SocketRoomService.notifyOrderUpdate(id, order.storeId, 'order:payment_confirmed', {
        orderId: id,
        orderNumber: order.orderNumber,
        status: 'PAID',
        adminId: req.user.id,
        customerId: order.customerId,
        store: order.store,
        totalAmount: order.totalAmount,
        currency: order.currency
    });
    logger_1.logger.info('Payment confirmed', { orderId: (0, sanitizer_1.sanitizeForLog)(id), adminId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
    res.json({ order: updatedOrder, message: 'Payment confirmed successfully' });
});
exports.rejectOrder = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { reason, notes } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    if (!reason) {
        throw new errorHandler_1.AppError('Rejection reason is required', 400);
    }
    const order = await prisma_1.prisma.order.findUnique({
        where: { id },
        include: {
            store: true,
            customer: true,
            items: {
                include: {
                    product: true,
                    variant: true,
                }
            }
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    if (order.status !== 'PENDING_ADMIN') {
        throw new errorHandler_1.AppError('Order cannot be rejected in current status', 400);
    }
    if (req.user.role !== 'OWNER') {
        const hasAccess = await prisma_1.prisma.store.findFirst({
            where: {
                id: order.storeId,
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            }
        });
        if (!hasAccess) {
            throw new errorHandler_1.AppError('No access to this store', 403);
        }
    }
    const updatedOrder = await prisma_1.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
            if (item.variantId && item.variant?.stock !== null) {
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: { stock: { increment: item.quantity } }
                });
            }
            else if (item.product.stock !== null) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } }
                });
            }
        }
        return await tx.order.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectedAt: new Date(),
                rejectionReason: reason,
                notes: notes ? `${order.notes || ''}\n\nAdmin note: ${notes}`.trim() : order.notes,
            },
            include: {
                customer: true,
                store: true,
            },
        });
    });
    await prisma_1.prisma.adminLog.create({
        data: {
            action: 'reject_order',
            adminId: req.user.id,
            orderId: id,
            details: JSON.stringify({
                orderNumber: order.orderNumber,
                reason,
                notes,
            }),
        },
    });
    await notifyCustomerOrderRejected(updatedOrder, reason);
    const { SocketRoomService } = await import('../services/socketRoomService.js');
    SocketRoomService.notifyOrderUpdate(id, order.storeId, 'order:rejected', {
        orderId: id,
        orderNumber: order.orderNumber,
        status: 'REJECTED',
        adminId: req.user.id,
        customerId: order.customerId,
        reason,
    });
    logger_1.logger.info('Order rejected', { orderId: (0, sanitizer_1.sanitizeForLog)(id), adminId: (0, sanitizer_1.sanitizeForLog)(req.user.id), reason: (0, sanitizer_1.sanitizeForLog)(reason) });
    res.json({ order: updatedOrder, message: 'Order rejected successfully' });
});
async function notifyCustomerPaymentConfirmed(order) {
    try {
        const { telegramNotificationService } = await import('../services/telegramNotificationService.js');
        await telegramNotificationService.notifyCustomerPaymentConfirmed(order);
        await notificationService_1.NotificationService.send({
            title: 'Оплата подтверждена',
            message: `Ваша оплата заказа #${order.orderNumber} подтверждена. Заказ будет обработан в ближайшее время.`,
            type: notificationService_1.NotificationType.ORDER_PAID,
            priority: notificationService_1.NotificationPriority.HIGH,
            recipients: [order.customerId],
            channels: [notificationService_1.NotificationChannel.SOCKET],
            data: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                storeId: order.storeId,
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to notify customer about payment confirmation:', (0, logger_1.toLogMetadata)(error));
    }
}
async function notifyCustomerOrderRejected(order, reason) {
    try {
        const { telegramNotificationService } = await import('../services/telegramNotificationService.js');
        await telegramNotificationService.notifyCustomerOrderRejected(order, reason);
        await notificationService_1.NotificationService.send({
            title: 'Заказ отклонен',
            message: `Ваш заказ #${order.orderNumber} был отклонен. Причина: ${reason}`,
            type: notificationService_1.NotificationType.ORDER_REJECTED,
            priority: notificationService_1.NotificationPriority.HIGH,
            recipients: [order.customerId],
            channels: [notificationService_1.NotificationChannel.SOCKET],
            data: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                storeId: order.storeId,
                rejectionReason: reason,
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to notify customer about order rejection:', (0, logger_1.toLogMetadata)(error));
    }
}
async function notifyCustomerOrderShipped(order, trackingNumber, carrier) {
    try {
        await telegramNotificationService_1.telegramNotificationService.notifyCustomerOrderShipped(order, trackingNumber, carrier);
        await notificationService_1.NotificationService.send({
            title: 'Заказ отправлен',
            message: `Ваш заказ #${order.orderNumber} отправлен${trackingNumber ? `. Трек-номер: ${trackingNumber}` : ''}`,
            type: notificationService_1.NotificationType.ORDER_SHIPPED,
            priority: notificationService_1.NotificationPriority.MEDIUM,
            recipients: [order.customerId],
            channels: [notificationService_1.NotificationChannel.SOCKET],
            data: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                storeId: order.storeId,
                trackingNumber,
                carrier,
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to notify customer about order shipment:', (0, logger_1.toLogMetadata)(error));
    }
}
async function notifyCustomerOrderDelivered(order) {
    try {
        await telegramNotificationService_1.telegramNotificationService.notifyCustomerOrderDelivered(order);
        await notificationService_1.NotificationService.send({
            title: 'Заказ доставлен',
            message: `Ваш заказ #${order.orderNumber} успешно доставлен`,
            type: notificationService_1.NotificationType.ORDER_DELIVERED,
            priority: notificationService_1.NotificationPriority.LOW,
            recipients: [order.customerId],
            channels: [notificationService_1.NotificationChannel.SOCKET],
            data: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                storeId: order.storeId,
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to notify customer about order delivery:', (0, logger_1.toLogMetadata)(error));
    }
}
async function notifyCustomerOrderCancelled(order, reason) {
    try {
        await telegramNotificationService_1.telegramNotificationService.notifyCustomerOrderCancelled(order, reason);
        await notificationService_1.NotificationService.send({
            title: 'Заказ отменен',
            message: `Ваш заказ #${order.orderNumber} отменен. Причина: ${reason}`,
            type: notificationService_1.NotificationType.ORDER_CANCELLED,
            priority: notificationService_1.NotificationPriority.MEDIUM,
            recipients: [order.customerId],
            channels: [notificationService_1.NotificationChannel.SOCKET],
            data: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                storeId: order.storeId,
                cancellationReason: reason,
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to notify customer about order cancellation:', (0, logger_1.toLogMetadata)(error));
    }
}
exports.getOrder = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const order = await prisma_1.prisma.order.findUnique({
        where: { id },
        include: {
            customer: {
                select: {
                    id: true,
                    telegramId: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                },
            },
            store: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    currency: true,
                    contactInfo: true,
                },
            },
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            images: true,
                            sku: true,
                        },
                    },
                    variant: {
                        select: {
                            id: true,
                            name: true,
                            value: true,
                            sku: true,
                        },
                    },
                },
            },
            adminLogs: {
                include: {
                    admin: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            },
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    if (req.user.role !== 'OWNER') {
        const hasAccess = order.customerId === req.user.id ||
            await prisma_1.prisma.store.findFirst({
                where: {
                    id: order.storeId,
                    OR: [
                        { ownerId: req.user.id },
                        { admins: { some: { userId: req.user.id } } }
                    ]
                }
            });
        if (!hasAccess) {
            throw new errorHandler_1.AppError('No access to this order', 403);
        }
    }
    const orderResponse = {
        ...order,
        paymentProof: order.paymentProof
            ? `/orders/${order.id}/payment-proof`
            : null
    };
    res.json({ order: orderResponse });
});
exports.shipOrder = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { trackingNumber, carrier } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    const order = await prisma_1.prisma.order.findUnique({
        where: { id },
        include: {
            store: true,
            customer: true,
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    if (order.status !== 'PAID') {
        throw new errorHandler_1.AppError('Order can only be shipped if paid', 400);
    }
    if (req.user.role !== 'OWNER') {
        const hasAccess = await prisma_1.prisma.store.findFirst({
            where: {
                id: order.storeId,
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            }
        });
        if (!hasAccess) {
            throw new errorHandler_1.AppError('No access to this store', 403);
        }
    }
    const updatedOrder = await prisma_1.prisma.order.update({
        where: { id },
        data: {
            status: 'SHIPPED',
            shippedAt: new Date(),
            trackingNumber: trackingNumber || null,
            carrier: carrier || null,
        },
        include: {
            customer: true,
            store: true,
        },
    });
    await prisma_1.prisma.adminLog.create({
        data: {
            action: 'ship_order',
            adminId: req.user.id,
            orderId: id,
            details: JSON.stringify({
                orderNumber: order.orderNumber,
                trackingNumber,
                carrier,
            }),
        },
    });
    await notifyCustomerOrderShipped(updatedOrder, trackingNumber, carrier);
    (0, socket_1.getIO)().emit('order_updated', {
        orderId: id,
        status: 'SHIPPED',
        adminId: req.user.id,
        trackingNumber,
        carrier,
    });
    logger_1.logger.info('Order shipped', { orderId: (0, sanitizer_1.sanitizeForLog)(id), adminId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
    res.json({ order: updatedOrder, message: 'Order shipped successfully' });
});
exports.deliverOrder = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { deliveryNotes } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    const order = await prisma_1.prisma.order.findUnique({
        where: { id },
        include: {
            store: true,
            customer: true,
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    if (order.status !== 'SHIPPED') {
        throw new errorHandler_1.AppError('Order can only be delivered if shipped', 400);
    }
    if (req.user.role !== 'OWNER') {
        const hasAccess = await prisma_1.prisma.store.findFirst({
            where: {
                id: order.storeId,
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            }
        });
        if (!hasAccess) {
            throw new errorHandler_1.AppError('No access to this store', 403);
        }
    }
    const updatedOrder = await prisma_1.prisma.order.update({
        where: { id },
        data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
            deliveryNotes: deliveryNotes || null,
        },
        include: {
            customer: true,
            store: true,
        },
    });
    await prisma_1.prisma.adminLog.create({
        data: {
            action: 'deliver_order',
            adminId: req.user.id,
            orderId: id,
            details: JSON.stringify({
                orderNumber: order.orderNumber,
                deliveryNotes,
            }),
        },
    });
    await notifyCustomerOrderDelivered(updatedOrder);
    (0, socket_1.getIO)().emit('order_updated', {
        orderId: id,
        status: 'DELIVERED',
        adminId: req.user.id,
    });
    logger_1.logger.info('Order delivered', { orderId: (0, sanitizer_1.sanitizeForLog)(id), adminId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
    res.json({ order: updatedOrder, message: 'Order delivered successfully' });
});
exports.cancelOrder = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    if (!reason) {
        throw new errorHandler_1.AppError('Cancellation reason is required', 400);
    }
    const order = await prisma_1.prisma.order.findUnique({
        where: { id },
        include: {
            store: true,
            customer: true,
            items: { include: { product: true, variant: true } },
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
        throw new errorHandler_1.AppError('Order cannot be cancelled in current status', 400);
    }
    if (req.user.role !== 'OWNER') {
        const hasAccess = await prisma_1.prisma.store.findFirst({
            where: {
                id: order.storeId,
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            }
        });
        if (!hasAccess) {
            throw new errorHandler_1.AppError('No access to this store', 403);
        }
    }
    for (const item of order.items) {
        if (item.variantId) {
            await prisma_1.prisma.productVariant.update({
                where: { id: item.variantId },
                data: {
                    stock: {
                        increment: item.quantity,
                    },
                },
            });
        }
        else {
            await prisma_1.prisma.product.update({
                where: { id: item.productId },
                data: {
                    stock: {
                        increment: item.quantity,
                    },
                },
            });
        }
    }
    const updatedOrder = await prisma_1.prisma.order.update({
        where: { id },
        data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: reason,
        },
        include: {
            customer: true,
            store: true,
        },
    });
    await prisma_1.prisma.adminLog.create({
        data: {
            action: 'cancel_order',
            adminId: req.user.id,
            orderId: id,
            details: JSON.stringify({
                orderNumber: order.orderNumber,
                reason,
            }),
        },
    });
    await notifyCustomerOrderCancelled(updatedOrder, reason);
    (0, socket_1.getIO)().emit('order_updated', {
        orderId: id,
        status: 'CANCELLED',
        adminId: req.user.id,
    });
    logger_1.logger.info('Order cancelled', { orderId: (0, sanitizer_1.sanitizeForLog)(id), adminId: (0, sanitizer_1.sanitizeForLog)(req.user.id), reason: (0, sanitizer_1.sanitizeForLog)(reason) });
    res.json({ order: updatedOrder, message: 'Order cancelled successfully' });
});
const uploadOrderPaymentProof = (req, res) => {
    const { id: orderId } = req.params;
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const upload = uploadPaymentProof_1.uploadPaymentProof.single('paymentProof');
    upload(req, res, async (err) => {
        try {
            if (err) {
                logger_1.logger.error('Multer upload error:', { error: err instanceof Error ? err.message : String(err) });
                if (err instanceof Error && err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
                }
                return res.status(400).json({ error: 'File upload failed: ' + (err instanceof Error ? err.message : String(err)) });
            }
            const file = req.file;
            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            await new Promise((resolve, reject) => {
                (0, uploadPaymentProof_1.validateUploadedFile)(req, res, (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
            const order = await prisma_1.prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    customer: true,
                    store: true,
                },
            });
            if (!order) {
                try {
                    await fs.unlink(file.path);
                }
                catch (cleanupError) {
                    logger_1.logger.error('Failed to cleanup uploaded file:', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
                }
                return res.status(404).json({ error: 'Order not found' });
            }
            if (order.customerId !== req.user.id) {
                try {
                    await fs.unlink(file.path);
                }
                catch (cleanupError) {
                    logger_1.logger.error('Failed to cleanup uploaded file:', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
                }
                return res.status(403).json({ error: 'You can only upload payment proof for your own orders' });
            }
            if (order.status !== 'PENDING_ADMIN') {
                try {
                    await fs.unlink(file.path);
                }
                catch (cleanupError) {
                    logger_1.logger.error('Failed to cleanup uploaded file:', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
                }
                return res.status(400).json({ error: 'Payment proof can only be uploaded for pending orders' });
            }
            const relativePath = path.relative(process.cwd(), file.path);
            const updatedOrder = await prisma_1.prisma.order.update({
                where: { id: orderId },
                data: {
                    paymentProof: relativePath,
                },
                include: {
                    customer: true,
                    store: true,
                },
            });
            await notifyAdminsPaymentProofUploaded(updatedOrder);
            (0, socket_1.getIO)().emit('order_updated', {
                orderId,
                status: order.status,
                paymentProof: true,
                customerId: req.user.id,
            });
            logger_1.logger.info('Payment proof uploaded', { orderId: (0, sanitizer_1.sanitizeForLog)(orderId), userId: (0, sanitizer_1.sanitizeForLog)(req.user.id), filename: (0, sanitizer_1.sanitizeForLog)(file.filename) });
            res.json({
                order: updatedOrder,
                message: 'Payment proof uploaded successfully',
                filename: file.filename,
            });
        }
        catch (error) {
            logger_1.logger.error('Payment proof upload error:', { error: error instanceof Error ? error.message : String(error) });
            try {
                const file = req.file;
                if (file?.path) {
                    await fs.unlink(file.path);
                }
            }
            catch (cleanupError) {
                logger_1.logger.error('Failed to cleanup uploaded file:', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
            }
            res.status(500).json({ error: 'Internal server error during file upload' });
        }
    });
};
exports.uploadOrderPaymentProof = uploadOrderPaymentProof;
async function notifyAdminsPaymentProofUploaded(order) {
    try {
        await notificationService_1.NotificationService.send({
            title: 'Payment Proof Uploaded',
            message: `Payment proof has been uploaded for order ${order.orderNumber}`,
            type: notificationService_1.NotificationType.PAYMENT_PROOF_UPLOADED,
            priority: notificationService_1.NotificationPriority.HIGH,
            storeId: order.storeId,
            orderId: order.id,
            channels: [notificationService_1.NotificationChannel.EMAIL, notificationService_1.NotificationChannel.SOCKET],
            recipients: [order.customer.telegramId]
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to send payment proof upload notifications:', (0, logger_1.toLogMetadata)(error));
    }
}
exports.getPaymentProof = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id: orderId } = req.params;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const order = await prisma_1.prisma.order.findUnique({
        where: { id: orderId },
        include: {
            customer: true,
            store: {
                include: {
                    owner: true,
                    admins: {
                        include: {
                            user: true
                        }
                    }
                }
            }
        }
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    if (!order.paymentProof) {
        throw new errorHandler_1.AppError('No payment proof found for this order', 404);
    }
    const hasAccess = order.customerId === req.user.id ||
        order.store.ownerId === req.user.id ||
        order.store.admins.some(admin => admin.userId === req.user.id) ||
        req.user.role === 'OWNER';
    if (!hasAccess) {
        throw new errorHandler_1.AppError('You do not have permission to access this payment proof', 403);
    }
    const filePath = path.isAbsolute(order.paymentProof)
        ? order.paymentProof
        : path.join(process.cwd(), order.paymentProof);
    try {
        await fs.access(filePath);
        const stats = await fs.stat(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentTypeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf'
        };
        const contentType = contentTypeMap[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stats.size);
        if (contentType.startsWith('image/')) {
            res.setHeader('Content-Disposition', `inline; filename="payment_proof_${orderId.slice(-8)}${ext}"`);
        }
        else {
            res.setHeader('Content-Disposition', `attachment; filename="payment_proof_${orderId.slice(-8)}${ext}"`);
        }
        logger_1.logger.info('Payment proof accessed', {
            orderId,
            userId: req.user.id,
            userRole: req.user.role,
            fileSize: stats.size,
            contentType,
            ip: req.ip
        });
        const fileBuffer = await fs.readFile(filePath);
        res.send(fileBuffer);
    }
    catch (error) {
        logger_1.logger.error('Error serving payment proof file:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Payment proof file not found or inaccessible', 404);
    }
});
exports.getOrderStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { storeId, period = 'all' } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const dateFilter = {};
    if (period && period !== 'all') {
        const now = new Date();
        switch (period) {
            case 'today':
                dateFilter.gte = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                dateFilter.gte = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                dateFilter.gte = new Date(now.setMonth(now.getMonth() - 1));
                break;
        }
    }
    const storeFilter = {};
    if (req.user.role !== 'OWNER') {
        const userStores = await prisma_1.prisma.store.findMany({
            where: {
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            },
            select: { id: true }
        });
        const storeIds = userStores.map(store => store.id);
        storeFilter.storeId = { in: storeIds };
        if (storeId && !storeIds.includes(storeId)) {
            throw new errorHandler_1.AppError('No access to this store', 403);
        }
    }
    if (storeId) {
        storeFilter.storeId = storeId;
    }
    const whereClause = {
        ...storeFilter,
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
    };
    const statusStats = await prisma_1.prisma.order.groupBy({
        by: ['status'],
        where: whereClause,
        _count: {
            _all: true,
        },
    });
    const statusCounts = statusStats.reduce((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
    }, {});
    const totalOrders = await prisma_1.prisma.order.count({
        where: whereClause,
    });
    const revenueStats = await prisma_1.prisma.order.aggregate({
        where: {
            ...whereClause,
            status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        },
        _sum: {
            totalAmount: true,
        },
    });
    res.json({
        statusCounts,
        totalOrders,
        totalRevenue: revenueStats._sum.totalAmount || 0,
        period: period,
    });
});
exports.exportOrders = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { status, statuses, storeId, dateFrom, dateTo, } = req.query;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const whereClause = {};
    if (req.user.role !== 'OWNER') {
        whereClause.store = {
            OR: [
                { ownerId: req.user.id },
                { admins: { some: { userId: req.user.id } } }
            ]
        };
    }
    if (statuses) {
        const statusArray = Array.isArray(statuses) ? statuses : [statuses];
        whereClause.status = { in: statusArray };
    }
    else if (status) {
        whereClause.status = status;
    }
    if (storeId) {
        whereClause.storeId = storeId;
    }
    if (dateFrom || dateTo) {
        whereClause.createdAt = {};
        if (dateFrom) {
            whereClause.createdAt.gte = new Date(dateFrom);
        }
        if (dateTo) {
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            whereClause.createdAt.lte = endDate;
        }
    }
    try {
        const orders = await prisma_1.prisma.order.findMany({
            where: whereClause,
            include: {
                customer: {
                    select: {
                        firstName: true,
                        lastName: true,
                        username: true,
                        telegramId: true,
                    }
                },
                store: {
                    select: {
                        name: true,
                        currency: true,
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                                sku: true,
                            }
                        },
                        variant: {
                            select: {
                                name: true,
                                value: true,
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        const csvHeader = 'Номер заказа,Дата,Статус,Клиент,Telegram ID,Магазин,Товары,Сумма,Валюта,Примечания\n';
        const csvRows = orders.map(order => {
            const customerName = order.customer
                ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.username || 'Неизвестно'
                : 'Неизвестно';
            const items = order.items.map(item => {
                const variantInfo = item.variant ? ` (${item.variant.name}: ${item.variant.value})` : '';
                return `${item.product.name}${variantInfo} x${item.quantity}`;
            }).join('; ');
            const statusLabels = {
                PENDING_ADMIN: 'Ожидает подтверждения',
                PAID: 'Оплачен',
                SHIPPED: 'Отправлен',
                DELIVERED: 'Доставлен',
                REJECTED: 'Отклонен',
                CANCELLED: 'Отменен',
            };
            return [
                `"${order.orderNumber}"`,
                `"${new Date(order.createdAt).toLocaleString('ru-RU')}"`,
                `"${statusLabels[order.status] || order.status}"`,
                `"${customerName.replace(/"/g, '""')}"`,
                `"${order.customer?.telegramId || ''}"`,
                `"${order.store.name.replace(/"/g, '""')}"`,
                `"${items.replace(/"/g, '""')}"`,
                order.totalAmount.toFixed(2),
                `"${order.store.currency}"`,
                `"${(order.notes || '').replace(/"/g, '""')}"`,
            ].join(',');
        }).join('\n');
        const csvContent = '\uFEFF' + csvHeader + csvRows;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.csv"`);
        logger_1.logger.info('Orders exported', {
            userId: req.user.id,
            count: orders.length,
            filters: { status: statuses || status, storeId, dateFrom, dateTo }
        });
        res.send(csvContent);
    }
    catch (error) {
        logger_1.logger.error('Error exporting orders:', (0, logger_1.toLogMetadata)(error));
        throw new errorHandler_1.AppError('Failed to export orders', 500);
    }
});
//# sourceMappingURL=orderController.js.map
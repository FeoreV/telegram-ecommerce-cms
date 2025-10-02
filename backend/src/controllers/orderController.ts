import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger, toLogMetadata } from '../utils/logger';
import { NotificationService, NotificationPriority, NotificationType, NotificationChannel } from '../services/notificationService';
import { telegramNotificationService } from '../services/telegramNotificationService';
import { getIO } from '../lib/socket';
import { uploadPaymentProof, validateUploadedFile } from '../middleware/uploadPaymentProof';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Prisma } from '@prisma/client';

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        telegramId: true;
        username: true;
        firstName: true;
        lastName: true;
      };
    };
    store: {
      select: {
        id: true;
        name: true;
        slug: true;
        currency: true;
      };
    };
    items: {
      include: {
        product: {
          select: {
            id: true;
            name: true;
            images: true;
            sku: true;
          };
        };
        variant: {
          select: {
            id: true;
            name: true;
            value: true;
          };
        };
      };
    };
    adminLogs: {
      include: {
        admin: {
          select: {
            id: true;
            username: true;
            firstName: true;
            lastName: true;
          };
        };
      };
      orderBy: {
        createdAt: 'desc';
      };
    };
  };
}>;

// Get orders with filtering and pagination
export const getOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    page = 1,
    limit = 20,
    status,
    storeId,
    customerId,
    search,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build where clause based on role and permissions
  const whereClause: Prisma.OrderWhereInput = {};

  // Role-based filtering
  if (req.user.role !== 'OWNER') {
    // Non-owners only see orders from stores they have access to
    whereClause.store = {
      OR: [
        { ownerId: req.user.id },
        { admins: { some: { userId: req.user.id } } }
      ]
    };
  }

  // Additional filters
  if (status) {
    whereClause.status = status as string;
  }

  if (storeId) {
    whereClause.storeId = storeId as string;
  }
  
  if (customerId) {
    whereClause.customerId = customerId as string;
  }

  if (search) {
    whereClause.OR = [
        { orderNumber: { contains: search as string } },
        { customerInfo: { contains: search as string } },
      { customer: {
          OR: [
          { firstName: { contains: search as string } },
          { lastName: { contains: search as string } },
          { username: { contains: search as string } }
        ]
      }}
    ];
  }

  if (dateFrom || dateTo) {
    whereClause.createdAt = {};
    if (dateFrom) {
      whereClause.createdAt.gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      const endDate = new Date(dateTo as string);
      endDate.setHours(23, 59, 59, 999);
      whereClause.createdAt.lte = endDate;
    }
  }

  try {
    // Get total count
    const total = await prisma.order.count({ where: whereClause });

    // Get orders
    const orders = await prisma.order.findMany({
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
        [sortBy as string]: sortOrder
      },
      skip,
      take: Number(limit),
    });

    res.json({
      items: orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: unknown) {
    logger.error('Error fetching orders:', toLogMetadata(error));
    throw new AppError('Failed to fetch orders', 500);
  }
});

export const createOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    storeId,
    items,
    customerInfo,
    notes,
    clientRequestId 
  } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Validate required fields
  if (!storeId || !items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('Store ID and items are required', 400);
  }

  if (!customerInfo || !customerInfo.name) {
    throw new AppError('Customer information is required', 400);
  }

  // Check if store exists and user has access
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      // Users can only create orders for stores they have access to
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
    throw new AppError('Store not found or access denied', 404);
  }

  // Validate and calculate order total
  let totalAmount = 0;
  const validatedItems: Array<{
    productId: string;
    variantId: string | null;
    quantity: number;
    price: number;
  }> = [];

  for (const item of items) {
    const { productId, variantId, quantity, price } = item;

    if (!productId || !quantity || quantity <= 0) {
      throw new AppError('Invalid item data', 400);
    }

    // Get product with variant
    const product = await prisma.product.findFirst({
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
      throw new AppError(`Product not found: ${productId}`, 400);
    }

    // Check variant if specified
    let variant = null;
    let itemPrice = price || product.price;
    
    if (variantId) {
      variant = product.variants.find(v => v.id === variantId);
      if (!variant) {
        throw new AppError(`Product variant not found: ${variantId}`, 400);
      }
      itemPrice = variant.price || product.price;
    }

    // Check stock if tracking is enabled
    const availableStock = variant?.stock ?? product.stock;
    if (availableStock !== null && availableStock < quantity) {
      throw new AppError(`Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${quantity}`, 400);
    }

    validatedItems.push({
      productId,
      variantId: variantId || null,
      quantity,
      price: itemPrice,
    });

    totalAmount += itemPrice * quantity;
  }

  // Check for duplicate order using clientRequestId
  if (clientRequestId) {
    const existingOrder = await prisma.order.findUnique({
      where: { clientRequestId }
    });
    
    if (existingOrder) {
      return res.status(200).json({ 
        order: existingOrder,
        message: 'Order already exists'
      });
    }
  }
   
  // Generate order number
  const orderDate = new Date();
  const orderPrefix = `${(orderDate.getMonth() + 1).toString().padStart(2, '0')}${orderDate.getFullYear().toString().slice(-2)}`;
  
  // Get next order number for this month/year
  const lastOrder = await prisma.order.findFirst({
    where: {
      orderNumber: {
        startsWith: orderPrefix
      }
    },
    orderBy: {
      orderNumber: 'desc'
    }
  });

  let orderNumber: string;
  if (lastOrder) {
    const lastNumber = parseInt(lastOrder.orderNumber.split('-')[1]) || 0;
    orderNumber = `${orderPrefix}-${(lastNumber + 1).toString().padStart(5, '0')}`;
  } else {
    orderNumber = `${orderPrefix}-00001`;
  }

  try {
    // Create order transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
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

      // Create order items
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

        // Update stock if tracking is enabled
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
        } else {
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

    // Log order creation
    await prisma.adminLog.create({
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

    // Send notifications to store admins
    await NotificationService.send({
      title: 'Новый заказ',
      message: `Получен новый заказ #${order.orderNumber} на сумму ${totalAmount} ${store.currency}`,
      type: NotificationType.ORDER_CREATED,
      priority: NotificationPriority.HIGH,
      recipients: [store.ownerId],
      channels: [NotificationChannel.SOCKET, NotificationChannel.TELEGRAM],
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: store.id,
        totalAmount,
        currency: store.currency,
      }
    });

    // Emit real-time update using SocketRoomService
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

    logger.info(`Order created: ${order.orderNumber} by user ${req.user.id}`);

    res.status(201).json({ order });
  } catch (error: unknown) {
    logger.error('Error creating order:', toLogMetadata(error));
    throw new AppError('Failed to create order', 500);
  }
});

export const confirmPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Check if user has permission to confirm payment
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      store: true,
      customer: true,
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (order.status !== 'PENDING_ADMIN') {
    throw new AppError('Order cannot be confirmed in current status', 400);
  }

  // Check store access for non-owners
  if (req.user.role !== 'OWNER') {
    const hasAccess = await prisma.store.findFirst({
      where: {
        id: order.storeId,
        OR: [
          { ownerId: req.user.id },
          { admins: { some: { userId: req.user.id } } }
        ]
      }
    });

    if (!hasAccess) {
      throw new AppError('No access to this store', 403);
    }
  }

  // Update order status
  const updatedOrder = await prisma.order.update({
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

  // Log admin action
  await prisma.adminLog.create({
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

  // Notify customer
  await notifyCustomerPaymentConfirmed(updatedOrder as any);

  // Emit real-time update using SocketRoomService
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

  logger.info(`Payment confirmed for order ${id} by admin ${req.user.id}`);

  res.json({ order: updatedOrder, message: 'Payment confirmed successfully' });
});

export const rejectOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason, notes } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Check if user has permission to reject orders
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  if (!reason) {
    throw new AppError('Rejection reason is required', 400);
  }

  const order = await prisma.order.findUnique({
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
    throw new AppError('Order not found', 404);
  }

  if (order.status !== 'PENDING_ADMIN') {
    throw new AppError('Order cannot be rejected in current status', 400);
  }

  // Check store access for non-owners
  if (req.user.role !== 'OWNER') {
    const hasAccess = await prisma.store.findFirst({
      where: {
        id: order.storeId,
        OR: [
          { ownerId: req.user.id },
          { admins: { some: { userId: req.user.id } } }
        ]
      }
    });

    if (!hasAccess) {
      throw new AppError('No access to this store', 403);
    }
  }

  // Restore stock and update order status in transaction
  const updatedOrder = await prisma.$transaction(async (tx) => {
    // Restore stock for each item
    for (const item of order.items) {
      if (item.variantId && item.variant?.stock !== null) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } }
        });
      } else if (item.product.stock !== null) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      }
    }

    // Update order status
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

  // Log admin action
  await prisma.adminLog.create({
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

  // Notify customer
  await notifyCustomerOrderRejected(updatedOrder as any, reason);

  // Emit real-time update
  const { SocketRoomService } = await import('../services/socketRoomService.js');
  SocketRoomService.notifyOrderUpdate(id, order.storeId, 'order:rejected', {
    orderId: id,
    orderNumber: order.orderNumber,
    status: 'REJECTED',
    adminId: req.user.id,
    customerId: order.customerId,
    reason,
  });

  logger.info(`Order ${id} rejected by admin ${req.user.id}. Reason: ${reason}`);

  res.json({ order: updatedOrder, message: 'Order rejected successfully' });
});

// Helper functions for notifications
async function notifyCustomerPaymentConfirmed(order: OrderWithRelations) {
  try {
    // Send notification through Telegram bot
    const { telegramNotificationService } = await import('../services/telegramNotificationService.js');
    await telegramNotificationService.notifyCustomerPaymentConfirmed(order);
    
    // Also send through general notification system (for socket/email)
    await NotificationService.send({
      title: 'Оплата подтверждена',
      message: `Ваша оплата заказа #${order.orderNumber} подтверждена. Заказ будет обработан в ближайшее время.`,
      type: NotificationType.ORDER_PAID,
      priority: NotificationPriority.HIGH,
      recipients: [order.customerId],
      channels: [NotificationChannel.SOCKET],
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to notify customer about payment confirmation:', toLogMetadata(error));
  }
}

async function notifyCustomerOrderRejected(order: OrderWithRelations, reason: string) {
  try {
    // Send notification through Telegram bot
    const { telegramNotificationService } = await import('../services/telegramNotificationService.js');
    await telegramNotificationService.notifyCustomerOrderRejected(order, reason);
    
    // Also send through general notification system (for socket/email)
    await NotificationService.send({
      title: 'Заказ отклонен',
      message: `Ваш заказ #${order.orderNumber} был отклонен. Причина: ${reason}`,
      type: NotificationType.ORDER_REJECTED,
      priority: NotificationPriority.HIGH,
      recipients: [order.customerId],
      channels: [NotificationChannel.SOCKET],
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
        rejectionReason: reason,
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to notify customer about order rejection:', toLogMetadata(error));
  }
}

async function notifyCustomerOrderShipped(order: OrderWithRelations, trackingNumber?: string, carrier?: string) {
  try {
    // Send notification through Telegram bot
    await telegramNotificationService.notifyCustomerOrderShipped(order, trackingNumber, carrier);
    
    // Also send through general notification system (for socket/email)
    await NotificationService.send({
      title: 'Заказ отправлен',
      message: `Ваш заказ #${order.orderNumber} отправлен${trackingNumber ? `. Трек-номер: ${trackingNumber}` : ''}`,
      type: NotificationType.ORDER_SHIPPED,
      priority: NotificationPriority.MEDIUM,
      recipients: [order.customerId],
      channels: [NotificationChannel.SOCKET],
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
        trackingNumber,
        carrier,
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to notify customer about order shipment:', toLogMetadata(error));
  }
}

async function notifyCustomerOrderDelivered(order: OrderWithRelations) {
  try {
    // Send notification through Telegram bot
    await telegramNotificationService.notifyCustomerOrderDelivered(order);
    
    // Also send through general notification system (for socket/email)
    await NotificationService.send({
      title: 'Заказ доставлен',
      message: `Ваш заказ #${order.orderNumber} успешно доставлен`,
      type: NotificationType.ORDER_DELIVERED,
      priority: NotificationPriority.LOW,
      recipients: [order.customerId],
      channels: [NotificationChannel.SOCKET],
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to notify customer about order delivery:', toLogMetadata(error));
  }
}

async function notifyCustomerOrderCancelled(order: OrderWithRelations, reason: string) {
  try {
    // Send notification through Telegram bot
    await telegramNotificationService.notifyCustomerOrderCancelled(order, reason);
    
    // Also send through general notification system (for socket/email)
    await NotificationService.send({
      title: 'Заказ отменен',
      message: `Ваш заказ #${order.orderNumber} отменен. Причина: ${reason}`,
      type: NotificationType.ORDER_CANCELLED,
      priority: NotificationPriority.MEDIUM,
      recipients: [order.customerId],
      channels: [NotificationChannel.SOCKET],
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
        cancellationReason: reason,
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to notify customer about order cancellation:', toLogMetadata(error));
  }
}

export const getOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const order = await prisma.order.findUnique({
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
    throw new AppError('Order not found', 404);
  }

  // Role-based access control
  if (req.user.role !== 'OWNER') {
    // Check if user is customer or has access to the store
    const hasAccess = order.customerId === req.user.id || 
      await prisma.store.findFirst({
        where: {
          id: order.storeId,
          OR: [
            { ownerId: req.user.id },
            { admins: { some: { userId: req.user.id } } }
          ]
        }
      });

    if (!hasAccess) {
      throw new AppError('No access to this order', 403);
    }
  }

  res.json({ order });
});

export const shipOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { trackingNumber, carrier } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Check permissions
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      store: true,
      customer: true,
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Validate status transition
  if (order.status !== 'PAID') {
    throw new AppError('Order can only be shipped if paid', 400);
  }

  // Check store access for non-owners
  if (req.user.role !== 'OWNER') {
    const hasAccess = await prisma.store.findFirst({
      where: {
        id: order.storeId,
        OR: [
          { ownerId: req.user.id },
          { admins: { some: { userId: req.user.id } } }
        ]
      }
    });

    if (!hasAccess) {
      throw new AppError('No access to this store', 403);
    }
  }

  // Update order status
  const updatedOrder = await prisma.order.update({
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

  // Log admin action
  await prisma.adminLog.create({
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

  // Notify customer
  await notifyCustomerOrderShipped(updatedOrder as any, trackingNumber, carrier);

  // Emit real-time update
  getIO().emit('order_updated', {
    orderId: id,
    status: 'SHIPPED',
    adminId: req.user.id,
    trackingNumber,
    carrier,
  });

  logger.info(`Order ${id} shipped by admin ${req.user.id}`);

  res.json({ order: updatedOrder, message: 'Order shipped successfully' });
});

export const deliverOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { deliveryNotes } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Check permissions
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      store: true,
      customer: true,
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Validate status transition
  if (order.status !== 'SHIPPED') {
    throw new AppError('Order can only be delivered if shipped', 400);
  }

  // Check store access for non-owners
  if (req.user.role !== 'OWNER') {
    const hasAccess = await prisma.store.findFirst({
      where: {
        id: order.storeId,
        OR: [
          { ownerId: req.user.id },
          { admins: { some: { userId: req.user.id } } }
        ]
      }
    });

    if (!hasAccess) {
      throw new AppError('No access to this store', 403);
    }
  }

  // Update order status
  const updatedOrder = await prisma.order.update({
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

  // Log admin action
  await prisma.adminLog.create({
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

  // Notify customer
  await notifyCustomerOrderDelivered(updatedOrder as any);

  // Emit real-time update
  getIO().emit('order_updated', {
    orderId: id,
    status: 'DELIVERED',
    adminId: req.user.id,
  });

  logger.info(`Order ${id} delivered by admin ${req.user.id}`);

  res.json({ order: updatedOrder, message: 'Order delivered successfully' });
});

export const cancelOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Check permissions
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  if (!reason) {
    throw new AppError('Cancellation reason is required', 400);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      store: true,
      customer: true,
      items: { include: { product: true, variant: true } },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Validate status transition
  if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
    throw new AppError('Order cannot be cancelled in current status', 400);
  }

  // Check store access for non-owners
  if (req.user.role !== 'OWNER') {
    const hasAccess = await prisma.store.findFirst({
      where: {
        id: order.storeId,
        OR: [
          { ownerId: req.user.id },
          { admins: { some: { userId: req.user.id } } }
        ]
      }
    });

    if (!hasAccess) {
      throw new AppError('No access to this store', 403);
    }
  }

  // Restore stock
  for (const item of order.items) {
    if (item.variantId) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: {
          stock: {
            increment: item.quantity,
          },
        },
      });
    } else {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            increment: item.quantity,
          },
        },
      });
    }
  }

  // Update order status
  const updatedOrder = await prisma.order.update({
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

  // Log admin action
  await prisma.adminLog.create({
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

  // Notify customer
  await notifyCustomerOrderCancelled(updatedOrder as any, reason);

  // Emit real-time update
  getIO().emit('order_updated', {
    orderId: id,
    status: 'CANCELLED',
    adminId: req.user.id,
  });

  logger.info(`Order ${id} cancelled by admin ${req.user.id}, reason: ${reason}`);

  res.json({ order: updatedOrder, message: 'Order cancelled successfully' });
});

export const uploadOrderPaymentProof = (req: AuthenticatedRequest, res: Response) => {
  const { id: orderId } = req.params;

  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Handle file upload with enhanced validation
  const upload = uploadPaymentProof.single('paymentProof');
  upload(req, res, async (err: unknown) => {
    try {
      if (err) {
        logger.error('Multer upload error:', { error: err instanceof Error ? err.message : String(err) });
        if (err instanceof Error && (err as any).code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: 'File upload failed: ' + (err instanceof Error ? err.message : String(err)) });
      }

      const file = req.file as Express.Multer.File;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate uploaded file with magic byte checking
      await new Promise<void>((resolve, reject) => {
        validateUploadedFile(req, res, (err: unknown) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Find the order
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          store: true,
        },
      });

      if (!order) {
        // Clean up uploaded file
        try {
          await fs.unlink(file.path);
        } catch (cleanupError: unknown) {
          logger.error('Failed to cleanup uploaded file:', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
        }
        return res.status(404).json({ error: 'Order not found' });
      }

      // Check if the user owns this order
      if (order.customerId !== req.user.id) {
        // Clean up uploaded file
        try {
          await fs.unlink(file.path);
        } catch (cleanupError: unknown) {
          logger.error('Failed to cleanup uploaded file:', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
        }
        return res.status(403).json({ error: 'You can only upload payment proof for your own orders' });
      }

      // Check if order is in correct status
      if (order.status !== 'PENDING_ADMIN') {
        // Clean up uploaded file
        try {
          await fs.unlink(file.path);
        } catch (cleanupError: unknown) {
          logger.error('Failed to cleanup uploaded file:', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
        }
        return res.status(400).json({ error: 'Payment proof can only be uploaded for pending orders' });
      }

      // Store relative path in database
      const relativePath = path.relative(process.cwd(), file.path);

      // Update order with payment proof
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentProof: relativePath,
        },
        include: {
          customer: true,
          store: true,
        },
      });

      // Notify admins about payment proof upload
      await notifyAdminsPaymentProofUploaded(updatedOrder as any);

      // Emit real-time update
      getIO().emit('order_updated', {
        orderId,
        status: order.status,
        paymentProof: true,
        customerId: req.user.id,
      });

      logger.info(`Payment proof uploaded for order ${orderId} by user ${req.user.id}: ${file.filename}`);

      res.json({
        order: updatedOrder,
        message: 'Payment proof uploaded successfully',
        filename: file.filename,
      });

    } catch (error: unknown) {
      logger.error('Payment proof upload error:', { error: error instanceof Error ? error.message : String(error) });
      
      // Clean up uploaded file if database update fails
      try {
        const file = req.file as Express.Multer.File;
        if (file?.path) {
          await fs.unlink(file.path);
        }
      } catch (cleanupError: unknown) {
        logger.error('Failed to cleanup uploaded file:', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
      }
      
      res.status(500).json({ error: 'Internal server error during file upload' });
    }
  });
};

async function notifyAdminsPaymentProofUploaded(order: OrderWithRelations) {
  try {
    const customerName = `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'Неизвестный покупатель';
    
    // Use notification service to notify about payment proof upload
    await NotificationService.send({
      title: 'Payment Proof Uploaded',
      message: `Payment proof has been uploaded for order ${order.orderNumber}`,
      type: NotificationType.PAYMENT_PROOF_UPLOADED,
      priority: NotificationPriority.HIGH,
      storeId: order.storeId,
      orderId: order.id,
      channels: [NotificationChannel.EMAIL, NotificationChannel.SOCKET],
      recipients: [order.customer.telegramId]
    });
  } catch (error: unknown) {
    logger.error('Failed to send payment proof upload notifications:', toLogMetadata(error));
  }
}

// Secure endpoint to serve payment proof files with access control
export const getPaymentProof = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id: orderId } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Find the order with payment proof
  const order = await prisma.order.findUnique({
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
    throw new AppError('Order not found', 404);
  }

  if (!order.paymentProof) {
    throw new AppError('No payment proof found for this order', 404);
  }

  // Check access permissions
  const hasAccess = 
    // Customer can access their own payment proof
    order.customerId === req.user.id ||
    // Store owner can access payment proofs for their store
    order.store.ownerId === req.user.id ||
    // Store admins can access payment proofs for their store
    order.store.admins.some(admin => admin.userId === req.user.id) ||
    // Global OWNER role can access any payment proof
    req.user.role === 'OWNER';

  if (!hasAccess) {
    throw new AppError('You do not have permission to access this payment proof', 403);
  }

  // Construct file path (stored as relative path)
  const filePath = path.isAbsolute(order.paymentProof) 
    ? order.paymentProof 
    : path.join(process.cwd(), order.paymentProof);

  try {
    // Check if file exists
    await fs.access(filePath);
    
    // Get file stats for content length
    const stats = await fs.stat(filePath);
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="payment_proof_${orderId.slice(-8)}.${path.extname(filePath).slice(1)}"`);
    
    // Log access for audit
    logger.info('Payment proof accessed', {
      orderId,
      userId: req.user.id,
      userRole: req.user.role,
      fileSize: stats.size,
      ip: req.ip
    });

    // Stream the file
    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);

  } catch (error: unknown) {
    logger.error('Error serving payment proof file:', toLogMetadata(error));
    throw new AppError('Payment proof file not found or inaccessible', 404);
  }
});

// Get order statistics
export const getOrderStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId, period = 'all' } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Build date filter
  const dateFilter: Prisma.DateTimeFilter = {};
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

  // Build store filter based on role and permissions
  const storeFilter: Prisma.OrderWhereInput = {};
  if (req.user.role !== 'OWNER') {
    // Non-owners only see stats from stores they have access to
    const userStores = await prisma.store.findMany({
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

    // If specific store requested, verify access
    if (storeId && !storeIds.includes(storeId as string)) {
      throw new AppError('No access to this store', 403);
    }
  }

  // Apply store filter if requested
  if (storeId) {
    storeFilter.storeId = storeId as string;
  }

  // Build where clause
  const whereClause: Prisma.OrderWhereInput = {
    ...storeFilter,
    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
  };

  // Get order status counts
  const statusStats = await prisma.order.groupBy({
    by: ['status'],
    where: whereClause,
    _count: {
      _all: true,
    },
  });

  // Transform to object with status counts
  const statusCounts = statusStats.reduce((acc: Record<string, number>, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, {} as Record<string, number>);

  // Get total orders count
  const totalOrders = await prisma.order.count({
    where: whereClause,
  });

  // Get total revenue (only from paid orders)
  const revenueStats = await prisma.order.aggregate({
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
    period: period as string,
  });
});

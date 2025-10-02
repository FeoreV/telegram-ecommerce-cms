import { AppError } from '../middleware/errorHandler';

// Order status enum matching database values
export enum OrderStatus {
  PENDING_ADMIN = 'PENDING_ADMIN',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

// Valid status transitions
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_ADMIN]: [
    OrderStatus.PAID,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.SHIPPED]: [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED, // Emergency cancellation
  ],
  [OrderStatus.DELIVERED]: [
    // Final state - no transitions
  ],
  [OrderStatus.CANCELLED]: [
    // Final state - no transitions 
  ],
  [OrderStatus.REJECTED]: [
    // Final state - no transitions
  ],
};

// Status descriptions for notifications and UI
export const STATUS_DESCRIPTIONS: Record<OrderStatus, { title: string; description: string }> = {
  [OrderStatus.PENDING_ADMIN]: {
    title: 'Ожидает подтверждения',
    description: 'Заказ создан и ожидает подтверждения оплаты администратором',
  },
  [OrderStatus.PAID]: {
    title: 'Оплачен',
    description: 'Оплата подтверждена, заказ готовится к отправке',
  },
  [OrderStatus.SHIPPED]: {
    title: 'Отправлен',
    description: 'Заказ отправлен курьерской службой',
  },
  [OrderStatus.DELIVERED]: {
    title: 'Доставлен',
    description: 'Заказ успешно доставлен покупателю',
  },
  [OrderStatus.CANCELLED]: {
    title: 'Отменен',
    description: 'Заказ отменен по запросу клиента или администратора',
  },
  [OrderStatus.REJECTED]: {
    title: 'Отклонен',
    description: 'Заказ отклонен из-за проблем с оплатой или товаром',
  },
};

/**
 * Validates if a status transition is allowed
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): void {
  const current = currentStatus as OrderStatus;
  const target = newStatus as OrderStatus;

  if (!Object.values(OrderStatus).includes(current)) {
    throw new AppError(`Invalid current status: ${currentStatus}`, 400);
  }

  if (!Object.values(OrderStatus).includes(target)) {
    throw new AppError(`Invalid target status: ${newStatus}`, 400);
  }

  const allowedTransitions = VALID_TRANSITIONS[current];
  if (!allowedTransitions.includes(target)) {
    throw new AppError(
      `Invalid status transition: ${currentStatus} → ${newStatus}. ` +
      `Allowed transitions: ${allowedTransitions.join(', ')}`,
      400
    );
  }
}

/**
 * Check if a status is final (no further transitions allowed)
 */
export function isFinalStatus(status: string): boolean {
  const orderStatus = status as OrderStatus;
  return VALID_TRANSITIONS[orderStatus].length === 0;
}

/**
 * Get available next statuses for current status
 */
export function getAvailableTransitions(currentStatus: string): OrderStatus[] {
  const status = currentStatus as OrderStatus;
  return VALID_TRANSITIONS[status] || [];
}

/**
 * Check if status requires stock restoration (for cancellations)
 */
export function shouldRestoreStock(newStatus: string): boolean {
  return [OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(newStatus as OrderStatus);
}

/**
 * Check if status is considered "active" (not final)
 */
export function isActiveStatus(status: string): boolean {
  return !isFinalStatus(status);
}

export default {
  OrderStatus,
  VALID_TRANSITIONS,
  STATUS_DESCRIPTIONS,
  validateStatusTransition,
  isFinalStatus,
  getAvailableTransitions,
  shouldRestoreStock,
  isActiveStatus,
};

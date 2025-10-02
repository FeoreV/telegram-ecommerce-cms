"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUS_DESCRIPTIONS = exports.VALID_TRANSITIONS = exports.OrderStatus = void 0;
exports.validateStatusTransition = validateStatusTransition;
exports.isFinalStatus = isFinalStatus;
exports.getAvailableTransitions = getAvailableTransitions;
exports.shouldRestoreStock = shouldRestoreStock;
exports.isActiveStatus = isActiveStatus;
const errorHandler_1 = require("../middleware/errorHandler");
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING_ADMIN"] = "PENDING_ADMIN";
    OrderStatus["PAID"] = "PAID";
    OrderStatus["SHIPPED"] = "SHIPPED";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
    OrderStatus["REJECTED"] = "REJECTED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
exports.VALID_TRANSITIONS = {
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
        OrderStatus.CANCELLED,
    ],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.REJECTED]: [],
};
exports.STATUS_DESCRIPTIONS = {
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
function validateStatusTransition(currentStatus, newStatus) {
    const current = currentStatus;
    const target = newStatus;
    if (!Object.values(OrderStatus).includes(current)) {
        throw new errorHandler_1.AppError(`Invalid current status: ${currentStatus}`, 400);
    }
    if (!Object.values(OrderStatus).includes(target)) {
        throw new errorHandler_1.AppError(`Invalid target status: ${newStatus}`, 400);
    }
    const allowedTransitions = exports.VALID_TRANSITIONS[current];
    if (!allowedTransitions.includes(target)) {
        throw new errorHandler_1.AppError(`Invalid status transition: ${currentStatus} → ${newStatus}. ` +
            `Allowed transitions: ${allowedTransitions.join(', ')}`, 400);
    }
}
function isFinalStatus(status) {
    const orderStatus = status;
    return exports.VALID_TRANSITIONS[orderStatus].length === 0;
}
function getAvailableTransitions(currentStatus) {
    const status = currentStatus;
    return exports.VALID_TRANSITIONS[status] || [];
}
function shouldRestoreStock(newStatus) {
    return [OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(newStatus);
}
function isActiveStatus(status) {
    return !isFinalStatus(status);
}
exports.default = {
    OrderStatus,
    VALID_TRANSITIONS: exports.VALID_TRANSITIONS,
    STATUS_DESCRIPTIONS: exports.STATUS_DESCRIPTIONS,
    validateStatusTransition,
    isFinalStatus,
    getAvailableTransitions,
    shouldRestoreStock,
    isActiveStatus,
};
//# sourceMappingURL=orderStateMachine.js.map
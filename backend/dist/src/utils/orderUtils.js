"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatOrderSummary = exports.calculateOrderTotal = exports.generateOrderNumber = void 0;
const prisma_1 = require("../lib/prisma");
const generateOrderNumber = async () => {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;
    const lastOrder = await prisma_1.prisma.order.findFirst({
        where: {
            orderNumber: {
                startsWith: datePrefix,
            },
        },
        orderBy: {
            orderNumber: 'desc',
        },
    });
    let sequence = 1;
    if (lastOrder) {
        const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
        sequence = lastSequence + 1;
    }
    return `${datePrefix}${sequence.toString().padStart(4, '0')}`;
};
exports.generateOrderNumber = generateOrderNumber;
const calculateOrderTotal = (items) => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
};
exports.calculateOrderTotal = calculateOrderTotal;
const formatOrderSummary = (order) => {
    const items = order.items.map((item) => {
        const variantInfo = item.variant ? ` (${item.variant.name}: ${item.variant.value})` : '';
        return `• ${item.product.name}${variantInfo} x${item.quantity} - ${item.price} ${order.currency}`;
    }).join('\n');
    return `
🛍️ Order #${order.orderNumber}
🏪 Store: ${order.store.name}
👤 Customer: ${order.customer.firstName} ${order.customer.lastName}

📦 Items:
${items}

💰 Total: ${order.totalAmount} ${order.currency}
📅 Created: ${order.createdAt.toLocaleDateString()}
  `.trim();
};
exports.formatOrderSummary = formatOrderSummary;
//# sourceMappingURL=orderUtils.js.map
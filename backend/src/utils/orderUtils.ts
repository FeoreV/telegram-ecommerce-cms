import { prisma } from '../lib/prisma';

export const generateOrderNumber = async (): Promise<string> => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  
  const datePrefix = `${year}${month}${day}`;
  
  // Find the highest order number for today
  const lastOrder = await prisma.order.findFirst({
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

export const calculateOrderTotal = (items: Array<{ price: number; quantity: number }>): number => {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0);
};

interface OrderWithDetails {
  orderNumber: string;
  currency: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
  store: {
    name: string;
  };
  customer: {
    firstName: string;
    lastName: string;
  };
  items: Array<{
    quantity: number;
    price: number;
    product: {
      name: string;
    };
    variant?: {
      name: string;
      value: string;
    };
  }>;
}

export const formatOrderSummary = (order: OrderWithDetails): string => {
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

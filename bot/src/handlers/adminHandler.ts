import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { apiService } from '../services/apiService';
import { userSessions } from '../utils/sessionManager';

interface AdminCommand {
  command: string;
  description: string;
  handler: (bot: TelegramBot, chatId: number, args: string[], session: any) => Promise<void>;
  roles: string[];
}

// Admin commands registry
const adminCommands: AdminCommand[] = [
  {
    command: 'orders',
    description: '📋 Просмотр заказов для проверки',
    handler: handleOrdersList,
    roles: ['OWNER', 'ADMIN']
  },
  {
    command: 'verify',
    description: '✅ Подтвердить оплату заказа',
    handler: handleVerifyPayment,
    roles: ['OWNER', 'ADMIN']
  },
  {
    command: 'reject',
    description: '❌ Отклонить оплату заказа',
    handler: handleRejectPayment,
    roles: ['OWNER', 'ADMIN']
  },
  {
    command: 'analytics',
    description: '📊 Быстрая аналитика',
    handler: handleAnalytics,
    roles: ['OWNER', 'ADMIN']
  },
  {
    command: 'stores',
    description: '🏪 Управление магазинами',
    handler: handleStoresList,
    roles: ['OWNER']
  },
  {
    command: 'alerts',
    description: '⚠️ Предупреждения о запасах',
    handler: handleInventoryAlerts,
    roles: ['OWNER', 'ADMIN', 'VENDOR']
  }
];

export async function handleAdmin(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  callbackQuery?: TelegramBot.CallbackQuery
) {
  const chatId = msg.chat.id;
  // Use callbackQuery.from.id if available (button press), otherwise msg.from.id (command)
  const userId = (callbackQuery?.from?.id || msg.from?.id)?.toString();
  
  if (!userId) return;
  
  if (callbackQuery && callbackQuery.data) {
    // Handle callback queries
    if (callbackQuery.data.startsWith('verify_order_')) {
      const orderId = callbackQuery.data.replace('verify_order_', '');
      await handleAdminCommand(bot, chatId, 'verify', [orderId], userId);
    } else if (callbackQuery.data.startsWith('reject_order_')) {
      const orderId = callbackQuery.data.replace('reject_order_', '');
      await handleAdminCommand(bot, chatId, 'reject', [orderId], userId);
    } else if (callbackQuery.data.startsWith('confirm_payment_')) {
      const orderId = callbackQuery.data.replace('confirm_payment_', '');
      await handleConfirmPaymentCallback(bot, chatId, orderId, userId);
    } else if (callbackQuery.data.startsWith('confirm_reject_')) {
      // confirm_reject_{orderId}_{encodedReason}
      const parts = callbackQuery.data.split('_');
      if (parts.length >= 4) {
        const orderId = parts[2];
        const encodedReason = parts.slice(3).join('_');
        const reason = decodeURIComponent(encodedReason);
        await handleConfirmRejectCallback(bot, chatId, orderId, reason, userId);
      }
    } else if (callbackQuery.data.startsWith('orders_')) {
      const status = callbackQuery.data.replace('orders_', '');
      await handleAdminCommand(bot, chatId, 'orders', [status], userId);
    } else if (callbackQuery.data.startsWith('analytics_')) {
      const period = callbackQuery.data.replace('analytics_', '');
      await handleAdminCommand(bot, chatId, 'analytics', [period], userId);
    } else if (callbackQuery.data === 'admin_analytics') {
      await handleAdminCommand(bot, chatId, 'analytics', [], userId);
    } else if (callbackQuery.data === 'admin_orders_pending') {
      await handleAdminCommand(bot, chatId, 'orders', ['PENDING_ADMIN'], userId);
    } else if (callbackQuery.data === 'admin_alerts') {
      await handleAdminCommand(bot, chatId, 'alerts', [], userId);
    } else if (callbackQuery.data === 'admin_stores') {
      await handleAdminCommand(bot, chatId, 'stores', [], userId);
    } else if (callbackQuery.data.startsWith('alerts_')) {
      const severity = callbackQuery.data.replace('alerts_', '');
      await handleAdminCommand(bot, chatId, 'alerts', [severity], userId);
    }
  } else {
    // Show admin menu (from /admin command, userId is from msg.from)
    await handleAdminCommand(bot, chatId, 'help', [], userId);
  }
}

async function handleConfirmPaymentCallback(bot: TelegramBot, chatId: number, orderId: string, userId?: string) {
  try {
    const session = userSessions.getSession(userId || chatId.toString());
    if (!session?.token) {
      await bot.sendMessage(chatId, '❌ Вы не авторизованы.');
      return;
    }

    const loading = await bot.sendMessage(chatId, '⏳ Подтверждаю оплату...');
    await apiService.confirmPayment(orderId, session.token);

    await bot.editMessageText('✅ Оплата подтверждена', {
      chat_id: chatId,
      message_id: loading.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Заказы', callback_data: 'orders_PENDING_ADMIN' }]
        ]
      }
    });
  } catch (error) {
    logger.error('Error confirming payment:', error);
    await bot.sendMessage(chatId, '❌ Не удалось подтвердить оплату.');
  }
}

async function handleConfirmRejectCallback(bot: TelegramBot, chatId: number, orderId: string, reason: string, userId?: string) {
  try {
    const session = userSessions.getSession(userId || chatId.toString());
    if (!session?.token) {
      await bot.sendMessage(chatId, '❌ Вы не авторизованы.');
      return;
    }

    const loading = await bot.sendMessage(chatId, '⏳ Отклоняю заказ...');
    await apiService.rejectOrder(orderId, reason, session.token);

    await bot.editMessageText('✅ Заказ отклонён', {
      chat_id: chatId,
      message_id: loading.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Заказы', callback_data: 'orders_PENDING_ADMIN' }]
        ]
      }
    });
  } catch (error) {
    logger.error('Error rejecting order:', error);
    await bot.sendMessage(chatId, '❌ Не удалось отклонить заказ.');
  }
}

export async function handleAdminCommand(
  bot: TelegramBot,
  chatId: number,
  command: string,
  args: string[] = [],
  userId?: string
) {
  try {
    const session = userSessions.getSession(userId || chatId.toString());
    
    if (!session || !session.token) {
      await bot.sendMessage(chatId, '❌ Вы не авторизованы. Используйте /start для входа.');
      return;
    }

    // Check if user has admin role
    if (!session.role || !['OWNER', 'ADMIN', 'VENDOR'].includes(session.role)) {
      await bot.sendMessage(chatId, '❌ У вас нет прав администратора.');
      return;
    }

    const adminCommand = adminCommands.find(cmd => cmd.command === command);
    
    if (!adminCommand) {
      await showAdminHelp(bot, chatId, session);
      return;
    }

    // Check role permissions
    if (!session.role || !adminCommand.roles.includes(session.role)) {
      await bot.sendMessage(chatId, `❌ Недостаточно прав для команды /${command}`);
      return;
    }

    await adminCommand.handler(bot, chatId, args, session);

  } catch (error) {
    logger.error('Error handling admin command:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка при выполнении команды');
  }
}

async function showAdminHelp(bot: TelegramBot, chatId: number, session: any) {
  const availableCommands = adminCommands.filter(cmd => 
    cmd.roles.includes(session.role)
  );

  let helpText = '🛠 *Команды администратора:*\n\n';
  
  availableCommands.forEach(cmd => {
    helpText += `/${cmd.command} — ${cmd.description}\n`;
  });

  helpText += '\n💡 *Быстрые действия:*\n';
  helpText += '• Отправьте ID заказа для быстрой проверки\n';
  helpText += '• Используйте inline кнопки для управления\n';

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 Заказы на проверку', callback_data: 'admin_orders_pending' },
        { text: '📊 Аналитика', callback_data: 'admin_analytics' }
      ],
      [
        { text: '⚠️ Уведомления', callback_data: 'admin_alerts' },
        { text: '🏪 Магазины', callback_data: 'admin_stores' }
      ]
    ]
  };

  await bot.sendMessage(chatId, helpText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function handleOrdersList(bot: TelegramBot, chatId: number, args: string[], session: any) {
  try {
    const status = args[0] || 'PENDING_ADMIN';
    const ordersList = await apiService.getOrders(session.token, {
      status,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });

    const orders = ordersList.orders;

    if (!orders || orders.length === 0) {
      await bot.sendMessage(chatId, `📋 Нет заказов со статусом "${status}"`);
      return;
    }

    let message = `📋 *Заказы (${status}):*\n\n`;
    
    orders.slice(0, 5).forEach((order: any, index: number) => {
      const orderNumber = order.orderNumber.slice(-8);
      const amount = order.totalAmount;
      const currency = order.currency || 'USD';
      const customer = order.customer?.firstName || order.customer?.username || 'Неизвестно';
      
      message += `${index + 1}. *#${orderNumber}*\n`;
      message += `   💰 ${amount} ${currency}\n`;
      message += `   👤 ${customer}\n`;
      message += `   📅 ${new Date(order.createdAt).toLocaleString('ru')}\n\n`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Ожидают проверки', callback_data: 'orders_PENDING_ADMIN' },
          { text: '💰 Оплаченные', callback_data: 'orders_PAID' }
        ],
        [
          { text: '📦 Отправленные', callback_data: 'orders_SHIPPED' },
          { text: '✅ Доставленные', callback_data: 'orders_DELIVERED' }
        ],
        [
          { text: '❌ Отклоненные', callback_data: 'orders_REJECTED' }
        ]
      ]
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error('Error fetching orders list:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке списка заказов');
  }
}

async function handleVerifyPayment(bot: TelegramBot, chatId: number, args: string[], session: any) {
  const orderId = args[0];
  
  if (!orderId) {
    await bot.sendMessage(chatId, '💡 Использование: `/verify [ID_заказа]`\n\nПример: `/verify abc123`');
    return;
  }

  try {
    // Find orders with partial ID match
    const ordersList = await apiService.getOrders(session.token, {
      search: orderId,
      status: 'PENDING_ADMIN',
      limit: 5
    });

    const orders = ordersList.orders;

    if (!orders || orders.length === 0) {
      await bot.sendMessage(chatId, `❌ Заказы с ID "${orderId}" не найдены или уже обработаны`);
      return;
    }

    // If exactly one match, confirm directly
    if (orders.length === 1) {
      await showOrderVerification(bot, chatId, orders[0], session);
      return;
    }

    // Multiple matches - show selection
    let message = `🔍 Найдено несколько заказов с "${orderId}":\n\n`;
    
    const keyboard = {
      inline_keyboard: orders.map((order: any, index: number) => [{
        text: `#${order.orderNumber.slice(-8)} - ${order.totalAmount} ${order.currency}`,
        callback_data: `verify_order_${order.id}`
      }])
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error('Error in verify payment:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при поиске заказа');
  }
}

async function handleRejectPayment(bot: TelegramBot, chatId: number, args: string[], session: any) {
  const orderId = args[0];
  const reason = args.slice(1).join(' ') || 'Не указана';
  
  if (!orderId) {
    await bot.sendMessage(chatId, '💡 Использование: `/reject [ID_заказа] [причина]`\n\nПример: `/reject abc123 Неверный чек`');
    return;
  }

  try {
    const ordersList = await apiService.getOrders(session.token, {
      search: orderId,
      status: 'PENDING_ADMIN',
      limit: 5
    });

    const orders = ordersList.orders;

    if (!orders || orders.length === 0) {
      await bot.sendMessage(chatId, `❌ Заказы с ID "${orderId}" не найдены или уже обработаны`);
      return;
    }

    if (orders.length === 1) {
      await showOrderRejection(bot, chatId, orders[0], reason, session);
      return;
    }

    // Store rejection reason in session for callback
    userSessions.updateSession(chatId.toString(), {
      pendingRejection: { reason }
    });

    let message = `🔍 Найдено несколько заказов с "${orderId}":\n\n`;
    
    const keyboard = {
      inline_keyboard: orders.map((order: any) => [{
        text: `❌ #${order.orderNumber.slice(-8)} - ${order.totalAmount} ${order.currency}`,
        callback_data: `reject_order_${order.id}`
      }])
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error('Error in reject payment:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при поиске заказа');
  }
}

async function handleAnalytics(bot: TelegramBot, chatId: number, args: string[], session: any) {
  try {
    const period = args[0] || '7d';
    const analytics = await apiService.getDashboardAnalytics(session.token, { period });
    
    if (!analytics.data) {
      await bot.sendMessage(chatId, '❌ Ошибка при загрузке аналитики');
      return;
    }

    const data = analytics.data;
    let message = `📊 *Аналитика (${period}):*\n\n`;
    
    message += `💰 *Доходы:* ${data.totalRevenue.toLocaleString('ru')} USD\n`;
    message += `📦 *Заказов:* ${data.totalOrders}\n`;
    message += `⏳ *Ожидают:* ${data.pendingOrders}\n`;
    message += `💹 *Средний чек:* ${data.averageOrderValue.toFixed(2)} USD\n`;
    message += `📈 *Рост доходов:* ${data.revenueGrowth > 0 ? '+' : ''}${data.revenueGrowth.toFixed(1)}%\n`;
    message += `📊 *Рост заказов:* ${data.ordersGrowth > 0 ? '+' : ''}${data.ordersGrowth.toFixed(1)}%\n\n`;

    if (data.topProducts && data.topProducts.length > 0) {
      message += `🏆 *Топ товары:*\n`;
      data.topProducts.slice(0, 3).forEach((product: any, index: number) => {
        message += `${index + 1}. ${product.name} (${product.totalSales} шт.)\n`;
      });
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📅 1 день', callback_data: 'analytics_1d' },
          { text: '📅 7 дней', callback_data: 'analytics_7d' },
          { text: '📅 30 дней', callback_data: 'analytics_30d' }
        ],
        [
          { text: '🏪 По магазинам', callback_data: 'analytics_stores' },
          { text: '👥 Клиенты', callback_data: 'analytics_customers' }
        ]
      ]
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error('Error fetching analytics:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке аналитики');
  }
}

async function handleStoresList(bot: TelegramBot, chatId: number, args: string[], session: any) {
  try {
    const storesResponse = await apiService.getStores(session.token);
    const stores = storesResponse.stores ?? storesResponse.items ?? [];
    
    if (!stores || stores.length === 0) {
      await bot.sendMessage(chatId, '🏪 Магазины не найдены');
      return;
    }

    let message = `🏪 *Ваши магазины:*\n\n`;
    
    stores.slice(0, 10).forEach((store: any, index: number) => {
      message += `${index + 1}. *${store.name}*\n`;
      message += `   🌐 @${store.slug}\n`;
      message += `   💱 ${store.currency}\n`;
      message += `   📦 ${store._count?.products || 0} товаров\n`;
      message += `   📋 ${store._count?.orders || 0} заказов\n\n`;
    });

    const keyboard = {
      inline_keyboard: stores.slice(0, 5).map((store: any) => [{
        text: `📊 ${store.name}`,
        callback_data: `store_details_${store.id}`
      }])
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error('Error fetching stores:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке магазинов');
  }
}

async function handleInventoryAlerts(bot: TelegramBot, chatId: number, args: string[], session: any) {
  try {
    const severity = args[0]?.toUpperCase() || 'HIGH';
    const alerts = await apiService.getInventoryAlerts(session.token, { severity, limit: 10 });
    
    if (!alerts.alerts || alerts.alerts.length === 0) {
      await bot.sendMessage(chatId, '✅ Критичных предупреждений о запасах нет');
      return;
    }

    let message = `⚠️ *Предупреждения о запасах:*\n\n`;
    message += `📊 Всего: ${alerts.summary.total} | Критичных: ${alerts.summary.critical}\n\n`;
    
    alerts.alerts.slice(0, 5).forEach((alert: any, index: number) => {
      const severity = alert.severity === 'CRITICAL' ? '🔴' : 
                     alert.severity === 'HIGH' ? '🟡' : '🟢';
      
      message += `${severity} *${alert.product.name}*\n`;
      message += `   📦 Остаток: ${alert.product.stock} шт.\n`;
      message += `   🏪 ${alert.store.name}\n`;
      if (alert.recentSales) {
        message += `   📈 Продаж за неделю: ${alert.recentSales}\n`;
      }
      message += `\n`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔴 Критичные', callback_data: 'alerts_CRITICAL' },
          { text: '🟡 Важные', callback_data: 'alerts_HIGH' }
        ],
        [
          { text: '📦 Пополнить запасы', callback_data: 'inventory_restock' }
        ]
      ]
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error('Error fetching inventory alerts:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке предупреждений');
  }
}

// Helper functions for order verification/rejection
async function showOrderVerification(bot: TelegramBot, chatId: number, order: any, session: any) {
  const orderNumber = order.orderNumber.slice(-8);
  const customer = order.customer?.firstName || order.customer?.username || 'Неизвестно';
  
  let message = `✅ *Подтверждение оплаты заказа #${orderNumber}*\n\n`;
  message += `👤 Клиент: ${customer}\n`;
  message += `💰 Сумма: ${order.totalAmount} ${order.currency}\n`;
  message += `📅 Дата: ${new Date(order.createdAt).toLocaleString('ru')}\n`;
  message += `🏪 Магазин: ${order.store?.name || 'Неизвестно'}\n\n`;

  if (order.paymentProof) {
    message += `📎 Чек прикреплен\n\n`;
  }

  message += `❓ Подтвердить оплату этого заказа?`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Подтвердить', callback_data: `confirm_payment_${order.id}` },
        { text: '❌ Отклонить', callback_data: `reject_payment_${order.id}` }
      ],
      [
        { text: '📄 Детали заказа', callback_data: `order_details_${order.id}` }
      ]
    ]
  };

  // Send payment proof if available
  if (order.paymentProof) {
    try {
      const photoUrl = `${process.env.API_URL || 'http://82.147.84.78:3001'}${order.paymentProof}`;
      await bot.sendPhoto(chatId, photoUrl, {
        caption: `💳 Чек об оплате заказа #${orderNumber}`
      });
    } catch (photoError) {
      logger.error('Error sending payment proof photo:', photoError);
    }
  }

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function showOrderRejection(bot: TelegramBot, chatId: number, order: any, reason: string, session: any) {
  const orderNumber = order.orderNumber.slice(-8);
  
  let message = `❌ *Отклонение заказа #${orderNumber}*\n\n`;
  message += `💰 Сумма: ${order.totalAmount} ${order.currency}\n`;
  message += `📝 Причина: ${reason}\n\n`;
  message += `❓ Отклонить этот заказ?`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '❌ Подтвердить отклонение', callback_data: `confirm_reject_${order.id}_${encodeURIComponent(reason)}` },
        { text: '🔙 Отмена', callback_data: 'admin_cancel' }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

// Handle text messages that might be order IDs
export async function handlePossibleOrderId(bot: TelegramBot, chatId: number, text: string) {
  const session = userSessions.getSession(chatId.toString());
  
  if (!session || !session.token || !session.role || !['OWNER', 'ADMIN'].includes(session.role)) {
    return false; // Not an admin or not logged in
  }

  // Check if text looks like an order ID (alphanumeric, 6+ chars)
  if (!/^[a-zA-Z0-9]{6,}$/.test(text)) {
    return false;
  }

  try {
    const ordersList = await apiService.getOrders(session.token, {
      search: text,
      limit: 3
    });

    const orders = ordersList.orders;

    if (!orders || orders.length === 0) {
      return false; // No orders found
    }

    // Found orders - show quick action menu
    let message = `🔍 *Найденные заказы по "${text}":*\n\n`;
    
    const keyboard: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: []
    };

    orders.forEach((order: any, index: number) => {
      const orderNumber = order.orderNumber.slice(-8);
      const statusEmoji = order.status === 'PENDING_ADMIN' ? '⏳' : 
                         order.status === 'PAID' ? '✅' : 
                         order.status === 'SHIPPED' ? '📦' : '📋';
      
      message += `${index + 1}. ${statusEmoji} *#${orderNumber}*\n`;
      message += `   💰 ${order.totalAmount} ${order.currency}\n`;
      message += `   📅 ${new Date(order.createdAt).toLocaleDateString('ru')}\n\n`;

      if (order.status === 'PENDING_ADMIN') {
        keyboard.inline_keyboard.push([
          { text: `✅ Подтвердить #${orderNumber}`, callback_data: `verify_order_${order.id}` },
          { text: `❌ Отклонить #${orderNumber}`, callback_data: `reject_order_${order.id}` }
        ]);
      } else {
        keyboard.inline_keyboard.push([
          { text: `📄 Детали #${orderNumber}`, callback_data: `order_details_${order.id}` }
        ]);
      }
    });

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    return true; // Successfully handled as order ID
  } catch (error) {
    logger.error('Error checking possible order ID:', error);
    return false;
  }
}
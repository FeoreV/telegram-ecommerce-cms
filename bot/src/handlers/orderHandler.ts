import TelegramBot from 'node-telegram-bot-api';
import { apiService } from '../services/apiService';
import { userSessions } from '../utils/sessionManager';
import { logger } from '../utils/logger';
import { initiatePaymentProofFlow } from './paymentProofHandler';

export async function handleOrders(
  bot: TelegramBot, 
  msg: TelegramBot.Message, 
  callbackQuery?: TelegramBot.CallbackQuery
) {
  const chatId = msg.chat.id;
  // Use callbackQuery.from.id if available (button press), otherwise msg.from.id (command)
  const userId = (callbackQuery?.from?.id || msg.from?.id)?.toString();

  if (!userId) return;

  const session = userSessions.getSession(userId);
  
  try {
    if (!callbackQuery?.data || callbackQuery.data === 'order_list') {
      await showUserOrders(bot, chatId, session);
    } else if (callbackQuery.data.startsWith('order_view_')) {
      const orderId = callbackQuery.data.replace('order_view_', '');
      await showOrder(bot, chatId, session, orderId);
    } else if (callbackQuery.data.startsWith('upload_proof_')) {
      const orderId = callbackQuery.data.replace('upload_proof_', '');
      await initiatePaymentProofFlow(bot, chatId, orderId, userId);
      return; // Return early to avoid handling as text message
    } else {
      // Handle text message during order process
      await handleOrderText(bot, msg, session);
    }
  } catch (error) {
    logger.error('Order handler error:', error);
    await bot.sendMessage(chatId, 'Ошибка при работе с заказами. Попробуйте еще раз.');
  }
}

async function showUserOrders(bot: TelegramBot, chatId: number, session: any) {
  if (!session.token) {
    await bot.sendMessage(chatId, 'Ошибка авторизации. Используйте /start для входа в систему.');
    return;
  }

  const loadingMsg = await bot.sendMessage(chatId, '🔄 Загружаю ваши заказы...');

  try {
    const ordersResponse = await apiService.getOrders(session.token, { limit: 10 });
    const orders = ordersResponse.orders ?? [];

    if (orders.length === 0) {
      await bot.editMessageText(
        '*📋 Ваши заказы*\n\nУ вас пока нет заказов.',
        {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏪 Посмотреть магазины', callback_data: 'store_list' }]
            ]
          }
        }
      );
      return;
    }

    let text = '*📋 Ваши заказы:*\n\n';
    const keyboard = { inline_keyboard: [] as any[] };

    orders.forEach((order: any) => {
      const statusEmoji = getOrderStatusEmoji(order.status);
      const statusText = getOrderStatusText(order.status);
      
      text += `${statusEmoji} *Заказ #${order.orderNumber}*\n`;
      text += `🏪 ${order.store?.name || 'Неизвестно'}\n`;
      text += `💰 ${order.totalAmount} ${order.currency}\n`;
      text += `📅 ${new Date(order.createdAt).toLocaleString('ru-RU')}\n`;
      text += `📊 Статус: ${statusText}\n\n`;

      // Create row with view button and upload button if pending
      const orderButtons = [
        { 
          text: `📋 Заказ #${order.orderNumber}`, 
          callback_data: `order_view_${order.id}` 
        }
      ];

      // Add upload payment proof button for pending orders
      if (order.status === 'PENDING_ADMIN' && !order.paymentProof) {
        orderButtons.push({ 
          text: '📸 Чек', 
          callback_data: `upload_proof_${order.id}` 
        });
      }

      keyboard.inline_keyboard.push(orderButtons);
    });

    keyboard.inline_keyboard.push([
      { text: '🏪 Магазины', callback_data: 'store_list' },
    ]);

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    await bot.editMessageText(
      'Ошибка при загрузке заказов.',
      { chat_id: chatId, message_id: loadingMsg.message_id }
    );
    throw error;
  }
}

async function showOrder(bot: TelegramBot, chatId: number, session: any, orderId: string) {
  if (!session.token) {
    await bot.sendMessage(chatId, 'Ошибка авторизации.');
    return;
  }

  const loadingMsg = await bot.sendMessage(chatId, '🔄 Загружаю информацию о заказе...');

  try {
    const orderResponse = await apiService.getOrder(orderId, session.token);
    const order = orderResponse.order;

    const statusEmoji = getOrderStatusEmoji(order.status);
    const statusText = getOrderStatusText(order.status);

    let text = `${statusEmoji} *Заказ #${order.orderNumber}*\n\n`;
    text += `🏪 *Магазин:* ${order.store?.name || 'Неизвестно'}\n`;
    text += `📅 *Дата:* ${new Date(order.createdAt).toLocaleString('ru-RU')}\n`;
    text += `📊 *Статус:* ${statusText}\n\n`;

    if (order.paidAt) {
      text += `✅ *Оплачено:* ${new Date(order.paidAt).toLocaleString('ru-RU')}\n\n`;
    }

    if (order.rejectedAt && order.rejectionReason) {
      text += `❌ *Отклонено:* ${new Date(order.rejectedAt).toLocaleString('ru-RU')}\n`;
      text += `💬 *Причина:* ${order.rejectionReason}\n\n`;
    }

    if (orderResponse.items && orderResponse.items.length > 0) {
      text += `🛍️ *Товары:*\n`;
      orderResponse.items.forEach((item) => {
        const productName = item.product?.name || 'Товар';
        text += `• ${productName}`;
        if (item.variant) {
          text += ` (${item.variant.name}: ${item.variant.value})`;
        }
        text += ` × ${item.quantity} = ${item.price * item.quantity} ${order.currency}\n`;
      });
    }

    const customerInfo = (order.customerInfo as { name?: string; phone?: string; address?: string } | null) || undefined;

    if (customerInfo) {
      text += `\n\n📞 *Контактная информация:*\n`;
      if (customerInfo.name) text += `Имя: ${customerInfo.name}\n`;
      if (customerInfo.phone) text += `Телефон: ${customerInfo.phone}\n`;
      if (customerInfo.address) text += `Адрес: ${customerInfo.address}\n`;
    }

    if (order.notes) {
      text += `\n💬 *Комментарий:* ${order.notes}`;
    }

    const keyboard = {
      inline_keyboard: [] as any[]
    };

    // Add upload payment proof button for pending orders
    if (order.status === 'PENDING_ADMIN') {
      keyboard.inline_keyboard.push([
        { text: '📸 Загрузить чек оплаты', callback_data: `upload_proof_${order.id}` }
      ]);
    }

    keyboard.inline_keyboard.push([
      { text: '⬅️ Назад к заказам', callback_data: 'order_list' }
    ]);

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    await bot.editMessageText(
      'Ошибка при загрузке информации о заказе.',
      { chat_id: chatId, message_id: loadingMsg.message_id }
    );
    throw error;
  }
}

async function handleOrderText(bot: TelegramBot, msg: TelegramBot.Message, session: any) {
  if (session.orderingStep !== 'contact' || !msg.text) return;

  const chatId = msg.chat.id;

  try {
    // Parse contact information from text
    const contactInfo = parseContactInfo(msg.text);
    
    if (!contactInfo.name || !contactInfo.phone) {
      await bot.sendMessage(chatId, 
        'Пожалуйста, укажите имя и телефон в правильном формате:\n\n' +
        'Имя: Ваше имя\n' +
        'Телефон: +7XXXXXXXXXX\n' +
        'Адрес: Адрес доставки\n' +
        'Комментарий: Дополнительная информация'
      );
      return;
    }

    // Create order from temp data
    const orderData = {
      storeId: session.currentStore,
      items: session.tempData?.orderItems || [],
      customerInfo: contactInfo,
      notes: contactInfo.comment
    };

    const orderResponse = await apiService.createOrder(orderData, session.token);
    const order = orderResponse.order;

    // Clear temp data and update session
    userSessions.updateSession(session.telegramId, { 
      orderingStep: undefined,
      tempData: null
    });

    let successText = `✅ *Заказ успешно создан!*\n\n`;
    successText += `📋 *Номер заказа:* #${order.orderNumber}\n`;
    successText += `💰 *Сумма:* ${order.totalAmount} ${order.currency}\n\n`;
    successText += `💳 *Следующий шаг:*\n`;
    successText += `1️⃣ Оплатите заказ по реквизитам магазина\n`;
    successText += `2️⃣ Загрузите скриншот чека (кнопка ниже)\n`;
    successText += `3️⃣ Дождитесь подтверждения администратора\n\n`;
    successText += `⏳ Вы получите уведомление о статусе оплаты.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📸 Загрузить чек оплаты', callback_data: `upload_proof_${order.id}` }
        ],
        [
          { text: '📋 Мои заказы', callback_data: 'order_list' },
          { text: '🏪 Магазины', callback_data: 'store_list' }
        ]
      ]
    };

    await bot.sendMessage(chatId, successText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    logger.info(`Order created: ${order.id} by user ${session.userId}`);

  } catch (error) {
    logger.error('Create order error:', error);
    await bot.sendMessage(chatId, 'Ошибка при создании заказа. Попробуйте еще раз.');
  }
}

function parseContactInfo(text: string) {
  const lines = text.split('\n');
  const info: any = {};

  lines.forEach(line => {
    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();

    if (key && value) {
      const keyLower = key.toLowerCase().trim();
      if (keyLower.includes('имя') || keyLower.includes('name')) {
        info.name = value;
      } else if (keyLower.includes('телефон') || keyLower.includes('phone')) {
        info.phone = value;
      } else if (keyLower.includes('адрес') || keyLower.includes('address')) {
        info.address = value;
      } else if (keyLower.includes('комментарий') || keyLower.includes('comment')) {
        info.comment = value;
      }
    }
  });

  return info;
}

function getOrderStatusEmoji(status: string): string {
  switch (status) {
    case 'PENDING_ADMIN':
      return '⏳';
    case 'PAID':
      return '✅';
    case 'REJECTED':
      return '❌';
    case 'CANCELLED':
      return '🚫';
    case 'SHIPPED':
      return '🚚';
    case 'DELIVERED':
      return '📦';
    default:
      return '📋';
  }
}

function getOrderStatusText(status: string): string {
  switch (status) {
    case 'PENDING_ADMIN':
      return 'Ожидает подтверждения';
    case 'PAID':
      return 'Оплачен';
    case 'REJECTED':
      return 'Отклонен';
    case 'CANCELLED':
      return 'Отменен';
    case 'SHIPPED':
      return 'Отправлен';
    case 'DELIVERED':
      return 'Доставлен';
    default:
      return status;
  }
}

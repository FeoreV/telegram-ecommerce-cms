import TelegramBot from 'node-telegram-bot-api';
import { apiService } from '../services/apiService';
import { userSessions } from '../utils/sessionManager';
import { logger } from '../utils/logger';

export async function handleProfile(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  callbackQuery?: TelegramBot.CallbackQuery
) {
  const chatId = msg.chat.id;
  const userId = (callbackQuery?.from?.id || msg.from?.id)?.toString();

  if (!userId) return;

  const session = userSessions.getSession(userId);

  try {
    if (!callbackQuery?.data || callbackQuery.data === 'profile_menu') {
      await showProfileMenu(bot, chatId, session);
    } else if (callbackQuery.data === 'profile_orders') {
      // Redirect to order handler
      const { handleOrders } = await import('./orderHandler');
      await handleOrders(bot, msg, callbackQuery);
    } else if (callbackQuery.data === 'profile_info') {
      await showProfileInfo(bot, chatId, session);
    }
  } catch (error) {
    logger.error('Profile handler error:', error);
    await bot.sendMessage(chatId, 'Ошибка при работе с профилем. Попробуйте еще раз.');
  }
}

async function showProfileMenu(bot: TelegramBot, chatId: number, session: any) {
  if (!session.token) {
    await bot.sendMessage(chatId, 'Необходимо авторизоваться. Нажмите /start');
    return;
  }

  try {
    // Get user orders count and balance
    const ordersResponse = await apiService.getOrders(session.token, { limit: 1 });
    const ordersCount = ordersResponse.pagination?.total || ordersResponse.orders?.length || 0;
    
    // Get user balance
    const userBalance = await apiService.getUserBalance(session.token);
    const balance = userBalance?.balance ?? 0;

    const text = `
👤 *Ваш профиль*

👋 ${session.telegramId ? `Telegram ID: ${session.telegramId}` : 'Пользователь'}
💰 Баланс: ${balance.toFixed(2)} ₽
📋 Заказов: ${ordersCount}

*Выберите раздел:*
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💳 Пополнить баланс', callback_data: 'balance_topup' }
        ],
        [
          { text: '📋 Мои заказы', callback_data: 'order_list' }
        ],
        [
          { text: 'ℹ️ Информация о профиле', callback_data: 'profile_info' }
        ],
        [
          { text: '🔙 Главное меню', callback_data: 'main_menu' }
        ]
      ]
    };

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error('Show profile menu error:', error);
    await bot.sendMessage(chatId, 'Ошибка при загрузке профиля.');
  }
}

async function showProfileInfo(bot: TelegramBot, chatId: number, session: any) {
  if (!session.token) {
    await bot.sendMessage(chatId, 'Необходимо авторизоваться. Нажмите /start');
    return;
  }

  try {
    // Get user stats
    const ordersResponse = await apiService.getOrders(session.token, { limit: 100 });
    const orders = ordersResponse.orders || [];
    
    const totalOrders = orders.length;
    const paidOrders = orders.filter((o: any) => o.status === 'PAID' || o.status === 'SHIPPED' || o.status === 'DELIVERED').length;
    const pendingOrders = orders.filter((o: any) => o.status === 'PENDING_ADMIN').length;
    
    let totalSpent = 0;
    orders.forEach((order: any) => {
      if (order.status === 'PAID' || order.status === 'SHIPPED' || order.status === 'DELIVERED') {
        totalSpent += order.totalAmount || 0;
      }
    });

    // Get user balance
    const userBalance = await apiService.getUserBalance(session.token);
    const balance = userBalance?.balance ?? 0;

    const text = `
ℹ️ *Информация о профиле*

👤 *Telegram ID:* \`${session.telegramId}\`
🎭 *Роль:* ${getRoleText(session.role)}
💰 *Баланс:* ${balance.toFixed(2)} ₽

📊 *Статистика заказов:*
📋 Всего заказов: ${totalOrders}
✅ Оплачено: ${paidOrders}
⏳ В ожидании: ${pendingOrders}
💰 Общая сумма покупок: ${totalSpent.toFixed(2)} ₽

📅 *Первое использование:* ${new Date().toLocaleDateString('ru-RU')}
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💳 Пополнить баланс', callback_data: 'balance_topup' }
        ],
        [
          { text: '📋 Мои заказы', callback_data: 'order_list' }
        ],
        [
          { text: '🔙 Назад в профиль', callback_data: 'profile_menu' }
        ]
      ]
    };

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error('Show profile info error:', error);
    await bot.sendMessage(chatId, 'Ошибка при загрузке информации о профиле.');
  }
}

function getRoleText(role: string): string {
  switch (role) {
    case 'OWNER':
      return '👑 Владелец';
    case 'ADMIN':
      return '⚙️ Администратор';
    case 'VENDOR':
      return '🏪 Продавец';
    case 'CUSTOMER':
      return '🛍️ Покупатель';
    default:
      return role;
  }
}


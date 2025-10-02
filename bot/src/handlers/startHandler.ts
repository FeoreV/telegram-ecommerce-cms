import TelegramBot from 'node-telegram-bot-api';
import { apiService } from '../services/apiService';
import { userSessions } from '../utils/sessionManager';
import { logger } from '../utils/logger';

export async function handleStart(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const user = msg.from;

  if (!user) {
    await bot.sendMessage(chatId, 'Ошибка получения информации о пользователе.');
    return;
  }

  try {
    // Authenticate user with backend
    logger.debug(`Attempting authentication for user ${user.id}`);
    const authResponse = await apiService.authenticateUser(
      user.id.toString(),
      user.username,
      user.first_name,
      user.last_name
    );
    
    logger.debug(`Authentication successful:`, {
      userId: authResponse.user.id,
      role: authResponse.user.role,
      hasToken: !!authResponse.token,
      tokenPreview: authResponse.token ? authResponse.token.substring(0, 20) + '...' : 'none'
    });

    // Update user session
    logger.debug(`Updating session for telegramId ${user.id.toString()} with:`, {
      userId: authResponse.user.id,
      role: authResponse.user.role,
      hasToken: !!authResponse.token
    });
    
    userSessions.updateSession(user.id.toString(), {
      userId: authResponse.user.id,
      token: authResponse.token,
      role: authResponse.user.role,
    });
    
    // Verify session was saved
    const savedSession = userSessions.getSession(user.id.toString());
    logger.debug(`Session after update:`, {
      telegramId: savedSession.telegramId,
      userId: savedSession.userId,
      role: savedSession.role,
      hasToken: !!savedSession.token
    });

    const welcomeText = `
🎉 *Добро пожаловать в наш Telegram магазин!*

Привет, ${user.first_name || 'пользователь'}! 👋

🛍️ *Что вы можете делать:*
• Просматривать товары разных магазинов
• Покупать товары в один клик
• Отслеживать свои заказы
• Получать уведомления о статусе

*Выберите действие для начала:*
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🏪 Просмотр магазинов', callback_data: 'store_list' }
        ],
        [
          { text: '💳 Пополнить баланс', callback_data: 'balance_topup' }
        ],
        [
          { text: '👤 Профиль', callback_data: 'profile_menu' },
          { text: '❓ Помощь и контакты', callback_data: 'help' }
        ]
      ]
    };

    // Add admin button if user is admin or owner
    if (['ADMIN', 'OWNER'].includes(authResponse.user.role)) {
      keyboard.inline_keyboard.push([
        { text: '⚙️ Админ панель', callback_data: 'admin_dashboard' },
        { text: '🤖 Боты магазинов', callback_data: 'bot_list' }
      ]);
    }

    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    logger.info(`User ${user.id} started bot, role: ${authResponse.user.role}`);

  } catch (error) {
    logger.error('Start handler error:', error);
    
    await bot.sendMessage(
      chatId,
      'Произошла ошибка при входе в систему. Попробуйте еще раз позже.'
    );
  }
}

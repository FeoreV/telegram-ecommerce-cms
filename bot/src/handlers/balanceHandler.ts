import TelegramBot from 'node-telegram-bot-api';
import { apiService } from '../services/apiService';
import { userSessions } from '../utils/sessionManager';
import { logger } from '../utils/logger';

export async function handleBalance(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  callbackQuery?: TelegramBot.CallbackQuery
) {
  const chatId = msg.chat.id;
  const userId = (callbackQuery?.from?.id || msg.from?.id)?.toString();

  if (!userId) return;

  const session = userSessions.getSession(userId);

  try {
    if (!callbackQuery?.data || callbackQuery.data === 'balance_topup') {
      await showBalanceTopup(bot, chatId, session);
    }
  } catch (error) {
    logger.error('Balance handler error:', error);
    await bot.sendMessage(chatId, 'Ошибка при работе с балансом. Попробуйте еще раз.');
  }
}

async function showBalanceTopup(bot: TelegramBot, chatId: number, session: any) {
  if (!session.token) {
    await bot.sendMessage(chatId, 'Необходимо авторизоваться. Нажмите /start');
    return;
  }

  try {
    // Get user balance
    const userBalance = await apiService.getUserBalance(session.token);
    const balance = userBalance?.balance ?? 0;

    // Get all stores to find P2P payment details from any store
    // (in a real scenario, you might want to use a specific store or global settings)
    const storesResponse = await apiService.getStores(session.token);
    const stores = (storesResponse?.stores ?? []) as any[];
    
    let paymentRequisites = null;
    let storeName = 'магазина';

    // Try to find payment requisites from any store with a bot
    for (const store of stores) {
      if (store.botUsername && store.id) {
        try {
          const settingsResp = await apiService.getBotSettings(store.id, session.token);
          const settings = (settingsResp?.settings as Record<string, any>) || {};
          const requisites = settings.paymentRequisites || settings.requisites || null;
          
          const hasRequisites = requisites && (
            requisites.card || 
            requisites.bank || 
            requisites.receiver || 
            requisites.comment
          );
          
          if (hasRequisites) {
            paymentRequisites = requisites;
            storeName = store.name;
            break; // Use first store with requisites
          }
        } catch (e) {
          logger.warn(`Failed to fetch payment requisites for store ${store.id}`, e);
        }
      }
    }

    let text = `💳 *Пополнение баланса*\n\n`;
    text += `💰 *Текущий баланс:* ${balance.toFixed(2)} ₽\n\n`;

    if (paymentRequisites) {
      text += `📝 *Реквизиты для пополнения (${storeName}):*\n\n`;
      
      if (paymentRequisites.card) {
        text += `💳 *Карта:* \`${paymentRequisites.card}\`\n`;
      }
      if (paymentRequisites.bank) {
        text += `🏦 *Банк:* ${paymentRequisites.bank}\n`;
      }
      if (paymentRequisites.receiver) {
        text += `👤 *Получатель:* ${paymentRequisites.receiver}\n`;
      }
      if (paymentRequisites.comment) {
        text += `💬 *Комментарий:* ${paymentRequisites.comment}\n`;
      }
      
      text += `\n📌 *Инструкция:*\n`;
      text += `1. Переведите нужную сумму по указанным реквизитам\n`;
      text += `2. Сохраните чек или скриншот перевода\n`;
      text += `3. Свяжитесь с поддержкой для подтверждения пополнения\n\n`;
      text += `⚠️ После перевода баланс будет пополнен администратором в течение 24 часов`;
    } else {
      text += `❌ *Реквизиты для пополнения не настроены*\n\n`;
      text += `Пожалуйста, свяжитесь с администратором магазина для получения реквизитов пополнения баланса.`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '👤 Профиль', callback_data: 'profile_menu' }
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
    logger.error('Show balance topup error:', error);
    await bot.sendMessage(chatId, 'Ошибка при загрузке информации о пополнении баланса.');
  }
}


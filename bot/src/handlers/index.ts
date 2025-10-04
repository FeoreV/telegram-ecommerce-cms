import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { sanitizeForLog } from '../utils/sanitizer';
import { handleAdmin, handlePossibleOrderId } from './adminHandler';
import { handleBalance } from './balanceHandler';
import { handleBotCreationCallback, handleBotCreationMessage, handleBotCreationSkipCallback } from './botCreationHandler';
import { handleOrders } from './orderHandler';
import { handlePaymentProofCallback, handlePaymentProofFlow } from './paymentProofHandler';
import { handleProducts } from './productHandler';
import { handleProfile } from './profileHandler';
import { handleStart } from './startHandler';
import { handleStoreCreationMessage, handleStores } from './storeHandler';

export function setupHandlers(bot: TelegramBot) {
  // Command handlers
  bot.onText(/\/start/, (msg) => handleStart(bot, msg));
  bot.onText(/\/stores/, (msg) => handleStores(bot, msg));
  bot.onText(/\/orders/, (msg) => handleOrders(bot, msg));
  bot.onText(/\/admin/, (msg) => handleAdmin(bot, msg));
  bot.onText(/\/help/, (msg) => handleHelp(bot, msg));

  // Callback query handlers
  bot.on('callback_query', async (callbackQuery) => {
    const { data, message } = callbackQuery;

    if (!data || !message) return;

    try {
      // Route callback queries to appropriate handlers
      if (data === 'main_menu') {
        // Return to main menu
        await handleStart(bot, message);
      } else if (data === 'help') {
        await handleHelp(bot, message);
      } else if (data.startsWith('balance_')) {
        await handleBalance(bot, message, callbackQuery);
      } else if (data.startsWith('profile_')) {
        await handleProfile(bot, message, callbackQuery);
      } else if (data.startsWith('store_')) {
        logger.debug(`Handling store callback for user ${message.from?.id}: ${sanitizeForLog(data)}`);
        await handleStores(bot, message, callbackQuery);
      } else if (data.startsWith('product_') || data.startsWith('cms_product_')) {
        await handleProducts(bot, message, callbackQuery);
      } else if (data.startsWith('order_')) {
        await handleOrders(bot, message, callbackQuery);
      } else if (
        data.startsWith('admin_') ||
        data.startsWith('verify_order_') ||
        data.startsWith('reject_order_') ||
        data.startsWith('orders_') ||
        data.startsWith('analytics_') ||
        data.startsWith('alerts_') ||
        data.startsWith('confirm_payment_') ||
        data.startsWith('confirm_reject_')
      ) {
        await handleAdmin(bot, message, callbackQuery);
      } else if (data.startsWith('upload_proof_') || data === 'cancel_payment_proof') {
        await handlePaymentProofCallback(bot, callbackQuery);
      } else if (data.startsWith('bot_') || data === 'create_bot' || data.includes('bot')) {
        // Handle bot creation and management callbacks
        const handled = await handleBotCreationCallback(bot, message.chat.id, data) ||
                       await handleBotCreationSkipCallback(bot, message.chat.id, data);
        if (!handled) {
          logger.warn(`Unhandled bot callback: ${sanitizeForLog(data)}`);
        }
      }

      // Answer callback query to remove loading state
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error('Callback query error:', error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Произошла ошибка. Попробуйте еще раз.',
        show_alert: true,
      });
    }
  });

  // Message handlers for text input, photos, and documents
  bot.on('message', async (msg) => {
    // Skip if it's a command (already handled above)
    if (msg.text?.startsWith('/')) return;

    try {
      // Handle payment proof uploads (photos and documents)
      if (msg.photo || msg.document) {
        await handlePaymentProofFlow(bot, msg);
        return;
      }

      // Handle store creation input
      await handleStoreCreationMessage(bot, msg);

      // Handle bot creation input
      await handleBotCreationMessage(bot, msg);

      // Handle contact info input during order process
      if (msg.text && msg.contact) {
        await handleOrders(bot, msg);
      } else if (msg.text) {
        // Handle payment proof text responses or general text messages
        await handlePaymentProofFlow(bot, msg);
        const handledAdmin = await handlePossibleOrderId(bot, msg.chat.id, msg.text);
        if (!handledAdmin) {
          await handleTextMessage(bot, msg);
        }
      }
    } catch (error) {
      logger.error('Message handler error:', error);
      await bot.sendMessage(msg.chat.id, 'Произошла ошибка. Попробуйте еще раз.');
    }
  });

  logger.info('✅ Bot handlers configured');
}

async function handleHelp(bot: TelegramBot, msg: TelegramBot.Message) {
  const helpText = `
❓ *Помощь и контакты*

*Основные команды:*
/start - Начать работу с ботом
/stores - Просмотр магазинов
/orders - Мои заказы
/admin - Админ панель (для администраторов)
/help - Показать это сообщение

*Как сделать заказ:*
1. Выберите магазин из списка 🏪
2. Просмотрите товары и выберите нужный 🛍️
3. Выберите количество и подтвердите покупку ✅
4. Оплатите по реквизитам и загрузите чек 💳
5. Дождитесь подтверждения администратора ⏳

*📞 Контактная информация:*
• Техническая поддержка: support@example.com
• Telegram: @support_bot
• Часы работы: Пн-Пт 9:00-18:00 (МСК)

*Для администраторов:*
Используйте команду /admin для доступа к:
• Статистике заказов
• Подтверждению платежей
• Управлению магазинами

Если у вас есть вопросы, обратитесь к администратору магазина через кнопку ниже.
  `;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '💬 Написать в поддержку', url: 'https://t.me/support' }
      ],
      [
        { text: '🏠 Главное меню', callback_data: 'main_menu' }
      ]
    ]
  };

  await bot.sendMessage(msg.chat.id, helpText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function handleTextMessage(bot: TelegramBot, msg: TelegramBot.Message) {
  // This could handle various text inputs based on user's current state
  // For now, just provide a helpful response
  await bot.sendMessage(
    msg.chat.id,
    'Используйте команды для навигации по боту:\n' +
    '/stores - Просмотр магазинов\n' +
    '/help - Помощь'
  );
}

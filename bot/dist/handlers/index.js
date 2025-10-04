"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupHandlers = setupHandlers;
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
const adminHandler_1 = require("./adminHandler");
const balanceHandler_1 = require("./balanceHandler");
const botCreationHandler_1 = require("./botCreationHandler");
const orderHandler_1 = require("./orderHandler");
const paymentProofHandler_1 = require("./paymentProofHandler");
const productHandler_1 = require("./productHandler");
const profileHandler_1 = require("./profileHandler");
const startHandler_1 = require("./startHandler");
const storeHandler_1 = require("./storeHandler");
function setupHandlers(bot) {
    bot.onText(/\/start/, (msg) => (0, startHandler_1.handleStart)(bot, msg));
    bot.onText(/\/stores/, (msg) => (0, storeHandler_1.handleStores)(bot, msg));
    bot.onText(/\/orders/, (msg) => (0, orderHandler_1.handleOrders)(bot, msg));
    bot.onText(/\/admin/, (msg) => (0, adminHandler_1.handleAdmin)(bot, msg));
    bot.onText(/\/help/, (msg) => handleHelp(bot, msg));
    bot.on('callback_query', async (callbackQuery) => {
        const { data, message } = callbackQuery;
        if (!data || !message)
            return;
        try {
            if (data === 'main_menu') {
                await (0, startHandler_1.handleStart)(bot, message);
            }
            else if (data === 'help') {
                await handleHelp(bot, message);
            }
            else if (data.startsWith('balance_')) {
                await (0, balanceHandler_1.handleBalance)(bot, message, callbackQuery);
            }
            else if (data.startsWith('profile_')) {
                await (0, profileHandler_1.handleProfile)(bot, message, callbackQuery);
            }
            else if (data.startsWith('store_')) {
                logger_1.logger.debug(`Handling store callback for user ${message.from?.id}: ${(0, sanitizer_1.sanitizeForLog)(data)}`);
                await (0, storeHandler_1.handleStores)(bot, message, callbackQuery);
            }
            else if (data.startsWith('product_') || data.startsWith('cms_product_')) {
                await (0, productHandler_1.handleProducts)(bot, message, callbackQuery);
            }
            else if (data.startsWith('order_')) {
                await (0, orderHandler_1.handleOrders)(bot, message, callbackQuery);
            }
            else if (data.startsWith('admin_') ||
                data.startsWith('verify_order_') ||
                data.startsWith('reject_order_') ||
                data.startsWith('orders_') ||
                data.startsWith('analytics_') ||
                data.startsWith('alerts_') ||
                data.startsWith('confirm_payment_') ||
                data.startsWith('confirm_reject_')) {
                await (0, adminHandler_1.handleAdmin)(bot, message, callbackQuery);
            }
            else if (data.startsWith('upload_proof_') || data === 'cancel_payment_proof') {
                await (0, paymentProofHandler_1.handlePaymentProofCallback)(bot, callbackQuery);
            }
            else if (data.startsWith('bot_') || data === 'create_bot' || data.includes('bot')) {
                const handled = await (0, botCreationHandler_1.handleBotCreationCallback)(bot, message.chat.id, data) ||
                    await (0, botCreationHandler_1.handleBotCreationSkipCallback)(bot, message.chat.id, data);
                if (!handled) {
                    logger_1.logger.warn(`Unhandled bot callback: ${(0, sanitizer_1.sanitizeForLog)(data)}`);
                }
            }
            await bot.answerCallbackQuery(callbackQuery.id);
        }
        catch (error) {
            logger_1.logger.error('Callback query error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Произошла ошибка. Попробуйте еще раз.',
                show_alert: true,
            });
        }
    });
    bot.on('message', async (msg) => {
        if (msg.text?.startsWith('/'))
            return;
        try {
            if (msg.photo || msg.document) {
                await (0, paymentProofHandler_1.handlePaymentProofFlow)(bot, msg);
                return;
            }
            await (0, storeHandler_1.handleStoreCreationMessage)(bot, msg);
            await (0, botCreationHandler_1.handleBotCreationMessage)(bot, msg);
            if (msg.text && msg.contact) {
                await (0, orderHandler_1.handleOrders)(bot, msg);
            }
            else if (msg.text) {
                await (0, paymentProofHandler_1.handlePaymentProofFlow)(bot, msg);
                const handledAdmin = await (0, adminHandler_1.handlePossibleOrderId)(bot, msg.chat.id, msg.text);
                if (!handledAdmin) {
                    await handleTextMessage(bot, msg);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Message handler error:', error);
            await bot.sendMessage(msg.chat.id, 'Произошла ошибка. Попробуйте еще раз.');
        }
    });
    logger_1.logger.info('✅ Bot handlers configured');
}
async function handleHelp(bot, msg) {
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
async function handleTextMessage(bot, msg) {
    await bot.sendMessage(msg.chat.id, 'Используйте команды для навигации по боту:\n' +
        '/stores - Просмотр магазинов\n' +
        '/help - Помощь');
}
//# sourceMappingURL=index.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStart = handleStart;
const apiService_1 = require("../services/apiService");
const sessionManager_1 = require("../utils/sessionManager");
const logger_1 = require("../utils/logger");
async function handleStart(bot, msg) {
    const chatId = msg.chat.id;
    const user = msg.from;
    if (!user) {
        await bot.sendMessage(chatId, 'Ошибка получения информации о пользователе.');
        return;
    }
    try {
        logger_1.logger.debug(`Attempting authentication for user ${user.id}`);
        const authResponse = await apiService_1.apiService.authenticateUser(user.id.toString(), user.username, user.first_name, user.last_name);
        logger_1.logger.debug(`Authentication successful:`, {
            userId: authResponse.user.id,
            role: authResponse.user.role,
            hasToken: !!authResponse.token,
            tokenPreview: authResponse.token ? authResponse.token.substring(0, 20) + '...' : 'none'
        });
        logger_1.logger.debug(`Updating session for telegramId ${user.id.toString()} with:`, {
            userId: authResponse.user.id,
            role: authResponse.user.role,
            hasToken: !!authResponse.token
        });
        sessionManager_1.userSessions.updateSession(user.id.toString(), {
            userId: authResponse.user.id,
            token: authResponse.token,
            role: authResponse.user.role,
        });
        const savedSession = sessionManager_1.userSessions.getSession(user.id.toString());
        logger_1.logger.debug(`Session after update:`, {
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
                    { text: '👤 Профиль', callback_data: 'profile_menu' },
                    { text: '❓ Помощь и контакты', callback_data: 'help' }
                ]
            ]
        };
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
        logger_1.logger.info(`User ${user.id} started bot, role: ${authResponse.user.role}`);
    }
    catch (error) {
        logger_1.logger.error('Start handler error:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при входе в систему. Попробуйте еще раз позже.');
    }
}
//# sourceMappingURL=startHandler.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBotCreationCallback = handleBotCreationCallback;
exports.handleBotCreationMessage = handleBotCreationMessage;
exports.handleBotCreationSkipCallback = handleBotCreationSkipCallback;
const apiService_1 = require("../services/apiService");
const sessionManager_1 = require("../utils/sessionManager");
const logger_1 = require("../utils/logger");
async function handleBotCreationCallback(bot, chatId, callbackData) {
    const userId = chatId.toString();
    const session = sessionManager_1.userSessions.getSession(userId);
    if (!session.token) {
        await bot.sendMessage(chatId, '🔐 Сначала необходимо авторизоваться. Используйте команду /start');
        return false;
    }
    try {
        switch (callbackData) {
            case 'create_bot':
                await startBotCreation(bot, chatId, session);
                return true;
            case 'bot_list':
                await showBotList(bot, chatId, session);
                return true;
            case 'bot_back':
                await showMainMenu(bot, chatId, session);
                return true;
            default:
                if (callbackData.startsWith('create_bot_for_store_')) {
                    const storeId = callbackData.replace('create_bot_for_store_', '');
                    await showBotCreationForm(bot, chatId, session, storeId);
                    return true;
                }
                if (callbackData.startsWith('bot_')) {
                    return await handleBotManagement(bot, chatId, callbackData, session);
                }
                break;
        }
    }
    catch (error) {
        logger_1.logger.error('Bot creation callback error:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте еще раз.');
    }
    return false;
}
async function startBotCreation(bot, chatId, session) {
    if (!['ADMIN', 'OWNER'].includes(session.role)) {
        await bot.sendMessage(chatId, '❌ У вас нет прав для создания ботов магазинов.');
        return;
    }
    try {
        const storesResponse = await apiService_1.apiService.getUserStores(session.token);
        const stores = (storesResponse?.stores ?? []);
        const storesWithoutBots = stores.filter((store) => !store.botUsername);
        if (storesWithoutBots.length === 0) {
            const text = `
🤖 *Создание ботов для магазинов*

❌ У всех ваших магазинов уже есть боты, или у вас нет магазинов.

*Что можно сделать:*
• Сначала создайте новый магазин
• Или удалите существующего бота, чтобы создать нового
      `;
            await bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🏪 Создать магазин', callback_data: 'store_create' }],
                        [{ text: '🤖 Управление ботами', callback_data: 'bot_list' }],
                        [{ text: '🔙 Назад', callback_data: 'bot_back' }]
                    ]
                }
            });
            return;
        }
        let text = `🤖 *Создание бота для магазина*\n\n`;
        text += `Выберите магазин, для которого хотите создать бота:\n\n`;
        const keyboard = [];
        for (const store of storesWithoutBots) {
            keyboard.push([{
                    text: `🏪 ${store.name}`,
                    callback_data: `create_bot_for_store_${store.id}`
                }]);
        }
        keyboard.push([{ text: '🔙 Назад', callback_data: 'bot_back' }]);
        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error loading stores for bot creation:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при загрузке магазинов. Попробуйте позже.');
    }
}
async function showBotCreationForm(bot, chatId, session, storeId) {
    try {
        const storesResponse = await apiService_1.apiService.getUserStores(session.token);
        const stores = (storesResponse?.stores ?? []);
        const store = stores.find((s) => s.id === storeId);
        if (!store) {
            await bot.sendMessage(chatId, '❌ Магазин не найден.');
            return;
        }
        sessionManager_1.userSessions.updateSession(session.telegramId, {
            botCreation: {
                storeId: storeId,
                storeName: store.name,
                step: 'token'
            }
        });
        const text = `
🤖 *Создание бота для магазина "${store.name}"*

📝 *Шаг 1/2: Токен бота*

Для создания бота вам нужен токен от @BotFather:

*Как получить токен:*
1️⃣ Откройте @BotFather в Telegram
2️⃣ Отправьте команду /newbot
3️⃣ Придумайте имя для вашего бота
4️⃣ Придумайте username (должен заканчиваться на "bot")
5️⃣ Скопируйте полученный токен

*Пример токена:*
\`1234567890:ABCdefGhIJKLmnopQRstUVwxyz\`

📨 *Отправьте токен следующим сообщением:*
    `;
        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❓ Помощь с созданием бота', url: 'https://t.me/BotFather' }],
                    [{ text: '❌ Отмена', callback_data: 'create_bot' }]
                ]
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error showing bot creation form:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при загрузке формы создания бота.');
    }
}
async function handleBotCreationMessage(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id?.toString();
    const text = msg.text;
    if (!userId || !text)
        return;
    const session = sessionManager_1.userSessions.getSession(userId);
    if (!session.botCreation)
        return;
    try {
        switch (session.botCreation.step) {
            case 'token':
                await handleTokenInput(bot, chatId, session, text);
                break;
            case 'username':
                await handleUsernameInput(bot, chatId, session, text);
                break;
        }
    }
    catch (error) {
        logger_1.logger.error('Bot creation message error:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте еще раз.');
    }
}
async function handleTokenInput(bot, chatId, session, token) {
    const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
    if (!tokenPattern.test(token.trim())) {
        await bot.sendMessage(chatId, `
❌ *Неверный формат токена*

Токен должен иметь формат: \`числа:буквы_символы\`

*Пример правильного токена:*
\`1234567890:ABCdefGhIJKLmnopQRstUVwxyz\`

Попробуйте еще раз:
    `, {
            parse_mode: 'Markdown'
        });
        return;
    }
    sessionManager_1.userSessions.updateSession(session.telegramId, {
        botCreation: {
            ...session.botCreation,
            token: token.trim(),
            step: 'username'
        }
    });
    const text = `
✅ *Токен принят*

🤖 *Шаг 2/2: Username бота (необязательно)*

Если хотите указать конкретный username бота, отправьте его следующим сообщением.

*Или нажмите "Пропустить", если хотите использовать автоматическое определение username.*

*Пример username:*
\`my_shop_bot\`
  `;
    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '⏭️ Пропустить', callback_data: 'bot_create_skip_username' }],
                [{ text: '❌ Отмена', callback_data: 'create_bot' }]
            ]
        }
    });
}
async function handleUsernameInput(bot, chatId, session, username) {
    const usernamePattern = /^[a-zA-Z][a-zA-Z0-9_]*bot$/i;
    if (!usernamePattern.test(username.trim())) {
        await bot.sendMessage(chatId, `
❌ *Неверный формат username*

Username должен:
• Начинаться с буквы
• Заканчиваться на "bot"
• Содержать только буквы, цифры и _

*Пример правильного username:*
\`my_shop_bot\`

Попробуйте еще раз или нажмите "Пропустить":
    `, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⏭️ Пропустить', callback_data: 'bot_create_skip_username' }]
                ]
            }
        });
        return;
    }
    sessionManager_1.userSessions.updateSession(session.telegramId, {
        botCreation: {
            ...session.botCreation,
            username: username.trim()
        }
    });
    await createBotFromSession(bot, chatId, session);
}
async function handleBotCreationSkipCallback(bot, chatId, callbackData) {
    const userId = chatId.toString();
    const session = sessionManager_1.userSessions.getSession(userId);
    if (callbackData === 'bot_create_skip_username' && session.botCreation) {
        await createBotFromSession(bot, chatId, session);
        return true;
    }
    return false;
}
async function createBotFromSession(bot, chatId, session) {
    const botCreationData = session.botCreation;
    if (!botCreationData || !botCreationData.token || !botCreationData.storeId) {
        await bot.sendMessage(chatId, '❌ Не все данные для создания бота заполнены.');
        return;
    }
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Создаю бота для магазина...');
    try {
        const response = await apiService_1.apiService.createStoreBot({
            storeId: botCreationData.storeId,
            botToken: botCreationData.token,
            botUsername: botCreationData.username
        }, session.token);
        sessionManager_1.userSessions.updateSession(session.telegramId, { botCreation: null });
        const successMessage = `
🎉 *Бот успешно создан!*

🤖 *@${response.bot.botUsername}*
🏪 Магазин: *${botCreationData.storeName}*
📅 Создан: ${new Date().toLocaleString('ru-RU')}

✅ *Бот активен и готов к работе!*

*Что дальше:*
• Бот автоматически обрабатывает заказы
• Настройте приветственное сообщение
• Поделитесь ссылкой на бота с клиентами

*Ссылка на вашего бота:*
https://t.me/${response.bot.botUsername}
    `;
        await bot.editMessageText(successMessage, {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔗 Открыть бота', url: `https://t.me/${response.bot.botUsername}` }],
                    [{ text: '⚙️ Настройки бота', callback_data: `bot_settings_${botCreationData.storeId}` }],
                    [{ text: '🤖 Все боты', callback_data: 'bot_list' }]
                ]
            }
        });
        logger_1.logger.info(`Bot created via Telegram: ${response.bot.botUsername} for store ${botCreationData.storeId} by user ${session.userId}`);
    }
    catch (error) {
        logger_1.logger.error('Error creating bot:', error);
        const errorMessage = error.response?.data?.message || 'Не удалось создать бота';
        await bot.editMessageText(`
❌ *Ошибка создания бота*

${errorMessage}

*Возможные причины:*
• Неверный токен бота
• Токен уже используется другим магазином
• Проблемы с подключением к Telegram API

Попробуйте еще раз или обратитесь к администратору.
    `, {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Попробовать снова', callback_data: `create_bot_for_store_${botCreationData.storeId}` }],
                    [{ text: '🔙 Назад', callback_data: 'create_bot' }]
                ]
            }
        });
    }
}
async function showBotList(bot, chatId, session) {
    try {
        const response = await apiService_1.apiService.getUserBots(session.token);
        const bots = response.bots || [];
        if (bots.length === 0) {
            const text = `
🤖 *Управление ботами*

У вас пока нет созданных ботов.

*Создайте первого бота для вашего магазина!*
      `;
            await bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ Создать бота', callback_data: 'create_bot' }],
                        [{ text: '🔙 Назад', callback_data: 'bot_back' }]
                    ]
                }
            });
            return;
        }
        let text = `🤖 *Ваши боты (${bots.length})*\n\n`;
        const keyboard = [];
        for (const botData of bots) {
            const statusIcon = botData.isActive ? '✅' : '❌';
            const status = botData.botStatus === 'ACTIVE' ? 'Активен' : 'Неактивен';
            text += `${statusIcon} *@${botData.botUsername || 'Неизвестно'}*\n`;
            text += `🏪 ${botData.storeName}\n`;
            text += `📊 Статус: ${status}\n`;
            text += `💬 Сообщений: ${botData.messageCount || 0}\n\n`;
            keyboard.push([{
                    text: `⚙️ ${botData.storeName}`,
                    callback_data: `bot_manage_${botData.storeId}`
                }]);
        }
        keyboard.push([{ text: '➕ Создать бота', callback_data: 'create_bot' }], [{ text: '🔙 Назад', callback_data: 'bot_back' }]);
        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error loading bot list:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при загрузке списка ботов.');
    }
}
async function handleBotManagement(bot, chatId, callbackData, session) {
    if (callbackData.startsWith('bot_manage_')) {
        const storeId = callbackData.replace('bot_manage_', '');
        await showBotManagementMenu(bot, chatId, session, storeId);
        return true;
    }
    if (callbackData.startsWith('bot_restart_')) {
        const storeId = callbackData.replace('bot_restart_', '');
        await restartBot(bot, chatId, session, storeId);
        return true;
    }
    if (callbackData.startsWith('bot_delete_')) {
        const storeId = callbackData.replace('bot_delete_', '');
        await deleteBot(bot, chatId, session, storeId);
        return true;
    }
    return false;
}
async function showBotManagementMenu(bot, chatId, session, storeId) {
    try {
        const response = await apiService_1.apiService.getUserBots(session.token);
        const bots = response.bots || [];
        const botData = bots.find((b) => b.storeId === storeId);
        if (!botData) {
            await bot.sendMessage(chatId, '❌ Бот не найден.');
            return;
        }
        const statusIcon = botData.isActive ? '✅' : '❌';
        const status = botData.botStatus === 'ACTIVE' ? 'Активен' : 'Неактивен';
        const text = `
🤖 *Управление ботом*

${statusIcon} *@${botData.botUsername}*
🏪 Магазин: *${botData.storeName}*
📊 Статус: ${status}
💬 Сообщений: ${botData.messageCount || 0}
📅 Создан: ${botData.botCreatedAt ? new Date(botData.botCreatedAt).toLocaleDateString('ru-RU') : 'Неизвестно'}

*Действия:*
    `;
        const keyboard = [
            [{ text: '🔗 Открыть бота', url: `https://t.me/${botData.botUsername}` }],
            [{ text: '🔄 Перезапустить', callback_data: `bot_restart_${storeId}` }],
            [{ text: '🗑️ Удалить бота', callback_data: `bot_delete_${storeId}` }],
            [{ text: '🔙 К списку ботов', callback_data: 'bot_list' }]
        ];
        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error showing bot management menu:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при загрузке меню управления ботом.');
    }
}
async function restartBot(bot, chatId, session, storeId) {
    const loadingMsg = await bot.sendMessage(chatId, '🔄 Перезапускаю бота...');
    try {
        await apiService_1.apiService.restartBot(storeId, session.token);
        await bot.editMessageText('✅ Бот успешно перезапущен!', {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Назад', callback_data: `bot_manage_${storeId}` }]
                ]
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error restarting bot:', error);
        const errorMessage = error.response?.data?.message || 'Не удалось перезапустить бота';
        await bot.editMessageText(`❌ ${errorMessage}`, {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Назад', callback_data: `bot_manage_${storeId}` }]
                ]
            }
        });
    }
}
async function deleteBot(bot, chatId, session, storeId) {
    const loadingMsg = await bot.sendMessage(chatId, '🗑️ Удаляю бота...');
    try {
        await apiService_1.apiService.deleteBot(storeId, session.token);
        await bot.editMessageText('✅ Бот успешно удален!', {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🤖 К списку ботов', callback_data: 'bot_list' }]
                ]
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting bot:', error);
        const errorMessage = error.response?.data?.message || 'Не удалось удалить бота';
        await bot.editMessageText(`❌ ${errorMessage}`, {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Назад', callback_data: `bot_manage_${storeId}` }]
                ]
            }
        });
    }
}
async function showMainMenu(bot, chatId, session) {
    const text = `
🎛️ *Главное меню*

Выберите действие:
  `;
    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🏪 Магазины', callback_data: 'store_list' }],
                [{ text: '🤖 Боты магазинов', callback_data: 'bot_list' }],
                [{ text: '📊 Статистика', callback_data: 'analytics' }]
            ]
        }
    });
}
//# sourceMappingURL=botCreationHandler.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStoreCreation = startStoreCreation;
exports.handleStoreCreationMessage = handleStoreCreationMessage;
exports.handleStoreCreationCallback = handleStoreCreationCallback;
const apiService_1 = require("../services/apiService");
const logger_1 = require("../utils/logger");
const sessionManager_1 = require("../utils/sessionManager");
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'RUB', 'UAH'];
const CURRENCY_SYMBOLS = {
    USD: '$',
    EUR: '€',
    RUB: '₽',
    UAH: '₴'
};
async function startStoreCreation(bot, chatId) {
    const session = sessionManager_1.userSessions.getSession(chatId.toString());
    if (!session || !session.token) {
        await bot.sendMessage(chatId, '❌ Вы не авторизованы. Используйте /start для входа.');
        return;
    }
    if (!session.role || !['OWNER', 'ADMIN'].includes(session.role)) {
        await bot.sendMessage(chatId, '❌ У вас нет прав для создания магазинов.');
        return;
    }
    const storeCreationState = {
        step: 1,
        data: {}
    };
    sessionManager_1.userSessions.updateSession(chatId.toString(), {
        storeCreation: storeCreationState
    });
    await showStep1NameInput(bot, chatId);
}
async function showStep1NameInput(bot, chatId) {
    const message = `🏪 *Создание нового магазина*\n\n` +
        `*Шаг 1 из 5: Название магазина*\n\n` +
        `Введите название вашего магазина:\n\n` +
        `💡 *Советы:*\n` +
        `• Используйте понятное и запоминающееся название\n` +
        `• Избегайте специальных символов\n` +
        `• Длина: 3-50 символов\n\n` +
        `📝 Напишите название магазина:`;
    const keyboard = {
        inline_keyboard: [
            [{ text: '❌ Отменить создание', callback_data: 'cancel_store_creation' }]
        ]
    };
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}
async function showStep2DescriptionInput(bot, chatId, storeName) {
    const message = `🏪 *Создание магазина "${storeName}"*\n\n` +
        `*Шаг 2 из 5: Описание магазина*\n\n` +
        `Напишите краткое описание вашего магазина:\n\n` +
        `💡 *Советы:*\n` +
        `• Опишите что вы продаете\n` +
        `• Укажите ваши преимущества\n` +
        `• Длина: 10-500 символов\n\n` +
        `📝 Введите описание:`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '⬅️ Назад', callback_data: 'store_creation_step_1' },
                { text: '❌ Отменить', callback_data: 'cancel_store_creation' }
            ]
        ]
    };
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}
async function showStep3SlugInput(bot, chatId, storeName) {
    const session = sessionManager_1.userSessions.getSession(chatId.toString());
    const suggestedSlug = generateSlugFromName(storeName);
    const message = `🏪 *Создание магазина "${storeName}"*\n\n` +
        `*Шаг 3 из 5: Адрес магазина (slug)*\n\n` +
        `Это будет адрес вашего магазина в системе.\n` +
        `Например: \`t.me/yourbot?start=store_${suggestedSlug}\`\n\n` +
        `💡 *Требования:*\n` +
        `• Только английские буквы и цифры\n` +
        `• Минимум 3 символа\n` +
        `• Должен быть уникальным\n\n` +
        `🤖 *Предложенный адрес:* \`${suggestedSlug}\`\n\n` +
        `Введите желаемый адрес или используйте предложенный:`;
    const keyboard = {
        inline_keyboard: [
            [{ text: `✅ Использовать "${suggestedSlug}"`, callback_data: `use_suggested_slug_${suggestedSlug}` }],
            [
                { text: '⬅️ Назад', callback_data: 'store_creation_step_2' },
                { text: '❌ Отменить', callback_data: 'cancel_store_creation' }
            ]
        ]
    };
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}
async function showStep4CurrencySelection(bot, chatId) {
    const session = sessionManager_1.userSessions.getSession(chatId.toString());
    const storeData = session.storeCreation?.data;
    const message = `🏪 *Создание магазина "${storeData?.name}"*\n\n` +
        `*Шаг 4 из 5: Валюта магазина*\n\n` +
        `Выберите основную валюту для ценообразования:\n\n` +
        `💡 *Внимание:* Валюту нельзя будет изменить после создания магазина.`;
    const keyboard = {
        inline_keyboard: [
            SUPPORTED_CURRENCIES.map(currency => ({
                text: `${CURRENCY_SYMBOLS[currency]} ${currency}`,
                callback_data: `select_currency_${currency}`
            })),
            [
                { text: '⬅️ Назад', callback_data: 'store_creation_step_3' },
                { text: '❌ Отменить', callback_data: 'cancel_store_creation' }
            ]
        ]
    };
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}
async function showStep5ContactInfo(bot, chatId) {
    const session = sessionManager_1.userSessions.getSession(chatId.toString());
    const storeData = session.storeCreation?.data;
    const message = `🏪 *Создание магазина "${storeData?.name}"*\n\n` +
        `*Шаг 5 из 5: Контактная информация*\n\n` +
        `Добавьте контактную информацию (все поля необязательные):\n\n` +
        `📞 Телефон для связи\n` +
        `📧 Email для уведомлений\n` +
        `📍 Адрес (если есть физический магазин)\n\n` +
        `Введите контакты в формате:\n` +
        `\`Телефон: +1234567890\`\n` +
        `\`Email: shop@example.com\`\n` +
        `\`Адрес: г. Москва, ул. Примерная, 123\`\n\n` +
        `Или нажмите "Пропустить" для завершения:`;
    const keyboard = {
        inline_keyboard: [
            [{ text: '⏭️ Пропустить этот шаг', callback_data: 'skip_contact_info' }],
            [
                { text: '⬅️ Назад', callback_data: 'store_creation_step_4' },
                { text: '❌ Отменить', callback_data: 'cancel_store_creation' }
            ]
        ]
    };
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}
async function showFinalConfirmation(bot, chatId) {
    const session = sessionManager_1.userSessions.getSession(chatId.toString());
    const storeData = session.storeCreation?.data;
    if (!storeData) {
        await bot.sendMessage(chatId, '❌ Ошибка: данные магазина не найдены');
        return;
    }
    let message = `🏪 *Подтверждение создания магазина*\n\n`;
    message += `📝 *Название:* ${storeData.name}\n`;
    message += `📄 *Описание:* ${storeData.description}\n`;
    message += `🔗 *Адрес:* ${storeData.slug}\n`;
    message += `💱 *Валюта:* ${storeData.currency} ${CURRENCY_SYMBOLS[storeData.currency]}\n\n`;
    if (storeData.contactInfo) {
        message += `📞 *Контакты:*\n`;
        if (storeData.contactInfo.phone)
            message += `• Телефон: ${storeData.contactInfo.phone}\n`;
        if (storeData.contactInfo.email)
            message += `• Email: ${storeData.contactInfo.email}\n`;
        if (storeData.contactInfo.address)
            message += `• Адрес: ${storeData.contactInfo.address}\n`;
        message += `\n`;
    }
    message += `❓ Создать магазин с указанными данными?`;
    const keyboard = {
        inline_keyboard: [
            [{ text: '✅ Создать магазин', callback_data: 'confirm_store_creation' }],
            [
                { text: '✏️ Редактировать', callback_data: 'edit_store_data' },
                { text: '❌ Отменить', callback_data: 'cancel_store_creation' }
            ]
        ]
    };
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}
async function handleStoreCreationMessage(bot, chatId, text) {
    const session = sessionManager_1.userSessions.getSession(chatId.toString());
    if (!session?.storeCreation) {
        return false;
    }
    const { step, data } = session.storeCreation;
    try {
        switch (step) {
            case 1:
                if (!validateStoreName(text)) {
                    await bot.sendMessage(chatId, '❌ Некорректное название магазина.\n\n' +
                        '• Длина должна быть от 3 до 50 символов\n' +
                        '• Избегайте специальных символов\n\n' +
                        'Попробуйте еще раз:');
                    return true;
                }
                const existingByName = await checkStoreNameAvailability(text, session.token);
                if (existingByName === false) {
                    await bot.sendMessage(chatId, `❌ Магазин с названием "${text}" уже существует.\n\n` +
                        'Выберите другое название:');
                    return true;
                }
                data.name = text;
                session.storeCreation.step = 2;
                sessionManager_1.userSessions.updateSession(chatId.toString(), { storeCreation: session.storeCreation });
                await showStep2DescriptionInput(bot, chatId, text);
                return true;
            case 2:
                if (!validateStoreDescription(text)) {
                    await bot.sendMessage(chatId, '❌ Некорректное описание магазина.\n\n' +
                        '• Длина должна быть от 10 до 500 символов\n\n' +
                        'Попробуйте еще раз:');
                    return true;
                }
                data.description = text;
                session.storeCreation.step = 3;
                sessionManager_1.userSessions.updateSession(chatId.toString(), { storeCreation: session.storeCreation });
                await showStep3SlugInput(bot, chatId, data.name);
                return true;
            case 3:
                const slug = text.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (!validateStoreSlug(slug)) {
                    await bot.sendMessage(chatId, '❌ Некорректный адрес магазина.\n\n' +
                        '• Минимум 3 символа\n' +
                        '• Только английские буквы и цифры\n\n' +
                        'Попробуйте еще раз:');
                    return true;
                }
                const existingBySlug = await checkStoreSlugAvailability(slug, session.token);
                if (!existingBySlug) {
                    await bot.sendMessage(chatId, `❌ Адрес "${slug}" уже занят.\n\n` +
                        'Выберите другой адрес:');
                    return true;
                }
                data.slug = slug;
                session.storeCreation.step = 4;
                sessionManager_1.userSessions.updateSession(chatId.toString(), { storeCreation: session.storeCreation });
                await showStep4CurrencySelection(bot, chatId);
                return true;
            case 5:
                const contactInfo = parseContactInfo(text);
                data.contactInfo = contactInfo;
                session.storeCreation.step = 6;
                sessionManager_1.userSessions.updateSession(chatId.toString(), { storeCreation: session.storeCreation });
                await showFinalConfirmation(bot, chatId);
                return true;
        }
    }
    catch (error) {
        logger_1.logger.error('Error in store creation message handler:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте еще раз.');
    }
    return true;
}
async function handleStoreCreationCallback(bot, chatId, callbackData) {
    const session = sessionManager_1.userSessions.getSession(chatId.toString());
    if (!session?.storeCreation) {
        return false;
    }
    try {
        if (callbackData === 'cancel_store_creation') {
            sessionManager_1.userSessions.updateSession(chatId.toString(), { storeCreation: null });
            await bot.sendMessage(chatId, '❌ Создание магазина отменено.');
            return true;
        }
        if (callbackData.startsWith('use_suggested_slug_')) {
            const slug = callbackData.replace('use_suggested_slug_', '');
            session.storeCreation.data.slug = slug;
            session.storeCreation.step = 4;
            sessionManager_1.userSessions.updateSession(chatId.toString(), { storeCreation: session.storeCreation });
            await showStep4CurrencySelection(bot, chatId);
            return true;
        }
        if (callbackData.startsWith('select_currency_')) {
            const currency = callbackData.replace('select_currency_', '');
            session.storeCreation.data.currency = currency;
            session.storeCreation.step = 5;
            sessionManager_1.userSessions.updateSession(chatId.toString(), { storeCreation: session.storeCreation });
            await showStep5ContactInfo(bot, chatId);
            return true;
        }
        if (callbackData === 'skip_contact_info') {
            session.storeCreation.step = 6;
            sessionManager_1.userSessions.updateSession(chatId.toString(), { storeCreation: session.storeCreation });
            await showFinalConfirmation(bot, chatId);
            return true;
        }
        if (callbackData === 'confirm_store_creation') {
            await createStore(bot, chatId, session);
            return true;
        }
        if (callbackData.startsWith('store_creation_step_')) {
            const step = parseInt(callbackData.replace('store_creation_step_', ''));
            await navigateToStep(bot, chatId, session, step);
            return true;
        }
    }
    catch (error) {
        logger_1.logger.error('Error in store creation callback handler:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте еще раз.');
    }
    return false;
}
async function createStore(bot, chatId, session) {
    const storeData = session.storeCreation?.data;
    if (!storeData || !storeData.name || !storeData.description || !storeData.slug || !storeData.currency) {
        await bot.sendMessage(chatId, '❌ Не все обязательные поля заполнены.');
        return;
    }
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Создаю магазин...');
    try {
        const newStoreResponse = await apiService_1.apiService.createStore({
            name: storeData.name,
            description: storeData.description,
            slug: storeData.slug,
            currency: storeData.currency,
            contactPhone: storeData.contactInfo?.phone,
            contactEmail: storeData.contactInfo?.email,
            contactAddress: storeData.contactInfo?.address
        }, session.token);
        const newStore = newStoreResponse.store;
        sessionManager_1.userSessions.updateSession(chatId.toString(), { storeCreation: null });
        let successMessage = `🎉 *Магазин успешно создан!*\n\n`;
        successMessage += `🏪 *${newStore.name}*\n`;
        successMessage += `🔗 Адрес: \`${newStore.slug}\`\n`;
        successMessage += `💱 Валюта: ${newStore.currency}\n\n`;
        successMessage += `📱 *Следующие шаги:*\n`;
        successMessage += `• Добавьте товары в магазин\n`;
        successMessage += `• Настройте способы оплаты\n`;
        successMessage += `• Поделитесь ссылкой с клиентами\n\n`;
        successMessage += `🚀 Ваш магазин готов к работе!`;
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📦 Добавить товары', callback_data: `add_products_${newStore.id}` },
                    { text: '⚙️ Настройки', callback_data: `store_settings_${newStore.id}` }
                ],
                [
                    { text: '📊 Аналитика', callback_data: `store_analytics_${newStore.id}` }
                ]
            ]
        };
        await bot.editMessageText(successMessage, {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        const sanitizedStoreId = String(newStore.id).replace(/[\r\n]/g, ' ');
        const sanitizedUserId = String(session.telegramId).replace(/[\r\n]/g, ' ');
        logger_1.logger.info(`Store created successfully: ${sanitizedStoreId} by user ${sanitizedUserId}`);
    }
    catch (error) {
        const sanitizedError = error instanceof Error ? error.message.replace(/[\r\n]/g, ' ') : String(error).replace(/[\r\n]/g, ' ');
        logger_1.logger.error('Error creating store:', sanitizedError);
        const errorMessage = error.response?.data?.message || 'Не удалось создать магазин';
        await bot.editMessageText(`❌ Ошибка создания магазина: ${errorMessage}\n\n` +
            'Попробуйте еще раз или обратитесь к администратору.', {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Попробовать снова', callback_data: 'retry_store_creation' }]
                ]
            }
        });
    }
}
function validateStoreName(name) {
    return !!(name && name.length >= 3 && name.length <= 50);
}
function validateStoreDescription(description) {
    return !!(description && description.length >= 10 && description.length <= 500);
}
function validateStoreSlug(slug) {
    return !!(slug && slug.length >= 3 && /^[a-z0-9]+$/.test(slug));
}
function generateSlugFromName(name) {
    return name
        .toLowerCase()
        .replace(/[а-я]/g, char => {
        const cyrillicToLatin = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
            'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
            'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
            'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
            'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return cyrillicToLatin[char] || char;
    })
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
}
function parseContactInfo(text) {
    const contactInfo = {};
    const phoneMatch = text.match(/телефон:?\s*([+\d\s\-\(\)]+)/i);
    if (phoneMatch) {
        contactInfo.phone = phoneMatch[1].trim();
    }
    const emailMatch = text.match(/email:?\s*([^\s]+@[^\s]+)/i);
    if (emailMatch) {
        contactInfo.email = emailMatch[1].trim();
    }
    const addressMatch = text.match(/адрес:?\s*(.+?)(?=\n|email|телефон|$)/is);
    if (addressMatch) {
        contactInfo.address = addressMatch[1].trim();
    }
    return contactInfo;
}
async function checkStoreNameAvailability(name, token) {
    try {
        const { stores } = await apiService_1.apiService.getStores(token, 1, 50);
        const exists = Array.isArray(stores) && stores.some((store) => store.name?.toLowerCase() === name.toLowerCase());
        return !exists;
    }
    catch (error) {
        logger_1.logger.error('Error checking store name availability:', error);
        return true;
    }
}
async function checkStoreSlugAvailability(slug, token) {
    try {
        const result = await apiService_1.apiService.checkSlugAvailability(slug, token);
        if (typeof result?.available === 'boolean') {
            return result.available;
        }
        return true;
    }
    catch (error) {
        logger_1.logger.error('Error checking store slug availability:', error);
        return true;
    }
}
async function navigateToStep(bot, chatId, session, step) {
    session.storeCreation.step = step;
    sessionManager_1.userSessions.updateSession(chatId.toString(), { storeCreation: session.storeCreation });
    const storeData = session.storeCreation.data;
    switch (step) {
        case 1:
            await showStep1NameInput(bot, chatId);
            break;
        case 2:
            await showStep2DescriptionInput(bot, chatId, storeData.name || '');
            break;
        case 3:
            await showStep3SlugInput(bot, chatId, storeData.name || '');
            break;
        case 4:
            await showStep4CurrencySelection(bot, chatId);
            break;
        case 5:
            await showStep5ContactInfo(bot, chatId);
            break;
    }
}
//# sourceMappingURL=storeCreationHandler.js.map
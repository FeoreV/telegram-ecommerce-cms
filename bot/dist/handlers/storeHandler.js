"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStores = handleStores;
exports.handleStoreCreationMessage = handleStoreCreationMessage;
const apiService_1 = require("../services/apiService");
const cmsService_1 = require("../services/cmsService");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
const sessionManager_1 = require("../utils/sessionManager");
async function handleStores(bot, msg, callbackQuery) {
    const chatId = msg.chat.id;
    const userId = (callbackQuery?.from?.id || msg.from?.id)?.toString();
    if (!userId)
        return;
    const session = sessionManager_1.userSessions.getSession(userId);
    logger_1.logger.debug(`Store handler - session check:`, {
        telegramId: session.telegramId,
        userId: session.userId,
        hasToken: !!session.token,
        role: session.role
    });
    try {
        if (callbackQuery?.data === 'store_list') {
            await showStoreList(bot, chatId, session);
        }
        else if (callbackQuery?.data?.startsWith('store_select_')) {
            const storeId = callbackQuery.data.replace('store_select_', '');
            await showStore(bot, chatId, session, storeId);
        }
        else if (callbackQuery?.data?.startsWith('store_products_')) {
            const storeId = callbackQuery.data.replace('store_products_', '');
            await showStoreProducts(bot, chatId, session, storeId);
        }
        else if (callbackQuery?.data === 'store_create') {
            await showCreateStoreForm(bot, chatId, session);
        }
        else if (callbackQuery?.data === 'store_create_start') {
            await startStoreCreation(bot, chatId, session);
        }
        else if (callbackQuery?.data?.startsWith('store_create_skip_')) {
            await handleStoreSkipStep(bot, chatId, session, callbackQuery.data);
        }
        else if (callbackQuery?.data?.startsWith('store_create_use_slug_')) {
            const slug = callbackQuery.data.replace('store_create_use_slug_', '');
            await handleStoreSlugInput(bot, chatId, session, slug);
        }
        else if (callbackQuery?.data?.startsWith('store_create_currency_')) {
            const currency = callbackQuery.data.replace('store_create_currency_', '');
            await handleStoreCurrencyInput(bot, chatId, session, currency);
        }
        else {
            await showStoreList(bot, chatId, session);
        }
    }
    catch (error) {
        logger_1.logger.error('Store handler error:', error);
        await bot.sendMessage(chatId, 'Ошибка при загрузке магазинов. Попробуйте еще раз.');
    }
}
async function showStoreList(bot, chatId, session) {
    const loadingMsg = await bot.sendMessage(chatId, '🔄 Загружаю магазины...');
    try {
        logger_1.logger.debug(`showStoreList - session debug:`, {
            telegramId: session.telegramId,
            userId: session.userId,
            hasToken: !!session.token,
            tokenPreview: session.token ? session.token.substring(0, 20) + '...' : 'NO TOKEN',
            role: session.role,
            sessionKeys: Object.keys(session)
        });
        if (!session.token) {
            logger_1.logger.warn(`No token found for user ${session.telegramId}`);
            await bot.editMessageText('Необходимо авторизоваться. Нажмите /start', { chat_id: chatId, message_id: loadingMsg.message_id });
            return;
        }
        const storesResponse = await apiService_1.apiService.getStores(session.token, 1, 10);
        const stores = storesResponse.stores ?? storesResponse.items ?? [];
        if (stores.length === 0) {
            await bot.editMessageText('К сожалению, пока нет доступных магазинов.', { chat_id: chatId, message_id: loadingMsg.message_id });
            return;
        }
        let text = '🏪 *Наши магазины*\n\n🛍️ Выберите магазин для просмотра ассортимента:\n\n';
        const keyboard = { inline_keyboard: [] };
        stores.forEach((store, index) => {
            const storeEmoji = index === 0 ? '🛍️' : index === 1 ? '🎁' : index === 2 ? '🛒' : '🏪';
            text += `${storeEmoji} *${store.name}*\n`;
            if (store.description) {
                const shortDesc = store.description.length > 100
                    ? store.description.substring(0, 100) + '...'
                    : store.description;
                text += `📄 ${shortDesc}\n`;
            }
            text += `📦 Товаров: ${store._count.products} • 💰 ${store.currency}\n\n`;
            keyboard.inline_keyboard.push([
                {
                    text: `${storeEmoji} ${store.name}`,
                    callback_data: `store_select_${store.id}`
                }
            ]);
        });
        if (['ADMIN', 'OWNER'].includes(session.role)) {
            keyboard.inline_keyboard.push([
                { text: '➕ Создать магазин', callback_data: 'store_create' }
            ]);
        }
        keyboard.inline_keyboard.push([
            { text: '🏠 Главное меню', callback_data: 'main_menu' }
        ]);
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    catch (error) {
        await bot.editMessageText('Ошибка при загрузке магазинов.', { chat_id: chatId, message_id: loadingMsg.message_id });
        throw error;
    }
}
async function showStore(bot, chatId, session, storeId) {
    const loadingMsg = await bot.sendMessage(chatId, '🔄 Загружаю информацию о магазине...');
    try {
        if (!session.token) {
            await bot.editMessageText('Необходимо авторизоваться. Нажмите /start', { chat_id: chatId, message_id: loadingMsg.message_id });
            return;
        }
        const storeResponse = await apiService_1.apiService.getStore(storeId, session.token);
        const store = storeResponse.store;
        sessionManager_1.userSessions.updateSession(session.telegramId, { currentStore: storeId });
        let text = `🏪 *${store.name}*\n\n`;
        if (store.description) {
            text += `📄 ${store.description}\n\n`;
        }
        const productsCount = store._count?.products ?? 0;
        const ordersCount = store._count?.orders ?? 0;
        text += `💰 Валюта магазина: ${store.currency}\n`;
        text += `📦 Товаров: ${productsCount}\n`;
        text += `📋 Заказов: ${ordersCount}\n\n`;
        text += `🛍️ *Нажмите "Посмотреть товары" для просмотра каталога*\n`;
        if (store.contactInfo) {
            text += `*📞 Контактная информация:*\n`;
            if (store.contactInfo.phone) {
                text += `Телефон: ${store.contactInfo.phone}\n`;
            }
            if (store.contactInfo.email) {
                text += `Email: ${store.contactInfo.email}\n`;
            }
            if (store.contactInfo.address) {
                text += `Адрес: ${store.contactInfo.address}\n`;
            }
            text += '\n';
        }
        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: '🛍️ Посмотреть товары',
                        callback_data: `store_products_${storeId}`
                    }
                ],
                [
                    { text: '🔙 Все магазины', callback_data: 'store_list' },
                    { text: '🏠 Главная', callback_data: 'main_menu' }
                ]
            ]
        };
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    catch (error) {
        await bot.editMessageText('Ошибка при загрузке информации о магазине.', { chat_id: chatId, message_id: loadingMsg.message_id });
        throw error;
    }
}
async function showStoreProducts(bot, chatId, session, storeId) {
    const loadingMsg = await bot.sendMessage(chatId, '🔄 Загружаю каталог товаров...');
    try {
        if (!session.token) {
            await bot.editMessageText('Необходимо авторизоваться. Нажмите /start', { chat_id: chatId, message_id: loadingMsg.message_id });
            return;
        }
        const [storeResponse, productsResponse] = await Promise.all([
            apiService_1.apiService.getStore(storeId, session.token),
            (async () => {
                const cmsBase = process.env.CMS_BASE_URL;
                if (!cmsBase) {
                    return apiService_1.apiService.getProducts(storeId, session.token, 1, 10);
                }
                try {
                    const data = await cache_1.ttlCache.wrap(`cms:products:store:${storeId}:p1`, 10000, async () => {
                        const resp = await cmsService_1.cmsService.listProducts({ limit: 10, offset: 0 });
                        return resp;
                    });
                    const normalized = {
                        products: (data.products || []).map((p) => ({
                            id: p.id,
                            name: p.title,
                            description: p.description,
                            price: p?.variants?.[0]?.prices?.[0]?.amount ? (p.variants[0].prices[0].amount / 100) : 0,
                            stock: p?.variants?.[0]?.inventory_quantity ?? 0,
                        })),
                        pagination: { page: 1, totalPages: 1 },
                        source: 'cms'
                    };
                    return normalized;
                }
                catch (e) {
                    logger_1.logger.warn('CMS product listing failed, falling back to backend', e);
                    return apiService_1.apiService.getProducts(storeId, session.token, 1, 10);
                }
            })()
        ]);
        const store = storeResponse.store;
        const products = productsResponse.products;
        if (products.length === 0) {
            await bot.editMessageText(`*${store.name}*\n\nВ этом магазине пока нет товаров.`, {
                chat_id: chatId,
                message_id: loadingMsg.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Назад к магазину', callback_data: `store_select_${storeId}` }]
                    ]
                }
            });
            return;
        }
        let text = `🛍️ *Каталог "${store.name}"*\n\n`;
        const paginationTotal = productsResponse.pagination && typeof productsResponse.pagination.total === 'number'
            ? productsResponse.pagination.total
            : products.length;
        text += `📦 Найдено товаров: ${paginationTotal}\n\n`;
        if (paginationTotal === 0) {
            text += `❌ В данном магазине пока нет товаров.\n`;
            text += `Заходите позже или выберите другой магазин.`;
        }
        const keyboard = { inline_keyboard: [] };
        const isCMS = productsResponse.source === 'cms';
        products.forEach((product, index) => {
            const priceEmoji = product.price > 1000 ? '💎' : '💰';
            const stockStatus = product.stock > 10 ? '✅' : product.stock > 0 ? '⚠️' : '❌';
            text += `${index + 1}. *${product.name}*\n`;
            text += `${priceEmoji} ${product.price} ${store.currency} • ${stockStatus} ${product.stock} шт.\n`;
            if (product.description) {
                const shortDesc = product.description.length > 80
                    ? product.description.substring(0, 80) + '...'
                    : product.description;
                text += `📝 ${shortDesc}\n`;
            }
            text += `\n`;
            keyboard.inline_keyboard.push([
                {
                    text: `🛒 ${product.name}`,
                    callback_data: isCMS ? `cms_product_view_${product.id}` : `product_view_${product.id}`
                }
            ]);
        });
        keyboard.inline_keyboard.push([
            { text: '🔙 К описанию магазина', callback_data: `store_select_${storeId}` },
            { text: '🏪 Все магазины', callback_data: 'store_list' }
        ]);
        const totalPages = productsResponse.pagination?.totalPages ?? 1;
        const currentPage = productsResponse.pagination?.page ?? 1;
        if (totalPages > 1) {
            const paginationRow = [];
            if (currentPage > 1) {
                paginationRow.push({
                    text: '⬅️ Пред.',
                    callback_data: `store_products_${storeId}_page_${currentPage - 1}`
                });
            }
            if (currentPage < totalPages) {
                paginationRow.push({
                    text: 'След. ➡️',
                    callback_data: `store_products_${storeId}_page_${currentPage + 1}`
                });
            }
            if (paginationRow.length > 0) {
                keyboard.inline_keyboard.push(paginationRow);
            }
        }
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    catch (error) {
        await bot.editMessageText('Ошибка при загрузке товаров.', { chat_id: chatId, message_id: loadingMsg.message_id });
        throw error;
    }
}
async function showCreateStoreForm(bot, chatId, session) {
    if (!['ADMIN', 'OWNER'].includes(session.role)) {
        await bot.sendMessage(chatId, 'У вас нет прав для создания магазинов.');
        return;
    }
    const text = `
🏪 *Создание нового магазина*

Создайте свой магазин прямо в Telegram!

*Что вам потребуется:*
• Название магазина
• Описание (необязательно)
• Уникальный идентификатор (slug)
• Валюта (USD, EUR, RUB и др.)
• Контактная информация

*Процесс займет всего 2-3 минуты!*

Готовы начать?
  `;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🚀 Начать создание', callback_data: 'store_create_start' }
            ],
            [
                { text: '⬅️ Назад к магазинам', callback_data: 'store_list' }
            ]
        ]
    };
    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}
async function startStoreCreation(bot, chatId, session) {
    if (!['ADMIN', 'OWNER'].includes(session.role)) {
        await bot.sendMessage(chatId, 'У вас нет прав для создания магазинов.');
        return;
    }
    sessionManager_1.userSessions.updateSession(session.telegramId, {
        storeCreation: {
            step: 'name',
            data: {}
        }
    });
    const text = `
🏪 *Шаг 1/5: Название магазина*

Введите название вашего магазина:

*Примеры:*
• "Техно Магазин"
• "Модная одежда"
• "Книжная лавка"

*Требования:*
• От 3 до 50 символов
• Может содержать буквы, цифры и пробелы
  `;
    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '❌ Отменить', callback_data: 'store_list' }]
            ]
        }
    });
}
async function handleStoreCreationMessage(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id?.toString();
    const text = msg.text;
    if (!userId || !text)
        return;
    const session = sessionManager_1.userSessions.getSession(userId);
    if (!session.storeCreation)
        return;
    try {
        switch (session.storeCreation.step) {
            case 'name':
                await handleStoreNameInput(bot, chatId, session, text);
                break;
            case 'description':
                await handleStoreDescriptionInput(bot, chatId, session, text);
                break;
            case 'slug':
                await handleStoreSlugInput(bot, chatId, session, text);
                break;
            case 'currency':
                await handleStoreCurrencyInput(bot, chatId, session, text);
                break;
            case 'contact':
                await handleStoreContactInput(bot, chatId, session, text);
                break;
        }
    }
    catch (error) {
        logger_1.logger.error('Store creation error:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте еще раз.');
    }
}
async function handleStoreNameInput(bot, chatId, session, name) {
    if (name.length < 3 || name.length > 50) {
        await bot.sendMessage(chatId, '❌ Название должно содержать от 3 до 50 символов. Попробуйте еще раз:');
        return;
    }
    sessionManager_1.userSessions.updateSession(session.telegramId, {
        storeCreation: {
            ...session.storeCreation,
            step: 'description',
            data: { ...session.storeCreation.data, name }
        }
    });
    const text = `
✅ *Название принято:* ${name}

🏪 *Шаг 2/5: Описание магазина*

Введите описание вашего магазина (необязательно):

*Примеры:*
• "Качественная электроника по доступным ценам"
• "Стильная одежда для современных людей"
• "Редкие и популярные книги"

*Требования:*
• До 200 символов
• Или отправьте "пропустить" чтобы пропустить этот шаг
  `;
    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '⏭️ Пропустить', callback_data: 'store_create_skip_description' }],
                [{ text: '❌ Отменить', callback_data: 'store_list' }]
            ]
        }
    });
}
async function handleStoreDescriptionInput(bot, chatId, session, description) {
    if (description.toLowerCase() === 'пропустить') {
        description = '';
    }
    else if (description.length > 200) {
        await bot.sendMessage(chatId, '❌ Описание должно содержать не более 200 символов. Попробуйте еще раз:');
        return;
    }
    sessionManager_1.userSessions.updateSession(session.telegramId, {
        storeCreation: {
            ...session.storeCreation,
            step: 'slug',
            data: { ...session.storeCreation.data, description }
        }
    });
    const suggestedSlug = session.storeCreation.data.name
        .toLowerCase()
        .replace(/[^а-яёa-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const text = `
✅ *Описание принято*

🏪 *Шаг 3/5: Уникальный идентификатор (slug)*

Введите уникальный идентификатор для вашего магазина:

*Предложение:* \`${suggestedSlug}\`

*Требования:*
• Только латинские буквы, цифры и дефисы
• От 3 до 30 символов
• Должен быть уникальным

*Пример:* tech-store, fashion-shop, book-corner
  `;
    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: `✅ Использовать: ${suggestedSlug}`, callback_data: `store_create_use_slug_${suggestedSlug}` }],
                [{ text: '❌ Отменить', callback_data: 'store_list' }]
            ]
        }
    });
}
async function handleStoreSlugInput(bot, chatId, session, slug) {
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug) || slug.length < 3 || slug.length > 30) {
        await bot.sendMessage(chatId, '❌ Некорректный формат. Используйте только латинские буквы, цифры и дефисы (3-30 символов):');
        return;
    }
    try {
        const response = await apiService_1.apiService.checkSlugAvailability(slug, session.token);
        if (!response.available) {
            await bot.sendMessage(chatId, '❌ Этот идентификатор уже занят. Попробуйте другой:');
            return;
        }
    }
    catch (error) {
        logger_1.logger.error('Slug check error:', error);
        await bot.sendMessage(chatId, '❌ Ошибка проверки идентификатора. Попробуйте еще раз:');
        return;
    }
    sessionManager_1.userSessions.updateSession(session.telegramId, {
        storeCreation: {
            ...session.storeCreation,
            step: 'currency',
            data: { ...session.storeCreation.data, slug }
        }
    });
    const text = `
✅ *Идентификатор принят:* ${slug}

🏪 *Шаг 4/5: Валюта*

Выберите валюту для вашего магазина:
  `;
    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '💵 USD', callback_data: 'store_create_currency_USD' },
                    { text: '💶 EUR', callback_data: 'store_create_currency_EUR' }
                ],
                [
                    { text: '₽ RUB', callback_data: 'store_create_currency_RUB' },
                    { text: '₴ UAH', callback_data: 'store_create_currency_UAH' }
                ],
                [{ text: '❌ Отменить', callback_data: 'store_list' }]
            ]
        }
    });
}
async function handleStoreCurrencyInput(bot, chatId, session, currency) {
    const validCurrencies = ['USD', 'EUR', 'RUB', 'UAH'];
    if (!validCurrencies.includes(currency)) {
        await bot.sendMessage(chatId, '❌ Выберите валюту из предложенных вариантов.');
        return;
    }
    sessionManager_1.userSessions.updateSession(session.telegramId, {
        storeCreation: {
            ...session.storeCreation,
            step: 'contact',
            data: { ...session.storeCreation.data, currency }
        }
    });
    const text = `
✅ *Валюта выбрана:* ${currency}

🏪 *Шаг 5/5: Контактная информация*

Введите контактную информацию (телефон, email, адрес):

*Пример:*
\`\`\`
Телефон: +7 900 123-45-67
Email: info@mystore.com
Адрес: г. Москва, ул. Примерная, 123
\`\`\`

*Или отправьте "пропустить" чтобы добавить позже*
  `;
    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '⏭️ Пропустить', callback_data: 'store_create_skip_contact' }],
                [{ text: '❌ Отменить', callback_data: 'store_list' }]
            ]
        }
    });
}
async function handleStoreContactInput(bot, chatId, session, contact) {
    let contactInfo = null;
    if (contact.toLowerCase() !== 'пропустить') {
        contactInfo = { description: contact };
    }
    sessionManager_1.userSessions.updateSession(session.telegramId, {
        storeCreation: {
            ...session.storeCreation,
            data: { ...session.storeCreation.data, contactInfo }
        }
    });
    await createStoreFromSession(bot, chatId, session);
}
async function createStoreFromSession(bot, chatId, session) {
    const storeData = session.storeCreation.data;
    const loadingMsg = await bot.sendMessage(chatId, '🔄 Создаю магазин...');
    try {
        const response = await apiService_1.apiService.createStore({
            name: storeData.name,
            description: storeData.description || '',
            slug: storeData.slug,
            currency: storeData.currency,
            contactInfo: storeData.contactInfo
        }, session.token);
        const store = response.store;
        sessionManager_1.userSessions.updateSession(session.telegramId, {
            storeCreation: null
        });
        const text = `
🎉 *Магазин успешно создан!*

🏪 **${store.name}**
🔗 Идентификатор: ${store.slug}
💰 Валюта: ${store.currency}
📊 ID: ${store.id}

*Что дальше?*
• Добавьте товары в магазин
• Настройте категории
• Поделитесь ссылкой с клиентами

*Ссылка на ваш магазин в боте:*
\`/stores → ${store.name}\`
    `;
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🏪 Перейти к магазину', callback_data: `store_select_${store.id}` }],
                    [{ text: '📋 Все магазины', callback_data: 'store_list' }]
                ]
            }
        });
        logger_1.logger.info(`Store created via Telegram: ${store.id} by user ${(0, sanitizer_1.sanitizeForLog)(session.userId)}`);
    }
    catch (error) {
        logger_1.logger.error('Store creation API error:', error);
        await bot.editMessageText('❌ Ошибка при создании магазина. Проверьте данные и попробуйте еще раз.', { chat_id: chatId, message_id: loadingMsg.message_id });
        sessionManager_1.userSessions.updateSession(session.telegramId, {
            storeCreation: null
        });
    }
}
async function handleStoreSkipStep(bot, chatId, session, callbackData) {
    if (callbackData === 'store_create_skip_description') {
        await handleStoreDescriptionInput(bot, chatId, session, 'пропустить');
    }
    else if (callbackData === 'store_create_skip_contact') {
        await handleStoreContactInput(bot, chatId, session, 'пропустить');
    }
}
//# sourceMappingURL=storeHandler.js.map
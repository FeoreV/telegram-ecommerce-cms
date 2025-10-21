"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotHandlerService = void 0;
const prisma_js_1 = require("../lib/prisma.js");
const i18n_js_1 = require("../utils/i18n.js");
const logger_js_1 = require("../utils/logger.js");
const sanitizer_js_1 = require("../utils/sanitizer.js");
const botDataService_js_1 = __importDefault(require("./botDataService.js"));
const EncryptionService_js_1 = require("./EncryptionService.js");
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs/promises"));
const node_fetch_1 = __importDefault(require("node-fetch"));
class BotHandlerService {
    constructor(storeId) {
        this.sessions = new Map();
        this.language = 'ru';
        this.storeId = storeId;
        this.dataService = new botDataService_js_1.default(storeId);
        this.initializeLanguage();
    }
    async initializeLanguage() {
        try {
            const storeInfo = await this.dataService.getStoreInfo();
            const lang = storeInfo.botSettings?.language;
            if (lang && (0, i18n_js_1.isSupportedLanguage)(lang)) {
                this.language = lang;
            }
        }
        catch (_error) {
            logger_js_1.logger.warn(`Could not load language for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}, using default (ru)`);
        }
    }
    translate(key) {
        return (0, i18n_js_1.t)(key, this.language);
    }
    async handleMessage(bot, msg) {
        try {
            const message = msg;
            const chatId = message.chat.id;
            const userId = message.from.id.toString();
            const text = message.text || '';
            let session = this.getSession(userId);
            if (!session) {
                session = await this.createSession(userId, message.from);
            }
            await this.dataService.updateStoreStats();
            if ((message.photo || message.document) && session.paymentProofFlow?.awaitingPhoto) {
                await this.handlePaymentProofUpload(bot, chatId, message, session);
                this.saveSession(userId, session);
                return;
            }
            if (text.startsWith('/')) {
                await this.handleCommand(bot, chatId, text, session);
            }
            else {
                await this.handleTextMessage(bot, chatId, text, session);
            }
            this.saveSession(userId, session);
        }
        catch (error) {
            logger_js_1.logger.error(`Error handling message for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            if (error instanceof Error && error.message.startsWith('STORE_NOT_FOUND')) {
                logger_js_1.logger.error(`⛔ Store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)} no longer exists - bot should be stopped`);
                await bot.sendMessage(msg.chat.id, '⚠️ Этот магазин больше не активен. Свяжитесь с администратором для получения дополнительной информации.').catch(() => { });
                throw error;
            }
            await bot.sendMessage(msg.chat.id, `❌ ${this.translate('error.generic')}`).catch(() => { });
        }
    }
    async handleCommand(bot, chatId, command, session) {
        const cmd = command.split(' ')[0].toLowerCase();
        const customCommandResponse = await this.checkCustomCommands(cmd);
        if (customCommandResponse) {
            await bot.sendMessage(chatId, customCommandResponse, { parse_mode: 'Markdown' });
            return;
        }
        switch (cmd) {
            case '/start':
                await this.handleStartCommand(bot, chatId, session);
                break;
            case '/catalog':
            case '/catalogue':
                await this.showCatalog(bot, chatId, session);
                break;
            case '/orders':
                await this.showMyOrders(bot, chatId, session);
                break;
            case '/help':
                await this.showHelp(bot, chatId);
                break;
            default:
                await bot.sendMessage(chatId, this.translate('error.unknown_command'));
        }
    }
    async checkCustomCommands(command) {
        try {
            const storeInfo = await this.dataService.getStoreInfo();
            const settings = storeInfo.botSettings;
            if (!settings?.customCommands || !Array.isArray(settings.customCommands)) {
                return null;
            }
            for (const customCmd of settings.customCommands) {
                if (!customCmd.enabled)
                    continue;
                const cmdPattern = customCmd.command.toLowerCase().trim();
                const inputCmd = command.toLowerCase().trim();
                if (inputCmd === cmdPattern || inputCmd === `/${cmdPattern}`) {
                    return customCmd.response;
                }
            }
            return null;
        }
        catch (error) {
            logger_js_1.logger.error('Error checking custom commands:', error);
            return null;
        }
    }
    async handleTextMessage(bot, chatId, text, session) {
        switch (session.currentAction) {
            case 'awaiting_customer_info':
                await this.handleCustomerInfo(bot, chatId, text, session);
                break;
            default:
                {
                    const autoResponse = await this.checkAutoResponses(text);
                    if (autoResponse) {
                        await bot.sendMessage(chatId, autoResponse, { parse_mode: 'Markdown' });
                    }
                    else {
                        await bot.sendMessage(chatId, 'Используйте /catalog для просмотра каталога товаров или /help для справки');
                    }
                }
        }
    }
    async checkAutoResponses(text) {
        try {
            const storeInfo = await this.dataService.getStoreInfo();
            const settings = storeInfo.botSettings;
            if (!settings)
                return null;
            if (settings.autoResponses?.responses && Array.isArray(settings.autoResponses.responses)) {
                for (const autoResp of settings.autoResponses.responses) {
                    if (!autoResp.enabled)
                        continue;
                    const trigger = autoResp.trigger.toLowerCase().trim();
                    const messageText = text.toLowerCase().trim();
                    if (messageText === trigger || messageText.includes(trigger)) {
                        return autoResp.response;
                    }
                }
            }
            if (settings.faqs && Array.isArray(settings.faqs)) {
                for (const faq of settings.faqs) {
                    const question = faq.question.toLowerCase().trim();
                    const messageText = text.toLowerCase().trim();
                    if (messageText.includes(question) || question.includes(messageText)) {
                        return `❓ **${faq.question}**\n\n${faq.answer}`;
                    }
                }
            }
            return null;
        }
        catch (error) {
            logger_js_1.logger.error('Error checking auto responses:', error);
            return null;
        }
    }
    async handleStartCommand(bot, chatId, _session) {
        const storeInfo = await this.dataService.getStoreInfo();
        const stats = await this.dataService.getBasicStats();
        const customization = storeInfo.botSettings?.startCustomization || {};
        const emoji = customization.emoji || '🛍️';
        const greeting = customization.greeting || 'Добро пожаловать';
        const welcomeText = customization.welcomeText || storeInfo.botSettings?.welcome_message ||
            `${greeting} в магазин "${storeInfo.name}"!`;
        const showStats = customization.showStats !== false;
        const showDescription = customization.showDescription !== false;
        const additionalText = customization.additionalText || '';
        const headerImage = customization.headerImage || null;
        const catalogButton = customization.catalogButton || {
            text: '🛒 Каталог товаров',
            emoji: '🛒'
        };
        const profileButton = customization.profileButton || {
            text: '👤 Профиль',
            emoji: '👤'
        };
        const helpButton = customization.helpButton || {
            text: '❓ Помощь и контакты',
            emoji: '❓'
        };
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: catalogButton.text, callback_data: 'catalog' }
                    ],
                    [
                        { text: profileButton.text, callback_data: 'profile' },
                        { text: helpButton.text, callback_data: 'help' }
                    ]
                ]
            }
        };
        if (customization.extraButtons && Array.isArray(customization.extraButtons)) {
            customization.extraButtons.forEach((btn) => {
                if (btn.text && (btn.callback_data || btn.url)) {
                    const button = { text: btn.text };
                    if (btn.url) {
                        button.url = btn.url;
                    }
                    else {
                        button.callback_data = btn.callback_data;
                    }
                    keyboard.reply_markup.inline_keyboard.push([button]);
                }
            });
        }
        let message = `${emoji} **${welcomeText}**\n\n`;
        if (showDescription && storeInfo.description) {
            message += `📝 ${storeInfo.description}\n\n`;
        }
        if (additionalText) {
            message += `${additionalText}\n\n`;
        }
        if (showStats) {
            message += `📊 **О магазине:**\n`;
            message += `• ${stats.products.active} товаров в наличии\n`;
            message += `• ${stats.orders.total} выполненных заказов\n`;
            message += `• Валюта: ${storeInfo.currency}\n\n`;
        }
        message += `Выберите действие:`;
        if (headerImage) {
            try {
                await bot.sendPhoto(chatId, headerImage, {
                    caption: message,
                    parse_mode: 'Markdown',
                    ...keyboard
                });
            }
            catch (error) {
                logger_js_1.logger.warn(`Failed to send header image for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
                await bot.sendMessage(chatId, message, {
                    parse_mode: 'Markdown',
                    ...keyboard
                });
            }
        }
        else {
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                ...keyboard
            });
        }
    }
    async showCatalog(bot, chatId, _session) {
        try {
            const [categories, productsResult] = await Promise.all([
                this.dataService.getCategories(),
                this.dataService.getProducts({ limit: 10 })
            ]);
            let message = '🛒 **Каталог товаров**\n\n';
            if (categories.length > 0) {
                message += '📂 **Категории:**\n';
                categories.forEach(category => {
                    message += `• ${category.name} (${category._count.products})\n`;
                });
                message += '\n';
            }
            if (productsResult.products.length > 0) {
                message += '🔥 **Популярные товары:**\n';
                const currency = await this.getCurrency();
                for (const product of productsResult.products.slice(0, 5)) {
                    message += `• ${product.name} - ${product.price} ${currency}\n`;
                }
                message += '\n';
            }
            const keyboardButtons = [];
            if (categories.length > 0) {
                keyboardButtons.push(...categories.map(category => ([
                    { text: `📂 ${category.name}`, callback_data: `category_${category.id}` }
                ])));
            }
            if (productsResult.products.length > 0) {
                keyboardButtons.push(...productsResult.products.slice(0, 5).map(product => ([
                    { text: `🛒 ${product.name}`, callback_data: `product_${product.id}` }
                ])));
            }
            keyboardButtons.push([
                { text: '🔍 Поиск товаров', callback_data: 'search' },
                { text: '⬅️ Назад', callback_data: 'start' }
            ]);
            const keyboard = {
                reply_markup: {
                    inline_keyboard: keyboardButtons
                }
            };
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                ...keyboard
            });
        }
        catch (error) {
            logger_js_1.logger.error(`Error showing catalog for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            await bot.sendMessage(chatId, '❌ Ошибка загрузки каталога');
        }
    }
    async showCart(bot, chatId, session) {
        if (!session.cart || session.cart.length === 0) {
            await bot.sendMessage(chatId, '🛍️ Ваша корзина пуста\n\nИспользуйте /catalog для выбора товаров', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🛒 Перейти к каталогу', callback_data: 'catalog' }]
                    ]
                }
            });
            return;
        }
        let message = '🛍️ **Ваша корзина:**\n\n';
        let total = 0;
        const currency = await this.getCurrency();
        session.cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            message += `${index + 1}. ${item.name}\n`;
            message += `   Количество: ${item.quantity}\n`;
            message += `   Цена: ${itemTotal} ${currency}\n\n`;
        });
        message += `💰 **Итого: ${total} ${currency}**`;
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Оформить заказ', callback_data: 'checkout' },
                        { text: '🗑️ Очистить корзину', callback_data: 'clear_cart' }
                    ],
                    [
                        { text: '🛒 Продолжить покупки', callback_data: 'catalog' },
                        { text: '⬅️ Назад', callback_data: 'start' }
                    ]
                ]
            }
        };
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            ...keyboard
        });
    }
    async showMyOrders(bot, chatId, session) {
        try {
            const orders = await this.dataService.getCustomerOrders(session.userId, 5);
            if (orders.length === 0) {
                await bot.sendMessage(chatId, '📋 У вас пока нет заказов', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🛒 Перейти к каталогу', callback_data: 'catalog' }]
                        ]
                    }
                });
                return;
            }
            let message = '📋 **Ваши заказы:**\n\n';
            const defaultCurrency = await this.getCurrency();
            orders.forEach(order => {
                message += `🧾 **Заказ ${order.orderNumber}**\n`;
                message += `📅 ${new Date(order.createdAt).toLocaleDateString('ru-RU')}\n`;
                message += `💰 ${order.totalAmount} ${order.currency || defaultCurrency}\n`;
                message += `📊 Статус: ${this.getStatusText(order.status)}\n\n`;
            });
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        ...orders.slice(0, 3).map(order => ([
                            { text: `📋 ${order.orderNumber}`, callback_data: `order_${order.id}` }
                        ])),
                        [{ text: '⬅️ Назад', callback_data: 'start' }]
                    ]
                }
            };
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                ...keyboard
            });
        }
        catch (error) {
            logger_js_1.logger.error(`Error showing orders for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            await bot.sendMessage(chatId, '❌ Ошибка загрузки заказов');
        }
    }
    async handleSearch(bot, chatId, query, session) {
        try {
            const result = await this.dataService.getProducts({
                search: query,
                limit: 10
            });
            if (result.products.length === 0) {
                await bot.sendMessage(chatId, `🔍 По запросу "${query}" ничего не найдено\n\nПопробуйте другие ключевые слова или перейдите в каталог`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🛒 Каталог', callback_data: 'catalog' }]
                        ]
                    }
                });
                return;
            }
            let message = `🔍 **Результаты поиска "${query}":**\n\n`;
            message += `Найдено товаров: ${result.total}\n\n`;
            const currency = await this.getCurrency();
            result.products.forEach(product => {
                message += `📦 **${product.name}**\n`;
                if (product.description) {
                    message += `${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}\n`;
                }
                message += `💰 ${product.price} ${currency}\n`;
                message += `📊 В наличии: ${product.stock}\n\n`;
            });
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        ...result.products.slice(0, 5).map(product => ([
                            { text: `📦 ${product.name}`, callback_data: `product_${product.id}` }
                        ])),
                        [
                            { text: '🔍 Новый поиск', callback_data: 'search' },
                            { text: '⬅️ Назад', callback_data: 'start' }
                        ]
                    ]
                }
            };
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                ...keyboard
            });
            session.currentAction = undefined;
        }
        catch (error) {
            logger_js_1.logger.error(`Error handling search for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            await bot.sendMessage(chatId, '❌ Ошибка поиска');
        }
    }
    async showHelp(bot, chatId) {
        try {
            const storeInfo = await this.dataService.getStoreInfo();
            const menuCustomization = storeInfo.botSettings?.menuCustomization || {};
            let message = `❓ **Помощь и контакты**\n\n`;
            message += `**Доступные команды:**\n`;
            message += `/start - Главное меню\n`;
            message += `/catalog - ${menuCustomization.catalogText || 'Каталог товаров'}\n`;
            message += `/orders - ${menuCustomization.ordersText || 'Мои заказы'}\n`;
            message += `/help - ${menuCustomization.helpText || 'Эта справка'}\n`;
            if (storeInfo.botSettings?.customCommands && Array.isArray(storeInfo.botSettings.customCommands)) {
                const enabledCommands = storeInfo.botSettings.customCommands.filter((cmd) => cmd.enabled);
                if (enabledCommands.length > 0) {
                    message += `\n**Дополнительные команды:**\n`;
                    enabledCommands.forEach((cmd) => {
                        message += `/${cmd.command} - ${cmd.description || 'Дополнительная команда'}\n`;
                    });
                }
            }
            message += `\n**Как сделать заказ:**\n`;
            message += `1️⃣ Выберите товар в каталоге\n`;
            message += `2️⃣ Выберите количество\n`;
            message += `3️⃣ Подтвердите заказ\n`;
            message += `4️⃣ Оплатите по реквизитам\n`;
            message += `5️⃣ Отправьте подтверждение оплаты\n\n`;
            message += `📞 **Контактная информация:**\n`;
            message += `🏪 ${storeInfo.name}\n`;
            if (storeInfo.contactInfo) {
                try {
                    const contacts = JSON.parse(storeInfo.contactInfo);
                    if (contacts.phone)
                        message += `📱 Телефон: ${contacts.phone}\n`;
                    if (contacts.email)
                        message += `📧 Email: ${contacts.email}\n`;
                    if (contacts.address)
                        message += `📍 Адрес: ${contacts.address}\n`;
                }
                catch (error) {
                    message += `📞 ${storeInfo.contactInfo}\n`;
                }
            }
            message += `\n💬 Или просто напишите нам в этом чате!`;
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🏠 Главное меню', callback_data: 'start' }]
                    ]
                }
            });
        }
        catch (error) {
            logger_js_1.logger.error(`Error showing help for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            await bot.sendMessage(chatId, '❌ Ошибка загрузки информации');
        }
    }
    async showProfile(bot, chatId, session) {
        try {
            const orders = await this.dataService.getCustomerOrders(session.userId, 5);
            const currency = await this.getCurrency();
            let message = `👤 **Ваш профиль**\n\n`;
            message += `🆔 ID: ${session.userId}\n`;
            message += `📋 Заказов: ${orders.length}\n\n`;
            let totalSpent = 0;
            let paidOrders = 0;
            orders.forEach((order) => {
                if (order.status === 'PAID' || order.status === 'DELIVERED') {
                    totalSpent += order.totalAmount || 0;
                    paidOrders++;
                }
            });
            message += `📊 **Статистика:**\n`;
            message += `✅ Оплачено заказов: ${paidOrders}\n`;
            message += `💰 Общая сумма покупок: ${totalSpent.toFixed(2)} ${currency}\n\n`;
            message += `*Выберите раздел:*`;
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📋 Мои заказы', callback_data: 'orders' }
                        ],
                        [
                            { text: '🏠 Главное меню', callback_data: 'start' }
                        ]
                    ]
                }
            });
        }
        catch (_error) {
            logger_js_1.logger.error(`Error showing profile for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, _error);
            await bot.sendMessage(chatId, '❌ Ошибка загрузки профиля');
        }
    }
    getSession(userId) {
        return this.sessions.get(userId) || null;
    }
    async createSession(userId, telegramUser) {
        const tgUser = telegramUser;
        const user = await this.dataService.getOrCreateCustomer(userId, {
            username: tgUser.username,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name
        });
        const session = {
            userId: user.id,
            storeId: this.storeId,
            cart: [],
            data: {}
        };
        this.sessions.set(userId, session);
        return session;
    }
    saveSession(userId, session) {
        this.sessions.set(userId, session);
    }
    async getCurrency() {
        try {
            const storeInfo = await this.dataService.getStoreInfo();
            return storeInfo.currency || 'USD';
        }
        catch (_error) {
            return 'USD';
        }
    }
    getStatusText(status) {
        const statusMap = {
            'PENDING_ADMIN': '⏳ Ожидает подтверждения',
            'PAID': '✅ Оплачен',
            'SHIPPED': '🚚 Отправлен',
            'DELIVERED': '📦 Доставлен',
            'REJECTED': '❌ Отклонен',
            'CANCELLED': '🚫 Отменен'
        };
        return statusMap[status] || status;
    }
    async handleCallbackQuery(bot, query) {
        try {
            const callbackQuery = query;
            const chatId = callbackQuery.message.chat.id;
            const userId = callbackQuery.from.id.toString();
            const data = callbackQuery.data;
            let session = this.getSession(userId);
            if (!session) {
                session = await this.createSession(userId, callbackQuery.from);
            }
            await bot.answerCallbackQuery(callbackQuery.id);
            if (data === 'start') {
                await this.handleStartCommand(bot, chatId, session);
            }
            else if (data === 'catalog') {
                await this.showCatalog(bot, chatId, session);
            }
            else if (data === 'profile') {
                await this.showProfile(bot, chatId, session);
            }
            else if (data === 'orders') {
                await this.showMyOrders(bot, chatId, session);
            }
            else if (data === 'help') {
                await this.showHelp(bot, chatId);
            }
            else if (data.startsWith('category_')) {
                const categoryId = data.replace('category_', '');
                await this.showCategoryProducts(bot, chatId, categoryId, session);
            }
            else if (data.startsWith('product_')) {
                const productId = data.replace('product_', '');
                await this.showProduct(bot, chatId, productId, session);
            }
            else if (data.startsWith('buy_now_')) {
                const parts = data.replace('buy_now_', '').split('_');
                if (parts.length >= 2) {
                    const productId = parts[0];
                    const quantity = parseInt(parts[1]) || 1;
                    await this.handleDirectPurchase(bot, chatId, productId, quantity, session);
                }
            }
            else if (data.startsWith('confirm_order_')) {
                const parts = data.replace('confirm_order_', '').split('_');
                if (parts.length >= 2) {
                    const productId = parts[0];
                    const quantity = parseInt(parts[1]) || 1;
                    await this.createOrderFromDirect(bot, chatId, productId, quantity, session);
                }
            }
            else if (data.startsWith('upload_proof_')) {
                const orderId = data.replace('upload_proof_', '');
                await this.initiatePaymentProofFlow(bot, chatId, orderId, session);
            }
            else if (data === 'cancel_payment_proof') {
                session.paymentProofFlow = undefined;
                await bot.sendMessage(chatId, '❌ Загрузка чека отменена', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 Мои заказы', callback_data: 'orders' }],
                            [{ text: '🏠 Главное меню', callback_data: 'start' }]
                        ]
                    }
                });
            }
            this.saveSession(userId, session);
        }
        catch (error) {
            logger_js_1.logger.error(`Error handling callback query for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
        }
    }
    async showCategoryProducts(bot, chatId, categoryId, _session) {
        try {
            const result = await this.dataService.getProducts({
                categoryId,
                limit: 10
            });
            if (result.products.length === 0) {
                await bot.sendMessage(chatId, '📦 В этой категории пока нет товаров', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '⬅️ К каталогу', callback_data: 'catalog' }]
                        ]
                    }
                });
                return;
            }
            let message = `📂 **Товары в категории**\n\n`;
            message += `Найдено: ${result.total} товаров\n\n`;
            const currency = await this.getCurrency();
            result.products.forEach(product => {
                message += `📦 **${product.name}**\n`;
                message += `💰 ${product.price} ${currency}\n`;
                message += `📊 В наличии: ${product.stock}\n\n`;
            });
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        ...result.products.map(product => ([
                            { text: `📦 ${product.name}`, callback_data: `product_${product.id}` }
                        ])),
                        [{ text: '⬅️ К каталогу', callback_data: 'catalog' }]
                    ]
                }
            };
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                ...keyboard
            });
        }
        catch (error) {
            logger_js_1.logger.error(`Error showing category products for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            await bot.sendMessage(chatId, '❌ Ошибка загрузки товаров');
        }
    }
    async showProduct(bot, chatId, productId, _session) {
        try {
            const product = await this.dataService.getProduct(productId);
            let message = `📦 **${product.name}**\n\n`;
            if (product.description) {
                message += `📝 ${product.description}\n\n`;
            }
            const currency = await this.getCurrency();
            message += `💰 Цена: ${product.price} ${currency}\n`;
            message += `📊 В наличии: ${product.stock} шт.\n`;
            if (product.variants && product.variants.length > 0) {
                message += `\n🎨 **Варианты:**\n`;
                product.variants.forEach(variant => {
                    message += `• ${variant.name}: ${variant.value}`;
                    if (variant.price) {
                        message += ` (+${variant.price} ${currency})`;
                    }
                    message += `\n`;
                });
            }
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '1 шт.', callback_data: `buy_now_${productId}_1` },
                            { text: '2 шт.', callback_data: `buy_now_${productId}_2` },
                            { text: '3 шт.', callback_data: `buy_now_${productId}_3` }
                        ],
                        [
                            { text: '4 шт.', callback_data: `buy_now_${productId}_4` },
                            { text: '5 шт.', callback_data: `buy_now_${productId}_5` }
                        ],
                        [
                            { text: '⬅️ Назад', callback_data: 'catalog' }
                        ]
                    ]
                }
            };
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                ...keyboard
            });
        }
        catch (error) {
            logger_js_1.logger.error(`Error showing product for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            await bot.sendMessage(chatId, '❌ Товар не найден');
        }
    }
    async handleCustomerInfo(bot, chatId, customerInfo, session) {
        try {
            const info = this.parseCustomerInfo(customerInfo);
            if (!info.name || !info.phone) {
                await bot.sendMessage(chatId, `❌ Неполная информация. Пожалуйста, укажите:\n\n` +
                    `Имя: Ваше имя\n` +
                    `Телефон: +7xxxxxxxxxx\n` +
                    `Адрес: Адрес доставки\n\n` +
                    `Например: Иван Петров, +79001234567, ул. Ленина 123`);
                return;
            }
            session.customerInfo = JSON.stringify(info);
            if (session.cart && Object.keys(session.cart).length > 0) {
                const cartItems = Object.entries(session.cart).map(([productId, quantity]) => ({
                    productId,
                    quantity: Number(quantity)
                }));
                let totalAmount = 0;
                for (const item of cartItems) {
                    totalAmount += 100 * item.quantity;
                }
                await bot.sendMessage(chatId, `✅ Заказ оформлен!\n\n` +
                    `👤 Покупатель: ${info.name}\n` +
                    `📞 Телефон: ${info.phone}\n` +
                    `📍 Адрес: ${info.address || 'Не указан'}\n\n` +
                    `📦 Товаров: ${cartItems.length}\n` +
                    `💰 Сумма: ${totalAmount}₽\n\n` +
                    `Ожидайте подтверждения от администратора.`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🛍 Продолжить покупки', callback_data: 'show_categories' }],
                            [{ text: '📋 Главное меню', callback_data: 'main_menu' }]
                        ]
                    }
                });
                session.cart = {};
                session.currentAction = undefined;
            }
            else {
                await bot.sendMessage(chatId, '❌ Корзина пуста. Добавьте товары перед оформлением заказа.');
            }
        }
        catch (error) {
            logger_js_1.logger.error(`Error handling customer info for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            await bot.sendMessage(chatId, '❌ Ошибка при обработке информации. Попробуйте снова.');
        }
    }
    parseCustomerInfo(text) {
        const info = {};
        const lines = text.split(/[,\n]/).map(line => line.trim());
        for (const line of lines) {
            const phoneMatch = line.match(/(\+?\d{10,15})/);
            if (phoneMatch && !info.phone) {
                info.phone = phoneMatch[1];
                continue;
            }
            if (!info.name && line.length > 2 && !phoneMatch) {
                const numberCount = (line.match(/\d/g) || []).length;
                if (numberCount < line.length / 3) {
                    info.name = line;
                    continue;
                }
            }
            if (info.name && info.phone && !info.address && line.length > 5) {
                info.address = line;
            }
        }
        if (!info.name && text.length > 0) {
            const firstPart = text.split(/[,\n]/)[0].trim();
            if (firstPart.length > 2) {
                info.name = firstPart;
            }
        }
        return info;
    }
    async createOrderFromDirect(bot, chatId, productId, quantity, session) {
        try {
            const loadingMsg = await bot.sendMessage(chatId, '⏳ Создаю заказ...');
            const product = await this.dataService.getProduct(productId);
            const currency = await this.getCurrency();
            const totalAmount = product.price * quantity;
            const order = await this.dataService.createOrder({
                customerId: session.userId,
                items: [{
                        productId,
                        quantity,
                        price: product.price
                    }],
                customerInfo: {},
                notes: `Заказ из бота магазина`
            });
            const storeInfo = await this.dataService.getStoreInfo();
            let botSettings = storeInfo.botSettings;
            if (typeof botSettings === 'string') {
                try {
                    botSettings = JSON.parse(botSettings);
                }
                catch (error) {
                    logger_js_1.logger.error(`Failed to parse botSettings for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
                    botSettings = {};
                }
            }
            const paymentSettings = botSettings?.paymentSettings || {};
            const paymentRequisites = botSettings?.paymentRequisites || {};
            let message = `✅ **Заказ успешно создан!** #${order.orderNumber || order.id}\n\n`;
            message += `🛍️ Товар: ${product.name}\n`;
            message += `📦 Количество: ${quantity} шт.\n`;
            message += `💳 **Сумма к оплате: ${totalAmount} ${currency}**\n`;
            message += `🏪 Магазин: ${storeInfo.name}\n\n`;
            message += `💰 **Инструкции по оплате:**\n`;
            const instructions = paymentSettings.instructions || botSettings?.paymentInstructions;
            if (instructions) {
                message += `📝 ${instructions}\n\n`;
            }
            else {
                message += `📝 Переведите точную сумму по реквизитам ниже\n\n`;
            }
            const bankDetails = paymentSettings.bankDetails;
            if (bankDetails && (bankDetails.accountNumber || bankDetails.accountName)) {
                message += `💳 **Реквизиты для оплаты:**\n`;
                if (bankDetails.accountNumber) {
                    message += `💳 Номер счета: \`${bankDetails.accountNumber}\`\n`;
                }
                if (bankDetails.accountName) {
                    message += `👤 Получатель: ${bankDetails.accountName}\n`;
                }
                if (bankDetails.bankName) {
                    message += `🏦 Банк: ${bankDetails.bankName}\n`;
                }
                if (bankDetails.notes) {
                    message += `📝 Примечание: ${bankDetails.notes}\n`;
                }
                message += `\n⚠️ **Важно:** Указывайте точную сумму при переводе!\n\n`;
            }
            else if (paymentRequisites && (paymentRequisites.card || paymentRequisites.receiver)) {
                message += `💳 **Реквизиты для оплаты:**\n`;
                if (paymentRequisites.card) {
                    message += `💳 Номер карты: \`${paymentRequisites.card}\`\n`;
                }
                if (paymentRequisites.receiver) {
                    message += `👤 Получатель: ${paymentRequisites.receiver}\n`;
                }
                if (paymentRequisites.bank) {
                    message += `🏦 Банк: ${paymentRequisites.bank}\n`;
                }
                if (paymentRequisites.comment) {
                    message += `📝 Комментарий: ${paymentRequisites.comment}\n`;
                }
                message += `\n⚠️ **Важно:** Указывайте точную сумму при переводе!\n\n`;
            }
            else {
                message += `❗ Реквизиты уточните у администратора\n\n`;
            }
            message += `📸 **После оплаты загрузите скриншот чека (кнопка ниже)**\n`;
            message += `📋 Ваш номер заказа: **#${order.orderNumber || order.id}**`;
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📸 Загрузить чек оплаты', callback_data: `upload_proof_${order.id}` }
                        ],
                        [
                            { text: '📋 Мои заказы', callback_data: 'orders' }
                        ],
                        [
                            { text: '🛒 Продолжить покупки', callback_data: 'catalog' },
                            { text: '🏠 Главное меню', callback_data: 'start' }
                        ]
                    ]
                }
            };
            await bot.deleteMessage(chatId, loadingMsg.message_id);
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                ...keyboard
            });
            const sanitizedOrderId = String(order.id).replace(/[\r\n]/g, ' ');
            logger_js_1.logger.info(`Order created for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}: ${sanitizedOrderId}`, { storeId: (0, sanitizer_js_1.sanitizeForLog)(this.storeId), orderId: sanitizedOrderId });
        }
        catch (error) {
            const sanitizedError = error instanceof Error ? error.message.replace(/[\r\n]/g, ' ') : String(error).replace(/[\r\n]/g, ' ');
            logger_js_1.logger.error(`Error creating order for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, { error: sanitizedError, storeId: (0, sanitizer_js_1.sanitizeForLog)(this.storeId) });
            await bot.sendMessage(chatId, '❌ Ошибка при создании заказа. Попробуйте позже.');
        }
    }
    async handlePaymentProofUpload(bot, chatId, message, session) {
        try {
            const orderId = session.paymentProofFlow?.orderId;
            if (!orderId) {
                await bot.sendMessage(chatId, '❌ Ошибка: заказ не найден');
                return;
            }
            const processingMsg = await bot.sendMessage(chatId, '⏳ Загружаю чек...');
            try {
                logger_js_1.logger.info('Starting payment proof upload process', { orderId: (0, sanitizer_js_1.sanitizeForLog)(orderId) });
                const photo = message.photo?.[message.photo.length - 1];
                const document = message.document;
                const fileId = photo?.file_id || document?.file_id;
                if (!fileId) {
                    logger_js_1.logger.error('No fileId found in message');
                    await bot.editMessageText('❌ Не удалось получить файл', {
                        chat_id: chatId,
                        message_id: processingMsg.message_id
                    });
                    return;
                }
                logger_js_1.logger.info('Getting file info from Telegram', { fileId: (0, sanitizer_js_1.sanitizeForLog)(fileId) });
                const fileInfo = await bot.getFile(fileId);
                const filePath = fileInfo.file_path;
                if (!filePath) {
                    logger_js_1.logger.error('No filePath in fileInfo');
                    throw new Error('Failed to get file path');
                }
                logger_js_1.logger.info('File path received', { filePath: (0, sanitizer_js_1.sanitizeForLog)(filePath) });
                const store = await prisma_js_1.prisma.store.findUnique({
                    where: { id: this.storeId },
                    select: { botToken: true }
                });
                if (!store?.botToken) {
                    logger_js_1.logger.error('Bot token not found in database');
                    throw new Error('Bot token not found');
                }
                logger_js_1.logger.info('Bot token found, attempting decryption');
                let decryptedToken;
                try {
                    decryptedToken = await EncryptionService_js_1.encryptionService.decryptData(store.botToken);
                    logger_js_1.logger.info('Bot token decrypted successfully');
                }
                catch (error) {
                    logger_js_1.logger.warn('Failed to decrypt token, trying as plaintext', { error });
                    decryptedToken = store.botToken;
                }
                logger_js_1.logger.info('Downloading file from Telegram');
                const fileUrl = `https://api.telegram.org/file/bot${decryptedToken}/${filePath}`;
                const response = await (0, node_fetch_1.default)(fileUrl);
                if (!response.ok) {
                    logger_js_1.logger.error('Failed to download file', { status: response.status, statusText: response.statusText });
                    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
                }
                logger_js_1.logger.info('File downloaded successfully, saving to disk');
                const buffer = await response.arrayBuffer();
                const fileExtension = path_1.default.extname(filePath) || '.jpg';
                const fileName = `payment_proof_${orderId}_${Date.now()}${fileExtension}`;
                const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'payment-proofs');
                await fs.mkdir(uploadsDir, { recursive: true });
                const localFilePath = path_1.default.join(uploadsDir, fileName);
                await fs.writeFile(localFilePath, Buffer.from(buffer));
                logger_js_1.logger.info('File saved to disk', { localFilePath: (0, sanitizer_js_1.sanitizeForLog)(localFilePath) });
                const relativePath = path_1.default.relative(process.cwd(), localFilePath);
                await prisma_js_1.prisma.order.update({
                    where: { id: orderId },
                    data: { paymentProof: relativePath }
                });
                logger_js_1.logger.info('Order updated with payment proof');
                const order = await prisma_js_1.prisma.order.findUnique({
                    where: { id: orderId }
                });
                session.paymentProofFlow = undefined;
                await bot.editMessageText(`✅ *Чек успешно загружен!*\n\n` +
                    `📋 Заказ: #${order?.orderNumber}\n` +
                    `💰 Сумма: ${order?.totalAmount} ${order?.currency}\n\n` +
                    `👤 Ваш чек отправлен администратору на проверку.\n` +
                    `⏱️ Вы получите уведомление о результате в ближайшее время.`, {
                    chat_id: chatId,
                    message_id: processingMsg.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '📋 Мои заказы', callback_data: 'orders' },
                                { text: '🏠 Главное меню', callback_data: 'start' }
                            ]
                        ]
                    }
                });
                logger_js_1.logger.info(`Payment proof uploaded successfully for order ${(0, sanitizer_js_1.sanitizeForLog)(orderId)}`);
            }
            catch (error) {
                logger_js_1.logger.error(`Payment proof processing failed:`, {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    storeId: (0, sanitizer_js_1.sanitizeForLog)(this.storeId),
                    orderId: (0, sanitizer_js_1.sanitizeForLog)(orderId)
                });
                await bot.editMessageText('❌ Ошибка при обработке чека. Попробуйте еще раз или обратитесь в поддержку.', {
                    chat_id: chatId,
                    message_id: processingMsg.message_id
                });
            }
        }
        catch (error) {
            logger_js_1.logger.error(`Payment proof upload error for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            await bot.sendMessage(chatId, '❌ Ошибка при загрузке файла');
        }
    }
    async initiatePaymentProofFlow(bot, chatId, orderId, session) {
        try {
            const order = await prisma_js_1.prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    store: true
                }
            });
            if (!order) {
                await bot.sendMessage(chatId, '❌ Заказ не найден');
                return;
            }
            session.paymentProofFlow = {
                orderId,
                awaitingPhoto: true
            };
            this.saveSession(session.userId, session);
            let instructionText = `📸 *Загрузка чека оплаты*\n\n`;
            instructionText += `📋 Заказ: #${order.orderNumber}\n`;
            instructionText += `💰 Сумма: ${order.totalAmount} ${order.currency}\n\n`;
            instructionText += `Для подтверждения оплаты, пожалуйста, отправьте:\n\n`;
            instructionText += `• Фото чека или квитанции об оплате\n`;
            instructionText += `• Скриншот перевода\n`;
            instructionText += `• Любой документ, подтверждающий оплату\n\n`;
            instructionText += `⚠️ *Важно:* Убедитесь, что на изображении четко видны:\n`;
            instructionText += `- Сумма перевода\n`;
            instructionText += `- Дата и время операции\n`;
            instructionText += `- Реквизиты получателя`;
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '❌ Отменить', callback_data: 'cancel_payment_proof' }]
                    ]
                }
            };
            await bot.sendMessage(chatId, instructionText, {
                parse_mode: 'Markdown',
                ...keyboard
            });
            logger_js_1.logger.info(`Payment proof flow initiated for order ${(0, sanitizer_js_1.sanitizeForLog)(orderId)} in store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}`);
        }
        catch (error) {
            logger_js_1.logger.error(`Error initiating payment proof flow for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            await bot.sendMessage(chatId, '❌ Ошибка при инициализации загрузки чека');
        }
    }
    async handleDirectPurchase(bot, chatId, productId, quantity, session) {
        try {
            const product = await this.dataService.getProduct(productId);
            if (product.stock < quantity) {
                await bot.sendMessage(chatId, `❌ Недостаточно товара на складе.\nДоступно: ${product.stock} шт.`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '⬅️ Назад к товару', callback_data: `product_${productId}` }]
                        ]
                    }
                });
                return;
            }
            const currency = await this.getCurrency();
            const totalAmount = product.price * quantity;
            let message = `🧾 **Подтверждение заказа**\n\n`;
            message += `🛍️ Товар: ${product.name}\n`;
            message += `📦 Количество: ${quantity} шт.\n`;
            message += `💰 Цена за единицу: ${product.price} ${currency}\n`;
            message += `💳 **Итого к оплате: ${totalAmount} ${currency}**\n\n`;
            message += `⚡ Подтвердите создание заказа`;
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Подтвердить заказ', callback_data: `confirm_order_${productId}_${quantity}` }
                        ],
                        [
                            { text: '🔙 Назад к товару', callback_data: `product_${productId}` },
                            { text: '🛒 К каталогу', callback_data: 'catalog' }
                        ]
                    ]
                }
            });
        }
        catch (error) {
            logger_js_1.logger.error(`Error handling direct purchase for store ${(0, sanitizer_js_1.sanitizeForLog)(this.storeId)}:`, error);
            await bot.sendMessage(chatId, '❌ Ошибка при оформлении заказа');
        }
    }
    cleanup() {
        this.sessions.clear();
    }
}
exports.BotHandlerService = BotHandlerService;
exports.default = BotHandlerService;
//# sourceMappingURL=botHandlerService.js.map
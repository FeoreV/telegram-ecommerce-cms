import TelegramBot from 'node-telegram-bot-api';
import BotDataService from './botDataService.js';
import { logger } from '../utils/logger.js';

interface BotSession {
  userId: string;
  storeId: string;
  currentAction?: string;
  cart?: any;
  customerInfo?: any;
  data?: any;
}

interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  name: string;
}

/**
 * Bot Handler Service - Обработка сообщений для индивидуальных ботов
 * Использует BotDataService для изолированного доступа к данным
 */
export class BotHandlerService {
  private storeId: string;
  private dataService: BotDataService;
  private sessions: Map<string, BotSession> = new Map();

  constructor(storeId: string) {
    this.storeId = storeId;
    this.dataService = new BotDataService(storeId);
  }

  async handleMessage(bot: TelegramBot, msg: unknown): Promise<void> {
    try {
      const message = msg as any;
      const chatId = message.chat.id;
      const userId = message.from.id.toString();
      const text = message.text || '';

      // Получаем или создаем сессию
      let session = this.getSession(userId);
      if (!session) {
        session = await this.createSession(userId, message.from);
      }

      // Обновляем активность магазина
      await this.dataService.updateStoreStats();

      // Обрабатываем команды
      if (text.startsWith('/')) {
        await this.handleCommand(bot, chatId, text, session);
      } else {
        await this.handleTextMessage(bot, chatId, text, session);
      }

      // Сохраняем сессию
      this.saveSession(userId, session);

    } catch (error) {
      logger.error(`Error handling message for store ${this.storeId}:`, error);
      await bot.sendMessage((msg as any).chat.id, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  private async handleCommand(bot: TelegramBot, chatId: number, command: string, session: BotSession): Promise<void> {
    const cmd = command.split(' ')[0].toLowerCase();

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
        await bot.sendMessage(chatId, 
          '❓ Неизвестная команда. Используйте /help для просмотра доступных команд.'
        );
    }
  }

  private async handleTextMessage(bot: TelegramBot, chatId: number, text: string, session: BotSession): Promise<void> {
    // Обрабатываем текстовые сообщения в зависимости от текущего действия
    switch (session.currentAction) {
      case 'awaiting_customer_info':
        // Handle customer info for checkout
        await this.handleCustomerInfo(bot, chatId, text, session);
        break;
      
      default:
        // Подсказываем использовать каталог
        await bot.sendMessage(chatId, 
          'Используйте /catalog для просмотра каталога товаров или /help для справки'
        );
    }
  }

  private async handleStartCommand(bot: TelegramBot, chatId: number, _session: BotSession): Promise<void> {
    const storeInfo = await this.dataService.getStoreInfo();
    const stats = await this.dataService.getBasicStats();

    // Получаем настройки кастомизации из botSettings
    const customization = storeInfo.botSettings?.startCustomization || {};
    
    // Настраиваемые элементы
    const emoji = customization.emoji || '🛍️';
    const greeting = customization.greeting || 'Добро пожаловать';
    const welcomeText = customization.welcomeText || storeInfo.botSettings?.welcome_message || 
      `${greeting} в магазин "${storeInfo.name}"!`;
    const showStats = customization.showStats !== false; // По умолчанию показываем
    const showDescription = customization.showDescription !== false;
    const additionalText = customization.additionalText || '';
    const headerImage = customization.headerImage || null;

    // Кастомизация кнопок
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

    // Строим главное меню
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

    // Добавляем дополнительные кнопки если настроены
    if (customization.extraButtons && Array.isArray(customization.extraButtons)) {
      customization.extraButtons.forEach((btn: any) => {
        if (btn.text && (btn.callback_data || btn.url)) {
          const button: any = { text: btn.text };
          if (btn.url) {
            button.url = btn.url;
          } else {
            button.callback_data = btn.callback_data;
          }
          keyboard.reply_markup.inline_keyboard.push([button]);
        }
      });
    }

    // Строим сообщение
    let message = `${emoji} **${welcomeText}**\n\n`;
    
    // Описание магазина
    if (showDescription && storeInfo.description) {
      message += `📝 ${storeInfo.description}\n\n`;
    }
    
    // Дополнительный текст
    if (additionalText) {
      message += `${additionalText}\n\n`;
    }
    
    // Статистика магазина
    if (showStats) {
      message += `📊 **О магазине:**\n`;
      message += `• ${stats.products.active} товаров в наличии\n`;
      message += `• ${stats.orders.total} выполненных заказов\n`;
      message += `• Валюта: ${storeInfo.currency}\n\n`;
    }
    
    message += `Выберите действие:`;

    // Отправляем с картинкой или без
    if (headerImage) {
      try {
        await bot.sendPhoto(chatId, headerImage, {
          caption: message,
          parse_mode: 'Markdown',
          ...keyboard
        });
      } catch (error) {
        // Если картинка не загрузилась, отправляем текстом
        logger.warn(`Failed to send header image for store ${this.storeId}:`, error);
        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }
    } else {
      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  }

  private async showCatalog(bot: TelegramBot, chatId: number, _session: BotSession): Promise<void> {
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

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            ...categories.map(category => ([
              { text: `📂 ${category.name}`, callback_data: `category_${category.id}` }
            ])),
            [
              { text: '🔍 Поиск товаров', callback_data: 'search' },
              { text: '⬅️ Назад', callback_data: 'start' }
            ]
          ]
        }
      };

      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.error(`Error showing catalog for store ${this.storeId}:`, error);
      await bot.sendMessage(chatId, '❌ Ошибка загрузки каталога');
    }
  }

  private async showCart(bot: TelegramBot, chatId: number, session: BotSession): Promise<void> {
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

  private async showMyOrders(bot: TelegramBot, chatId: number, session: BotSession): Promise<void> {
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
    } catch (error) {
      logger.error(`Error showing orders for store ${this.storeId}:`, error);
      await bot.sendMessage(chatId, '❌ Ошибка загрузки заказов');
    }
  }

  private async handleSearch(bot: TelegramBot, chatId: number, query: string, session: BotSession): Promise<void> {
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

      // Сбрасываем режим поиска
      session.currentAction = undefined;
    } catch (error) {
      logger.error(`Error handling search for store ${this.storeId}:`, error);
      await bot.sendMessage(chatId, '❌ Ошибка поиска');
    }
  }

  private async showHelp(bot: TelegramBot, chatId: number): Promise<void> {
    try {
      const storeInfo = await this.dataService.getStoreInfo();
      
      let message = `❓ **Помощь и контакты**\n\n`;
      
      // Помощь
      message += `**Доступные команды:**\n`;
      message += `/start - Главное меню\n`;
      message += `/catalog - Каталог товаров\n`;
      message += `/orders - Мои заказы\n`;
      message += `/help - Эта справка\n\n`;
      
      message += `**Как сделать заказ:**\n`;
      message += `1️⃣ Выберите товар в каталоге\n`;
      message += `2️⃣ Выберите количество\n`;
      message += `3️⃣ Подтвердите заказ\n`;
      message += `4️⃣ Оплатите по реквизитам\n`;
      message += `5️⃣ Отправьте подтверждение оплаты\n\n`;
      
      // Контакты
      message += `📞 **Контактная информация:**\n`;
      message += `🏪 ${storeInfo.name}\n`;
      
      if (storeInfo.contactInfo) {
        try {
          const contacts = JSON.parse(storeInfo.contactInfo);
          if (contacts.phone) message += `📱 Телефон: ${contacts.phone}\n`;
          if (contacts.email) message += `📧 Email: ${contacts.email}\n`;
          if (contacts.address) message += `📍 Адрес: ${contacts.address}\n`;
        } catch (error) {
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
    } catch (error) {
      logger.error(`Error showing help for store ${this.storeId}:`, error);
      await bot.sendMessage(chatId, '❌ Ошибка загрузки информации');
    }
  }

  private async showProfile(bot: TelegramBot, chatId: number, session: BotSession): Promise<void> {
    try {
      // Get user orders
      const orders = await this.dataService.getCustomerOrders(session.userId, 5);
      const currency = await this.getCurrency();

      let message = `👤 **Ваш профиль**\n\n`;
      message += `🆔 ID: ${session.userId}\n`;
      message += `📋 Заказов: ${orders.length}\n\n`;

      // Calculate statistics
      let totalSpent = 0;
      let paidOrders = 0;
      orders.forEach((order: any) => {
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
    } catch (error) {
      logger.error(`Error showing profile for store ${this.storeId}:`, error);
      await bot.sendMessage(chatId, '❌ Ошибка загрузки профиля');
    }
  }


  // Session management
  private getSession(userId: string): BotSession | null {
    return this.sessions.get(userId) || null;
  }

  private async createSession(userId: string, telegramUser: unknown): Promise<BotSession> {
    // Получаем или создаем пользователя в базе данных
    const tgUser = telegramUser as any;
    const user = await this.dataService.getOrCreateCustomer(userId, {
      username: tgUser.username,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name
    });

    const session: BotSession = {
      userId: user.id,
      storeId: this.storeId,
      cart: [],
      data: {}
    };

    this.sessions.set(userId, session);
    return session;
  }

  private saveSession(userId: string, session: BotSession): void {
    this.sessions.set(userId, session);
  }

  // Utility methods
  private async getCurrency(): Promise<string> {
    try {
      const storeInfo = await this.dataService.getStoreInfo();
      return storeInfo.currency || 'USD';
    } catch (error) {
      return 'USD';
    }
  }

  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'PENDING_ADMIN': '⏳ Ожидает подтверждения',
      'PAID': '✅ Оплачен',
      'SHIPPED': '🚚 Отправлен',
      'DELIVERED': '📦 Доставлен',
      'REJECTED': '❌ Отклонен',
      'CANCELLED': '🚫 Отменен'
    };
    return statusMap[status] || status;
  }

  // Callback query handler
  async handleCallbackQuery(bot: TelegramBot, query: unknown): Promise<void> {
    try {
      const callbackQuery = query as any;
      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id.toString();
      const data = callbackQuery.data;

      let session = this.getSession(userId);
      if (!session) {
        session = await this.createSession(userId, callbackQuery.from);
      }

      await bot.answerCallbackQuery(callbackQuery.id);

      // Обрабатываем callback data
      if (data === 'start') {
        await this.handleStartCommand(bot, chatId, session);
      } else if (data === 'catalog') {
        await this.showCatalog(bot, chatId, session);
      } else if (data === 'profile') {
        await this.showProfile(bot, chatId, session);
      } else if (data === 'orders') {
        await this.showMyOrders(bot, chatId, session);
      } else if (data === 'help') {
        await this.showHelp(bot, chatId);
      } else if (data.startsWith('category_')) {
        const categoryId = data.replace('category_', '');
        await this.showCategoryProducts(bot, chatId, categoryId, session);
      } else if (data.startsWith('product_')) {
        const productId = data.replace('product_', '');
        await this.showProduct(bot, chatId, productId, session);
      } else if (data.startsWith('buy_now_')) {
        // Handle direct purchase: buy_now_productId_quantity
        const parts = data.replace('buy_now_', '').split('_');
        if (parts.length >= 2) {
          const productId = parts[0];
          const quantity = parseInt(parts[1]) || 1;
          await this.handleDirectPurchase(bot, chatId, productId, quantity, session);
        }
      } else if (data.startsWith('confirm_order_')) {
        // Create order: confirm_order_productId_quantity
        const parts = data.replace('confirm_order_', '').split('_');
        if (parts.length >= 2) {
          const productId = parts[0];
          const quantity = parseInt(parts[1]) || 1;
          await this.createOrderFromDirect(bot, chatId, productId, quantity, session);
        }
      }

      this.saveSession(userId, session);
    } catch (error) {
      logger.error(`Error handling callback query for store ${this.storeId}:`, error);
    }
  }

  private async showCategoryProducts(bot: TelegramBot, chatId: number, categoryId: string, _session: BotSession): Promise<void> {
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
    } catch (error) {
      logger.error(`Error showing category products for store ${this.storeId}:`, error);
      await bot.sendMessage(chatId, '❌ Ошибка загрузки товаров');
    }
  }

  private async showProduct(bot: TelegramBot, chatId: number, productId: string, _session: BotSession): Promise<void> {
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
    } catch (error) {
      logger.error(`Error showing product for store ${this.storeId}:`, error);
      await bot.sendMessage(chatId, '❌ Товар не найден');
    }
  }

  /**
   * Handle customer information for checkout
   */
  private async handleCustomerInfo(bot: TelegramBot, chatId: number, customerInfo: string, session: unknown): Promise<void> {
    try {
      // Parse customer info (expecting format like: "Name: John, Phone: +1234567890, Address: 123 Main St")
      const info = this.parseCustomerInfo(customerInfo);
      
      if (!info.name || !info.phone) {
        await bot.sendMessage(chatId, `❌ Неполная информация. Пожалуйста, укажите:\n\n` +
          `Имя: Ваше имя\n` +
          `Телефон: +7xxxxxxxxxx\n` +
          `Адрес: Адрес доставки\n\n` +
          `Например: Иван Петров, +79001234567, ул. Ленина 123`);
        return;
      }

      // Store customer info in session
      (session as any).customerInfo = JSON.stringify(info);
      
      // Create order with the cart items
      if ((session as any).cart && Object.keys((session as any).cart).length > 0) {
        const cartItems = Object.entries((session as any).cart).map(([productId, quantity]) => ({
          productId,
          quantity: Number(quantity)
        }));

        // Calculate total (simplified)
        let totalAmount = 0;
        for (const item of cartItems) {
          // In real implementation, fetch actual product price
          totalAmount += 100 * item.quantity; // Placeholder price
        }

        // Here you would create the actual order in the database
        // For now, just confirm the order
        await bot.sendMessage(chatId, 
          `✅ Заказ оформлен!\n\n` +
          `👤 Покупатель: ${info.name}\n` +
          `📞 Телефон: ${info.phone}\n` +
          `📍 Адрес: ${info.address || 'Не указан'}\n\n` +
          `📦 Товаров: ${cartItems.length}\n` +
          `💰 Сумма: ${totalAmount}₽\n\n` +
          `Ожидайте подтверждения от администратора.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🛍 Продолжить покупки', callback_data: 'show_categories' }],
                [{ text: '📋 Главное меню', callback_data: 'main_menu' }]
              ]
            }
          }
        );

        // Clear cart and reset session
        (session as any).cart = {};
        (session as any).currentAction = undefined;
        
      } else {
        await bot.sendMessage(chatId, '❌ Корзина пуста. Добавьте товары перед оформлением заказа.');
      }

    } catch (error) {
      logger.error(`Error handling customer info for store ${this.storeId}:`, error);
      await bot.sendMessage(chatId, '❌ Ошибка при обработке информации. Попробуйте снова.');
    }
  }

  /**
   * Parse customer info from text
   */
  private parseCustomerInfo(text: string): { name?: string; phone?: string; address?: string } {
    const info: { name?: string; phone?: string; address?: string } = {};
    
    // Simple parsing - in production, use more robust parsing
    const lines = text.split(/[,\n]/).map(line => line.trim());
    
    for (const line of lines) {
      
      // Phone number detection
      const phoneMatch = line.match(/(\+?\d{10,15})/);
      if (phoneMatch && !info.phone) {
        info.phone = phoneMatch[1];
        continue;
      }
      
      // If no specific pattern matched, treat as name if it's the first unmatched line
      if (!info.name && line.length > 2 && !phoneMatch) {
        // Simple name detection - contains letters but not too many numbers
        const numberCount = (line.match(/\d/g) || []).length;
        if (numberCount < line.length / 3) {
          info.name = line;
          continue;
        }
      }
      
      // Everything else as address
      if (info.name && info.phone && !info.address && line.length > 5) {
        info.address = line;
      }
    }
    
    // Fallback: if we have text but no name, use the first part as name
    if (!info.name && text.length > 0) {
      const firstPart = text.split(/[,\n]/)[0].trim();
      if (firstPart.length > 2) {
        info.name = firstPart;
      }
    }
    
    return info;
  }

  /**
   * Create order from direct purchase and show payment details
   */
  private async createOrderFromDirect(bot: TelegramBot, chatId: number, productId: string, quantity: number, session: BotSession): Promise<void> {
    try {
      const loadingMsg = await bot.sendMessage(chatId, '⏳ Создаю заказ...');
      
      // Get product info
      const product = await this.dataService.getProduct(productId);
      const currency = await this.getCurrency();
      const totalAmount = product.price * quantity;

      // Create order in database
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

      // Get store payment info
      const storeInfo = await this.dataService.getStoreInfo();
      const paymentSettings = storeInfo.botSettings?.paymentSettings || {};

      // Build order confirmation message with payment details
      let message = `✅ **Заказ успешно создан!** #${order.orderNumber || order.id}\n\n`;
      message += `🛍️ Товар: ${product.name}\n`;
      message += `📦 Количество: ${quantity} шт.\n`;
      message += `💳 **Сумма к оплате: ${totalAmount} ${currency}**\n`;
      message += `🏪 Магазин: ${storeInfo.name}\n\n`;
      message += `💰 **Инструкции по оплате:**\n`;
      
      if (paymentSettings.paymentInstructions) {
        message += `📝 ${paymentSettings.paymentInstructions}\n\n`;
      } else {
        message += `📝 Переведите точную сумму по реквизитам ниже\n\n`;
      }

      if (paymentSettings.cardNumber || paymentSettings.requisites) {
        message += `💳 **Реквизиты для оплаты:**\n`;
        if (paymentSettings.cardNumber) {
          message += `💳 Карта: \`${paymentSettings.cardNumber}\`\n`;
        }
        if (paymentSettings.recipientName) {
          message += `👤 Получатель: ${paymentSettings.recipientName}\n`;
        }
        if (paymentSettings.bankName) {
          message += `🏦 Банк: ${paymentSettings.bankName}\n`;
        }
        message += `\n⚠️ **Важно:** Указывайте точную сумму при переводе!\n\n`;
      } else {
        message += `❗ Реквизиты уточните у администратора\n\n`;
      }

      message += `📱 После оплаты свяжитесь с администратором и предоставьте скриншот чека.\n`;
      message += `📋 Ваш номер заказа: **#${order.orderNumber || order.id}**`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
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

      logger.info(`Order created for store ${this.storeId}: ${order.id}`);

    } catch (error) {
      logger.error(`Error creating order for store ${this.storeId}:`, error);
      await bot.sendMessage(chatId, '❌ Ошибка при создании заказа. Попробуйте позже.');
    }
  }

  /**
   * Handle direct purchase - create order immediately
   */
  private async handleDirectPurchase(bot: TelegramBot, chatId: number, productId: string, quantity: number, session: BotSession): Promise<void> {
    try {
      // Get product info
      const product = await this.dataService.getProduct(productId);
      
      // Check stock
      if (product.stock < quantity) {
        await bot.sendMessage(chatId, 
          `❌ Недостаточно товара на складе.\nДоступно: ${product.stock} шт.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '⬅️ Назад к товару', callback_data: `product_${productId}` }]
              ]
            }
          }
        );
        return;
      }

      const currency = await this.getCurrency();
      const totalAmount = product.price * quantity;

      // Show confirmation
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

    } catch (error) {
      logger.error(`Error handling direct purchase for store ${this.storeId}:`, error);
      await bot.sendMessage(chatId, '❌ Ошибка при оформлении заказа');
    }
  }

  // Cleanup method
  cleanup(): void {
    this.sessions.clear();
  }
}

export default BotHandlerService;

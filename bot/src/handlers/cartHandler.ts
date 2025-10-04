import TelegramBot from 'node-telegram-bot-api';
import { apiService } from '../services/apiService';
import { userSessions } from '../utils/sessionManager';
import { logger } from '../utils/logger';

interface CartItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
  currency: string;
  storeId: string;
  storeName: string;
}

export async function handleCart(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  callbackQuery?: TelegramBot.CallbackQuery
) {
  const chatId = msg.chat.id;
  const userId = (callbackQuery?.from?.id || msg.from?.id)?.toString();

  if (!userId) return;

  const session = userSessions.getSession(userId);

  try {
    if (!callbackQuery?.data || callbackQuery.data === 'cart_view') {
      await showCart(bot, chatId, session);
    } else if (callbackQuery.data === 'cart_checkout') {
      await checkoutCart(bot, chatId, session);
    } else if (callbackQuery.data === 'cart_clear') {
      await clearCart(bot, chatId, session);
    } else if (callbackQuery.data.startsWith('cart_remove_')) {
      const index = parseInt(callbackQuery.data.replace('cart_remove_', ''));
      await removeFromCart(bot, chatId, session, index);
    } else if (callbackQuery.data.startsWith('cart_increase_')) {
      const index = parseInt(callbackQuery.data.replace('cart_increase_', ''));
      await updateCartQuantity(bot, chatId, session, index, 1);
    } else if (callbackQuery.data.startsWith('cart_decrease_')) {
      const index = parseInt(callbackQuery.data.replace('cart_decrease_', ''));
      await updateCartQuantity(bot, chatId, session, index, -1);
    }
  } catch (error) {
    logger.error('Cart handler error:', error);
    await bot.sendMessage(chatId, 'Ошибка при работе с корзиной. Попробуйте еще раз.');
  }
}

export async function addToCart(
  bot: TelegramBot,
  chatId: number,
  session: any,
  item: CartItem
) {
  try {
    const cart = session.cart || [];
    
    // Check if item already exists in cart
    const existingIndex = cart.findIndex((i: CartItem) => 
      i.productId === item.productId && 
      (i.variantId === item.variantId || (!i.variantId && !item.variantId))
    );

    if (existingIndex >= 0) {
      // Update quantity
      cart[existingIndex].quantity += item.quantity;
    } else {
      // Add new item
      cart.push(item);
    }

    // Update session
    userSessions.updateSession(session.telegramId, { cart });

    await bot.sendMessage(chatId, 
      `✅ *Товар добавлен в корзину!*\n\n` +
      `🛍️ ${item.productName}${item.variantName ? ` (${item.variantName})` : ''}\n` +
      `📦 Количество: ${item.quantity} шт.\n` +
      `💰 Цена: ${item.price * item.quantity} ${item.currency}\n\n` +
      `Всего товаров в корзине: ${cart.length}`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🛒 Перейти в корзину', callback_data: 'cart_view' },
              { text: '🛍️ Продолжить покупки', callback_data: `store_products_${item.storeId}` }
            ]
          ]
        }
      }
    );

    logger.info(`Item added to cart for user ${session.telegramId}: ${item.productName}`);
  } catch (error) {
    logger.error('Add to cart error:', error);
    throw error;
  }
}

async function showCart(bot: TelegramBot, chatId: number, session: any) {
  if (!session.token) {
    await bot.sendMessage(chatId, 'Необходимо авторизоваться. Нажмите /start');
    return;
  }

  const cart: CartItem[] = session.cart || [];

  if (cart.length === 0) {
    await bot.sendMessage(chatId, 
      '🛒 *Ваша корзина пуста*\n\n' +
      'Добавьте товары из каталога магазинов!',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏪 Перейти к магазинам', callback_data: 'store_list' }]
          ]
        }
      }
    );
    return;
  }

  // Group items by store
  const storeGroups: { [key: string]: CartItem[] } = {};
  cart.forEach(item => {
    if (!storeGroups[item.storeId]) {
      storeGroups[item.storeId] = [];
    }
    storeGroups[item.storeId].push(item);
  });

  let text = '🛒 *Ваша корзина*\n\n';
  let totalAmount = 0;
  let totalItems = 0;

  Object.entries(storeGroups).forEach(([storeId, items]) => {
    const storeName = items[0].storeName;
    text += `🏪 *${storeName}*\n`;
    
    items.forEach((item, index) => {
      const itemTotal = item.price * item.quantity;
      totalAmount += itemTotal;
      totalItems += item.quantity;
      
      text += `${index + 1}. ${item.productName}`;
      if (item.variantName) {
        text += ` (${item.variantName})`;
      }
      text += `\n`;
      text += `   💰 ${item.price} × ${item.quantity} = ${itemTotal} ${item.currency}\n`;
    });
    text += '\n';
  });

  text += `📊 *Итого:*\n`;
  text += `Товаров: ${totalItems} шт.\n`;
  text += `💳 Сумма: ${totalAmount.toFixed(2)} ${cart[0].currency}`;

  const keyboard = {
    inline_keyboard: [] as any[]
  };

  // Add item management buttons
  cart.forEach((item, index) => {
    keyboard.inline_keyboard.push([
      { text: `➖ ${item.productName.substring(0, 20)}...`, callback_data: `cart_decrease_${index}` },
      { text: `${item.quantity} шт.`, callback_data: `cart_item_${index}` },
      { text: '➕', callback_data: `cart_increase_${index}` },
      { text: '🗑️', callback_data: `cart_remove_${index}` }
    ]);
  });

  // Checkout and clear buttons
  keyboard.inline_keyboard.push([
    { text: '✅ Оформить заказ', callback_data: 'cart_checkout' }
  ]);
  keyboard.inline_keyboard.push([
    { text: '🗑️ Очистить корзину', callback_data: 'cart_clear' },
    { text: '🛍️ Продолжить покупки', callback_data: 'store_list' }
  ]);

  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function checkoutCart(bot: TelegramBot, chatId: number, session: any) {
  if (!session.token) {
    await bot.sendMessage(chatId, 'Необходимо авторизоваться. Нажмите /start');
    return;
  }

  const cart: CartItem[] = session.cart || [];

  if (cart.length === 0) {
    await bot.sendMessage(chatId, 'Корзина пуста!');
    return;
  }

  try {
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Создаю заказ...');

    // Group items by store and create orders
    const storeGroups: { [key: string]: CartItem[] } = {};
    cart.forEach(item => {
      if (!storeGroups[item.storeId]) {
        storeGroups[item.storeId] = [];
      }
      storeGroups[item.storeId].push(item);
    });

    const orders = [];

    for (const [storeId, items] of Object.entries(storeGroups)) {
      const orderData = {
        storeId,
        items: items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price
        })),
        currency: items[0].currency
      };

      const orderResponse = await apiService.createOrder(orderData, session.token);
      orders.push(orderResponse.order || orderResponse);
    }

    // Clear cart
    userSessions.updateSession(session.telegramId, { cart: [] });

    await bot.deleteMessage(chatId, loadingMsg.message_id);

    let successText = '✅ *Заказы успешно созданы!*\n\n';
    
    orders.forEach((order: any) => {
      const orderNumber = order.orderNumber ? `#${order.orderNumber}` : '';
      successText += `📋 Заказ ${orderNumber}\n`;
      successText += `💰 Сумма: ${order.totalAmount} ${order.currency}\n`;
      successText += `🏪 Магазин: ${order.store?.name || 'Неизвестно'}\n\n`;
    });

    successText += `💳 *Инструкции по оплате:*\n`;
    successText += `1️⃣ Переведите точную сумму на реквизиты магазина\n`;
    successText += `2️⃣ Сделайте скриншот чека или подтверждения\n`;
    successText += `3️⃣ Загрузите чек для каждого заказа (кнопки ниже)\n`;
    successText += `4️⃣ Дождитесь подтверждения от администратора\n\n`;
    successText += `📋 Все заказы доступны в разделе "Профиль" → "Мои заказы"`;

    // Create keyboard with upload buttons for each order
    const keyboardButtons: any[] = [];
    
    // Add upload buttons for each order
    orders.forEach((order: any) => {
      const orderNumber = order.orderNumber ? `#${order.orderNumber}` : `ID: ${order.id.slice(-8)}`;
      keyboardButtons.push([
        { text: `📸 Загрузить чек ${orderNumber}`, callback_data: `upload_proof_${order.id}` }
      ]);
    });

    // Add navigation buttons
    keyboardButtons.push([
      { text: '📋 Мои заказы', callback_data: 'order_list' }
    ]);
    keyboardButtons.push([
      { text: '🏪 Магазины', callback_data: 'store_list' },
      { text: '🏠 Главное меню', callback_data: 'main_menu' }
    ]);

    const keyboard = {
      inline_keyboard: keyboardButtons
    };

    await bot.sendMessage(chatId, successText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    logger.info(`Cart checkout completed for user ${session.telegramId}, created ${orders.length} orders`);

  } catch (error) {
    logger.error('Cart checkout error:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при оформлении заказа. Попробуйте еще раз.');
  }
}

async function clearCart(bot: TelegramBot, chatId: number, session: any) {
  userSessions.updateSession(session.telegramId, { cart: [] });
  
  await bot.sendMessage(chatId, 
    '🗑️ *Корзина очищена*',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏪 Перейти к магазинам', callback_data: 'store_list' }]
        ]
      }
    }
  );

  logger.info(`Cart cleared for user ${session.telegramId}`);
}

async function removeFromCart(bot: TelegramBot, chatId: number, session: any, index: number) {
  const cart: CartItem[] = session.cart || [];

  if (index < 0 || index >= cart.length) {
    await bot.sendMessage(chatId, '❌ Товар не найден в корзине.');
    return;
  }

  const removedItem = cart.splice(index, 1)[0];
  userSessions.updateSession(session.telegramId, { cart });

  await bot.sendMessage(chatId, 
    `🗑️ Товар удален из корзины:\n${removedItem.productName}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 Вернуться в корзину', callback_data: 'cart_view' }]
        ]
      }
    }
  );

  logger.info(`Item removed from cart for user ${session.telegramId}: ${removedItem.productName}`);
}

async function updateCartQuantity(
  bot: TelegramBot,
  chatId: number,
  session: any,
  index: number,
  delta: number
) {
  const cart: CartItem[] = session.cart || [];

  if (index < 0 || index >= cart.length) {
    await bot.sendMessage(chatId, '❌ Товар не найден в корзине.');
    return;
  }

  cart[index].quantity += delta;

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  userSessions.updateSession(session.telegramId, { cart });

  // Refresh cart view
  await showCart(bot, chatId, session);
}


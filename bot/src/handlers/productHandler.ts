import TelegramBot from 'node-telegram-bot-api';
import { apiService } from '../services/apiService';
import { cmsService } from '../services/cmsService';
import { qrPaymentService } from '../services/qrPaymentService';
import { OrderSummary, StoreSummary } from '../types/apiResponses';
import { ttlCache } from '../utils/cache';
import { logger } from '../utils/logger';
import { userSessions } from '../utils/sessionManager';

export async function handleProducts(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  callbackQuery?: TelegramBot.CallbackQuery
) {
  const chatId = msg.chat.id;
  // Use callbackQuery.from.id if available (button press), otherwise msg.from.id (command)
  const userId = (callbackQuery?.from?.id || msg.from?.id)?.toString();

  if (!userId || !callbackQuery?.data) return;

  const session = userSessions.getSession(userId);

  try {
    if (callbackQuery.data.startsWith('product_view_')) {
      const productId = callbackQuery.data.replace('product_view_', '');
      await showProduct(bot, chatId, session, productId);
    } else if (callbackQuery.data.startsWith('product_variants_detail_')) {
      const productId = callbackQuery.data.replace('product_variants_detail_', '');
      await showVariantDetails(bot, chatId, session, productId);
    } else if (callbackQuery.data.startsWith('cms_product_view_')) {
      const cmsProductId = callbackQuery.data.replace('cms_product_view_', '');
      await showCMSProduct(bot, chatId, session, cmsProductId);
    } else if (callbackQuery.data.startsWith('product_variant_')) {
      await handleVariantSelection(bot, chatId, session, callbackQuery.data);
    } else if (
      callbackQuery.data.startsWith('buy_simple_') ||
      callbackQuery.data.startsWith('buy_variant_')
    ) {
      await handleQuantitySelection(bot, chatId, session, callbackQuery.data);
    } else if (callbackQuery.data.startsWith('buy_confirm_')) {
      await handleBuyConfirmation(bot, chatId, session, callbackQuery.data);
    }
    // CMS Purchase Handlers
    else if (
      callbackQuery.data.startsWith('cms_buy_simple_') ||
      callbackQuery.data.startsWith('cms_buy_variant_') ||
      callbackQuery.data.startsWith('cms_buy_custom_')
    ) {
      await handleCMSPurchase(bot, chatId, session, callbackQuery.data);
    } else if (callbackQuery.data.startsWith('cms_buy_confirm_')) {
      await handleCMSPurchaseConfirmation(bot, chatId, session, callbackQuery.data);
    } else if (callbackQuery.data.startsWith('cms_notify_stock_')) {
      await handleCMSStockNotification(bot, chatId, session, callbackQuery.data);
    } else if (callbackQuery.data.startsWith('generate_qr_')) {
      await handleQRGeneration(bot, chatId, session, callbackQuery.data);
    }
  } catch (error) {
    logger.error('Product handler error:', error);
    await bot.sendMessage(chatId, 'Ошибка при работе с товаром. Попробуйте еще раз.');
  }
}

async function showProduct(bot: TelegramBot, chatId: number, session: any, productId: string) {
  const loadingMsg = await bot.sendMessage(chatId, '🔄 Загружаю товар...');

  try {
    if (!session.token) {
      await bot.editMessageText(
        'Необходимо авторизоваться. Нажмите /start',
        { chat_id: chatId, message_id: loadingMsg.message_id }
      );
      return;
    }

    const productResponse = await apiService.getProduct(productId, session.token);
    const product = productResponse.product;

    // Format price with better visual appeal
    const priceEmoji = product.price > 1000 ? '💎' : '💰';
    const stockStatus = product.stock > 10 ? '✅ В наличии' :
                       product.stock > 0 ? `⚠️ Осталось ${product.stock} шт.` : '❌ Нет в наличии';

    let text = `🛍️ *${product.name}*\n`;
    text += `🏪 ${product.store.name}\n\n`;

    if (product.description) {
      // Limit description length for better readability
      const shortDesc = product.description.length > 200
        ? product.description.substring(0, 200) + '...'
        : product.description;
      text += `📝 ${shortDesc}\n\n`;
    }

    text += `${priceEmoji} *${product.price} ${product.store.currency}*\n`;
    text += `📦 ${stockStatus}\n`;

    if (product.sku) {
      text += `🏷️ Артикул: \`${product.sku}\`\n`;
    }

    // Handle variants and purchasing
    const keyboard = { inline_keyboard: [] as any[] };

    if (product.variants && product.variants.length > 0) {
      // Группируем варианты по типам
      const variantGroups: { [key: string]: any[] } = {};
      product.variants.forEach((variant: any) => {
        const groupName = variant.name || 'Другое';
        if (!variantGroups[groupName]) {
          variantGroups[groupName] = [];
        }
        variantGroups[groupName].push(variant);
      });

      text += '\n*🎨 Доступные варианты:*\n';
      
      // Функция для получения эмодзи в зависимости от типа варианта
      const getVariantEmoji = (groupName: string): string => {
        const name = groupName.toLowerCase();
        if (name.includes('цвет') || name.includes('color')) return '🎨';
        if (name.includes('размер') || name.includes('size')) return '📏';
        if (name.includes('вес') || name.includes('weight')) return '⚖️';
        if (name.includes('объем') || name.includes('volume')) return '📦';
        if (name.includes('вкус') || name.includes('taste') || name.includes('flavor')) return '🍬';
        if (name.includes('материал') || name.includes('material')) return '🧵';
        return '🔹';
      };
      
      // Отображаем варианты по группам
      Object.entries(variantGroups).forEach(([groupName, variants]: [string, any[]]) => {
        const emoji = getVariantEmoji(groupName);
        text += `\n${emoji} *${groupName}*\n`;
        
        variants.forEach((variant: any) => {
          const variantPrice = variant.price || product.price;
          const variantStock = variant.stock ?? product.stock;
          const stockIcon = variantStock > 10 ? '✅' : variantStock > 0 ? '⚠️' : '❌';
          
          text += `  ${stockIcon} ${variant.value}`;
          if (variant.price && variant.price !== product.price) {
            text += ` - *${variantPrice} ${product.store.currency}*`;
          }
          text += ` (${variantStock} шт.)\n`;
        });
      });

      text += '\n💡 *Выберите нужный вариант:*\n';

      // Создаем кнопки по группам для более удобного выбора
      Object.entries(variantGroups).forEach(([groupName, variants]: [string, any[]]) => {
        const emoji = getVariantEmoji(groupName);
        
        // Группируем кнопки по 2-3 в строке в зависимости от длины названий
        const maxButtonsPerRow = variants.some((v: any) => v.value.length > 10) ? 2 : 3;
        
        for (let i = 0; i < variants.length; i += maxButtonsPerRow) {
          const row: any[] = [];
          for (let j = i; j < Math.min(i + maxButtonsPerRow, variants.length); j++) {
            const variant = variants[j];
            const variantStock = variant.stock ?? product.stock;
            const variantPrice = variant.price || product.price;
            
            if (variantStock > 0) {
              // Показываем цену на кнопке, если она отличается от базовой
              let buttonText = `${emoji} ${variant.value}`;
              if (variant.price && variant.price !== product.price) {
                buttonText += ` (${variantPrice} ${product.store.currency})`;
              }
              
              row.push({
                text: buttonText,
                callback_data: `product_variant_${productId}_${variant.id}`
              });
            }
          }
          if (row.length > 0) {
            keyboard.inline_keyboard.push(row);
          }
        }
      });

      // Добавляем кнопку "Показать детали" для детального просмотра вариантов
      keyboard.inline_keyboard.push([
        {
          text: '📋 Подробнее о вариантах',
          callback_data: `product_variants_detail_${productId}`
        }
      ]);
    } else {
      // Simple product: direct purchase
      if (product.stock > 0) {
        text += '\n*🛒 Выберите количество:*\n';

        // Show quantity options with prices
        const maxQty = Math.min(10, product.stock);
        
        // Первый ряд: 1-5
        if (maxQty >= 1) {
          const row1 = [] as any[];
          for (let i = 1; i <= Math.min(5, maxQty); i++) {
            const totalPrice = (product.price * i).toFixed(2);
            row1.push({
              text: `${i} шт. (${totalPrice} ${product.store.currency})`,
              callback_data: `buy_simple_${productId}_${i}`
            });
          }
          keyboard.inline_keyboard.push(row1);
        }

        // Второй ряд: 6-10
        if (maxQty > 5) {
          const row2 = [] as any[];
          for (let i = 6; i <= Math.min(10, maxQty); i++) {
            const totalPrice = (product.price * i).toFixed(2);
            row2.push({
              text: `${i} шт. (${totalPrice} ${product.store.currency})`,
              callback_data: `buy_simple_${productId}_${i}`
            });
          }
          keyboard.inline_keyboard.push(row2);
        }

        // Add custom quantity option if stock > 10
        if (product.stock > 10) {
          keyboard.inline_keyboard.push([
            {
              text: '📝 Указать другое количество',
              callback_data: `buy_custom_${productId}`
            }
          ]);
        }
      } else {
        text += '\n❌ *Товар закончился*\n';
        keyboard.inline_keyboard.push([
          {
            text: '🔔 Уведомить о поступлении',
            callback_data: `notify_stock_${productId}`
          }
        ]);
      }
    }

    // Navigation buttons with better UX
    keyboard.inline_keyboard.push([
      {
        text: '🔙 К товарам магазина',
        callback_data: `store_products_${product.store?.id || ''}`
      },
      {
        text: '🏪 Все магазины',
        callback_data: 'store_list'
      }
    ]);

    // Send product images if available
    if (product.images && product.images.length > 0) {
      try {
        await bot.sendPhoto(chatId, product.images[0], {
          caption: text,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });

        // Delete loading message
        await bot.deleteMessage(chatId, loadingMsg.message_id);

        } catch {
          // Fallback to text message if photo fails
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    } else {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }

  } catch (error) {
    await bot.editMessageText(
      'Ошибка при загрузке информации о товаре.',
      { chat_id: chatId, message_id: loadingMsg.message_id }
    );
    throw error;
  }
}

async function showVariantDetails(
  bot: TelegramBot,
  chatId: number,
  session: any,
  productId: string
) {
  const loadingMsg = await bot.sendMessage(chatId, '🔄 Загружаю информацию...');

  try {
    if (!session.token) {
      await bot.editMessageText(
        'Необходимо авторизоваться. Нажмите /start',
        { chat_id: chatId, message_id: loadingMsg.message_id }
      );
      return;
    }

    const productResponse = await apiService.getProduct(productId, session.token);
    const product = productResponse.product;

    if (!product.variants || product.variants.length === 0) {
      await bot.editMessageText(
        'У этого товара нет вариантов.',
        { chat_id: chatId, message_id: loadingMsg.message_id }
      );
      return;
    }

    // Группируем варианты по типам
    const variantGroups: { [key: string]: any[] } = {};
    product.variants.forEach((variant: any) => {
      const groupName = variant.name || 'Другое';
      if (!variantGroups[groupName]) {
        variantGroups[groupName] = [];
      }
      variantGroups[groupName].push(variant);
    });

    let text = `📋 *Детальная информация о вариантах*\n\n`;
    text += `🛍️ Товар: *${product.name}*\n`;
    text += `💰 Базовая цена: ${product.price} ${product.store.currency}\n\n`;

    Object.entries(variantGroups).forEach(([groupName, variants]: [string, any[]]) => {
      text += `━━━━━━━━━━━━━━━━\n`;
      text += `📌 *${groupName}* (${variants.length} вариантов)\n\n`;

      variants.forEach((variant: any, index: number) => {
        const variantPrice = variant.price || product.price;
        const variantStock = variant.stock ?? product.stock;
        const priceDiff = variant.price ? (variant.price - product.price) : 0;
        const stockStatus = variantStock > 10 ? '✅ В наличии' :
                          variantStock > 0 ? `⚠️ Осталось ${variantStock}` :
                          '❌ Нет в наличии';

        text += `${index + 1}. *${variant.value}*\n`;
        text += `   💵 Цена: ${variantPrice} ${product.store.currency}`;
        if (priceDiff !== 0) {
          text += ` (${priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(2)})`;
        }
        text += `\n   📦 ${stockStatus}\n`;
        if (variant.sku) {
          text += `   🏷️ SKU: \`${variant.sku}\`\n`;
        }
        text += `\n`;
      });
    });

    text += `━━━━━━━━━━━━━━━━\n`;
    text += `\n💡 Выберите нужный вариант на странице товара для заказа.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔙 Назад к товару', callback_data: `product_view_${productId}` }
        ],
        [
          { text: '🏪 К товарам магазина', callback_data: `store_products_${product.store.id}` }
        ]
      ]
    };

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error('Show variant details error:', error);
    await bot.editMessageText(
      'Ошибка при загрузке информации о вариантах.',
      { chat_id: chatId, message_id: loadingMsg.message_id }
    );
  }
}

async function showCMSProduct(bot: TelegramBot, chatId: number, session: any, cmsProductId: string) {
  const loadingMsg = await bot.sendMessage(chatId, '🔄 Загружаю товар из каталога...');

  try {
    const cmsBase = process.env.CMS_BASE_URL;
    if (!cmsBase) {
      await bot.editMessageText('❌ Каталог CMS недоступен. Повторите позже.', { chat_id: chatId, message_id: loadingMsg.message_id });
      return;
    }

    // Try to map CMS product to local product to enable direct purchase
    if (session.token) {
      try {
        const mappingResp = await apiService.getIntegrationMapping(
          { source: 'MEDUSA', entityType: 'PRODUCT', externalId: cmsProductId },
          session.token
        );
        const localId = mappingResp?.mapping?.localId;
        if (localId) {
          // Reuse the local product flow with direct purchase capabilities
          await showProduct(bot, chatId, session, localId);
          try { await bot.deleteMessage(chatId, loadingMsg.message_id); } catch {}
          return;
        }
      } catch (mapErr) {
        logger.debug('No local mapping found, creating direct CMS purchase flow');
      }
    }

    // Enhanced CMS product display with direct purchase capabilities
    const resp = await cmsService.retrieveProduct(cmsProductId);
    const p = resp.product || resp;

    let defaultPrice = 0;
    let defaultStock = 0;
    const variants = p?.variants || [];

    if (variants.length > 0) {
      defaultPrice = (variants[0]?.prices?.[0]?.amount || 0) / 100;
      defaultStock = variants[0]?.inventory_quantity ?? 0;
    }

    // Enhanced display format
    const priceEmoji = defaultPrice > 1000 ? '💎' : '💰';
    const stockStatus = defaultStock > 10 ? '✅ В наличии' :
                       defaultStock > 0 ? `⚠️ Осталось ${defaultStock} шт.` : '❌ Нет в наличии';

    let text = `🛍️ *${p.title}*\n`;
    text += `🏷️ CMS Каталог\n\n`;

    if (p.description) {
      const shortDesc = p.description.length > 200
        ? p.description.substring(0, 200) + '...'
        : p.description;
      text += `📝 ${shortDesc}\n\n`;
    }

    text += `${priceEmoji} *Цена: ${defaultPrice} ₽*\n`;
    text += `📦 ${stockStatus}\n\n`;

    const keyboard = { inline_keyboard: [] as any[] };

    // Add purchase options for CMS products
    if (defaultStock > 0 && session.token) {
      text += `🛒 *Быстрая покупка:*\n`;

      if (variants.length > 1) {
        text += `\n*🎨 Доступные варианты:*\n`;
        variants.forEach((variant: any, index: number) => {
          const variantPrice = (variant?.prices?.[0]?.amount || 0) / 100;
          const variantStock = variant?.inventory_quantity ?? 0;
          const emoji = index === 0 ? '🟦' : index === 1 ? '🟩' : index === 2 ? '🟨' : '🟪';

          text += `${emoji} ${variant.title}: *${variantPrice} ₽*\n`;

          if (variantStock > 0) {
            keyboard.inline_keyboard.push([
              {
                text: `🛒 Купить ${variant.title}`,
                callback_data: `cms_buy_variant_${cmsProductId}_${variant.id}_1`
              }
            ]);
          }
        });
      } else {
        // Simple product purchase options
        const quantityRow = [] as any[];
        const maxQty = Math.min(5, defaultStock);
        for (let i = 1; i <= maxQty; i++) {
          quantityRow.push({
            text: `${i} шт.`,
            callback_data: `cms_buy_simple_${cmsProductId}_${i}`
          });
        }

        if (quantityRow.length > 0) {
          keyboard.inline_keyboard.push(quantityRow);
        }

        if (defaultStock > 5) {
          keyboard.inline_keyboard.push([
            {
              text: '📝 Указать количество',
              callback_data: `cms_buy_custom_${cmsProductId}`
            }
          ]);
        }
      }
    } else if (defaultStock === 0) {
      text += `\n❌ *Товар закончился*\n`;
      keyboard.inline_keyboard.push([
        {
          text: '🔔 Уведомить о поступлении',
          callback_data: `cms_notify_stock_${cmsProductId}`
        }
      ]);
    } else if (!session.token) {
      text += `\n⚠️ *Для покупки необходимо авторизоваться*\n`;
      keyboard.inline_keyboard.push([
        { text: '🔑 Войти в систему', callback_data: 'login' }
      ]);
    }

    // Navigation buttons
    keyboard.inline_keyboard.push([
      { text: '🔙 К товарам каталога', callback_data: 'cms_product_list' },
      { text: '🏪 Все магазины', callback_data: 'store_list' }
    ]);

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    logger.error('CMS product view error:', error);
    await bot.editMessageText('❌ Ошибка при загрузке товара из каталога.', {
      chat_id: chatId,
      message_id: loadingMsg.message_id
    });
  }
}

// Direct-buy: show variant-specific quantity selector

async function handleVariantSelection(bot: TelegramBot, chatId: number, session: any, data: string) {
  // Parse data: product_variant_productId_variantId
  const parts = data.split('_');
  if (parts.length < 4) return;

  const productId = parts[2];
  const variantId = parts[3];

  // Show quantity selector for this variant (direct buy)
  await showVariantQuantitySelector(bot, chatId, session, productId, variantId);
}

async function showVariantQuantitySelector(
  bot: TelegramBot,
  chatId: number,
  session: any,
  productId: string,
  variantId: string
) {
  try {
    const token = session.token;
    if (!token) {
      await bot.sendMessage(chatId, 'Необходимо авторизоваться. Нажмите /start');
      return;
    }

    const productResponse = await apiService.getProduct(productId, token);
    const product = productResponse.product;
    const variant = product.variants?.find((v: any) => v.id === variantId);

    if (!variant) {
      await bot.sendMessage(chatId, 'Вариант товара не найден.');
      return;
    }

    const variantStock = variant?.stock ?? null;
    const baseStock = product.stock ?? 0;
    const availableStock = variantStock !== null ? variantStock : baseStock;
    const price = variant.price || product.price;
    const currency = product.store.currency;

    let text = `🛒 *Выберите количество*\n\n`;
    text += `🛍️ Товар: *${product.name}*\n`;
    text += `🎨 Вариант: *${variant.name}: ${variant.value}*\n`;
    text += `💰 Цена за 1 шт: *${price} ${currency}*\n`;
    text += `📦 В наличии: *${availableStock} шт.*\n\n`;
    
    const keyboard = { inline_keyboard: [] as any[] };

    // Quantity buttons with prices
    const maxSelectable = Math.min(10, availableStock);
    
    // Первый ряд: 1-5
    if (maxSelectable >= 1) {
      const row1: any[] = [];
      for (let i = 1; i <= Math.min(5, maxSelectable); i++) {
        const totalPrice = (price * i).toFixed(2);
        row1.push({
          text: `${i} шт. (${totalPrice} ${currency})`,
          callback_data: `buy_variant_${productId}_${variantId}_${i}`
        });
      }
      keyboard.inline_keyboard.push(row1);
    }

    // Второй ряд: 6-10 (если доступно)
    if (maxSelectable > 5) {
      const row2: any[] = [];
      for (let i = 6; i <= Math.min(10, maxSelectable); i++) {
        const totalPrice = (price * i).toFixed(2);
        row2.push({
          text: `${i} шт. (${totalPrice} ${currency})`,
          callback_data: `buy_variant_${productId}_${variantId}_${i}`
        });
      }
      keyboard.inline_keyboard.push(row2);
    }

    // Кнопка для большого количества
    if (availableStock > 10) {
      keyboard.inline_keyboard.push([
        {
          text: '📝 Указать другое количество',
          callback_data: `buy_custom_variant_${productId}_${variantId}`
        }
      ]);
    }

    // Navigation buttons
    keyboard.inline_keyboard.push([
      { text: '⬅️ Назад к товару', callback_data: `product_view_${productId}` },
      { text: '🏪 К товарам', callback_data: `store_products_${product.store.id}` }
    ]);

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error('Variant quantity selector error:', error);
    await bot.sendMessage(chatId, 'Ошибка при выборе варианта.');
  }
}

async function handleQuantitySelection(bot: TelegramBot, chatId: number, session: any, data: string) {
  // Parse data: buy_simple_productId_quantity or buy_variant_productId_variantId_quantity
  const parts = data.split('_');
  if (data.startsWith('buy_variant_')) {
    if (parts.length < 5) return;
    const productId = parts[2];
    const variantId = parts[3];
    const quantity = parseInt(parts[4]);
    await showBuyConfirmation(bot, chatId, session, productId, variantId, quantity);
  } else if (data.startsWith('buy_simple_')) {
    if (parts.length < 4) return;
    const productId = parts[2];
    const quantity = parseInt(parts[3]);
    await showBuyConfirmation(bot, chatId, session, productId, undefined, quantity);
  }
}

async function showBuyConfirmation(
  bot: TelegramBot,
  chatId: number,
  session: any,
  productId: string,
  variantId: string | undefined,
  quantity: number
) {
  try {
    if (!session.token) {
      await bot.sendMessage(chatId, 'Необходимо авторизоваться. Нажмите /start');
      return;
    }

    const productResponse = await apiService.getProduct(productId, session.token);
    const product = productResponse.product;
    const variant = variantId ? product.variants?.find((v: any) => v.id === variantId) : null;

    const pricePerUnit = variant?.price || product.price;
    const total = pricePerUnit * quantity;

    let text = `🧾 *Подтверждение заказа*\n\n`;
    text += `🏪 Магазин: ${product.store.name}\n`;
    text += `🛍️ Товар: ${product.name}${variant ? ` (${variant.name}: ${variant.value})` : ''}\n`;
    text += `📦 Количество: ${quantity} шт.\n`;
    text += `💰 Цена за единицу: ${pricePerUnit} ${product.store.currency}\n`;
    text += `💳 *Итого к оплате: ${total} ${product.store.currency}*\n\n`;
    text += `⚡ При подтверждении будет создан заказ с инструкциями по оплате.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Подтвердить и оформить заказ', callback_data: `buy_confirm_${productId}_${variantId || 'null'}_${quantity}` }
        ],
        [
          { text: '🔙 Назад к товару', callback_data: `product_view_${productId}` },
          { text: '🏪 К товарам магазина', callback_data: `store_products_${product.store.id}` }
        ]
      ]
    };

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch (error) {
    logger.error('Show buy confirmation error:', error);
    await bot.sendMessage(chatId, 'Ошибка при подтверждении заказа.');
  }
}

async function handleBuyConfirmation(
  bot: TelegramBot,
  chatId: number,
  session: any,
  data: string
) {
  try {
    if (!session.token) {
      await bot.sendMessage(chatId, 'Необходимо авторизоваться. Нажмите /start');
      return;
    }

    // buy_confirm_productId_variantOrNull_quantity
    const parts = data.split('_');
    if (parts.length < 5) return;
    const productId = parts[2];
    const variantId = parts[3] !== 'null' ? parts[3] : undefined;
    const quantity = parseInt(parts[4]);

    const productResponse = await apiService.getProduct(productId, session.token);
    const product = productResponse.product;

    // Stock check
    let availableStock = product.stock ?? 0;
    let price = product.price;
    let variant = null;
    if (variantId) {
      variant = product.variants?.find((v: any) => v.id === variantId);
      if (!variant) {
        await bot.sendMessage(chatId, 'Вариант товара не найден.');
        return;
      }
      if (typeof variant.stock === 'number') availableStock = variant.stock;
      if (variant.price) price = variant.price;
    }
    if (availableStock < quantity) {
      await bot.sendMessage(chatId, `К сожалению, недостаточно товара в наличии. Доступно: ${availableStock}`);
      return;
    }

    // Create order directly
    const orderResponse = await apiService.createOrder({
      storeId: product.store.id,
      items: [
        {
          productId,
          variantId,
          quantity,
          price
        }
      ],
      currency: product.store.currency
    }, session.token);

    const orderSummary = orderResponse.order ?? (orderResponse as unknown as OrderSummary);
    const totalAmount = orderSummary.totalAmount ?? (price * quantity);
    const orderNumber = orderSummary.orderNumber ? `#${orderSummary.orderNumber}` : '';

    let payText = `✅ *Заказ успешно создан!* ${orderNumber}\n\n`;
    payText += `🛍️ Товар: ${product.name}${variant ? ` (${variant.name}: ${variant.value})` : ''}\n`;
    payText += `📦 Количество: ${quantity} шт.\n`;
    payText += `💳 *Сумма к оплате: ${totalAmount} ${product.store.currency}*\n`;
    payText += `🏪 Магазин: ${product.store.name}\n\n`;
    payText += `💰 *Инструкции по оплате:*\n`;

    // Load bot settings for payment instructions/requisites
    const settingsResp = await apiService.getBotSettings(product.store.id, session.token);
    logger.info('💳 Bot settings response:', JSON.stringify(settingsResp, null, 2));

    const settings = (settingsResp?.settings as Record<string, unknown>) || {};
    const paymentInstructions = (settings.paymentInstructions as string) || 'Переведите точную сумму по реквизитам ниже';
    const requisites = settings.paymentRequisites as { card?: string; bank?: string; receiver?: string; comment?: string } | null | undefined;

    logger.info('💳 Payment instructions:', paymentInstructions);
    logger.info('💳 Payment requisites:', JSON.stringify(requisites, null, 2));

    payText += `📝 ${paymentInstructions}\n\n`;

    // Show requisites if available
    if (requisites && typeof requisites === 'object') {
      const hasAnyRequisite = requisites.card || requisites.bank || requisites.receiver || requisites.comment;

      if (hasAnyRequisite) {
        payText += `💳 *Реквизиты для оплаты:*\n`;
        if (requisites.card) payText += `💳 Карта: \`${requisites.card}\`\n`;
        if (requisites.bank) payText += `🏦 Банк: ${requisites.bank}\n`;
        if (requisites.receiver) payText += `👤 Получатель: ${requisites.receiver}\n`;
        if (requisites.comment) payText += `💬 Комментарий: ${requisites.comment}\n`;
      } else {
        payText += `❗️ Реквизиты не заполнены в настройках магазина\n`;
      }
    } else {
      payText += `❗️ Реквизиты не настроены. Обратитесь к администратору.\n`;
    }

    payText += `\n📸 *После оплаты загрузите скриншот чека (кнопка ниже)*\n`;
    payText += `📋 Ваш номер заказа: ${orderNumber}\n`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📸 Загрузить чек оплаты', callback_data: `upload_proof_${orderSummary.id}` }
        ],
        [
          { text: '📋 Мои заказы', callback_data: 'order_list' },
          { text: '🏪 Магазины', callback_data: 'store_list' }
        ]
      ]
    };

    await bot.sendMessage(chatId, payText, { parse_mode: 'Markdown', reply_markup: keyboard });

    // Automatically generate and send QR code if enabled
    if (process.env.AUTO_GENERATE_QR === 'true' && product.store) {
      const storeSummary: StoreSummary = {
        id: product.store.id,
        name: product.store.name,
        slug: (product.store as any).slug ?? product.store.id,
        currency: product.store.currency,
        status: (product.store as any).status,
        description: (product.store as any).description,
        ownerId: (product.store as any).ownerId,
        botUsername: (product.store as any).botUsername,
        contactInfo: (product.store as any).contactInfo,
        _count: (product.store as any)._count
      };
      await generateAndSendQRCode(bot, chatId, orderSummary, storeSummary, session);
    }
  } catch (error) {
    logger.error('Direct buy confirmation error:', error);
    await bot.sendMessage(chatId, 'Ошибка при создании заказа. Попробуйте еще раз.');
  }
}

// =================================
// CMS DIRECT PURCHASE FUNCTIONALITY
// =================================

async function handleCMSPurchase(bot: TelegramBot, chatId: number, session: any, data: string) {
  try {
    if (!session.token) {
      await bot.sendMessage(chatId, '❌ Необходимо авторизоваться. Нажмите /start');
      return;
    }

    let cmsProductId = '';
    let variantId: string | undefined;
    let quantity = 1;

    if (data.startsWith('cms_buy_simple_')) {
      // cms_buy_simple_productId_quantity
      const parts = data.replace('cms_buy_simple_', '').split('_');
      cmsProductId = parts[0];
      quantity = parseInt(parts[1]) || 1;
    } else if (data.startsWith('cms_buy_variant_')) {
      // cms_buy_variant_productId_variantId_quantity
      const parts = data.replace('cms_buy_variant_', '').split('_');
      cmsProductId = parts[0];
      variantId = parts[1];
      quantity = parseInt(parts[2]) || 1;
    } else if (data.startsWith('cms_buy_custom_')) {
      // cms_buy_custom_productId
      cmsProductId = data.replace('cms_buy_custom_', '');
      await bot.sendMessage(chatId, '📝 Напишите количество товара (число):');
      // Store in session for processing
      userSessions.updateSession(session.telegramId, {
        tempData: { awaitingQuantity: true, cmsProductId }
      });
      return;
    }

    await showCMSBuyConfirmation(bot, chatId, session, cmsProductId, variantId, quantity);
  } catch (error) {
    logger.error('CMS purchase error:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при оформлении покупки CMS товара.');
  }
}

async function showCMSBuyConfirmation(
  bot: TelegramBot,
  chatId: number,
  session: any,
  cmsProductId: string,
  variantId?: string,
  quantity: number = 1
) {
  try {
    const loadingMsg = await bot.sendMessage(chatId, '🔄 Подготавливаю заказ...');

    // Get CMS product details
    const resp = await cmsService.retrieveProduct(cmsProductId);
    const product = resp.product || resp;

    let price = 0;
    let stock = 0;
    let variant = null;
    const variants = product?.variants || [];

    if (variantId) {
      variant = variants.find((v: any) => v.id === variantId);
      if (!variant) {
        await bot.editMessageText('❌ Вариант товара не найден.', {
          chat_id: chatId,
          message_id: loadingMsg.message_id
        });
        return;
      }
      price = (variant?.prices?.[0]?.amount || 0) / 100;
      stock = variant?.inventory_quantity ?? 0;
    } else if (variants.length > 0) {
      price = (variants[0]?.prices?.[0]?.amount || 0) / 100;
      stock = variants[0]?.inventory_quantity ?? 0;
    }

    // Check stock availability
    if (stock < quantity) {
      await bot.editMessageText(
        `❌ Недостаточно товара на складе.\nВ наличии: ${stock} шт.\nЗапрошено: ${quantity} шт.`,
        { chat_id: chatId, message_id: loadingMsg.message_id }
      );
      return;
    }

    const total = price * quantity;

    let text = `🧾 *Подтверждение заказа CMS*\n\n`;
    text += `🏷️ Каталог: CMS\n`;
    text += `🛍️ Товар: ${product.title}${variant ? ` (${variant.title})` : ''}\n`;
    text += `📦 Количество: ${quantity} шт.\n`;
    text += `💰 Цена за единицу: ${price} ₽\n`;
    text += `💳 *Итого к оплате: ${total} ₽*\n\n`;
    text += `⚡ При подтверждении будет создан заказ с инструкциями по оплате.\n`;
    text += `📋 Заказ будет синхронизирован с CMS системой.`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '✅ Подтвердить и оформить заказ',
            callback_data: `cms_buy_confirm_${cmsProductId}_${variantId || 'null'}_${quantity}`
          }
        ],
        [
          { text: '🔙 Назад к товару', callback_data: `cms_product_view_${cmsProductId}` },
          { text: '🏪 К каталогу', callback_data: 'cms_product_list' }
        ]
      ]
    };

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    logger.error('Show CMS buy confirmation error:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при подтверждении заказа CMS.');
  }
}

async function handleCMSPurchaseConfirmation(
  bot: TelegramBot,
  chatId: number,
  session: any,
  data: string
) {
  try {
    if (!session.token) {
      await bot.sendMessage(chatId, '❌ Необходимо авторизоваться. Нажмите /start');
      return;
    }

    // cms_buy_confirm_productId_variantOrNull_quantity
    const parts = data.split('_');
    if (parts.length < 5) return;

    const cmsProductId = parts[2];
    const variantId = parts[3] !== 'null' ? parts[3] : undefined;
    const quantity = parseInt(parts[4]);

    const loadingMsg = await bot.sendMessage(chatId, '⏳ Создаю заказ в CMS...');

    // Get CMS product details
    const resp = await cmsService.retrieveProduct(cmsProductId);
    const product = resp.product || resp;
    const variants = product?.variants || [];

    let price = 0;
    let stock = 0;
    let variant = null;

    if (variantId) {
      variant = variants.find((v: any) => v.id === variantId);
      price = (variant?.prices?.[0]?.amount || 0) / 100;
      stock = variant?.inventory_quantity ?? 0;
    } else if (variants.length > 0) {
      price = (variants[0]?.prices?.[0]?.amount || 0) / 100;
      stock = variants[0]?.inventory_quantity ?? 0;
    }

    // Final stock check
    if (stock < quantity) {
      await bot.editMessageText(`❌ К сожалению, недостаточно товара в наличии. Доступно: ${stock}`, {
        chat_id: chatId,
        message_id: loadingMsg.message_id
      });
      return;
    }

    // Create order in local system with CMS reference
    const orderData = {
      cmsProductId,
      cmsVariantId: variantId,
      productName: product.title,
      variantName: variant?.title,
      quantity,
      price,
      currency: 'RUB', // Default for CMS
      source: 'CMS',
      externalData: {
        cmsProductId,
        cmsVariantId: variantId,
        productTitle: product.title,
        variantTitle: variant?.title
      }
    };

    // Create order through API
    const order = await apiService.createOrder(orderData, session.token);

    const totalAmount = order.totalAmount ?? (price * quantity);
    const orderNumber = order.orderNumber ? `#${order.orderNumber}` : '';

    let successText = `✅ *CMS заказ успешно создан!* ${orderNumber}\n\n`;
    successText += `🛍️ Товар: ${product.title}${variant ? ` (${variant.title})` : ''}\n`;
    successText += `📦 Количество: ${quantity} шт.\n`;
    successText += `💳 *Сумма к оплате: ${totalAmount} ₽*\n`;
    successText += `🏷️ Источник: CMS Каталог\n\n`;
    successText += `💰 *Инструкции по оплате:*\n`;
    successText += `1️⃣ Переведите точную сумму на реквизиты\n`;
    successText += `2️⃣ Сделайте скриншот чека или подтверждения\n`;
    successText += `3️⃣ Загрузите чек через кнопку ниже\n`;
    successText += `4️⃣ Дождитесь подтверждения от администратора\n\n`;
    successText += `🔄 Заказ автоматически синхронизируется с CMS системой.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '📸 Загрузить чек оплаты', callback_data: `upload_proof_${order.id}` }],
        [
          { text: '📋 Мои заказы', callback_data: 'order_list' },
          { text: '🏪 Каталог', callback_data: 'cms_product_list' }
        ]
      ]
    };

    await bot.editMessageText(successText, {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    // SECURITY FIX (CWE-117): Sanitize for logging to prevent log injection
    const { sanitizeForLog } = require('../utils/sanitizer');
    logger.info(`CMS order created: ${sanitizeForLog(order.id)} for product ${sanitizeForLog(cmsProductId)} by user ${sanitizeForLog(session.telegramId)}`);

  } catch (error) {
    logger.error('CMS purchase confirmation error:', error);
    await bot.sendMessage(chatId, `❌ Ошибка при создании CMS заказа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
  }
}

async function handleCMSStockNotification(
  bot: TelegramBot,
  chatId: number,
  session: any,
  data: string
) {
  try {
    const cmsProductId = data.replace('cms_notify_stock_', '');

    // Create stock notification request
    if (session.token) {
      // TODO: Implement stock notification system
      logger.info(`Stock notification requested for product ${cmsProductId} by user ${session.telegramId}`);

      await bot.sendMessage(chatId,
        `🔔 *Уведомление настроено!*\n\n` +
        `Мы сообщим вам, когда товар появится в наличии.\n` +
        `Уведомление придет в этот чат.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.sendMessage(chatId, '❌ Для настройки уведомлений необходимо авторизоваться.');
    }
  } catch (error) {
    logger.error('CMS stock notification error:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при настройке уведомления.');
  }
}

// =================================
// QR CODE PAYMENT FUNCTIONALITY
// =================================

async function handleQRGeneration(
  bot: TelegramBot,
  chatId: number,
  session: any,
  data: string
) {
  try {
    const orderId = data.replace('generate_qr_', '');

    if (!session.token) {
      await bot.sendMessage(chatId, '❌ Необходимо авторизоваться для генерации QR-кода.');
      return;
    }

    const loadingMsg = await bot.sendMessage(chatId, '🔄 Генерирую QR-коды для оплаты...');

    // Get order details
    const orderResponse = await apiService.getOrder(orderId, session.token);
    const order = orderResponse.order;

    const store = order.store;
    if (!store) {
      await bot.sendMessage(chatId, '❌ Не удалось определить магазин для заказа.');
      return;
    }

    const storeSummary: StoreSummary = {
      id: store.id,
      name: store.name,
      slug: (store as any).slug ?? store.id,
      currency: (store as any).currency ?? '—',
      status: (store as any).status,
      description: (store as any).description,
      ownerId: (store as any).ownerId,
      botUsername: (store as any).botUsername,
      contactInfo: (store as any).contactInfo,
      _count: (store as any)._count
    };

    await generateAndSendQRCode(bot, chatId, order, storeSummary, session, loadingMsg.message_id);

  } catch (error) {
    logger.error('QR generation error:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при генерации QR-кода.');
  }
}

async function generateAndSendQRCode(
  bot: TelegramBot,
  chatId: number,
  order: OrderSummary,
  store: StoreSummary,
  session: any,
  editMessageId?: number
) {
  try {
    const authToken = session?.token;

    let paymentSettings: any = {};
    if (authToken) {
      try {
        const storeSettings = await ttlCache.wrap(
          `bot-settings:${store.id}`,
          5 * 60 * 1000,
          async () => apiService.getBotSettings(store.id, authToken)
        );
        paymentSettings = storeSettings?.settings?.paymentSettings || {};
      } catch (error) {
        logger.warn('Failed to fetch bot settings for QR generation', {
          storeId: store.id,
          error: error instanceof Error ? error.message : error
        });
      }
    } else {
      logger.warn('Missing user token for QR generation', {
        storeId: store.id
      });
    }

    // Prepare QR data
    const qrData = {
      orderId: order.orderNumber,
      amount: order.totalAmount,
      currency: order.currency,
      recipientCard: paymentSettings.cardNumber,
      recipientName: paymentSettings.recipientName || store.name,
      bankName: paymentSettings.bankName,
      comment: `Заказ ${order.orderNumber}`,
      paymentSystem: 'SBP' as const
    };

    // Validate QR data
    if (!qrPaymentService.validatePaymentData(qrData)) {
      await bot.sendMessage(chatId, '❌ Недостаточно данных для генерации QR-кода.');
      return;
    }

    // Generate multiple QR codes
    const qrCodes = await qrPaymentService.generateMultiPaymentQRs(qrData);

    // Generate payment instructions
    const instructions = qrPaymentService.generatePaymentInstructions(qrData);

    // Send QR codes with instructions
    let messageText = `📱 *QR-коды для оплаты заказа #${order.orderNumber}*\n\n`;
    messageText += `💰 Сумма: ${order.totalAmount} ${order.currency}\n\n`;
    messageText += `Выберите удобный способ оплаты:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🏦 СБП (любой банк)', callback_data: `qr_sbp_${order.id}` },
          { text: '🟢 Сбербанк', callback_data: `qr_sberbank_${order.id}` }
        ],
        [
          { text: '🟡 Тинькофф', callback_data: `qr_tinkoff_${order.id}` },
          { text: '🔗 Универсальный', callback_data: `qr_custom_${order.id}` }
        ],
        [
          { text: '📄 Инструкция по оплате', callback_data: `qr_instructions_${order.id}` }
        ],
        [
          { text: '📸 Загрузить чек', callback_data: `upload_proof_${order.id}` },
          { text: '🔙 Назад', callback_data: `order_details_${order.id}` }
        ]
      ]
    };

    if (editMessageId) {
      await bot.editMessageText(messageText, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      await bot.sendMessage(chatId, messageText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }

    // Send SBP QR code by default
    await bot.sendPhoto(chatId, qrCodes.sbp, {
      caption: `🏦 *QR-код СБП для заказа #${order.orderNumber}*\n\n` +
               `💰 Сумма: ${order.totalAmount} ${order.currency}\n` +
               `📱 Отсканируйте камерой банковского приложения`,
      parse_mode: 'Markdown'
    });

    // Store QR codes for later use
    await storeQRCodes(order.id, qrCodes, store.id);

    logger.info(`QR codes generated for order ${order.id}`, {
      orderNumber: order.orderNumber,
      amount: order.totalAmount,
      currency: order.currency,
      storeId: store.id
    });

  } catch (error) {
    logger.error('QR code generation failed:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при генерации QR-кодов.');
  }
}

async function handleQRTypeSelection(
  bot: TelegramBot,
  chatId: number,
  data: string,
  session: any
) {
  try {
    const [qrType, orderId] = data.split('_').slice(1);

    const orderResponse = await apiService.getOrder(orderId, session.token);
    const order = orderResponse.order;

    const qrCodes = await getStoredQRCodes(orderId);
    if (!qrCodes) {
      await bot.sendMessage(chatId, '❌ QR-коды не найдены. Попробуйте сгенерировать заново.');
      return;
    }

    let qrBuffer: Buffer;
    let caption = '';

    switch (qrType) {
      case 'sbp':
        qrBuffer = qrCodes.sbp;
        caption = `🏦 *QR-код СБП*\n\n📱 Для любого российского банка`;
        break;
      case 'sberbank':
        qrBuffer = qrCodes.sberbank;
        caption = `🟢 *QR-код Сбербанка*\n\n📱 Оптимизирован для Сбербанк Онлайн`;
        break;
      case 'tinkoff':
        qrBuffer = qrCodes.tinkoff;
        caption = `🟡 *QR-код Тинькофф*\n\n📱 Оптимизирован для Тинькофф Банка`;
        break;
      case 'custom':
        qrBuffer = qrCodes.custom;
        caption = `🔗 *Универсальный QR-код*\n\n📱 Содержит ссылку для оплаты`;
        break;
      case 'instructions':
        const instructions = qrPaymentService.generatePaymentInstructions({
          orderId: order.orderNumber,
          amount: order.totalAmount,
          currency: order.currency,
          comment: `Заказ ${order.orderNumber}`,
          paymentSystem: 'SBP'
        });

        await bot.sendMessage(chatId, instructions, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 К QR-кодам', callback_data: `generate_qr_${orderId}` }]
            ]
          }
        });
        return;
      default:
        await bot.sendMessage(chatId, '❌ Неизвестный тип QR-кода.');
        return;
    }

    caption += `\n\n💰 Сумма: ${order.totalAmount} ${order.currency}`;
    caption += `\n📋 Заказ: #${order.orderNumber}`;
    caption += `\n💬 Комментарий: Заказ ${order.orderNumber}`;

    await bot.sendPhoto(chatId, qrBuffer, {
      caption,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📸 Загрузить чек', callback_data: `upload_proof_${orderId}` },
            { text: '🔙 К QR-кодам', callback_data: `generate_qr_${orderId}` }
          ]
        ]
      }
    });

  } catch (error) {
    logger.error('QR type selection error:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при отображении QR-кода.');
  }
}

async function storeQRCodes(orderId: string, qrCodes: any, storeId: string) {
  const payload = {
    orderId,
    qrCodes,
    generatedAt: new Date().toISOString(),
    storeId
  };
  await ttlCache.set(`qr-codes:${orderId}`, payload, 10 * 60 * 1000);
}

async function getStoredQRCodes(orderId: string): Promise<any | null> {
  try {
    return ttlCache.get(`qr:codes:${orderId}`) || null;
  } catch (error) {
    logger.error('Failed to get stored QR codes:', error);
    return null;
  }
}


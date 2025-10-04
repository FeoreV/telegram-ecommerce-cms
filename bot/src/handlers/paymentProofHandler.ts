import TelegramBot from 'node-telegram-bot-api';
import path from 'path';
import { apiService } from '../services/apiService';
import { logger } from '../utils/logger';
import { sanitizeForLog } from '../utils/sanitizer';
import { userSessions } from '../utils/sessionManager';

export async function handlePaymentProofFlow(
  bot: TelegramBot,
  msg: TelegramBot.Message
) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString();

  if (!userId) return;

  const session = userSessions.getSession(userId);

  if (!session.paymentProofFlow) {
    return;
  }

  try {
    if (msg.photo) {
      await handlePhotoUpload(bot, msg, session);
    } else if (msg.document) {
      await handleDocumentUpload(bot, msg, session);
    } else if (msg.text) {
      await handleTextResponse(bot, msg, session);
    }
  } catch (error) {
    logger.error('Payment proof flow error:', error);
    await bot.sendMessage(chatId, 'Произошла ошибка при загрузке чека. Попробуйте еще раз.');
  }
}

export async function initiatePaymentProofFlow(
  bot: TelegramBot,
  chatId: number,
  orderId: string,
  userId: string
) {
  try {
    const session = userSessions.getSession(userId);

    // Update session to track payment proof flow
    userSessions.updateSession(userId, {
      paymentProofFlow: {
        orderId,
        awaitingPhoto: true
      }
    });

    // Get order details to show payment info
    let instructionText = `📸 *Загрузка чека оплаты*\n\n`;

    if (session.token) {
      try {
        const orderResponse = await apiService.getOrder(orderId, session.token);
        const order = orderResponse.order;

        instructionText += `📋 Заказ: #${order.orderNumber}\n`;
        instructionText += `💰 Сумма: ${order.totalAmount} ${order.currency}\n\n`;

        // Try to get payment requisites
        if (order.store?.id) {
          try {
            const settingsResp = await apiService.getBotSettings(order.store.id, session.token);
            const settings = (settingsResp?.settings as Record<string, any>) || {};
            const requisites = settings.paymentRequisites || settings.requisites || null;

            const hasRequisites = requisites && (
              requisites.card ||
              requisites.bank ||
              requisites.receiver ||
              requisites.comment
            );

            if (hasRequisites) {
              instructionText += `💳 *Реквизиты для оплаты:*\n`;
              if (requisites.card) instructionText += `💳 Карта: \`${requisites.card}\`\n`;
              if (requisites.bank) instructionText += `🏦 Банк: ${requisites.bank}\n`;
              if (requisites.receiver) instructionText += `👤 Получатель: ${requisites.receiver}\n`;
              if (requisites.comment) instructionText += `💬 Комментарий: ${requisites.comment}\n`;
              instructionText += `\n`;
            }
          } catch (e) {
            logger.warn('Failed to fetch payment requisites', e);
          }
        }
      } catch (e) {
        logger.warn('Failed to fetch order details', e);
      }
    }

    instructionText += `Для подтверждения оплаты, пожалуйста, отправьте:\n\n` +
      `• Фото чека или квитанции об оплате\n` +
      `• Скриншот перевода\n` +
      `• Любой документ, подтверждающий оплату\n\n` +
      `⚠️ *Важно:* Убедитесь, что на изображении четко видны:\n` +
      `- Сумма перевода\n` +
      `- Дата и время операции\n` +
      `- Реквизиты получателя\n\n` +
      `Отправьте отмену командой /cancel если передумали.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '❌ Отменить', callback_data: 'cancel_payment_proof' }]
      ]
    };

    await bot.sendMessage(chatId, instructionText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    // SECURITY FIX (CWE-117): Sanitize for logging to prevent log injection
    logger.info(`Payment proof flow initiated for order ${sanitizeForLog(orderId)} by user ${sanitizeForLog(userId)}`);
  } catch (error) {
    logger.error('Failed to initiate payment proof flow:', error);
    throw error;
  }
}

async function handlePhotoUpload(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  session: any
) {
  try {
    const photo = msg.photo?.[msg.photo.length - 1]; // Get highest resolution
    const document = msg.document;

    if (!photo && !document) {
      await bot.sendMessage(msg.chat.id, '❌ Пожалуйста, отправьте изображение чека.');
      return;
    }

    const fileId = photo?.file_id || document?.file_id;
    if (!fileId) {
      await bot.sendMessage(msg.chat.id, '❌ Не удалось получить файл.');
      return;
    }

    const processingMsg = await bot.sendMessage(msg.chat.id, '⏳ Загружаю чек...');

    try {
      // Get file info and download
      const fileInfo = await bot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;

      // SECURITY FIX (CWE-918): Validate URL to prevent SSRF
      const url = new URL(fileUrl);
      if (url.hostname !== 'api.telegram.org') {
        throw new Error('SECURITY: Invalid file URL - only Telegram API allowed');
      }

      // Download file to buffer
      // NOTE: URL is validated above to only allow api.telegram.org (CWE-918 mitigated)
      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      // Get order details
      const orderId = session.paymentProofFlow?.orderId;
      if (!orderId) {
        await bot.editMessageText('❌ Ошибка: не найден ID заказа.', {
          chat_id: msg.chat.id,
          message_id: processingMsg.message_id
        });
        return;
      }

      // Get order information
      const orderResponse = await apiService.getOrder(orderId, session.token);
      const order = orderResponse.order;

      // Upload file to backend
      await apiService.uploadPaymentProof(orderId, imageBuffer, `payment_proof_${Date.now()}.jpg`, session.token);

      // Send success message
      await bot.editMessageText(
        `✅ *Чек успешно загружен!*\n\n` +
        `📋 Заказ: #${order.orderNumber}\n` +
        `💰 Сумма: ${order.totalAmount} ${order.currency}\n\n` +
        `👤 Ваш чек отправлен администратору на проверку.\n` +
        `⏱️ Вы получите уведомление о результате в ближайшее время.`,
        {
          chat_id: msg.chat.id,
          message_id: processingMsg.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📋 Мои заказы', callback_data: 'order_list' },
                { text: '🏪 Магазины', callback_data: 'store_list' }
              ]
            ]
          }
        }
      );

      // Clear payment proof flow
      userSessions.updateSession(session.telegramId, {
        paymentProofFlow: null
      });

      // SECURITY FIX (CWE-117): Sanitize for logging
      logger.info(`Payment proof uploaded for order ${sanitizeForLog(orderId)}`);

    } catch (error) {
      logger.error('Payment proof processing failed:', error);
      await bot.editMessageText(
        '❌ Ошибка при обработке чека. Попробуйте еще раз или обратитесь в поддержку.',
        {
          chat_id: msg.chat.id,
          message_id: processingMsg.message_id
        }
      );
    }

  } catch (error) {
    logger.error('Photo upload handler error:', error);
    await bot.sendMessage(msg.chat.id, '❌ Ошибка при загрузке файла.');
  }
}


async function handleDocumentUpload(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  session: any
) {
  const chatId = msg.chat.id;
  const document = msg.document!;

  // Check file size (max 10MB)
  if (document.file_size && document.file_size > 10 * 1024 * 1024) {
    await bot.sendMessage(chatId, 'Файл слишком большой. Максимальный размер: 10MB.');
    return;
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  if (document.mime_type && !allowedTypes.includes(document.mime_type)) {
    await bot.sendMessage(chatId, 'Неподдерживаемый тип файла. Пожалуйста, отправьте изображение или PDF.');
    return;
  }

  await processFileUpload(bot, chatId, document.file_id, session, 'document');
}

async function processFileUpload(
  bot: TelegramBot,
  chatId: number,
  fileId: string,
  session: any,
  fileType: 'photo' | 'document'
) {
  if (!session.paymentProofFlow) {
    return;
  }

  // Save order ID before clearing session
  const orderId = session.paymentProofFlow.orderId;
  const processingMsg = await bot.sendMessage(chatId, '⏳ Обрабатываю файл...');

  try {
    // Download file from Telegram
    const file = await bot.getFile(fileId);
    const filePath = file.file_path;

    if (!filePath) {
      throw new Error('Failed to get file path');
    }

    // SECURITY FIX (CWE-918): Validate file URL to prevent SSRF
    // Ensure we're only downloading from Telegram's official API
    const telegramDomain = 'api.telegram.org';
    const fileUrl = `https://${telegramDomain}/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;

    // SECURITY: Validate URL before fetch
    const url = new URL(fileUrl);
    if (url.hostname !== telegramDomain) {
      throw new Error('SECURITY: Invalid file URL - only Telegram API allowed');
    }

    // NOTE: URL is validated above to only allow api.telegram.org (CWE-918 mitigated)
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error('Failed to download file');
    }

    const buffer = await response.arrayBuffer();
    const fileExtension = path.extname(filePath) || (fileType === 'photo' ? '.jpg' : '.pdf');
    const fileName = `payment_proof_${orderId}_${Date.now()}${fileExtension}`;

    // Upload to backend
    await apiService.uploadPaymentProof(
      orderId,
      buffer,
      fileName,
      session.token
    );

    // Get order info for display
    const orderResponse = await apiService.getOrder(orderId, session.token);
    const order = orderResponse.order;

    // Clear payment proof flow
    userSessions.updateSession(session.telegramId, {
      paymentProofFlow: null
    });

    // Success message
    const successText = `✅ *Чек успешно загружен!*\n\n` +
      `📋 Заказ: #${order.orderNumber}\n` +
      `💰 Сумма: ${order.totalAmount} ${order.currency}\n\n` +
      `Ваш чек отправлен администратору на проверку.\n` +
      `Вы получите уведомление о результате рассмотрения.\n\n` +
      `⏰ Обычно проверка занимает от нескольких минут до часа.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 Мои заказы', callback_data: 'order_list' },
          { text: '🏪 Магазины', callback_data: 'store_list' }
        ]
      ]
    };

    await bot.editMessageText(successText, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    // SECURITY FIX (CWE-117): Sanitize for logging
    logger.info(`Payment proof uploaded for order ${sanitizeForLog(orderId)} by user ${sanitizeForLog(session.telegramId)}`);

  } catch (error) {
    logger.error('File upload error:', error);

    await bot.editMessageText(
      'Ошибка при загрузке файла. Попробуйте еще раз или обратитесь к администратору.',
      {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Попробовать снова', callback_data: `upload_proof_${orderId}` }]
          ]
        }
      }
    );
  }
}

async function handleTextResponse(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  session: any
) {
  const chatId = msg.chat.id;

  if (msg.text === '/cancel') {
    userSessions.updateSession(session.telegramId, {
      paymentProofFlow: null
    });

    await bot.sendMessage(chatId, 'Загрузка чека отменена.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Мои заказы', callback_data: 'order_list' }]
        ]
      }
    });
    return;
  }

  // Remind user about photo requirement
  await bot.sendMessage(chatId,
    'Пожалуйста, отправьте фото или документ с чеком об оплате.\n\n' +
    'Если хотите отменить загрузку, нажмите /cancel'
  );
}

export async function handlePaymentProofCallback(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
) {
  const data = callbackQuery.data!;
  const msg = callbackQuery.message!;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id.toString();

  try {
    if (data === 'cancel_payment_proof') {
      userSessions.updateSession(userId, {
        paymentProofFlow: null
      });

      await bot.editMessageText(
        'Загрузка чека отменена.',
        {
          chat_id: chatId,
          message_id: msg.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Мои заказы', callback_data: 'order_list' }]
            ]
          }
        }
      );
    } else if (data.startsWith('upload_proof_')) {
      const orderId = data.replace('upload_proof_', '');
      await initiatePaymentProofFlow(bot, chatId, orderId, userId);
    }
  } catch (error) {
    logger.error('Payment proof callback error:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Произошла ошибка. Попробуйте еще раз.',
      show_alert: true
    });
  }
}

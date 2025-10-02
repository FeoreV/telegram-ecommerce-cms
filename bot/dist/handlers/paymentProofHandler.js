"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePaymentProofFlow = handlePaymentProofFlow;
exports.initiatePaymentProofFlow = initiatePaymentProofFlow;
exports.handlePaymentProofCallback = handlePaymentProofCallback;
const path_1 = __importDefault(require("path"));
const apiService_1 = require("../services/apiService");
const sessionManager_1 = require("../utils/sessionManager");
const logger_1 = require("../utils/logger");
const smartVerificationService_1 = require("../services/smartVerificationService");
async function handlePaymentProofFlow(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id?.toString();
    if (!userId)
        return;
    const session = sessionManager_1.userSessions.getSession(userId);
    if (!session.paymentProofFlow) {
        return;
    }
    try {
        if (msg.photo) {
            await handlePhotoUpload(bot, msg, session);
        }
        else if (msg.document) {
            await handleDocumentUpload(bot, msg, session);
        }
        else if (msg.text) {
            await handleTextResponse(bot, msg, session);
        }
    }
    catch (error) {
        logger_1.logger.error('Payment proof flow error:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при загрузке чека. Попробуйте еще раз.');
    }
}
async function initiatePaymentProofFlow(bot, chatId, orderId, userId) {
    try {
        const session = sessionManager_1.userSessions.getSession(userId);
        sessionManager_1.userSessions.updateSession(userId, {
            paymentProofFlow: {
                orderId,
                awaitingPhoto: true
            }
        });
        let instructionText = `📸 *Загрузка чека оплаты*\n\n`;
        if (session.token) {
            try {
                const orderResponse = await apiService_1.apiService.getOrder(orderId, session.token);
                const order = orderResponse.order;
                instructionText += `📋 Заказ: #${order.orderNumber}\n`;
                instructionText += `💰 Сумма: ${order.totalAmount} ${order.currency}\n\n`;
                if (order.store?.id) {
                    try {
                        const settingsResp = await apiService_1.apiService.getBotSettings(order.store.id, session.token);
                        const settings = settingsResp?.settings || {};
                        const requisites = settings.paymentRequisites || settings.requisites || null;
                        const hasRequisites = requisites && (requisites.card ||
                            requisites.bank ||
                            requisites.receiver ||
                            requisites.comment);
                        if (hasRequisites) {
                            instructionText += `💳 *Реквизиты для оплаты:*\n`;
                            if (requisites.card)
                                instructionText += `💳 Карта: \`${requisites.card}\`\n`;
                            if (requisites.bank)
                                instructionText += `🏦 Банк: ${requisites.bank}\n`;
                            if (requisites.receiver)
                                instructionText += `👤 Получатель: ${requisites.receiver}\n`;
                            if (requisites.comment)
                                instructionText += `💬 Комментарий: ${requisites.comment}\n`;
                            instructionText += `\n`;
                        }
                    }
                    catch (e) {
                        logger_1.logger.warn('Failed to fetch payment requisites', e);
                    }
                }
            }
            catch (e) {
                logger_1.logger.warn('Failed to fetch order details', e);
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
        logger_1.logger.info(`Payment proof flow initiated for order ${orderId} by user ${userId}`);
    }
    catch (error) {
        logger_1.logger.error('Failed to initiate payment proof flow:', error);
        throw error;
    }
}
async function handlePhotoUpload(bot, msg, session) {
    try {
        const photo = msg.photo?.[msg.photo.length - 1];
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
        const processingMsg = await bot.sendMessage(msg.chat.id, '🔄 Анализирую чек с помощью ИИ...');
        try {
            const fileInfo = await bot.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
            const response = await fetch(fileUrl);
            const arrayBuffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            const orderId = session.paymentProofFlow?.orderId;
            if (!orderId) {
                await bot.editMessageText('❌ Ошибка: не найден ID заказа.', {
                    chat_id: msg.chat.id,
                    message_id: processingMsg.message_id
                });
                return;
            }
            const orderResponse = await apiService_1.apiService.getOrder(orderId, session.token);
            const order = orderResponse.order;
            const analysis = await smartVerificationService_1.smartVerificationService.analyzePaymentProof(imageBuffer, {
                totalAmount: order.totalAmount,
                currency: order.currency,
                orderNumber: order.orderNumber,
                expectedRecipient: order.store?.contactInfo?.receiver
            });
            await apiService_1.apiService.uploadPaymentProof(orderId, imageBuffer, `payment_proof_${Date.now()}.jpg`, session.token);
            const report = smartVerificationService_1.smartVerificationService.generateVerificationReport(analysis, {
                totalAmount: order.totalAmount,
                currency: order.currency
            });
            await bot.editMessageText(`📸 *Чек успешно загружен и проанализирован!*\n\n${report}\n\n` +
                `📋 Заказ: #${order.orderNumber}\n` +
                `${analysis.isAutoVerifiable ?
                    '🤖 Система рекомендует автоматическое подтверждение.' :
                    '👤 Требуется ручная проверка администратором.'}\n\n` +
                `⏱️ Статус будет обновлен в ближайшее время.`, {
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
            });
            sessionManager_1.userSessions.updateSession(session.telegramId, {
                paymentProofFlow: null
            });
            if (analysis.isAutoVerifiable && process.env.ENABLE_AUTO_VERIFICATION === 'true') {
                await handleAutoVerification(orderId, analysis, session.token);
                await bot.sendMessage(msg.chat.id, `🎉 *Платеж автоматически подтвержден!*\n\n` +
                    `✅ Заказ #${order.orderNumber} переведен в статус "Оплачен"\n` +
                    `📦 Ожидайте обновления о доставке.`, { parse_mode: 'Markdown' });
            }
            else {
                await notifyAdminsWithAIAnalysis(order, analysis);
            }
            logger_1.logger.info(`Payment proof processed for order ${orderId}`, {
                confidenceScore: analysis.confidenceScore,
                isAutoVerifiable: analysis.isAutoVerifiable,
                detectedAmount: analysis.detectedAmount
            });
        }
        catch (error) {
            logger_1.logger.error('Payment proof processing failed:', error);
            await bot.editMessageText('❌ Ошибка при обработке чека. Попробуйте еще раз или обратитесь в поддержку.', {
                chat_id: msg.chat.id,
                message_id: processingMsg.message_id
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Photo upload handler error:', error);
        await bot.sendMessage(msg.chat.id, '❌ Ошибка при загрузке файла.');
    }
}
async function handleAutoVerification(orderId, analysis, token) {
    try {
        await apiService_1.apiService.confirmPayment(orderId, token);
        logger_1.logger.info(`Auto-verified payment for order ${orderId}`, {
            confidenceScore: analysis.confidenceScore
        });
    }
    catch (error) {
        logger_1.logger.error('Auto-verification failed:', error);
        throw error;
    }
}
async function notifyAdminsWithAIAnalysis(order, analysis) {
    try {
        logger_1.logger.info(`Payment analysis completed for order ${order.id}`, {
            aiAnalysis: analysis,
            requiresReview: !analysis.isAutoVerifiable,
            priority: analysis.confidenceScore < 0.5 ? 'HIGH' : 'NORMAL'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to notify admins:', error);
    }
}
async function handleDocumentUpload(bot, msg, session) {
    const chatId = msg.chat.id;
    const document = msg.document;
    if (document.file_size && document.file_size > 10 * 1024 * 1024) {
        await bot.sendMessage(chatId, 'Файл слишком большой. Максимальный размер: 10MB.');
        return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (document.mime_type && !allowedTypes.includes(document.mime_type)) {
        await bot.sendMessage(chatId, 'Неподдерживаемый тип файла. Пожалуйста, отправьте изображение или PDF.');
        return;
    }
    await processFileUpload(bot, chatId, document.file_id, session, 'document');
}
async function processFileUpload(bot, chatId, fileId, session, fileType) {
    if (!session.paymentProofFlow) {
        return;
    }
    const processingMsg = await bot.sendMessage(chatId, '⏳ Обрабатываю файл...');
    try {
        const file = await bot.getFile(fileId);
        const filePath = file.file_path;
        if (!filePath) {
            throw new Error('Failed to get file path');
        }
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error('Failed to download file');
        }
        const buffer = await response.arrayBuffer();
        const fileExtension = path_1.default.extname(filePath) || (fileType === 'photo' ? '.jpg' : '.pdf');
        const fileName = `payment_proof_${session.paymentProofFlow.orderId}_${Date.now()}${fileExtension}`;
        await apiService_1.apiService.uploadPaymentProof(session.paymentProofFlow.orderId, buffer, fileName, session.token);
        sessionManager_1.userSessions.updateSession(session.telegramId, {
            paymentProofFlow: null
        });
        const successText = `✅ *Чек успешно загружен!*\n\n` +
            `Ваш чек отправлен администратору на проверку.\n` +
            `Вы получите уведомление о результате рассмотрения.\n\n` +
            `📋 Заказ: #${session.paymentProofFlow.orderId.slice(-8)}\n` +
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
        logger_1.logger.info(`Payment proof uploaded for order ${session.paymentProofFlow.orderId} by user ${session.telegramId}`);
    }
    catch (error) {
        logger_1.logger.error('File upload error:', error);
        await bot.editMessageText('Ошибка при загрузке файла. Попробуйте еще раз или обратитесь к администратору.', {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Попробовать снова', callback_data: `upload_proof_${session.paymentProofFlow.orderId}` }]
                ]
            }
        });
    }
}
async function handleTextResponse(bot, msg, session) {
    const chatId = msg.chat.id;
    if (msg.text === '/cancel') {
        sessionManager_1.userSessions.updateSession(session.telegramId, {
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
    await bot.sendMessage(chatId, 'Пожалуйста, отправьте фото или документ с чеком об оплате.\n\n' +
        'Если хотите отменить загрузку, нажмите /cancel');
}
async function handlePaymentProofCallback(bot, callbackQuery) {
    const data = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id.toString();
    try {
        if (data === 'cancel_payment_proof') {
            sessionManager_1.userSessions.updateSession(userId, {
                paymentProofFlow: null
            });
            await bot.editMessageText('Загрузка чека отменена.', {
                chat_id: chatId,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 Мои заказы', callback_data: 'order_list' }]
                    ]
                }
            });
        }
        else if (data.startsWith('upload_proof_')) {
            const orderId = data.replace('upload_proof_', '');
            await initiatePaymentProofFlow(bot, chatId, orderId, userId);
        }
    }
    catch (error) {
        logger_1.logger.error('Payment proof callback error:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Произошла ошибка. Попробуйте еще раз.',
            show_alert: true
        });
    }
}
//# sourceMappingURL=paymentProofHandler.js.map
import TelegramBot from 'node-telegram-bot-api';
export declare function handlePaymentProofFlow(bot: TelegramBot, msg: TelegramBot.Message): Promise<void>;
export declare function initiatePaymentProofFlow(bot: TelegramBot, chatId: number, orderId: string, userId: string): Promise<void>;
export declare function handlePaymentProofCallback(bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery): Promise<void>;
//# sourceMappingURL=paymentProofHandler.d.ts.map
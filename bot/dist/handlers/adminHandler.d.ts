import TelegramBot from 'node-telegram-bot-api';
export declare function handleAdmin(bot: TelegramBot, msg: TelegramBot.Message, callbackQuery?: TelegramBot.CallbackQuery): Promise<void>;
export declare function handleAdminCommand(bot: TelegramBot, chatId: number, command: string, args?: string[], userId?: string): Promise<void>;
export declare function handlePossibleOrderId(bot: TelegramBot, chatId: number, text: string): Promise<boolean>;
//# sourceMappingURL=adminHandler.d.ts.map
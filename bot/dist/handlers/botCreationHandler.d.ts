import TelegramBot from 'node-telegram-bot-api';
export declare function handleBotCreationCallback(bot: TelegramBot, chatId: number, callbackData: string): Promise<boolean>;
export declare function handleBotCreationMessage(bot: TelegramBot, msg: TelegramBot.Message): Promise<void>;
export declare function handleBotCreationSkipCallback(bot: TelegramBot, chatId: number, callbackData: string): Promise<boolean>;
//# sourceMappingURL=botCreationHandler.d.ts.map
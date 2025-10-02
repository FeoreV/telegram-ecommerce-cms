import TelegramBot from 'node-telegram-bot-api';
export declare function startStoreCreation(bot: TelegramBot, chatId: number): Promise<void>;
export declare function handleStoreCreationMessage(bot: TelegramBot, chatId: number, text: string): Promise<boolean>;
export declare function handleStoreCreationCallback(bot: TelegramBot, chatId: number, callbackData: string): Promise<boolean>;
//# sourceMappingURL=storeCreationHandler.d.ts.map
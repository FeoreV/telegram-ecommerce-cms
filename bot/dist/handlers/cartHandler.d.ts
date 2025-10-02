import TelegramBot from 'node-telegram-bot-api';
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
export declare function handleCart(bot: TelegramBot, msg: TelegramBot.Message, callbackQuery?: TelegramBot.CallbackQuery): Promise<void>;
export declare function addToCart(bot: TelegramBot, chatId: number, session: any, item: CartItem): Promise<void>;
export {};
//# sourceMappingURL=cartHandler.d.ts.map
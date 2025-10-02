import TelegramBot from 'node-telegram-bot-api';
export declare class BotHandlerService {
    private storeId;
    private dataService;
    private sessions;
    constructor(storeId: string);
    handleMessage(bot: TelegramBot, msg: unknown): Promise<void>;
    private handleCommand;
    private handleTextMessage;
    private handleStartCommand;
    private showCatalog;
    private showCart;
    private showMyOrders;
    private handleSearch;
    private showHelp;
    private showContact;
    private getSession;
    private createSession;
    private saveSession;
    private getCurrency;
    private getStatusText;
    handleCallbackQuery(bot: TelegramBot, query: unknown): Promise<void>;
    private showCategoryProducts;
    private showProduct;
    private handleCustomerInfo;
    private parseCustomerInfo;
    cleanup(): void;
}
export default BotHandlerService;
//# sourceMappingURL=botHandlerService.d.ts.map
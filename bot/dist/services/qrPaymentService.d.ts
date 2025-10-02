interface PaymentQRData {
    orderId: string;
    amount: number;
    currency: string;
    recipientCard?: string;
    recipientName?: string;
    bankName?: string;
    comment?: string;
    paymentSystem: 'SBP' | 'CARD_TRANSFER' | 'CUSTOM';
}
interface QRGenerationOptions {
    size: number;
    margin: number;
    errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
    type: 'png' | 'svg';
    color: {
        dark: string;
        light: string;
    };
}
export declare class QRPaymentService {
    private static instance;
    private readonly defaultOptions;
    static getInstance(): QRPaymentService;
    generatePaymentQR(paymentData: PaymentQRData, options?: Partial<QRGenerationOptions>): Promise<Buffer>;
    private generateSBPQRContent;
    private generateCardTransferQRContent;
    private generateCustomQRContent;
    generateBankSpecificQR(paymentData: PaymentQRData, bankType: 'SBERBANK' | 'TINKOFF' | 'VTB' | 'ALFABANK'): Promise<Buffer>;
    private generateSberbankQR;
    private generateTinkoffQR;
    private generateVTBQR;
    private generateAlfaBankQR;
    generateMultiPaymentQRs(paymentData: PaymentQRData): Promise<{
        sbp: Buffer;
        sberbank: Buffer;
        tinkoff: Buffer;
        custom: Buffer;
    }>;
    private calculateCRC16;
    validatePaymentData(paymentData: PaymentQRData): boolean;
    generateQRWithLogo(paymentData: PaymentQRData, logoBuffer?: Buffer): Promise<Buffer>;
    generatePaymentInstructions(paymentData: PaymentQRData): string;
}
export declare const qrPaymentService: QRPaymentService;
export {};
//# sourceMappingURL=qrPaymentService.d.ts.map
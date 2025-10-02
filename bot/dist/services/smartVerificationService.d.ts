interface PaymentProofAnalysis {
    detectedAmount?: number;
    detectedCurrency?: string;
    detectedDate?: Date;
    detectedTime?: string;
    detectedRecipient?: string;
    detectedBankName?: string;
    detectedTransactionId?: string;
    confidenceScore: number;
    isAutoVerifiable: boolean;
    extractedText: string;
    analysisDetails: string[];
}
export declare class SmartVerificationService {
    private static instance;
    private readonly MIN_CONFIDENCE_SCORE;
    private readonly AMOUNT_TOLERANCE;
    static getInstance(): SmartVerificationService;
    analyzePaymentProof(imageBuffer: Buffer, orderDetails: {
        totalAmount: number;
        currency: string;
        orderNumber: string;
        expectedRecipient?: string;
    }): Promise<PaymentProofAnalysis>;
    private performOCR;
    private performTesseractOCR;
    private performCloudOCR;
    private extractPaymentInfo;
    private extractAmount;
    private extractCurrency;
    private extractDate;
    private extractTime;
    private extractRecipient;
    private extractBankName;
    private extractTransactionId;
    private calculateConfidenceScore;
    private shouldAutoVerify;
    private calculateStringSimilarity;
    private levenshteinDistance;
    private simulateOCRText;
    generateVerificationReport(analysis: PaymentProofAnalysis, orderDetails: any): string;
}
export declare const smartVerificationService: SmartVerificationService;
export {};
//# sourceMappingURL=smartVerificationService.d.ts.map
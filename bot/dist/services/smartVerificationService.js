"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smartVerificationService = exports.SmartVerificationService = void 0;
const logger_1 = require("../utils/logger");
class SmartVerificationService {
    constructor() {
        this.MIN_CONFIDENCE_SCORE = 0.75;
        this.AMOUNT_TOLERANCE = 0.01;
    }
    static getInstance() {
        if (!SmartVerificationService.instance) {
            SmartVerificationService.instance = new SmartVerificationService();
        }
        return SmartVerificationService.instance;
    }
    async analyzePaymentProof(imageBuffer, orderDetails) {
        try {
            logger_1.logger.info(`Analyzing payment proof for order ${orderDetails.orderNumber}`);
            const ocrResult = await this.performOCR(imageBuffer);
            const analysis = await this.extractPaymentInfo(ocrResult.text, orderDetails);
            analysis.confidenceScore = this.calculateConfidenceScore(analysis, orderDetails);
            analysis.isAutoVerifiable = this.shouldAutoVerify(analysis, orderDetails);
            analysis.extractedText = ocrResult.text;
            logger_1.logger.info(`Payment proof analysis completed`, {
                orderNumber: orderDetails.orderNumber,
                confidenceScore: analysis.confidenceScore,
                isAutoVerifiable: analysis.isAutoVerifiable,
                detectedAmount: analysis.detectedAmount
            });
            return analysis;
        }
        catch (error) {
            logger_1.logger.error('Payment proof analysis failed:', error);
            return {
                confidenceScore: 0,
                isAutoVerifiable: false,
                extractedText: '',
                analysisDetails: ['Ошибка при анализе изображения']
            };
        }
    }
    async performOCR(imageBuffer) {
        try {
            const tesseractResult = await this.performTesseractOCR(imageBuffer);
            if (tesseractResult.confidence < 0.6) {
                const cloudResult = await this.performCloudOCR(imageBuffer);
                if (cloudResult.confidence > tesseractResult.confidence) {
                    return cloudResult;
                }
            }
            return tesseractResult;
        }
        catch (error) {
            logger_1.logger.error('OCR processing failed:', error);
            return {
                text: '',
                confidence: 0,
                blocks: []
            };
        }
    }
    async performTesseractOCR(imageBuffer) {
        try {
            const mockText = this.simulateOCRText();
            return {
                text: mockText,
                confidence: 0.85,
                blocks: []
            };
        }
        catch (error) {
            logger_1.logger.error('Tesseract OCR failed:', error);
            throw error;
        }
    }
    async performCloudOCR(imageBuffer) {
        try {
            return {
                text: this.simulateOCRText(),
                confidence: 0.92,
                blocks: []
            };
        }
        catch (error) {
            logger_1.logger.error('Cloud OCR failed:', error);
            throw error;
        }
    }
    async extractPaymentInfo(text, orderDetails) {
        const analysis = {
            confidenceScore: 0,
            isAutoVerifiable: false,
            extractedText: text,
            analysisDetails: []
        };
        analysis.detectedAmount = this.extractAmount(text);
        analysis.detectedCurrency = this.extractCurrency(text);
        analysis.detectedDate = this.extractDate(text);
        analysis.detectedTime = this.extractTime(text);
        analysis.detectedRecipient = this.extractRecipient(text);
        analysis.detectedBankName = this.extractBankName(text);
        analysis.detectedTransactionId = this.extractTransactionId(text);
        if (analysis.detectedAmount) {
            analysis.analysisDetails.push(`Обнаружена сумма: ${analysis.detectedAmount} ${analysis.detectedCurrency || '₽'}`);
        }
        if (analysis.detectedDate) {
            analysis.analysisDetails.push(`Дата операции: ${analysis.detectedDate.toLocaleDateString('ru')}`);
        }
        if (analysis.detectedRecipient) {
            analysis.analysisDetails.push(`Получатель: ${analysis.detectedRecipient}`);
        }
        if (analysis.detectedBankName) {
            analysis.analysisDetails.push(`Банк: ${analysis.detectedBankName}`);
        }
        return analysis;
    }
    extractAmount(text) {
        const patterns = [
            /сумма[:\s]*(\d+[.,]?\d*)/i,
            /(\d+[.,]\d{2})\s*(?:руб|₽|rub)/i,
            /перевод[:\s]*(\d+[.,]?\d*)/i,
            /списано[:\s]*(\d+[.,]?\d*)/i,
            /зачислено[:\s]*(\d+[.,]?\d*)/i,
            /(\d+[.,]\d{2})\s*р\./i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const amountStr = match[1].replace(',', '.');
                const amount = parseFloat(amountStr);
                if (!isNaN(amount) && amount > 0) {
                    return amount;
                }
            }
        }
        return undefined;
    }
    extractCurrency(text) {
        const patterns = [
            /(?:руб|₽|rub)/i,
            /(?:usd|\$)/i,
            /(?:eur|€)/i
        ];
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                if (/(?:руб|₽|rub)/i.test(text))
                    return 'RUB';
                if (/(?:usd|\$)/i.test(text))
                    return 'USD';
                if (/(?:eur|€)/i.test(text))
                    return 'EUR';
            }
        }
        return 'RUB';
    }
    extractDate(text) {
        const patterns = [
            /(\d{2}[./-]\d{2}[./-]\d{4})/,
            /(\d{4}[./-]\d{2}[./-]\d{2})/,
            /(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})/i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                try {
                    return new Date(match[1]);
                }
                catch {
                    continue;
                }
            }
        }
        return undefined;
    }
    extractTime(text) {
        const timePattern = /(\d{1,2}:\d{2}(?::\d{2})?)/;
        const match = text.match(timePattern);
        return match ? match[1] : undefined;
    }
    extractRecipient(text) {
        const patterns = [
            /получатель[:\s]*([А-Яа-я\s]+)/i,
            /на счет[:\s]*([А-Яа-я\s]+)/i,
            /зачислено[:\s]*([А-Яа-я\s]+)/i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        return undefined;
    }
    extractBankName(text) {
        const banks = [
            'сбербанк', 'втб', 'газпромбанк', 'альфа-банк', 'россельхозбанк',
            'тинькофф', 'банк москвы', 'уралсиб', 'открытие', 'промсвязьбанк'
        ];
        const lowerText = text.toLowerCase();
        for (const bank of banks) {
            if (lowerText.includes(bank)) {
                return bank;
            }
        }
        return undefined;
    }
    extractTransactionId(text) {
        const patterns = [
            /(?:id|номер|№)[:\s]*([A-Za-z0-9]{6,})/i,
            /транзакция[:\s]*([A-Za-z0-9]{6,})/i,
            /референс[:\s]*([A-Za-z0-9]{6,})/i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return undefined;
    }
    calculateConfidenceScore(analysis, orderDetails) {
        let score = 0;
        let maxScore = 0;
        maxScore += 40;
        if (analysis.detectedAmount) {
            const amountDiff = Math.abs(analysis.detectedAmount - orderDetails.totalAmount);
            if (amountDiff <= this.AMOUNT_TOLERANCE) {
                score += 40;
            }
            else if (amountDiff <= orderDetails.totalAmount * 0.05) {
                score += 30;
            }
            else if (amountDiff <= orderDetails.totalAmount * 0.1) {
                score += 20;
            }
        }
        maxScore += 20;
        if (analysis.detectedCurrency === orderDetails.currency) {
            score += 20;
        }
        maxScore += 20;
        if (analysis.detectedDate) {
            const daysDiff = Math.abs((new Date().getTime() - analysis.detectedDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 7) {
                score += 20;
            }
            else if (daysDiff <= 30) {
                score += 10;
            }
        }
        maxScore += 10;
        if (analysis.detectedRecipient && orderDetails.expectedRecipient) {
            const similarity = this.calculateStringSimilarity(analysis.detectedRecipient.toLowerCase(), orderDetails.expectedRecipient.toLowerCase());
            score += similarity * 10;
        }
        maxScore += 10;
        if (analysis.detectedBankName) {
            score += 10;
        }
        return maxScore > 0 ? score / maxScore : 0;
    }
    shouldAutoVerify(analysis, orderDetails) {
        if (analysis.confidenceScore < this.MIN_CONFIDENCE_SCORE) {
            return false;
        }
        if (!analysis.detectedAmount) {
            return false;
        }
        const amountDiff = Math.abs(analysis.detectedAmount - orderDetails.totalAmount);
        if (amountDiff > this.AMOUNT_TOLERANCE) {
            return false;
        }
        if (analysis.detectedDate) {
            const daysDiff = Math.abs((new Date().getTime() - analysis.detectedDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff > 7) {
                return false;
            }
        }
        return true;
    }
    calculateStringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0) {
            return 1.0;
        }
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        for (let i = 0; i <= str1.length; i++) {
            matrix[0][i] = i;
        }
        for (let j = 0; j <= str2.length; j++) {
            matrix[j][0] = j;
        }
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
            }
        }
        return matrix[str2.length][str1.length];
    }
    simulateOCRText() {
        return `
СБЕРБАНК РОССИИ
Перевод между картами
Дата: 26.09.2025 15:34:12
Сумма: 1500.00 руб.
Получатель: ИВАНОВ ИВАН ИВАНОВИЧ
Номер операции: SB123456789
Комиссия: 0.00 руб.
Статус: Выполнено
    `;
    }
    generateVerificationReport(analysis, orderDetails) {
        let report = `🔍 *Результат анализа платежного документа*\n\n`;
        report += `📊 *Оценка достоверности: ${Math.round(analysis.confidenceScore * 100)}%*\n\n`;
        if (analysis.isAutoVerifiable) {
            report += `✅ *Рекомендация: АВТОПОДТВЕРЖДЕНИЕ*\n\n`;
        }
        else {
            report += `⚠️ *Рекомендация: РУЧНАЯ ПРОВЕРКА*\n\n`;
        }
        report += `📋 *Извлеченная информация:*\n`;
        analysis.analysisDetails.forEach(detail => {
            report += `• ${detail}\n`;
        });
        if (analysis.detectedAmount && orderDetails.totalAmount) {
            const diff = Math.abs(analysis.detectedAmount - orderDetails.totalAmount);
            report += `\n💰 *Сверка суммы:*\n`;
            report += `Ожидалось: ${orderDetails.totalAmount} ${orderDetails.currency}\n`;
            report += `Обнаружено: ${analysis.detectedAmount} ${analysis.detectedCurrency || orderDetails.currency}\n`;
            if (diff <= this.AMOUNT_TOLERANCE) {
                report += `✅ Суммы совпадают\n`;
            }
            else {
                report += `❌ Расхождение: ${diff.toFixed(2)} ${orderDetails.currency}\n`;
            }
        }
        return report;
    }
}
exports.SmartVerificationService = SmartVerificationService;
exports.smartVerificationService = SmartVerificationService.getInstance();
//# sourceMappingURL=smartVerificationService.js.map
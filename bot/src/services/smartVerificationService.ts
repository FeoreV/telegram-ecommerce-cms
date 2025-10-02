import { logger } from '../utils/logger';
import { apiService } from './apiService';

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

interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
}

interface OCRBlock {
  text: string;
  boundingBox: number[];
  confidence: number;
}

export class SmartVerificationService {
  private static instance: SmartVerificationService;
  private readonly MIN_CONFIDENCE_SCORE = 0.75;
  private readonly AMOUNT_TOLERANCE = 0.01; // 1 kopeck tolerance

  public static getInstance(): SmartVerificationService {
    if (!SmartVerificationService.instance) {
      SmartVerificationService.instance = new SmartVerificationService();
    }
    return SmartVerificationService.instance;
  }

  /**
   * Analyze payment proof image and extract key information
   */
  async analyzePaymentProof(
    imageBuffer: Buffer,
    orderDetails: {
      totalAmount: number;
      currency: string;
      orderNumber: string;
      expectedRecipient?: string;
    }
  ): Promise<PaymentProofAnalysis> {
    try {
      logger.info(`Analyzing payment proof for order ${orderDetails.orderNumber}`);

      // Step 1: Perform OCR on the image
      const ocrResult = await this.performOCR(imageBuffer);
      
      // Step 2: Extract payment information
      const analysis = await this.extractPaymentInfo(ocrResult.text, orderDetails);
      
      // Step 3: Calculate confidence and determine auto-verification eligibility
      analysis.confidenceScore = this.calculateConfidenceScore(analysis, orderDetails);
      analysis.isAutoVerifiable = this.shouldAutoVerify(analysis, orderDetails);
      analysis.extractedText = ocrResult.text;

      logger.info(`Payment proof analysis completed`, {
        orderNumber: orderDetails.orderNumber,
        confidenceScore: analysis.confidenceScore,
        isAutoVerifiable: analysis.isAutoVerifiable,
        detectedAmount: analysis.detectedAmount
      });

      return analysis;

    } catch (error) {
      logger.error('Payment proof analysis failed:', error);
      return {
        confidenceScore: 0,
        isAutoVerifiable: false,
        extractedText: '',
        analysisDetails: ['Ошибка при анализе изображения']
      };
    }
  }

  /**
   * Perform OCR on image using multiple recognition services
   */
  private async performOCR(imageBuffer: Buffer): Promise<OCRResult> {
    try {
      // Try Tesseract OCR first (free option)
      const tesseractResult = await this.performTesseractOCR(imageBuffer);
      
      // If confidence is low, try cloud OCR services
      if (tesseractResult.confidence < 0.6) {
        const cloudResult = await this.performCloudOCR(imageBuffer);
        if (cloudResult.confidence > tesseractResult.confidence) {
          return cloudResult;
        }
      }

      return tesseractResult;

    } catch (error) {
      logger.error('OCR processing failed:', error);
      return {
        text: '',
        confidence: 0,
        blocks: []
      };
    }
  }

  /**
   * Tesseract OCR implementation
   */
  private async performTesseractOCR(imageBuffer: Buffer): Promise<OCRResult> {
    try {
      // Note: In production, you would use a proper Tesseract library
      // For now, simulate OCR result
      const mockText = this.simulateOCRText();
      
      return {
        text: mockText,
        confidence: 0.85,
        blocks: []
      };
    } catch (error) {
      logger.error('Tesseract OCR failed:', error);
      throw error;
    }
  }

  /**
   * Cloud OCR services (Google Vision, Azure, AWS Textract)
   */
  private async performCloudOCR(imageBuffer: Buffer): Promise<OCRResult> {
    try {
      // Implementation would call cloud OCR API
      // For demo purposes, return high confidence result
      return {
        text: this.simulateOCRText(),
        confidence: 0.92,
        blocks: []
      };
    } catch (error) {
      logger.error('Cloud OCR failed:', error);
      throw error;
    }
  }

  /**
   * Extract payment information from OCR text
   */
  private async extractPaymentInfo(
    text: string, 
    orderDetails: any
  ): Promise<PaymentProofAnalysis> {
    const analysis: PaymentProofAnalysis = {
      confidenceScore: 0,
      isAutoVerifiable: false,
      extractedText: text,
      analysisDetails: []
    };

    // Extract amount using multiple patterns
    analysis.detectedAmount = this.extractAmount(text);
    analysis.detectedCurrency = this.extractCurrency(text);
    analysis.detectedDate = this.extractDate(text);
    analysis.detectedTime = this.extractTime(text);
    analysis.detectedRecipient = this.extractRecipient(text);
    analysis.detectedBankName = this.extractBankName(text);
    analysis.detectedTransactionId = this.extractTransactionId(text);

    // Add analysis details
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

  /**
   * Extract amount from text using regex patterns
   */
  private extractAmount(text: string): number | undefined {
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

  /**
   * Extract currency from text
   */
  private extractCurrency(text: string): string | undefined {
    const patterns = [
      /(?:руб|₽|rub)/i,
      /(?:usd|\$)/i,
      /(?:eur|€)/i
    ];

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        if (/(?:руб|₽|rub)/i.test(text)) return 'RUB';
        if (/(?:usd|\$)/i.test(text)) return 'USD';
        if (/(?:eur|€)/i.test(text)) return 'EUR';
      }
    }

    return 'RUB'; // Default to rubles
  }

  /**
   * Extract date from text
   */
  private extractDate(text: string): Date | undefined {
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
        } catch {
          continue;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract time from text
   */
  private extractTime(text: string): string | undefined {
    const timePattern = /(\d{1,2}:\d{2}(?::\d{2})?)/;
    const match = text.match(timePattern);
    return match ? match[1] : undefined;
  }

  /**
   * Extract recipient information
   */
  private extractRecipient(text: string): string | undefined {
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

  /**
   * Extract bank name
   */
  private extractBankName(text: string): string | undefined {
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

  /**
   * Extract transaction ID
   */
  private extractTransactionId(text: string): string | undefined {
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

  /**
   * Calculate confidence score based on extracted data
   */
  private calculateConfidenceScore(
    analysis: PaymentProofAnalysis, 
    orderDetails: any
  ): number {
    let score = 0;
    let maxScore = 0;

    // Amount match (40% weight)
    maxScore += 40;
    if (analysis.detectedAmount) {
      const amountDiff = Math.abs(analysis.detectedAmount - orderDetails.totalAmount);
      if (amountDiff <= this.AMOUNT_TOLERANCE) {
        score += 40; // Perfect match
      } else if (amountDiff <= orderDetails.totalAmount * 0.05) {
        score += 30; // 5% tolerance
      } else if (amountDiff <= orderDetails.totalAmount * 0.1) {
        score += 20; // 10% tolerance
      }
    }

    // Currency match (20% weight)
    maxScore += 20;
    if (analysis.detectedCurrency === orderDetails.currency) {
      score += 20;
    }

    // Date validity (20% weight)
    maxScore += 20;
    if (analysis.detectedDate) {
      const daysDiff = Math.abs(
        (new Date().getTime() - analysis.detectedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff <= 7) {
        score += 20; // Within a week
      } else if (daysDiff <= 30) {
        score += 10; // Within a month
      }
    }

    // Recipient match (10% weight)
    maxScore += 10;
    if (analysis.detectedRecipient && orderDetails.expectedRecipient) {
      const similarity = this.calculateStringSimilarity(
        analysis.detectedRecipient.toLowerCase(),
        orderDetails.expectedRecipient.toLowerCase()
      );
      score += similarity * 10;
    }

    // Bank detection (10% weight)
    maxScore += 10;
    if (analysis.detectedBankName) {
      score += 10;
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Determine if payment should be auto-verified
   */
  private shouldAutoVerify(
    analysis: PaymentProofAnalysis, 
    orderDetails: any
  ): boolean {
    // High confidence score required
    if (analysis.confidenceScore < this.MIN_CONFIDENCE_SCORE) {
      return false;
    }

    // Amount must match exactly or within tolerance
    if (!analysis.detectedAmount) {
      return false;
    }

    const amountDiff = Math.abs(analysis.detectedAmount - orderDetails.totalAmount);
    if (amountDiff > this.AMOUNT_TOLERANCE) {
      return false;
    }

    // Date must be recent
    if (analysis.detectedDate) {
      const daysDiff = Math.abs(
        (new Date().getTime() - analysis.detectedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff > 7) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
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
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Simulate OCR text for demonstration
   */
  private simulateOCRText(): string {
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

  /**
   * Generate verification report
   */
  generateVerificationReport(analysis: PaymentProofAnalysis, orderDetails: any): string {
    let report = `🔍 *Результат анализа платежного документа*\n\n`;
    
    report += `📊 *Оценка достоверности: ${Math.round(analysis.confidenceScore * 100)}%*\n\n`;
    
    if (analysis.isAutoVerifiable) {
      report += `✅ *Рекомендация: АВТОПОДТВЕРЖДЕНИЕ*\n\n`;
    } else {
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
      } else {
        report += `❌ Расхождение: ${diff.toFixed(2)} ${orderDetails.currency}\n`;
      }
    }

    return report;
  }
}

export const smartVerificationService = SmartVerificationService.getInstance();


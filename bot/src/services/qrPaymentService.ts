import { logger } from '../utils/logger';
import QRCode from 'qrcode';

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

interface SBPQRData {
  bankId: string;
  phoneNumber: string;
  amount: number;
  currency: string;
  comment?: string;
}

export class QRPaymentService {
  private static instance: QRPaymentService;
  
  private readonly defaultOptions = {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M' as const,
    type: 'png' as const,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  };

  public static getInstance(): QRPaymentService {
    if (!QRPaymentService.instance) {
      QRPaymentService.instance = new QRPaymentService();
    }
    return QRPaymentService.instance;
  }

  /**
   * Generate QR code for payment
   */
  async generatePaymentQR(
    paymentData: PaymentQRData,
    options?: Partial<QRGenerationOptions>
  ): Promise<Buffer> {
    try {
      const qrOptions = { ...this.defaultOptions, ...options };
      
      let qrContent = '';
      
      switch (paymentData.paymentSystem) {
        case 'SBP':
          qrContent = this.generateSBPQRContent(paymentData);
          break;
        case 'CARD_TRANSFER':
          qrContent = this.generateCardTransferQRContent(paymentData);
          break;
        case 'CUSTOM':
          qrContent = this.generateCustomQRContent(paymentData);
          break;
        default:
          throw new Error(`Unsupported payment system: ${paymentData.paymentSystem}`);
      }

      // Generate QR code
      const qrBuffer = await QRCode.toBuffer(qrContent, {
        width: qrOptions.size,
        margin: qrOptions.margin,
        errorCorrectionLevel: qrOptions.errorCorrectionLevel,
        color: qrOptions.color
      });

      logger.info(`QR code generated for order ${paymentData.orderId}`, {
        paymentSystem: paymentData.paymentSystem,
        amount: paymentData.amount,
        currency: paymentData.currency
      });

      return qrBuffer;

    } catch (error) {
      logger.error('QR code generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate SBP (Система быстрых платежей) QR content
   */
  private generateSBPQRContent(paymentData: PaymentQRData): string {
    // SBP QR format: https://sbp.nspk.ru/
    const sbpData = {
      version: '01',
      initMethod: '12', // Static QR
      merchantInfo: {
        id: '0007',
        bankId: paymentData.bankName || '100000000111', // Sberbank BIC
        account: paymentData.recipientCard || '',
      },
      amount: paymentData.amount.toFixed(2),
      currency: paymentData.currency === 'RUB' ? '643' : '840',
      comment: paymentData.comment || `Заказ ${paymentData.orderId}`,
      crc: ''
    };

    // Build SBP QR string according to specification
    let qrString = '';
    qrString += `00${sbpData.version.length.toString().padStart(2, '0')}${sbpData.version}`;
    qrString += `01${sbpData.initMethod.length.toString().padStart(2, '0')}${sbpData.initMethod}`;
    
    // Merchant info
    const merchantInfo = `${sbpData.merchantInfo.id}${sbpData.merchantInfo.bankId}${sbpData.merchantInfo.account}`;
    qrString += `26${merchantInfo.length.toString().padStart(2, '0')}${merchantInfo}`;
    
    // Amount
    qrString += `54${sbpData.amount.length.toString().padStart(2, '0')}${sbpData.amount}`;
    
    // Currency
    qrString += `53${sbpData.currency.length.toString().padStart(2, '0')}${sbpData.currency}`;
    
    // Comment
    if (sbpData.comment) {
      qrString += `62${sbpData.comment.length.toString().padStart(2, '0')}${sbpData.comment}`;
    }

    // Calculate CRC16
    const crc = this.calculateCRC16(qrString + '6304');
    qrString += `63${crc.length.toString().padStart(2, '0')}${crc}`;

    return qrString;
  }

  /**
   * Generate card transfer QR content
   */
  private generateCardTransferQRContent(paymentData: PaymentQRData): string {
    // Simple format for card transfers
    const transferData = {
      type: 'CARD_TRANSFER',
      card: paymentData.recipientCard,
      amount: paymentData.amount,
      currency: paymentData.currency,
      recipient: paymentData.recipientName,
      comment: paymentData.comment || `Оплата заказа ${paymentData.orderId}`,
      orderId: paymentData.orderId
    };

    return JSON.stringify(transferData);
  }

  /**
   * Generate custom QR content
   */
  private generateCustomQRContent(paymentData: PaymentQRData): string {
    // Custom payment link or data
    const baseUrl = process.env.PAYMENT_BASE_URL || 'https://pay.example.com';
    
    const paymentUrl = new URL('/pay', baseUrl);
    paymentUrl.searchParams.set('order', paymentData.orderId);
    paymentUrl.searchParams.set('amount', paymentData.amount.toString());
    paymentUrl.searchParams.set('currency', paymentData.currency);
    
    if (paymentData.comment) {
      paymentUrl.searchParams.set('comment', paymentData.comment);
    }

    return paymentUrl.toString();
  }

  /**
   * Generate QR for specific Russian banks
   */
  async generateBankSpecificQR(
    paymentData: PaymentQRData,
    bankType: 'SBERBANK' | 'TINKOFF' | 'VTB' | 'ALFABANK'
  ): Promise<Buffer> {
    try {
      let qrContent = '';

      switch (bankType) {
        case 'SBERBANK':
          qrContent = this.generateSberbankQR(paymentData);
          break;
        case 'TINKOFF':
          qrContent = this.generateTinkoffQR(paymentData);
          break;
        case 'VTB':
          qrContent = this.generateVTBQR(paymentData);
          break;
        case 'ALFABANK':
          qrContent = this.generateAlfaBankQR(paymentData);
          break;
        default:
          throw new Error(`Unsupported bank: ${bankType}`);
      }

      return await QRCode.toBuffer(qrContent, this.defaultOptions);

    } catch (error) {
      logger.error(`Failed to generate ${bankType} QR:`, error);
      throw error;
    }
  }

  /**
   * Generate Sberbank-specific QR
   */
  private generateSberbankQR(paymentData: PaymentQRData): string {
    // Sberbank QR format
    const sberbankUrl = new URL('https://qr.nspk.ru/proxyapp');
    sberbankUrl.searchParams.set('type', 'p2p');
    sberbankUrl.searchParams.set('bank', '100000000111'); // Sberbank BIC
    sberbankUrl.searchParams.set('sum', paymentData.amount.toString());
    sberbankUrl.searchParams.set('comment', paymentData.comment || `Заказ ${paymentData.orderId}`);
    
    if (paymentData.recipientCard) {
      sberbankUrl.searchParams.set('card', paymentData.recipientCard);
    }

    return sberbankUrl.toString();
  }

  /**
   * Generate Tinkoff-specific QR
   */
  private generateTinkoffQR(paymentData: PaymentQRData): string {
    // Tinkoff QR format
    const tinkoffUrl = new URL('https://www.tinkoff.ru/sl/');
    const paymentId = `tinkoff_${paymentData.orderId}_${Date.now()}`;
    tinkoffUrl.pathname += paymentId;
    
    const qrData = {
      amount: paymentData.amount,
      comment: paymentData.comment || `Оплата заказа ${paymentData.orderId}`,
      recipient: paymentData.recipientName || 'Получатель',
      orderId: paymentData.orderId
    };

    // In real implementation, you would create a payment link through Tinkoff API
    tinkoffUrl.searchParams.set('data', btoa(JSON.stringify(qrData)));

    return tinkoffUrl.toString();
  }

  /**
   * Generate VTB-specific QR
   */
  private generateVTBQR(paymentData: PaymentQRData): string {
    // VTB QR format
    const vtbData = {
      type: 'vtb_transfer',
      amount: paymentData.amount,
      currency: paymentData.currency,
      comment: paymentData.comment || `Заказ ${paymentData.orderId}`,
      orderId: paymentData.orderId
    };

    return JSON.stringify(vtbData);
  }

  /**
   * Generate Alfa-Bank-specific QR
   */
  private generateAlfaBankQR(paymentData: PaymentQRData): string {
    // Alfa-Bank QR format
    const alfaUrl = new URL('https://alfabank.ru/get-money/');
    alfaUrl.searchParams.set('amount', paymentData.amount.toString());
    alfaUrl.searchParams.set('comment', paymentData.comment || `Заказ ${paymentData.orderId}`);
    alfaUrl.searchParams.set('order', paymentData.orderId);

    return alfaUrl.toString();
  }

  /**
   * Generate multiple QR codes for different payment methods
   */
  async generateMultiPaymentQRs(paymentData: PaymentQRData): Promise<{
    sbp: Buffer;
    sberbank: Buffer;
    tinkoff: Buffer;
    custom: Buffer;
  }> {
    try {
      const [sbp, sberbank, tinkoff, custom] = await Promise.all([
        this.generatePaymentQR({ ...paymentData, paymentSystem: 'SBP' }),
        this.generateBankSpecificQR(paymentData, 'SBERBANK'),
        this.generateBankSpecificQR(paymentData, 'TINKOFF'),
        this.generatePaymentQR({ ...paymentData, paymentSystem: 'CUSTOM' })
      ]);

      return { sbp, sberbank, tinkoff, custom };

    } catch (error) {
      logger.error('Failed to generate multiple QR codes:', error);
      throw error;
    }
  }

  /**
   * Calculate CRC16 for SBP QR codes
   */
  private calculateCRC16(data: string): string {
    const polynomial = 0x1021;
    let crc = 0xFFFF;

    for (let i = 0; i < data.length; i++) {
      crc ^= (data.charCodeAt(i) << 8);
      
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ polynomial;
        } else {
          crc <<= 1;
        }
      }
    }

    crc &= 0xFFFF;
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Validate QR data
   */
  validatePaymentData(paymentData: PaymentQRData): boolean {
    if (!paymentData.orderId || !paymentData.amount || !paymentData.currency) {
      return false;
    }

    if (paymentData.amount <= 0) {
      return false;
    }

    if (!['RUB', 'USD', 'EUR'].includes(paymentData.currency)) {
      return false;
    }

    return true;
  }

  /**
   * Create QR code with logo overlay
   */
  async generateQRWithLogo(
    paymentData: PaymentQRData,
    logoBuffer?: Buffer
  ): Promise<Buffer> {
    try {
      // Generate base QR code
      const qrBuffer = await this.generatePaymentQR(paymentData);

      if (!logoBuffer) {
        return qrBuffer;
      }

      // In a real implementation, you would use image processing library
      // to overlay the logo onto the QR code
      // For now, return the QR code without logo
      return qrBuffer;

    } catch (error) {
      logger.error('Failed to generate QR with logo:', error);
      throw error;
    }
  }

  /**
   * Generate payment instructions text for QR code
   */
  generatePaymentInstructions(paymentData: PaymentQRData): string {
    let instructions = `💳 *Инструкции по оплате через QR-код*\n\n`;
    
    instructions += `📋 Заказ: ${paymentData.orderId}\n`;
    instructions += `💰 Сумма: ${paymentData.amount} ${paymentData.currency}\n\n`;

    switch (paymentData.paymentSystem) {
      case 'SBP':
        instructions += `🏦 *Система быстрых платежей (СБП)*\n`;
        instructions += `1️⃣ Откройте приложение вашего банка\n`;
        instructions += `2️⃣ Найдите функцию "Оплата по QR"\n`;
        instructions += `3️⃣ Наведите камеру на QR-код\n`;
        instructions += `4️⃣ Подтвердите платеж\n`;
        break;
      
      case 'CARD_TRANSFER':
        instructions += `💳 *Перевод на карту*\n`;
        instructions += `1️⃣ Отсканируйте QR-код банковским приложением\n`;
        instructions += `2️⃣ Проверьте реквизиты получателя\n`;
        instructions += `3️⃣ Укажите сумму: ${paymentData.amount} ${paymentData.currency}\n`;
        instructions += `4️⃣ Добавьте комментарий: ${paymentData.comment}\n`;
        instructions += `5️⃣ Подтвердите перевод\n`;
        break;
      
      case 'CUSTOM':
        instructions += `🔗 *Персональная ссылка для оплаты*\n`;
        instructions += `1️⃣ Отсканируйте QR-код\n`;
        instructions += `2️⃣ Перейдите по ссылке\n`;
        instructions += `3️⃣ Выберите способ оплаты\n`;
        instructions += `4️⃣ Завершите платеж\n`;
        break;
    }

    instructions += `\n⚠️ *Важно:*\n`;
    instructions += `• Указывайте точную сумму\n`;
    instructions += `• Обязательно добавьте комментарий к платежу\n`;
    instructions += `• Сохраните чек об оплате\n`;
    instructions += `• Загрузите чек в бот после оплаты\n`;

    return instructions;
  }
}

export const qrPaymentService = QRPaymentService.getInstance();


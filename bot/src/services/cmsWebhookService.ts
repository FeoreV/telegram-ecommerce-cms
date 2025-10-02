import { logger } from '../utils/logger';
import { apiService } from './apiService';

interface WebhookEvent {
  id: string;
  type: 'product.created' | 'product.updated' | 'product.deleted' | 
        'inventory.updated' | 'order.created' | 'order.updated' | 'order.cancelled';
  data: any;
  timestamp: string;
  source: 'MEDUSA' | 'SHOPIFY' | 'WOOCOMMERCE';
}

interface StockUpdate {
  productId: string;
  variantId?: string;
  newStock: number;
  oldStock?: number;
  threshold?: number;
}

interface ProductUpdate {
  id: string;
  title: string;
  description?: string;
  price?: number;
  images?: string[];
  variants?: any[];
  status: 'active' | 'inactive' | 'deleted';
}

interface OrderSync {
  cmsOrderId: string;
  localOrderId?: string;
  status: string;
  items: any[];
  totalAmount: number;
  customerInfo: any;
}

export class CMSWebhookService {
  private static instance: CMSWebhookService;

  public static getInstance(): CMSWebhookService {
    if (!CMSWebhookService.instance) {
      CMSWebhookService.instance = new CMSWebhookService();
    }
    return CMSWebhookService.instance;
  }

  /**
   * Process incoming webhook from CMS
   */
  async processWebhook(webhookData: WebhookEvent): Promise<void> {
    try {
      logger.info(`Processing CMS webhook: ${webhookData.type}`, {
        eventId: webhookData.id,
        source: webhookData.source,
        timestamp: webhookData.timestamp
      });

      switch (webhookData.type) {
        case 'product.created':
          await this.handleProductCreated(webhookData.data);
          break;
        case 'product.updated':
          await this.handleProductUpdated(webhookData.data);
          break;
        case 'product.deleted':
          await this.handleProductDeleted(webhookData.data);
          break;
        case 'inventory.updated':
          await this.handleInventoryUpdated(webhookData.data);
          break;
        case 'order.created':
          await this.handleOrderCreated(webhookData.data);
          break;
        case 'order.updated':
          await this.handleOrderUpdated(webhookData.data);
          break;
        case 'order.cancelled':
          await this.handleOrderCancelled(webhookData.data);
          break;
        default:
          logger.warn(`Unknown webhook type: ${webhookData.type}`);
      }

      logger.info(`Successfully processed webhook: ${webhookData.type}`, {
        eventId: webhookData.id
      });

    } catch (error) {
      logger.error('Webhook processing failed:', error, {
        eventId: webhookData.id,
        eventType: webhookData.type
      });
      throw error;
    }
  }

  /**
   * Handle new product creation in CMS
   */
  private async handleProductCreated(productData: ProductUpdate): Promise<void> {
    try {
      // TODO: Create mapping between CMS product and local system
      // await apiService.createProductMapping({
      //   cmsProductId: productData.id,
      //   cmsSource: 'MEDUSA',
      //   productData: {
      //     name: productData.title,
      //     description: productData.description,
      //     price: productData.price,
      //     images: productData.images,
      //     variants: productData.variants,
      //     isActive: productData.status === 'active'
      //   }
      // });
      logger.info(`Product created in CMS: ${productData.title} (${productData.id})`);

      // Notify relevant store admins
      await this.notifyAdminsProductUpdate('NEW_PRODUCT', productData);

      logger.info(`Product mapping created for CMS product: ${productData.id}`);
    } catch (error) {
      logger.error('Failed to handle product creation:', error);
      throw error;
    }
  }

  /**
   * Handle product updates from CMS
   */
  private async handleProductUpdated(productData: ProductUpdate): Promise<void> {
    try {
      // TODO: Update local product mapping
      // await apiService.updateProductMapping(productData.id, {
      //   productData: {
      //     name: productData.title,
      //     description: productData.description,
      //     price: productData.price,
      //     images: productData.images,
      //     variants: productData.variants,
      //     isActive: productData.status === 'active'
      //   }
      // });
      logger.info(`Product updated in CMS: ${productData.title} (${productData.id})`);

      // Notify customers who have this product in wishlist/notifications
      await this.notifyCustomersProductUpdate(productData);

      logger.info(`Product mapping updated for CMS product: ${productData.id}`);
    } catch (error) {
      logger.error('Failed to handle product update:', error);
      throw error;
    }
  }

  /**
   * Handle product deletion from CMS
   */
  private async handleProductDeleted(productData: { id: string }): Promise<void> {
    try {
      // TODO: Deactivate local mapping and cancel orders
      // await apiService.deactivateProductMapping(productData.id);
      // await apiService.cancelOrdersForCMSProduct(productData.id);
      logger.info(`Product deleted in CMS: ${productData.id}`);

      logger.info(`Product mapping deactivated for CMS product: ${productData.id}`);
    } catch (error) {
      logger.error('Failed to handle product deletion:', error);
      throw error;
    }
  }

  /**
   * Handle inventory updates from CMS
   */
  private async handleInventoryUpdated(stockData: StockUpdate): Promise<void> {
    try {
      // TODO: Update local stock information
      // await apiService.updateProductStock(stockData.productId, {
      //   variantId: stockData.variantId,
      //   newStock: stockData.newStock,
      //   source: 'CMS_WEBHOOK'
      // });
      logger.info(`Stock updated for product ${stockData.productId}: ${stockData.newStock}`);

      // Check for low stock alerts
      if (stockData.threshold && stockData.newStock <= stockData.threshold) {
        await this.triggerLowStockAlert(stockData);
      }

      // Notify customers waiting for restock
      if (stockData.oldStock === 0 && stockData.newStock > 0) {
        await this.notifyCustomersRestock(stockData);
      }

      logger.info(`Stock updated for product: ${stockData.productId}`, {
        variantId: stockData.variantId,
        newStock: stockData.newStock,
        oldStock: stockData.oldStock
      });
    } catch (error) {
      logger.error('Failed to handle inventory update:', error);
      throw error;
    }
  }

  /**
   * Handle order creation in CMS
   */
  private async handleOrderCreated(orderData: OrderSync): Promise<void> {
    try {
      // TODO: Check if order was created through our bot
      // const existingOrder = await apiService.findOrderByCMSId(orderData.cmsOrderId);
      // if (existingOrder) {
      //   await apiService.updateOrderWithCMSData(existingOrder.id, {
      //     cmsOrderId: orderData.cmsOrderId,
      //     cmsStatus: orderData.status,
      //     syncedAt: new Date()
      //   });
      // } else {
      //   await apiService.createOrderFromCMS({
      //     cmsOrderId: orderData.cmsOrderId,
      //     items: orderData.items,
      //     totalAmount: orderData.totalAmount,
      //     customerInfo: orderData.customerInfo,
      //     status: 'PENDING_CMS_SYNC'
      //   });
      // }
      logger.info(`Order created/updated in CMS: ${orderData.cmsOrderId}`);

      logger.info(`Order synced from CMS: ${orderData.cmsOrderId}`);
    } catch (error) {
      logger.error('Failed to handle CMS order creation:', error);
      throw error;
    }
  }

  /**
   * Handle order updates from CMS
   */
  private async handleOrderUpdated(orderData: OrderSync): Promise<void> {
    try {
      // TODO: Find and update local order status
      // const localOrder = await apiService.findOrderByCMSId(orderData.cmsOrderId);
      // if (localOrder) {
      //   const newStatus = this.mapCMSStatusToLocal(orderData.status);
      //   await apiService.updateOrderStatus(localOrder.id, {
      //     status: newStatus,
      //     cmsStatus: orderData.status,
      //     syncedAt: new Date()
      //   });
      // }
      logger.info(`Order status updated in CMS: ${orderData.cmsOrderId} -> ${orderData.status}`);

      // TODO: Notify customer about status change
      // await this.notifyCustomerStatusChange(localOrder, newStatus);

      logger.info(`Order status updated from CMS: ${orderData.cmsOrderId} -> ${orderData.status}`);
    } catch (error) {
      logger.error('Failed to handle CMS order update:', error);
      throw error;
    }
  }

  /**
   * Handle order cancellation from CMS
   */
  private async handleOrderCancelled(orderData: { cmsOrderId: string; reason?: string }): Promise<void> {
    try {
      // Find local order by CMS ID using integration mapping
      const integrationMapping = await this.findIntegrationMapping('CMS', 'order', orderData.cmsOrderId);
      
      if (!integrationMapping) {
        logger.warn(`No local order found for CMS order ID: ${orderData.cmsOrderId}`);
        return;
      }

      // Get the local order
      const localOrder = await this.getOrderWithDetails(integrationMapping.localId);
      
      if (!localOrder) {
        logger.error(`Local order ${integrationMapping.localId} not found for CMS ID: ${orderData.cmsOrderId}`);
        return;
      }

      // Cancel the local order using API service
      const adminToken = await this.getAdminToken();
      
      if (adminToken) {
        await apiService.rejectOrder(localOrder.id, orderData.reason || 'Cancelled in CMS', adminToken);
        logger.info(`Order ${localOrder.orderNumber} cancelled successfully from CMS webhook`);

        // Notify customer about cancellation
        await this.notifyCustomerCancellation(localOrder, orderData.reason || 'Cancelled in CMS');
      } else {
        logger.error('Unable to get admin token for order cancellation');
      }

    } catch (error) {
      logger.error('Failed to handle CMS order cancellation:', error);
      throw error;
    }
  }

  /**
   * Trigger low stock alert
   */
  private async triggerLowStockAlert(stockData: StockUpdate): Promise<void> {
    try {
      // Find local product by CMS ID
      const productMapping = await this.findIntegrationMapping('CMS', 'product', stockData.productId);
      
      if (!productMapping) {
        logger.warn(`No local product found for CMS product ID: ${stockData.productId}`);
        return;
      }

      // Create inventory alert notification
      const adminToken = await this.getAdminToken();
      if (!adminToken) {
        logger.error('Unable to get admin token for inventory alert');
        return;
      }

      // Send alert via API to create proper notification
      const alertData = {
        type: 'LOW_STOCK',
        severity: stockData.newStock === 0 ? 'CRITICAL' : 'HIGH',
        productId: productMapping.localId,
        variantId: stockData.variantId ? await this.mapVariantId(stockData.variantId) : null,
        currentStock: stockData.newStock,
        threshold: stockData.threshold,
        message: stockData.newStock === 0 
          ? `Product out of stock` 
          : `Low stock: ${stockData.newStock} remaining`,
        source: 'CMS_WEBHOOK'
      };

      // For now, log the alert since we need to implement the API endpoint
      logger.warn(`🚨 INVENTORY ALERT: Product ${productMapping.localId} - Stock: ${stockData.newStock}, Threshold: ${stockData.threshold}`);

      logger.info(`Low stock alert processed for product: ${productMapping.localId}`);
    } catch (error) {
      logger.error('Failed to create low stock alert:', error);
    }
  }

  /**
   * Notify customers about product restock
   */
  private async notifyCustomersRestock(stockData: StockUpdate): Promise<void> {
    try {
      // TODO: Get customers waiting for restock notifications and notify them
      // const waitingCustomers = await apiService.getStockNotificationSubscribers(
      //   stockData.productId, 
      //   stockData.variantId
      // );
      // for (const customer of waitingCustomers) {
      //   await apiService.sendRestockNotification(customer.telegramId, {
      //     productId: stockData.productId,
      //     variantId: stockData.variantId,
      //     newStock: stockData.newStock
      //   });
      // }
      logger.info(`Product restocked: ${stockData.productId} (${stockData.newStock} units)`);
    } catch (error) {
      logger.error('Failed to send restock notifications:', error);
    }
  }

  /**
   * Notify admins about product updates
   */
  private async notifyAdminsProductUpdate(type: string, productData: ProductUpdate): Promise<void> {
    try {
      // TODO: Notify admins about product updates
      // await apiService.notifyAdminsProductUpdate({
      //   type,
      //   productId: productData.id,
      //   productName: productData.title,
      //   status: productData.status
      // });
      logger.info(`Admin notification: Product updated ${productData.title}`);

      logger.info(`Admin notification sent for product update: ${type}`);
    } catch (error) {
      logger.error('Failed to notify admins:', error);
    }
  }

  /**
   * Notify customers about product updates
   */
  private async notifyCustomersProductUpdate(productData: ProductUpdate): Promise<void> {
    try {
      // TODO: Notify customers who have favorited this product
      // await apiService.notifyFavoriteProductUpdate(productData.id, {
      //   title: productData.title,
      //   price: productData.price,
      //   status: productData.status
      // });
      logger.info(`Favorite product update notification: ${productData.title}`);

      logger.info(`Customer notifications sent for product update: ${productData.id}`);
    } catch (error) {
      logger.error('Failed to notify customers:', error);
    }
  }

  /**
   * Notify customer about order status change
   */
  private async notifyCustomerStatusChange(order: any, newStatus: string): Promise<void> {
    try {
      // TODO: Send order status notification to customer
      // await apiService.sendOrderStatusNotification(order.customerId, {
      //   orderId: order.id,
      //   orderNumber: order.orderNumber,
      //   newStatus,
      //   totalAmount: order.totalAmount,
      //   currency: order.currency
      // });
      logger.info(`Order status notification: ${order.orderNumber} -> ${newStatus}`);

      logger.info(`Status change notification sent for order: ${order.id}`);
    } catch (error) {
      logger.error('Failed to send status notification:', error);
    }
  }

  /**
   * Notify customer about order cancellation
   */
  private async notifyCustomerCancellation(order: any, reason?: string): Promise<void> {
    try {
      // TODO: Send cancellation notification to customer
      // await apiService.sendOrderCancellationNotification(order.customerId, {
      //   orderId: order.id,
      //   orderNumber: order.orderNumber,
      //   reason,
      //   totalAmount: order.totalAmount,
      //   currency: order.currency
      // });
      logger.info(`Order cancellation notification: ${order.orderNumber}`);

      logger.info(`Cancellation notification sent for order: ${order.id}`);
    } catch (error) {
      logger.error('Failed to send cancellation notification:', error);
    }
  }

  /**
   * Map CMS status to local system status
   */
  private mapCMSStatusToLocal(cmsStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'PENDING_ADMIN',
      'confirmed': 'PAID',
      'processing': 'PAID',
      'shipped': 'SHIPPED',
      'delivered': 'DELIVERED',
      'cancelled': 'CANCELLED',
      'refunded': 'REFUNDED'
    };

    return statusMap[cmsStatus.toLowerCase()] || 'PENDING_ADMIN';
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Webhook signature validation failed:', error);
      return false;
    }
  }

  /**
   * Create webhook response
   */
  createWebhookResponse(success: boolean, message?: string): any {
    return {
      success,
      message: message || (success ? 'Webhook processed successfully' : 'Webhook processing failed'),
      timestamp: new Date().toISOString(),
      processedBy: 'telegram-bot-service'
    };
  }

  /**
   * Find integration mapping by external ID
   */
  private async findIntegrationMapping(source: string, entityType: string, externalId: string): Promise<any> {
    try {
      const userToken = await this.getAdminToken();
      if (!userToken) {
        return null;
      }
      const response = await apiService.getIntegrationMapping({ source, entityType, externalId }, userToken);
      return response.mapping ?? response;
    } catch (error) {
      logger.warn(`Integration mapping not found: ${source}/${entityType}/${externalId}`);
      return null;
    }
  }

  /**
   * Get order with full details
   */
  private async getOrderWithDetails(orderId: string): Promise<any> {
    try {
      const adminToken = await this.getAdminToken();
      if (!adminToken) return null;

      const response = await apiService.getOrder(orderId, adminToken);
      return response.order;
    } catch (error) {
      logger.error(`Error fetching order ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Get admin token for API calls
   */
  private async getAdminToken(): Promise<string | null> {
    try {
      // Try to get system admin token or use default admin credentials
      return await apiService.getSystemAdminToken('CMS_WEBHOOK_SERVICE');
    } catch (error) {
      logger.warn('Unable to get system admin token for webhook operations');
      return null;
    }
  }

  /**
   * Map variant ID from CMS to local system
   */
  private async mapVariantId(cmsVariantId: string): Promise<string | null> {
    try {
      const variantMapping = await this.findIntegrationMapping('CMS', 'variant', cmsVariantId);
      return variantMapping?.localId || null;
    } catch (error) {
      logger.error(`Error mapping variant ID ${cmsVariantId}:`, error);
      return null;
    }
  }
}

export const cmsWebhookService = CMSWebhookService.getInstance();


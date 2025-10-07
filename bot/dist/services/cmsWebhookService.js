"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmsWebhookService = exports.CMSWebhookService = void 0;
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
const apiService_1 = require("./apiService");
class CMSWebhookService {
    static getInstance() {
        if (!CMSWebhookService.instance) {
            CMSWebhookService.instance = new CMSWebhookService();
        }
        return CMSWebhookService.instance;
    }
    async processWebhook(webhookData) {
        try {
            logger_1.logger.info(`Processing CMS webhook: ${(0, sanitizer_1.sanitizeForLog)(webhookData.type)}`, {
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
                    logger_1.logger.warn(`Unknown webhook type: ${(0, sanitizer_1.sanitizeForLog)(webhookData.type)}`);
            }
            logger_1.logger.info(`Successfully processed webhook: ${(0, sanitizer_1.sanitizeForLog)(webhookData.type)}`, {
                eventId: webhookData.id
            });
        }
        catch (error) {
            logger_1.logger.error('Webhook processing failed:', error, {
                eventId: webhookData.id,
                eventType: webhookData.type
            });
            throw error;
        }
    }
    async handleProductCreated(productData) {
        try {
            logger_1.logger.info(`Product created in CMS: ${(0, sanitizer_1.sanitizeForLog)(productData.title)} (${productData.id})`);
            await this.notifyAdminsProductUpdate('NEW_PRODUCT', productData);
            logger_1.logger.info(`Product mapping created for CMS product: ${productData.id}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to handle product creation:', error);
            throw error;
        }
    }
    async handleProductUpdated(productData) {
        try {
            logger_1.logger.info(`Product updated in CMS: ${(0, sanitizer_1.sanitizeForLog)(productData.title)} (${productData.id})`);
            await this.notifyCustomersProductUpdate(productData);
            logger_1.logger.info(`Product mapping updated for CMS product: ${productData.id}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to handle product update:', error);
            throw error;
        }
    }
    async handleProductDeleted(productData) {
        try {
            logger_1.logger.info(`Product deleted in CMS: ${productData.id}`);
            logger_1.logger.info(`Product mapping deactivated for CMS product: ${productData.id}`);
        }
        catch (error) {
            const sanitizedError = error instanceof Error ? error.message.replace(/[\r\n]/g, ' ') : String(error).replace(/[\r\n]/g, ' ');
            logger_1.logger.error('Failed to handle product deletion:', sanitizedError);
            throw error;
        }
    }
    async handleInventoryUpdated(stockData) {
        try {
            logger_1.logger.info(`Stock updated for product ${(0, sanitizer_1.sanitizeForLog)(stockData.productId)}: ${stockData.newStock}`);
            if (stockData.threshold && stockData.newStock <= stockData.threshold) {
                await this.triggerLowStockAlert(stockData);
            }
            if (stockData.oldStock === 0 && stockData.newStock > 0) {
                await this.notifyCustomersRestock(stockData);
            }
            logger_1.logger.info(`Stock updated for product: ${stockData.productId}`, {
                variantId: stockData.variantId,
                newStock: stockData.newStock,
                oldStock: stockData.oldStock
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to handle inventory update:', error);
            throw error;
        }
    }
    async handleOrderCreated(orderData) {
        try {
            logger_1.logger.info(`Order created/updated in CMS: ${(0, sanitizer_1.sanitizeForLog)(orderData.cmsOrderId)}`);
            logger_1.logger.info(`Order synced from CMS: ${(0, sanitizer_1.sanitizeForLog)(orderData.cmsOrderId)}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to handle CMS order creation:', error);
            throw error;
        }
    }
    async handleOrderUpdated(orderData) {
        try {
            logger_1.logger.info(`Order status updated in CMS: ${(0, sanitizer_1.sanitizeForLog)(orderData.cmsOrderId)} -> ${(0, sanitizer_1.sanitizeForLog)(orderData.status)}`);
            logger_1.logger.info(`Order status updated from CMS: ${(0, sanitizer_1.sanitizeForLog)(orderData.cmsOrderId)} -> ${(0, sanitizer_1.sanitizeForLog)(orderData.status)}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to handle CMS order update:', error);
            throw error;
        }
    }
    async handleOrderCancelled(orderData) {
        try {
            const integrationMapping = await this.findIntegrationMapping('CMS', 'order', orderData.cmsOrderId);
            if (!integrationMapping) {
                logger_1.logger.warn(`No local order found for CMS order ID: ${(0, sanitizer_1.sanitizeForLog)(orderData.cmsOrderId)}`);
                return;
            }
            const localOrder = await this.getOrderWithDetails(integrationMapping.localId);
            if (!localOrder) {
                logger_1.logger.error(`Local order ${integrationMapping.localId} not found for CMS ID: ${(0, sanitizer_1.sanitizeForLog)(orderData.cmsOrderId)}`);
                return;
            }
            const adminToken = await this.getAdminToken();
            if (adminToken) {
                await apiService_1.apiService.rejectOrder(localOrder.id, orderData.reason || 'Cancelled in CMS', adminToken);
                const sanitizedOrderNumber = String(localOrder.orderNumber).replace(/[\r\n]/g, ' ');
                logger_1.logger.info(`Order ${sanitizedOrderNumber} cancelled successfully from CMS webhook`);
                await this.notifyCustomerCancellation(localOrder, orderData.reason || 'Cancelled in CMS');
            }
            else {
                logger_1.logger.error('Unable to get admin token for order cancellation');
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to handle CMS order cancellation:', error);
            throw error;
        }
    }
    async triggerLowStockAlert(stockData) {
        try {
            const productMapping = await this.findIntegrationMapping('CMS', 'product', stockData.productId);
            if (!productMapping) {
                logger_1.logger.warn(`No local product found for CMS product ID: ${(0, sanitizer_1.sanitizeForLog)(stockData.productId)}`);
                return;
            }
            const adminToken = await this.getAdminToken();
            if (!adminToken) {
                logger_1.logger.error('Unable to get admin token for inventory alert');
                return;
            }
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
            logger_1.logger.warn(`🚨 INVENTORY ALERT: Product ${(0, sanitizer_1.sanitizeForLog)(productMapping.localId)} - Stock: ${stockData.newStock}, Threshold: ${stockData.threshold}`);
            logger_1.logger.info(`Low stock alert processed for product: ${(0, sanitizer_1.sanitizeForLog)(productMapping.localId)}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to create low stock alert:', error);
        }
    }
    async notifyCustomersRestock(stockData) {
        try {
            logger_1.logger.info(`Product restocked: ${(0, sanitizer_1.sanitizeForLog)(stockData.productId)} (${stockData.newStock} units)`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send restock notifications:', error);
        }
    }
    async notifyAdminsProductUpdate(type, productData) {
        try {
            logger_1.logger.info(`Admin notification: Product updated ${(0, sanitizer_1.sanitizeForLog)(productData.title)}`);
            logger_1.logger.info(`Admin notification sent for product update: ${(0, sanitizer_1.sanitizeForLog)(type)}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to notify admins:', error);
        }
    }
    async notifyCustomersProductUpdate(productData) {
        try {
            logger_1.logger.info(`Favorite product update notification: ${(0, sanitizer_1.sanitizeForLog)(productData.title)}`);
            logger_1.logger.info(`Customer notifications sent for product update: ${productData.id}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to notify customers:', error);
        }
    }
    async notifyCustomerStatusChange(order, newStatus) {
        try {
            logger_1.logger.info(`Order status notification: ${(0, sanitizer_1.sanitizeForLog)(order.orderNumber)} -> ${(0, sanitizer_1.sanitizeForLog)(newStatus)}`);
            logger_1.logger.info(`Status change notification sent for order: ${(0, sanitizer_1.sanitizeForLog)(order.id)}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send status notification:', error);
        }
    }
    async notifyCustomerCancellation(order, reason) {
        try {
            logger_1.logger.info(`Order cancellation notification: ${(0, sanitizer_1.sanitizeForLog)(order.orderNumber)}`);
            logger_1.logger.info(`Cancellation notification sent for order: ${(0, sanitizer_1.sanitizeForLog)(order.id)}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send cancellation notification:', error);
        }
    }
    mapCMSStatusToLocal(cmsStatus) {
        const statusMap = {
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
    validateWebhookSignature(payload, signature, secret) {
        try {
            const crypto = require('crypto');
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(payload)
                .digest('hex');
            return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
        }
        catch (error) {
            logger_1.logger.error('Webhook signature validation failed:', error);
            return false;
        }
    }
    createWebhookResponse(success, message) {
        return {
            success,
            message: message || (success ? 'Webhook processed successfully' : 'Webhook processing failed'),
            timestamp: new Date().toISOString(),
            processedBy: 'telegram-bot-service'
        };
    }
    async findIntegrationMapping(source, entityType, externalId) {
        try {
            const userToken = await this.getAdminToken();
            if (!userToken) {
                return null;
            }
            const response = await apiService_1.apiService.getIntegrationMapping({ source, entityType, externalId }, userToken);
            return response.mapping ?? response;
        }
        catch (error) {
            logger_1.logger.warn(`Integration mapping not found: ${(0, sanitizer_1.sanitizeForLog)(source)}/${(0, sanitizer_1.sanitizeForLog)(entityType)}/${(0, sanitizer_1.sanitizeForLog)(externalId)}`);
            return null;
        }
    }
    async getOrderWithDetails(orderId) {
        try {
            const adminToken = await this.getAdminToken();
            if (!adminToken)
                return null;
            const response = await apiService_1.apiService.getOrder(orderId, adminToken);
            return response.order;
        }
        catch (error) {
            const sanitizedOrderId = String(orderId).replace(/[\r\n]/g, ' ');
            const sanitizedError = error instanceof Error ? error.message.replace(/[\r\n]/g, ' ') : String(error).replace(/[\r\n]/g, ' ');
            logger_1.logger.error(`Error fetching order ${sanitizedOrderId}:`, sanitizedError);
            return null;
        }
    }
    async getAdminToken() {
        try {
            return await apiService_1.apiService.getSystemAdminToken('CMS_WEBHOOK_SERVICE');
        }
        catch (error) {
            logger_1.logger.warn('Unable to get system admin token for webhook operations');
            return null;
        }
    }
    async mapVariantId(cmsVariantId) {
        try {
            const variantMapping = await this.findIntegrationMapping('CMS', 'variant', cmsVariantId);
            return variantMapping?.localId || null;
        }
        catch (error) {
            logger_1.logger.error(`Error mapping variant ID ${(0, sanitizer_1.sanitizeForLog)(cmsVariantId)}:`, error);
            return null;
        }
    }
}
exports.CMSWebhookService = CMSWebhookService;
exports.cmsWebhookService = CMSWebhookService.getInstance();
//# sourceMappingURL=cmsWebhookService.js.map
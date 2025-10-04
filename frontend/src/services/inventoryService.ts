import { apiClient } from './apiClient'

export interface InventoryAlert {
  id: string
  productId: string
  variantId?: string
  productName: string
  variantName?: string
  currentStock: number
  threshold: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'REORDER_POINT'
  storeId?: string
  storeName?: string
  lastUpdated: string
  estimatedRunoutDate?: string
}

export interface AlertsSummary {
  total: number
  critical: number
  high: number
  medium: number
  outOfStock: number
  lowStock: number
}

export interface InventoryFilters {
  storeId?: string
  severity?: string
  type?: string
  search?: string
}

export interface StockUpdateRequest {
  variantId: string
  quantity: number
  reason?: string
  notes?: string
}

export interface StockAlertsConfig {
  lowStockThreshold?: number
  criticalStockThreshold?: number
  enableEmailAlerts?: boolean
  enableTelegramAlerts?: boolean
}

export const inventoryService = {
  // Get inventory alerts
  getInventoryAlerts: async (filters: InventoryFilters = {}): Promise<{ alerts: InventoryAlert[]; summary: AlertsSummary }> => {
    const params = new URLSearchParams()
    
    if (filters.storeId) params.set('storeId', filters.storeId)
    if (filters.severity && filters.severity !== 'all') params.set('severity', filters.severity)
    if (filters.type && filters.type !== 'all') params.set('type', filters.type)
    if (filters.search) params.set('search', filters.search)

    const response = await apiClient.get(`/inventory/alerts?${params.toString()}`)
    
    return {
      alerts: response.data?.alerts || [],
      summary: response.data?.summary || {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        outOfStock: 0,
        lowStock: 0
      }
    }
  },

  // Update stock level
  updateStock: async (data: StockUpdateRequest): Promise<any> => {
    const response = await apiClient.post('/inventory/update-stock', data)
    return response.data
  },

  // Configure stock alerts
  setStockAlertsConfig: async (storeId: string, config: StockAlertsConfig): Promise<any> => {
    const response = await apiClient.put(`/inventory/alerts-config/${storeId}`, config)
    return response.data
  },

  // Get stock alerts configuration
  getStockAlertsConfig: async (storeId: string): Promise<StockAlertsConfig> => {
    const response = await apiClient.get(`/inventory/alerts-config/${storeId}`)
    return response.data || {}
  },

  // Get inventory by product
  getProductInventory: async (productId: string): Promise<any> => {
    const response = await apiClient.get(`/inventory/product/${productId}`)
    return response.data
  },

  // Bulk update stock levels
  bulkUpdateStock: async (updates: StockUpdateRequest[]): Promise<any> => {
    const response = await apiClient.post('/inventory/bulk-update', { updates })
    return response.data
  },

  // Get inventory history
  getInventoryHistory: async (variantId: string, limit = 50): Promise<any[]> => {
    const response = await apiClient.get(`/inventory/history/${variantId}?limit=${limit}`)
    return response.data?.history || []
  }
}


import { ListResponse, Order } from '../types'
import { apiClient } from './apiClient'

const buildSearchParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  })
  return params
}

const emptyListResponse = (filters: OrderFilters): ListResponse<Order> => ({
  items: [],
  pagination: {
    page: Number(filters.page) || 1,
    limit: Number(filters.limit) || 0,
    total: 0,
    totalPages: 0,
  },
})

const toListResponse = (data: any, filters: OrderFilters): ListResponse<Order> => {
  if (Array.isArray(data?.items)) {
    return data as ListResponse<Order>
  }

  if (Array.isArray(data?.orders)) {
    const orders = data.orders as Order[]
    return {
      items: orders,
      pagination: data.pagination ?? {
        page: Number(filters.page) || 1,
        limit: Number(filters.limit) || orders.length || 0,
        total: (data.pagination?.total ?? orders.length) || 0,
        totalPages: data.pagination?.totalPages ?? 1,
      },
    }
  }

  return emptyListResponse(filters)
}

const unwrapOrder = (data: any): Order => {
  if (data?.order) {
    return data.order as Order
  }
  throw new Error('Unexpected order response shape')
}

const postAndUnwrapOrder = async (url: string, payload?: unknown): Promise<Order> => {
  const response = await apiClient.post(url, payload)
  return unwrapOrder(response.data)
}

export interface OrderFilters {
  storeId?: string
  status?: 'PENDING_ADMIN' | 'PAID' | 'REJECTED' | 'CANCELLED' | 'SHIPPED' | 'DELIVERED'
  statuses?: string[]
  customerId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'totalAmount' | 'orderNumber'
  sortOrder?: 'asc' | 'desc'
}

export interface ConfirmPaymentRequest {
  notes?: string
}

export interface RejectOrderRequest {
  reason: string
  notes?: string
}

const defaultOrderStats = (period?: string) => ({
  statusCounts: {},
  totalOrders: 0,
  totalRevenue: 0,
  period: period || 'all',
})

export const orderService = {
  // Получить список заказов
  getOrders: async (filters: OrderFilters = {}): Promise<ListResponse<Order>> => {
    const params = buildSearchParams({
      storeId: filters.storeId,
      status: filters.status,
      customerId: filters.customerId,
      search: filters.search,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })

    // Add statuses as separate query parameters if provided
    if (filters.statuses && filters.statuses.length > 0) {
      filters.statuses.forEach(status => {
        params.append('statuses', status)
      })
    }

    const response = await apiClient.get(`/orders?${params.toString()}`)
    return toListResponse(response.data, filters)
  },

  // Получить заказ по ID
  getOrder: async (id: string): Promise<Order> => {
    const response = await apiClient.get(`/orders/${id}`)
    return unwrapOrder(response.data)
  },

  // Подтвердить оплату заказа
  confirmPayment: async (id: string, data: ConfirmPaymentRequest = {}): Promise<Order> => {
    return postAndUnwrapOrder(`/orders/${id}/confirm-payment`, data)
  },

  // Отклонить заказ
  rejectOrder: async (id: string, data: RejectOrderRequest): Promise<Order> => {
    return postAndUnwrapOrder(`/orders/${id}/reject`, data)
  },

  // Отменить заказ
  cancelOrder: async (id: string, reason?: string): Promise<Order> => {
    return postAndUnwrapOrder(`/orders/${id}/cancel`, { reason })
  },

  // Обновить статус заказа на "Отправлен"
  markAsShipped: async (id: string, data?: { trackingNumber?: string; trackingUrl?: string }): Promise<Order> => {
    return postAndUnwrapOrder(`/orders/${id}/ship`, data || {})
  },

  // Обновить статус заказа на "Доставлен"
  markAsDelivered: async (id: string): Promise<Order> => {
    return postAndUnwrapOrder(`/orders/${id}/deliver`)
  },

  // Получить статистику заказов
  getOrderStats: async (storeId?: string, period?: string): Promise<Record<string, unknown>> => {
    const params = buildSearchParams({ storeId, period })

    try {
      const response = await apiClient.get(`/orders/stats?${params.toString()}`)
      return response.data ?? defaultOrderStats(period)
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return defaultOrderStats(period)
      }
      throw error
    }
  },

  // Экспорт заказов
  exportOrders: async (filters: OrderFilters = {}): Promise<Blob> => {
    const params = buildSearchParams({
      storeId: filters.storeId,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    })

    // Add statuses as separate query parameters if provided
    if (filters.statuses && filters.statuses.length > 0) {
      filters.statuses.forEach(status => {
        params.append('statuses', status)
      })
    }

    const response = await apiClient.get(`/orders/export?${params.toString()}`, {
      responseType: 'blob',
    })
    return response.data as Blob
  },

  // Получить логи действий администратора для заказа
  getOrderLogs: async (orderId: string): Promise<any[]> => {
    const response = await apiClient.get(`/orders/${orderId}/logs`)
    return Array.isArray(response.data?.logs) ? response.data.logs : []
  },

  // Добавить заметку к заказу
  addOrderNote: async (orderId: string, note: string): Promise<Order> => {
    const response = await apiClient.post(`/orders/${orderId}/notes`, { note })
    return unwrapOrder(response.data)
  },
}

import { apiClient } from './apiClient'
import { DashboardStats, Order } from '../types'

export interface DashboardFilters {
  storeId?: string
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  dateFrom?: string
  dateTo?: string
}

export interface RevenueData {
  date: string
  revenue: number
  orders: number
}

export interface TopProduct {
  id: string
  name: string
  revenue: number
  quantity: number
  store: {
    id: string
    name: string
  }
}

export interface TopStore {
  id: string
  name: string
  revenue: number
  orders: number
}

const PERIOD_TO_RANGE: Record<NonNullable<DashboardFilters['period']>, string> = {
  today: '24h',
  week: '7d',
  month: '30d',
  quarter: '90d',
  year: '365d',
  custom: 'custom',
}

const PERIOD_TO_DAYS: Record<NonNullable<DashboardFilters['period']>, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
  custom: 30,
}

const buildSearchParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  })
  return params
}

const toDashboardStats = (data: unknown): DashboardStats => {
  if (!data || typeof data !== 'object') {
    throw new Error('Некорректный ответ при получении статистики дашборда')
  }
  return data as DashboardStats
}

const safeArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[]
  }
  return []
}

export const dashboardService = {
  // Получить основную статистику
  getStats: async (filters: DashboardFilters = {}): Promise<DashboardStats> => {
    const params = buildSearchParams({
      timeRange: filters.period ? PERIOD_TO_RANGE[filters.period] : undefined,
      storeId: filters.storeId,
    })

    const response = await apiClient.get(`/admin/dashboard?${params.toString()}`)
    return toDashboardStats(response.data?.stats)
  },

  // Получить недавние заказы для дашборда
  getRecentOrders: async (limit: number = 10, storeId?: string): Promise<Order[]> => {
    const params = buildSearchParams({ storeId })
    const response = await apiClient.get(`/admin/dashboard?${params.toString()}`)
    const orders = safeArray<Order>(response.data?.recentOrders)
    return orders.slice(0, limit)
  },

  // Получить данные о выручке по дням
  getRevenueData: async (filters: DashboardFilters = {}): Promise<RevenueData[]> => {
    const params = buildSearchParams({
      period: filters.period ?? 'daily',
      days: filters.period ? PERIOD_TO_DAYS[filters.period] : undefined,
      storeId: filters.storeId,
    })

    const response = await apiClient.get(`/admin/revenue?${params.toString()}`)
    const revenue = safeArray<{ date: string; amount: number; orders?: number }>(response.data?.revenue)
    return revenue.map((entry) => ({
      date: entry.date,
      revenue: entry.amount,
      orders: entry.orders ?? 0,
    }))
  },

  // Получить топ товары по выручке
  getTopProducts: async (filters: DashboardFilters & { limit?: number } = {}): Promise<TopProduct[]> => {
    const params = buildSearchParams({
      limit: filters.limit,
      period: filters.period,
      storeId: filters.storeId,
    })

    const response = await apiClient.get(`/admin/top-products?${params.toString()}`)
    return safeArray<TopProduct>(response.data?.products)
  },

  // Получить топ магазины по выручке
  getTopStores: async (filters: DashboardFilters & { limit?: number } = {}): Promise<TopStore[]> => {
    const params = buildSearchParams({
      limit: filters.limit,
      period: filters.period,
      storeId: filters.storeId,
    })

    const response = await apiClient.get(`/admin/top-stores?${params.toString()}`)
    return safeArray<TopStore>(response.data?.stores)
  },

  // Получить статистику по статусам заказов
  getOrderStatusStats: async (filters: DashboardFilters = {}): Promise<Record<string, number>> => {
    const params = buildSearchParams({ period: filters.period, storeId: filters.storeId })
    const response = await apiClient.get(`/admin/order-status-stats?${params.toString()}`)
    return (response.data?.statusStats ?? {}) as Record<string, number>
  },

  // Получить сводку активности за день
  getDailyActivity: async (date?: string): Promise<any> => {
    // Not implemented; return empty safely
    return {}
  },

  // Получить уведомления для дашборда
  getNotifications: async (limit: number = 20): Promise<any[]> => {
    // Not implemented; return empty safely
    return []
  },

  // Отметить уведомление как прочитанное
  markNotificationRead: async (id: string): Promise<void> => {
    // Not implemented; no-op
    return
  },

  // Отметить все уведомления как прочитанные
  markAllNotificationsRead: async (): Promise<void> => {
    // Not implemented; no-op
    return
  },

  // Получить сравнение с предыдущим периодом
  getComparisonData: async (filters: DashboardFilters = {}): Promise<any> => {
    const params = new URLSearchParams()
    if (filters.period) params.set('period', filters.period)
    if (filters.storeId) params.set('storeId', filters.storeId)

    const response = await apiClient.get(`/admin/comparison?${params.toString()}`)
    return response.data || {}
  },
}

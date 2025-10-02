import { apiClient } from './apiClient'
import { User, ListResponse } from '../types'

export interface UserFilters {
  role?: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOMER'
  isActive?: boolean
  search?: string
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'firstName' | 'role'
  sortOrder?: 'asc' | 'desc'
}

export interface UpdateUserRequest {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  role?: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOMER'
  isActive?: boolean
}

export interface CreateUserRequest {
  telegramId: string
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  role: 'ADMIN' | 'VENDOR' | 'CUSTOMER'
}

export const userService = {
  // Получить список пользователей
  getUsers: async (filters: UserFilters = {}): Promise<ListResponse<User>> => {
    const params = new URLSearchParams()
    if (filters.role) params.set('role', filters.role)
    if (filters.isActive !== undefined) params.set('isActive', filters.isActive.toString())
    if (filters.search) params.set('search', filters.search)
    if (filters.page) params.set('page', filters.page.toString())
    if (filters.limit) params.set('limit', filters.limit.toString())
    if (filters.sortBy) params.set('sortBy', filters.sortBy)
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder)

    const response = await apiClient.get(`/users?${params.toString()}`)
    return response.data
  },

  // Получить пользователя по ID
  getUser: async (id: string): Promise<User> => {
    const response = await apiClient.get(`/users/${id}`)
    return response.data.user
  },

  // Создать нового пользователя (только для владельцев)
  createUser: async (data: CreateUserRequest): Promise<User> => {
    const response = await apiClient.post('/users', data)
    return response.data.user
  },

  // Обновить пользователя
  updateUser: async (id: string, data: UpdateUserRequest): Promise<User> => {
    const response = await apiClient.put(`/users/${id}`, data)
    return response.data.user
  },

  // Активировать/деактивировать пользователя
  toggleUserActive: async (id: string): Promise<User> => {
    const response = await apiClient.patch(`/users/${id}/toggle-active`)
    return response.data.user
  },

  // Изменить роль пользователя
  changeUserRole: async (id: string, role: 'ADMIN' | 'VENDOR' | 'CUSTOMER'): Promise<User> => {
    const response = await apiClient.patch(`/users/${id}/role`, { role })
    return response.data.user
  },

  // Удалить пользователя (только владельцы могут удалять)
  deleteUser: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`)
  },

  // Получить статистику пользователя
  getUserStats: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/users/${id}/stats`)
    return response.data
  },

  // Получить заказы пользователя
  getUserOrders: async (id: string, page: number = 1, limit: number = 10): Promise<any> => {
    const response = await apiClient.get(`/users/${id}/orders?page=${page}&limit=${limit}`)
    return response.data
  },

  // Получить магазины, которыми управляет пользователь
  getUserStores: async (id: string): Promise<any[]> => {
    const response = await apiClient.get(`/users/${id}/stores`)
    return response.data.items || response.data.stores
  },

  // Сбросить пароль пользователя (отправить инструкции)
  resetPassword: async (id: string): Promise<void> => {
    await apiClient.post(`/users/${id}/reset-password`)
  },

  // Поиск пользователей по Telegram ID/username
  searchUsersByTelegram: async (query: string): Promise<User[]> => {
    const response = await apiClient.get(`/users/search/telegram?q=${encodeURIComponent(query)}`)
    return response.data.users
  },

  // Получить активность пользователя (логи)
  getUserActivity: async (id: string, page: number = 1, limit: number = 20): Promise<any> => {
    const response = await apiClient.get(`/users/${id}/activity?page=${page}&limit=${limit}`)
    return response.data
  },

  // Получить детальную информацию о пользователе со статистикой
  getUserDetailed: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/users/${id}/detailed`)
    return response.data
  },

  // Забанить пользователя
  banUser: async (id: string, reason?: string): Promise<User> => {
    const response = await apiClient.post(`/users/${id}/ban`, { reason })
    return response.data.user
  },

  // Разбанить пользователя
  unbanUser: async (id: string): Promise<User> => {
    const response = await apiClient.post(`/users/${id}/unban`)
    return response.data.user
  },

  // Массовые действия над пользователями
  bulkUserAction: async (action: 'ban' | 'unban' | 'changeRole' | 'delete', userIds: string[], data?: any): Promise<any> => {
    const response = await apiClient.post('/users/bulk-action', { action, userIds, data })
    return response.data
  },

  // Назначить пользователя в магазин
  assignToStore: async (userId: string, storeId: string, role: 'ADMIN' | 'VENDOR'): Promise<any> => {
    const response = await apiClient.post('/users/assign-store', { userId, storeId, role })
    return response.data
  },

  // Удалить пользователя из магазина
  removeFromStore: async (userId: string, storeId: string, role: 'ADMIN' | 'VENDOR'): Promise<any> => {
    const response = await apiClient.delete('/users/remove-store', { data: { userId, storeId, role } })
    return response.data
  },

  // Получить статистику по ролям
  getRoleStatistics: async (): Promise<any> => {
    const response = await apiClient.get('/users/statistics')
    return response.data
  },

  // Изменить роль пользователя
  updateRole: async (id: string, role: string, storeAssignments?: any[]): Promise<User> => {
    const response = await apiClient.put(`/users/${id}/role`, { role, storeAssignments })
    return response.data.user
  },
}

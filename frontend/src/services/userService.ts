import { apiClient } from './apiClient'
import { ListResponse, User } from '../types'

export interface UserSearchFilters {
  search?: string
  role?: string
  isActive?: boolean
  limit?: number
  page?: number
}

export interface UserCandidate {
  id: string
  telegramId?: string
  firstName?: string
  lastName?: string
  username?: string
  email?: string
  phone?: string
  role: string
  isActive: boolean
  avatar?: string
}

export const userService = {
  // Search users for admin assignment
  searchUsers: async (filters: UserSearchFilters = {}): Promise<ListResponse<UserCandidate>> => {
    const params = new URLSearchParams()
    
    if (filters.search) params.set('search', filters.search)
    if (filters.role) params.set('role', filters.role)
    if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive))
    if (filters.limit) params.set('limit', String(filters.limit))
    if (filters.page) params.set('page', String(filters.page))

    const response = await apiClient.get(`/users/search?${params.toString()}`)
    
    return {
      items: response.data?.users || response.data?.items || [],
      pagination: response.data?.pagination || {
        page: 1,
        limit: filters.limit || 10,
        total: 0,
        totalPages: 0
      }
    }
  },

  // Get user by ID
  getUser: async (userId: string): Promise<User> => {
    const response = await apiClient.get(`/users/${userId}`)
    return response.data?.user || response.data
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get('/users/me')
    return response.data?.user || response.data
  },

  // Update user
  updateUser: async (userId: string, data: Partial<User>): Promise<User> => {
    const response = await apiClient.put(`/users/${userId}`, data)
    return response.data?.user || response.data
  },

  // Delete user
  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}`)
  },

  // Get user roles
  getUserRoles: async (): Promise<string[]> => {
    const response = await apiClient.get('/users/roles')
    return response.data?.roles || []
  },

  // Get users list
  getUsers: async (filters: UserSearchFilters = {}): Promise<ListResponse<User>> => {
    const params = new URLSearchParams()
    
    if (filters.role) params.set('role', filters.role)
    if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive))
    if (filters.limit) params.set('limit', String(filters.limit))
    if (filters.page) params.set('page', String(filters.page))

    const response = await apiClient.get(`/users?${params.toString()}`)
    
    return {
      items: response.data?.users || response.data?.items || [],
      pagination: response.data?.pagination || {
        page: 1,
        limit: filters.limit || 10,
        total: 0,
        totalPages: 0
      }
    }
  }
}

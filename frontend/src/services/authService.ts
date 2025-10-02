import { apiClient } from './apiClient'

export interface User {
  id: string
  telegramId: string
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  role: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOMER'
  isActive: boolean
  profilePhoto?: string
  lastLoginAt?: string
  createdAt: string
  _count?: {
    orders: number
    ownedStores: number
  }
}

export interface LoginResponse {
  success: boolean
  token: string
  accessToken: string
  refreshToken: string
  user: User
  sessionId?: string
}

export interface ProfileResponse {
  success: boolean
  user: User
}

export interface QRAuthResponse {
  success: boolean
  sessionId: string
  deepLink: string
  qrData: string
  expiresAt: string
  expiresIn: number
}

export interface QRStatusResponse {
  success: boolean
  sessionId: string
  completed: boolean
  telegramId?: string
  expiresAt: string
}

export interface RefreshResponse {
  success: boolean
  accessToken: string
  refreshToken: string
  user: User
}

export interface DeepLinkResponse {
  success: boolean
  deepLink: string
  action: string
  params: string
}

export interface SessionInfo {
  id: string
  createdAt: string
  lastUsedAt?: string
  expiresAt: string
  ipAddress: string
  userAgent: string
}

class AuthService {
  private warnTelegramValidationMissing = (() => {
    let warned = false
    return (context: unknown) => {
      if (!warned && import.meta.env.MODE === 'development') {
        console.warn('validateTelegramWebAppData is not implemented yet', context)
        warned = true
      }
    }
  })()

  // Enhanced Telegram login
  async login(
    telegramId: string,
    username?: string,
    firstName?: string,
    lastName?: string,
    options?: {
      authDate?: number
      hash?: string
      photoUrl?: string
      sessionId?: string
    }
  ): Promise<LoginResponse> {
    const response = await apiClient.post('/auth/login/telegram', {
      telegramId,
      username,
      firstName,
      lastName,
      ...options
    })
    return response.data
  }

  // Generate QR code for authentication
  async generateQRAuth(): Promise<QRAuthResponse> {
    const response = await apiClient.post('/auth/qr/generate')
    return response.data
  }

  // Check QR authentication status
  async checkQRAuth(sessionId: string): Promise<QRStatusResponse> {
    const response = await apiClient.get(`/auth/qr/${sessionId}`)
    return response.data
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    const response = await apiClient.post('/auth/refresh-token', {
      refreshToken
    })
    return response.data
  }

  // Logout
  async logout(refreshToken?: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/auth/logout', {
      refreshToken
    })
    return response.data
  }

  // Generate deep link
  async generateDeepLink(action: string, params?: any): Promise<DeepLinkResponse> {
    const response = await apiClient.post('/auth/deep-link', {
      action,
      params
    })
    return response.data
  }

  // Get current user profile
  async getProfile(): Promise<ProfileResponse> {
    const response = await apiClient.get('/auth/profile')
    return response.data
  }

  // Update user profile
  async updateProfile(data: Partial<User>): Promise<ProfileResponse> {
    const response = await apiClient.put('/auth/profile', data)
    return response.data
  }

  // Get active sessions
  async getActiveSessions(): Promise<{ success: boolean; sessions: SessionInfo[] }> {
    const response = await apiClient.get('/auth/sessions')
    return response.data
  }

  // Revoke specific session
  async revokeSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/auth/sessions/${sessionId}`)
    return response.data
  }

  // Check if user has permission for action
  hasPermission(user: User, requiredRoles: string[]): boolean {
    return requiredRoles.includes(user.role)
  }

  // Format user display name
  getDisplayName(user: User): string {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`
    }
    if (user.firstName) {
      return user.firstName
    }
    if (user.username) {
      return `@${user.username}`
    }
    return `User ${user.telegramId}`
  }

  // Get role display name
  getRoleDisplayName(role: string): string {
    const roleNames = {
      OWNER: 'Владелец',
      ADMIN: 'Администратор',
      VENDOR: 'Продавец',
      CUSTOMER: 'Клиент'
    }
    return roleNames[role as keyof typeof roleNames] || role
  }

  // Check if token is expired
  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      return payload.exp < currentTime
    } catch {
      return true
    }
  }

  // Get time until token expires (in seconds)
  getTokenTimeToExpiry(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      const timeToExpiry = payload.exp - currentTime
      return timeToExpiry > 0 ? timeToExpiry : 0
    } catch {
      return null
    }
  }

  // Validate Telegram Web App data
  validateTelegramWebAppData(initData: string): boolean {
    this.warnTelegramValidationMissing({ initData })
    return true
  }
}

export const authService = new AuthService()
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import { authService } from '../services/authService'
import { tokenManager } from '../services/apiClient'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (telegramId: string, username?: string, firstName?: string, lastName?: string) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (!error) {
      return fallback
    }
    const anyError = error as { response?: { data?: { error?: string; message?: string } }; message?: string }
    return (
      anyError.response?.data?.error ||
      anyError.response?.data?.message ||
      anyError.message ||
      fallback
    )
  }, [])

  const clearSession = useCallback(() => {
    tokenManager.clearTokens()
    setUser(null)
  }, [])

  const checkAuthStatus = useCallback(async () => {
    setLoading(true)
    try {
      const token = tokenManager.getAccessToken()
      if (!token) {
        clearSession()
        return
      }

      const response = await authService.getProfile()
      setUser(response.user)
    } catch (error) {
      toast.error('Не удалось проверить авторизацию. Требуется повторный вход.')
      clearSession()
    } finally {
      setLoading(false)
    }
  }, [clearSession])

  const performLogout = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      const refreshToken = tokenManager.getRefreshToken()

      clearSession()

      try {
        if (refreshToken) {
          await authService.logout(refreshToken)
        }
      } catch (error) {
        console.warn('Logout request failed:', error)
      } finally {
        if (!silent) {
          toast.info('Вы вышли из системы')
        }
      }
    },
    [clearSession]
  )

  useEffect(() => {
    void checkAuthStatus()
  }, [checkAuthStatus])

  useEffect(() => {
    const handleAuthFailure = () => {
      void performLogout({ silent: true })
    }

    window.addEventListener('authFailure', handleAuthFailure)
    return () => {
      window.removeEventListener('authFailure', handleAuthFailure)
    }
  }, [performLogout])

  const login = useCallback(
    async (
    telegramId: string,
    username?: string,
    firstName?: string,
    lastName?: string
    ) => {
      try {
        setLoading(true)
        const response = await authService.login(telegramId, username, firstName, lastName)

        const resolvedAccessToken = response.accessToken || response.token
        if (resolvedAccessToken) {
          tokenManager.setAccessToken(resolvedAccessToken)
        }
        if (response.refreshToken) {
          tokenManager.setRefreshToken(response.refreshToken)
        }

        setUser(response.user)

        toast.success('Успешный вход в систему!')
      } catch (error: any) {
        toast.error(getErrorMessage(error, 'Ошибка входа в систему'))
        throw error
      } finally {
        setLoading(false)
      }
    },
    [getErrorMessage]
  )

  const logout = useCallback(() => {
    void performLogout()
  }, [performLogout])

  const updateProfile = useCallback(
    async (data: Partial<User>) => {
      try {
        const response = await authService.updateProfile(data)
        setUser(response.user)
        toast.success('Профиль обновлен!')
      } catch (error: any) {
        toast.error(getErrorMessage(error, 'Ошибка обновления профиля'))
        throw error
      }
    },
    [getErrorMessage]
  )

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      login,
      logout,
      updateProfile,
    }),
    [loading, login, logout, updateProfile, user]
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

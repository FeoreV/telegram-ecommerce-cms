import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { toast } from 'react-toastify'

const normalizeApiBase = (rawBase?: string | null) => {
  const base = (rawBase ?? 'http://localhost:3001').replace(/\/$/, '')
  return base.endsWith('/api') ? base : `${base}/api`
}

const RAW_API_BASE = import.meta.env.VITE_API_URL as string | undefined
const API_BASE = normalizeApiBase(RAW_API_BASE)

const AUTH_BASE = (() => {
  const legacyBase = import.meta.env.VITE_AUTH_URL as string | undefined
  if (legacyBase) {
    return normalizeApiBase(legacyBase)
  }
  return API_BASE
})()

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  withCredentials: true, // Enable credentials for CORS
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// CSRF token management
let csrfToken: string | null = null
let csrfFetchingPromise: Promise<string | null> | null = null

async function fetchCsrfToken(): Promise<string | null> {
  try {
    const response = await axios.get(`${API_BASE}/csrf-token`, { withCredentials: true })
    const token = (response.data as any)?.csrfToken
    csrfToken = typeof token === 'string' ? token : null
    return csrfToken
  } catch (_err) {
    csrfToken = null
    return null
  } finally {
    csrfFetchingPromise = null
  }
}

async function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken
  if (!csrfFetchingPromise) {
    csrfFetchingPromise = fetchCsrfToken()
  }
  return csrfFetchingPromise
}

// Store for managing refresh token attempts
let isRefreshing = false

type FailedQueueItem = {
  resolve: (value: string | undefined) => void
  reject: (reason: unknown) => void
}

let failedQueue: FailedQueueItem[] = []

const processQueue = (error: unknown, token?: string) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token)
    }
  })

  failedQueue = []
}

const enqueueFailedRequest = () =>
  new Promise<string | undefined>((resolve, reject) => {
    failedQueue.push({ resolve, reject })
  })

// Request interceptor to add auth token and CSRF token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const method = (config.method || 'get').toLowerCase()
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      try {
        const currentToken = csrfToken || await ensureCsrfToken()
        if (currentToken) {
          if (!config.headers['X-CSRF-Token'] && !(config.headers as any)['x-csrf-token']) {
            ;(config.headers as any)['X-CSRF-Token'] = currentToken
          }
        }
      } catch {
        // Ignore CSRF retrieval errors; server will respond with 403 which we handle below
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for handling 401 errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const errorData = error.response.data as any

      if (errorData?.code === 'TOKEN_EXPIRED') {
        if (isRefreshing) {
          return enqueueFailedRequest()
            .then((token) => {
              if (token) {
                originalRequest.headers.Authorization = `Bearer ${token}`
              }
              return apiClient(originalRequest)
            })
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          const refreshToken = getRefreshToken()
          if (!refreshToken) {
            throw new Error('No refresh token available')
          }

          const response = await axios.post(`${AUTH_BASE}/auth/refresh-token`, { refreshToken }, { withCredentials: true })
          const { accessToken, refreshToken: newRefreshToken } = response.data as {
            accessToken: string
            refreshToken?: string
          }

          if (!accessToken) {
            throw new Error('Не удалось обновить токен доступа')
          }

          setAccessToken(accessToken)
          if (newRefreshToken) {
            setRefreshToken(newRefreshToken)
          }

          originalRequest.headers.Authorization = `Bearer ${accessToken}`

          processQueue(null, accessToken)

          return apiClient(originalRequest)
        } catch (refreshError) {
          processQueue(refreshError)
          handleAuthFailure()
          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      } else {
        handleAuthFailure()
      }
    }

    // Handle CSRF errors: refresh token and retry once
    if (
      error.response?.status === 403 &&
      !(originalRequest as any)._csrfRetry
    ) {
      const errorData = error.response.data as any
      const isCsrfIssue =
        errorData?.code === 'CSRF_TOKEN_MISSING' ||
        errorData?.code === 'CSRF_TOKEN_INVALID'

      if (isCsrfIssue) {
        try {
          ;(originalRequest as any)._csrfRetry = true
          csrfToken = null
          const newToken = await ensureCsrfToken()
          if (newToken) {
            originalRequest.headers = originalRequest.headers || {}
            originalRequest.headers['X-CSRF-Token'] = newToken
            return apiClient(originalRequest)
          }
        } catch (_csrfErr) {
          // fall through to default handler
        }
      }
    }

    handleErrorResponse(error)

    return Promise.reject(error)
  }
)

const handleErrorResponse = (error: AxiosError) => {
  if (error.response) {
    const status = error.response.status
    const errorData = error.response.data as any

    switch (status) {
      case 403:
        toast.error('У вас нет прав для выполнения этого действия')
        return
      case 404:
        toast.error('Запрашиваемый ресурс не найден')
        return
      case 429:
        toast.error('Слишком много запросов. Попробуйте позже')
        return
      case 500:
        toast.error('Внутренняя ошибка сервера')
        return
      case 502:
      case 503:
      case 504:
        toast.error('Сервер временно недоступен')
        return
      default:
        if (errorData?.message || errorData?.error) {
          toast.error(errorData.message || errorData.error)
        } else {
          toast.error(`Ошибка ${status}: ${error.message}`)
        }
        return
    }
  }

  if (error.request) {
    toast.error('Ошибка сети. Проверьте подключение к интернету')
    return
  }

  toast.error('Произошла неожиданная ошибка')
}

// Token management functions
const ACCESS_TOKEN_KEY = 'accessToken'
const LEGACY_ACCESS_TOKEN_KEY = 'authToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

function getAccessToken(): string | null {
  return (
    localStorage.getItem(ACCESS_TOKEN_KEY) ??
    localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)
  )
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
}

function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

function handleAuthFailure(): void {
  clearTokens()
  
  // Emit custom event for auth failure
  window.dispatchEvent(new CustomEvent('authFailure'))
  
  // Show notification
  toast.error('Сессия истекла. Необходимо войти в систему заново')
  
  // Redirect to login if not already there
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

// Utility functions for external use
export const tokenManager = {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
  
  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = getAccessToken()
    if (!token) return false
    
    // Basic token format validation
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return false
      
      // Check if token is expired
      const payload = JSON.parse(atob(parts[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      
      return payload.exp > currentTime
    } catch {
      return false
    }
  },
  
  // Get user info from token
  getUserFromToken(): any | null {
    const token = getAccessToken()
    if (!token) return null
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return {
        userId: payload.userId,
        telegramId: payload.telegramId,
        role: payload.role
      }
    } catch {
      return null
    }
  },
  
  // Setup tokens from login response
  setupTokens(accessToken: string, refreshToken: string): void {
    setAccessToken(accessToken)
    setRefreshToken(refreshToken)
  }
}

// Export commonly used HTTP methods
export const api = {
  get: (url: string, config?: any) => apiClient.get(url, config),
  post: (url: string, data?: any, config?: any) => apiClient.post(url, data, config),
  put: (url: string, data?: any, config?: any) => apiClient.put(url, data, config),
  patch: (url: string, data?: any, config?: any) => apiClient.patch(url, data, config),
  delete: (url: string, config?: any) => apiClient.delete(url, config),
}

export const unwrap = <T>(response: AxiosResponse<T>): T => response.data

export default apiClient
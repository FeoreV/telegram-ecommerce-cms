import { apiClient, unwrap } from './apiClient'
import { Store, ListResponse, ApiResponse } from '../types'

const cache = new Map<string, { value: unknown; expiresAt: number }>()

const cacheKey = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key

const getCached = <T>(key: string): T | undefined => {
  const entry = cache.get(key) as { value: T; expiresAt: number } | undefined
  if (!entry) return undefined

  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return undefined
  }

  return entry.value
}

const setCached = <T>(key: string, value: T, ttlMs: number) => {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

const clearCached = (prefix?: string) => {
  if (!prefix) {
    cache.clear()
    return
  }

  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

const cacheTtl = {
  stores: 30_000,
  store: 15_000,
}

const request = async <T>(config: {
  method: 'get' | 'post' | 'put' | 'delete'
  url: string
  params?: Record<string, unknown>
  data?: unknown
  cacheKey?: string
  cacheTtl?: number
  invalidate?: string[]
}): Promise<T> => {
  const key = config.cacheKey
  if (key) {
    const cached = getCached<T>(key)
    if (cached !== undefined) {
      return cached
    }
  }

  try {
    const response = await apiClient.request({
      method: config.method,
      url: config.url,
      params: config.params,
      data: config.data,
    })
    const result = unwrap<T>(response)

    if (key && config.cacheTtl) {
      setCached(key, result, config.cacheTtl)
    }

    if (config.invalidate?.length) {
      config.invalidate.forEach((prefix) => clearCached(typeof prefix === 'string' ? prefix : undefined))
    }

    return result
  } catch (error) {
    throw error
  }
}

export interface CreateStoreRequest {
  name: string
  description: string  // Required by backend
  slug: string
  status?: string
  currency: string
  domain?: string
  contactInfo?: any
  settings?: any
  logoUrl?: string
  bannerUrl?: string
}

export interface UpdateStoreRequest extends Partial<CreateStoreRequest> {
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  domain?: string
}

export interface StoreFilters {
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  search?: string
  page?: number
  limit?: number
}

const ALLOWED_CURRENCIES = ['USD', 'EUR', 'RUB', 'UAH'] as const
type AllowedCurrency = typeof ALLOWED_CURRENCIES[number]

const isPresent = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null && value !== ''

const buildRequestParams = (values: Record<string, string | number | undefined>) =>
  Object.entries(values).reduce<Record<string, string | number>>((acc, [key, value]) => {
    if (isPresent(value)) {
      acc[key] = typeof value === 'string' ? value.trim() : value
    }
    return acc
  }, {})

const normalizeSlug = (slug?: string) => slug?.trim().toLowerCase() ?? ''

const assertCurrency = (currency: string): AllowedCurrency => {
  const normalized = currency?.trim().toUpperCase()
  if (!ALLOWED_CURRENCIES.includes(normalized as AllowedCurrency)) {
    throw new Error(`Unsupported currency: ${normalized}. Allowed: ${ALLOWED_CURRENCIES.join(', ')}`)
  }
  return normalized as AllowedCurrency
}

const prepareStorePayload = <T extends Partial<CreateStoreRequest>>(input: T) => {
  const payload: Partial<CreateStoreRequest> = {}

  if ('name' in input) {
    payload.name = input.name?.trim()
  }

  if ('description' in input) {
    payload.description = input.description?.trim()
  }

  if ('slug' in input && typeof input.slug === 'string') {
    const normalized = normalizeSlug(input.slug)
    payload.slug = normalized || undefined
  }

  if ('status' in input) {
    payload.status = input.status
  }

  if ('currency' in input && input.currency) {
    payload.currency = assertCurrency(input.currency)
  }

  if ('domain' in input) {
    payload.domain = input.domain?.trim()
  }

  if ('contactInfo' in input) {
    payload.contactInfo = input.contactInfo
  }

  if ('settings' in input) {
    payload.settings = input.settings
  }

  if ('logoUrl' in input) {
    payload.logoUrl = input.logoUrl
  }

  if ('bannerUrl' in input) {
    payload.bannerUrl = input.bannerUrl
  }

  return payload as T
}

export const storeService = {
  // Получить список магазинов
  getStores: async (filters: StoreFilters = {}): Promise<ListResponse<Store>> => {
    const params = buildRequestParams({
      status: filters.status,
      search: filters.search,
      page: filters.page,
      limit: filters.limit,
    })

    return request<ListResponse<Store>>({
      method: 'get',
      url: '/stores',
      params,
      cacheKey: cacheKey('stores', params),
      cacheTtl: cacheTtl.stores,
    })
  },

  // Получить магазин по ID
  getStore: async (id: string): Promise<Store> => {
    const result = await request<{ store: Store }>({
      method: 'get',
      url: `/stores/${id}`,
      cacheKey: cacheKey('store', { id }),
      cacheTtl: cacheTtl.store,
    })
    return result.store
  },

  // Создать новый магазин
  createStore: async (data: CreateStoreRequest): Promise<Store> => {
    const normalized = prepareStorePayload({ ...data, currency: data.currency })

    if (!normalized.name || !normalized.description || !normalized.slug || !normalized.currency) {
      throw new Error('Name, description and slug are required')
    }

    const result = await request<{ store: Store }>({
      method: 'post',
      url: '/stores',
      data: normalized,
      invalidate: ['stores', 'store'],
    })
    return result.store
  },

  // Обновить магазин
  updateStore: async (id: string, data: UpdateStoreRequest): Promise<Store> => {
    const normalized = prepareStorePayload(data)
    const result = await request<{ store: Store }>({
      method: 'put',
      url: `/stores/${id}`,
      data: normalized,
      invalidate: ['stores', cacheKey('store', { id })],
    })
    return result.store
  },

  // Удалить магазин
  deleteStore: async (id: string): Promise<void> => {
    await request<void>({
      method: 'delete',
      url: `/stores/${id}`,
      invalidate: ['stores', cacheKey('store', { id })],
    })
  },

  // Получить статистику магазина
  getStoreStats: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/stores/${id}/stats`)
    return unwrap(response)
  },

  // Добавить администратора к магазину
  addStoreAdmin: async (storeId: string, userId: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.post(`/stores/${storeId}/admins`, { userId })
    return unwrap<ApiResponse<null>>(response)
  },

  // Удалить администратора из магазина
  removeStoreAdmin: async (storeId: string, userId: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete(`/stores/${storeId}/admins/${userId}`)
    return unwrap<ApiResponse<null>>(response)
  },

  // Проверить доступность slug
  checkSlugAvailability: async (slug: string, excludeId?: string): Promise<boolean> => {
    const normalizedSlug = normalizeSlug(slug)
    if (!normalizedSlug) {
      return false
    }

    const response = await apiClient.get(`/stores/check-slug/${normalizedSlug}`, {
      params: buildRequestParams({ excludeId }),
    })

    if (typeof response.data?.available === 'boolean') {
      return response.data.available
    }

    // fallback to backend returning 404/not found -> available
    return true
  },
}

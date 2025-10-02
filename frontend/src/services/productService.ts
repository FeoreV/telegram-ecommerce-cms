import { apiClient } from './apiClient'
import { Product, ProductVariant, Category, ListResponse } from '../types'

const buildSearchParams = (values: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  })
  return params
}

const unwrapProduct = (data: any): Product => {
  if (data?.product) {
    return data.product as Product
  }
  throw new Error('Unexpected product response shape')
}

const unwrapVariant = (data: any): ProductVariant => {
  if (data?.variant) {
    return data.variant as ProductVariant
  }
  throw new Error('Unexpected variant response shape')
}

const unwrapCategory = (data: any): Category => {
  if (data?.category) {
    return data.category as Category
  }
  throw new Error('Unexpected category response shape')
}

export interface CreateProductRequest {
  name: string
  description?: string
  sku?: string
  price: number
  stock: number
  storeId: string
  categoryId?: string
  images?: string[]
  isActive?: boolean
  variants?: CreateProductVariantRequest[]
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}

export interface CreateProductVariantRequest {
  name: string
  value: string
  price?: number
  stock?: number
  sku?: string
}

export interface ProductFilters {
  storeId?: string
  categoryId?: string
  isActive?: boolean
  search?: string
  page?: number
  limit?: number
  sortBy?: 'name' | 'price' | 'stock' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export const productService = {
  // Получить список товаров
  getProducts: async (filters: ProductFilters = {}): Promise<ListResponse<Product>> => {
    const params = buildSearchParams({
      storeId: filters.storeId,
      categoryId: filters.categoryId,
      isActive: filters.isActive,
      search: filters.search,
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })

    const response = await apiClient.get(`/products?${params.toString()}`)
    return response.data as ListResponse<Product>
  },

  // Получить товар по ID
  getProduct: async (id: string): Promise<Product> => {
    const response = await apiClient.get(`/products/${id}`)
    return unwrapProduct(response.data)
  },

  // Создать новый товар
  createProduct: async (data: CreateProductRequest): Promise<Product> => {
    const response = await apiClient.post('/products', data)
    return unwrapProduct(response.data)
  },

  // Обновить товар
  updateProduct: async (id: string, data: UpdateProductRequest): Promise<Product> => {
    const response = await apiClient.put(`/products/${id}`, data)
    return unwrapProduct(response.data)
  },

  // Удалить товар
  deleteProduct: async (id: string): Promise<void> => {
    await apiClient.delete(`/products/${id}`)
  },

  // Обновить количество на складе
  updateStock: async (id: string, stock: number): Promise<Product> => {
    const response = await apiClient.patch(`/products/${id}/stock`, { stock })
    return unwrapProduct(response.data)
  },

  // Активировать/деактивировать товар
  toggleActive: async (id: string): Promise<Product> => {
    const response = await apiClient.patch(`/products/${id}/toggle-active`)
    return unwrapProduct(response.data)
  },

  // Получить варианты товара
  getProductVariants: async (productId: string): Promise<ProductVariant[]> => {
    const response = await apiClient.get(`/products/${productId}/variants`)
    return Array.isArray(response.data?.variants) ? response.data.variants : []
  },

  // Добавить вариант товара
  addProductVariant: async (productId: string, data: CreateProductVariantRequest): Promise<ProductVariant> => {
    const response = await apiClient.post(`/products/${productId}/variants`, data)
    return unwrapVariant(response.data)
  },

  // Обновить вариант товара
  updateProductVariant: async (productId: string, variantId: string, data: Partial<CreateProductVariantRequest>): Promise<ProductVariant> => {
    const response = await apiClient.put(`/products/${productId}/variants/${variantId}`, data)
    return unwrapVariant(response.data)
  },

  // Удалить вариант товара
  deleteProductVariant: async (productId: string, variantId: string): Promise<void> => {
    await apiClient.delete(`/products/${productId}/variants/${variantId}`)
  },

  // Получить категории
  getCategories: async (): Promise<Category[]> => {
    const response = await apiClient.get('/products/categories')
    return Array.isArray(response.data?.categories) ? response.data.categories : []
  },

  // Создать категорию
  createCategory: async (data: { name: string; slug: string; parentId?: string }): Promise<Category> => {
    const response = await apiClient.post('/products/categories', data)
    return unwrapCategory(response.data)
  },

  // Загрузка изображения
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('image', file)

    const response = await apiClient.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    if (response.data?.url) {
      return response.data.url as string
    }
    throw new Error('Unexpected image upload response shape')
  },
}

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
  createdAt: string
}

export interface Store {
  id: string
  name: string
  description?: string
  slug: string
  currency: string
  domain?: string
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  contactInfo?: any
  settings?: any
  logoUrl?: string
  bannerUrl?: string
  owner: User
  admins: StoreAdmin[]
  _count: {
    products: number
    orders: number
  }
  createdAt: string
  updatedAt: string
}

export interface StoreAdmin {
  id: string
  user: User
}

export interface Product {
  id: string
  name: string
  description?: string
  sku?: string
  price: number
  stock: number
  isActive: boolean
  images: string[]
  store: Store
  category?: Category
  variants: ProductVariant[]
  _count: {
    orderItems: number
  }
  createdAt: string
  updatedAt: string
}

export interface ProductVariant {
  id: string
  name: string
  value: string
  price?: number
  stock?: number
  sku?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  parentId?: string
}

export interface Order {
  id: string
  orderNumber: string
  status: 'PENDING_ADMIN' | 'PAID' | 'REJECTED' | 'CANCELLED' | 'SHIPPED' | 'DELIVERED'
  totalAmount: number
  currency: string
  customerInfo: any
  notes?: string
  paidAt?: string
  rejectedAt?: string
  rejectionReason?: string
  paymentProof?: string
  trackingNumber?: string
  trackingUrl?: string
  shippedAt?: string
  deliveredAt?: string
  customer: User
  store: Store
  items: OrderItem[]
  adminLogs: AdminLog[]
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  quantity: number
  price: number
  product: Product
  variant?: ProductVariant
}

export interface AdminLog {
  id: string
  action: string
  details?: any
  admin: User
  order?: Order
  createdAt: string
}

export interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  recentPaidOrders: number
  totalRevenue: number
  activeStores: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListResponse<T> {
  items: T[]
  pagination: PaginationInfo
}

/**
 * @botrt/types
 * Общие TypeScript типы для всех приложений в монорепозитории
 */

// ============================================================================
// USER TYPES
// ============================================================================

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}

export interface User {
  id: number;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  phoneNumber?: string;
  email?: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// STORE TYPES
// ============================================================================

export interface Store {
  id: number;
  name: string;
  description?: string;
  ownerId: number;
  botToken?: string;
  botUsername?: string;
  isActive: boolean;
  currency: string;
  settings?: StoreSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreSettings {
  paymentMethods?: string[];
  shippingMethods?: string[];
  taxRate?: number;
  notificationSettings?: NotificationSettings;
  [key: string]: any;
}

export interface NotificationSettings {
  email?: boolean;
  telegram?: boolean;
  sms?: boolean;
}

// ============================================================================
// PRODUCT TYPES
// ============================================================================

export interface Product {
  id: number;
  storeId: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  categoryId?: number;
  images?: string[];
  isActive: boolean;
  sku?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: number;
  productId: number;
  name: string;
  price: number;
  stock: number;
  sku?: string;
  attributes?: Record<string, any>;
}

// ============================================================================
// ORDER TYPES
// ============================================================================

export enum OrderStatus {
  PENDING = 'PENDING',
  PENDING_ADMIN = 'PENDING_ADMIN',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface Order {
  id: number;
  storeId: number;
  userId: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  items: OrderItem[];
  shippingAddress?: string;
  paymentProof?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  variantId?: number;
  quantity: number;
  price: number;
  subtotal: number;
}

// ============================================================================
// CART TYPES
// ============================================================================

export interface CartItem {
  productId: number;
  variantId?: number;
  quantity: number;
  price: number;
  product?: Product;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
  totalItems: number;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationChannel {
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
  SOCKET = 'SOCKET',
  SMS = 'SMS',
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  channel: NotificationChannel;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  details?: any;
}

// ============================================================================
// TELEGRAM TYPES
// ============================================================================

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: any[];
  document?: any;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface SalesAnalytics {
  period: string;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: number;
    name: string;
    sales: number;
    quantity: number;
  }>;
}

export interface StoreMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  conversionRate: number;
  averageOrderValue: number;
  topSellingProducts: Product[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type ID = number | string;


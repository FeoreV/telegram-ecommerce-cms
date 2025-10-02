export interface ApiPagination {
  page: number;
  limit?: number;
  total?: number;
  totalPages: number;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  user: {
    id: string;
    telegramId: string | null;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role: string;
    profilePhoto?: string | null;
    lastLoginAt?: string | null;
  };
  sessionId?: string | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  paidAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  customerInfo?: {
    name?: string;
    phone?: string;
    address?: string;
  } | null;
  customer?: {
    firstName?: string;
    lastName?: string;
    username?: string;
  };
  store?: {
    id: string;
    name: string;
  };
  paymentProof?: string | null;
}

export interface OrdersListResponse {
  success?: boolean;
  orders?: OrderSummary[];
  pagination?: ApiPagination;
}

export interface OrderResponse {
  success?: boolean;
  order: OrderSummary;
  totalAmount?: number;
  orderNumber?: string;
  id?: string;
  items?: OrderItemSummary[];
}

export interface OrderItemSummary {
  id: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
  };
  variant?: {
    id: string;
    name: string;
    value: string;
  } | null;
}

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  currency: string;
  status?: string;
  description?: string;
  ownerId?: string;
  botUsername?: string | null;
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  } | null;
  _count?: {
    products?: number;
    orders?: number;
  };
}

export interface StoresListResponse {
  stores?: StoreSummary[];
  items?: StoreSummary[];
  pagination?: ApiPagination;
}

export interface StoreResponse {
  success?: boolean;
  store: StoreSummary;
}

export interface SlugAvailabilityResponse {
  available: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  value: string;
  price?: number;
  stock?: number;
}

export interface ProductSummary {
  id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  description?: string;
  sku?: string;
  images?: string[];
  store: {
    id: string;
    name: string;
    currency: string;
  };
  variants?: ProductVariant[];
}

export interface ProductsListResponse {
  products?: ProductSummary[];
  items?: ProductSummary[];
  pagination?: ApiPagination;
}

export interface ProductResponse {
  success?: boolean;
  product: ProductSummary;
}

export interface DashboardAnalyticsResponse {
  success: boolean;
  data: {
    totalRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    averageOrderValue: number;
    revenueGrowth: number;
    ordersGrowth: number;
    topProducts?: Array<{ name: string; totalSales: number }>;
    recentOrders?: Array<{
      id: string;
      orderNumber: string;
      totalAmount: number;
      currency: string;
      status: string;
      createdAt: string;
    }>;
    statusDistribution?: Array<{ status: string; count: number }>;
    storePerformance?: Array<{
      storeId: string;
      storeName: string;
      revenue: number;
      totalOrders: number;
    }>;
  };
  period: string;
  storeId: string | null;
  timestamp: string;
}

export interface InventoryAlertSummary {
  id: string;
  severity: string;
  product: {
    id: string;
    name: string;
    stock: number;
  };
  store: {
    id: string;
    name: string;
  };
  recentSales?: number;
}

export interface InventoryAlertsResponse {
  success: boolean;
  alerts: InventoryAlertSummary[];
  summary: {
    total: number;
    critical: number;
    high?: number;
    medium?: number;
  };
}

export interface DashboardStatsResponse {
  stats: {
    totalOrders: number;
    pendingOrders: number;
    recentPaidOrders: number;
    totalRevenue: number;
    activeStores: number;
  };
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    currency: string;
    createdAt: string;
    customer?: {
      firstName?: string | null;
      lastName?: string | null;
      username?: string | null;
    };
    store?: {
      name: string;
    };
  }>;
}

export interface BotsListResponse {
  bots: BotSummary[];
  stats?: {
    totalBots: number;
    activeBots: number;
  };
}

export interface BotSummary {
  storeId: string;
  storeName: string;
  storeSlug: string;
  botUsername: string | null;
  botStatus: string | null;
  botCreatedAt: string | null;
  botLastActive: string | null;
  hasToken: boolean;
  isActive: boolean;
  messageCount: number;
  lastActivity: string | null;
  orderCount: number;
  productCount: number;
}

export interface BotResponse {
  success: boolean;
  bot: BotSummary;
}

export interface BotStatsResponse {
  success: boolean;
  stats: {
    totalUsers: number;
    activeUsers: number;
    messagesSent: number;
  };
}

export interface BotSettingsResponse {
  success: boolean;
  settings: Record<string, unknown>;
}

export interface IntegrationMappingResponse {
  mapping?: {
    localId?: string;
    externalId?: string;
    source?: string;
    entityType?: string;
  };
}


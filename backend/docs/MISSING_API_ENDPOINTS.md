# Missing API Endpoints

This document lists API endpoints that need to be implemented on the backend to fully support the frontend features.

## Priority 1 - Critical for Core Functionality

### Inventory Management

#### GET `/api/inventory/alerts`
**Purpose**: Get inventory alerts for low stock and out-of-stock products
**Query Parameters**:
- `storeId` (optional): Filter by store
- `severity` (optional): Filter by severity (critical, high, medium, low)
- `type` (optional): Filter by type (OUT_OF_STOCK, LOW_STOCK, REORDER_POINT)
- `search` (optional): Search products

**Response**:
```json
{
  "alerts": [
    {
      "id": "string",
      "productId": "string",
      "variantId": "string",
      "productName": "string",
      "variantName": "string",
      "currentStock": 0,
      "threshold": 10,
      "severity": "critical",
      "type": "LOW_STOCK",
      "storeId": "string",
      "storeName": "string",
      "lastUpdated": "2025-01-01T00:00:00Z"
    }
  ],
  "summary": {
    "total": 0,
    "critical": 0,
    "high": 0,
    "medium": 0,
    "outOfStock": 0,
    "lowStock": 0
  }
}
```

#### POST `/api/inventory/update-stock`
**Purpose**: Update stock levels for a product variant
**Request Body**:
```json
{
  "variantId": "string",
  "quantity": 100,
  "reason": "string",
  "notes": "string"
}
```

#### PUT `/api/inventory/alerts-config/:storeId`
**Purpose**: Configure stock alert thresholds
**Request Body**:
```json
{
  "lowStockThreshold": 10,
  "criticalStockThreshold": 5,
  "enableEmailAlerts": true,
  "enableTelegramAlerts": true
}
```

#### GET `/api/inventory/alerts-config/:storeId`
**Purpose**: Get stock alerts configuration

### User Management

#### GET `/api/users/search`
**Purpose**: Search users for adding as store admins
**Query Parameters**:
- `search`: Search term (name, username, email)
- `role` (optional): Filter by role
- `isActive` (optional): Filter by active status
- `limit` (default: 10)
- `page` (default: 1)

**Response**:
```json
{
  "users": [
    {
      "id": "string",
      "telegramId": "string",
      "firstName": "string",
      "lastName": "string",
      "username": "string",
      "email": "string",
      "phone": "string",
      "role": "VENDOR",
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Order Statistics Enhancement

#### Enhancement needed for GET `/api/orders/stats`
**Current**: Returns basic aggregated statistics
**Need to add**:
- `dailyData`: Array of daily breakdown with orders and revenue
- `ordersChange`: Percentage change from previous period
- `revenueChange`: Percentage change from previous period
- `aovChange`: Average order value change
- `conversionChange`: Conversion rate change

**Enhanced Response**:
```json
{
  "totalOrders": 100,
  "totalRevenue": 50000,
  "averageOrderValue": 500,
  "conversionRate": 3.5,
  "statusCounts": {
    "PENDING_ADMIN": 10,
    "PAID": 80,
    "REJECTED": 5,
    "CANCELLED": 5
  },
  "topProducts": [...],
  "storeStats": [...],
  "dailyData": {
    "orders": [
      { "date": "01.01", "orders": 10, "fullDate": "01 января 2025" }
    ],
    "revenue": [
      { "date": "01.01", "revenue": 5000, "fullDate": "01 января 2025" }
    ]
  },
  "ordersChange": 12.5,
  "revenueChange": 15.3,
  "aovChange": 2.1,
  "conversionChange": -0.5
}
```

## Priority 2 - Nice to Have

### Notifications

#### GET `/api/notifications`
**Purpose**: Get user notifications
**Query Parameters**:
- `unread` (optional): Filter unread notifications
- `type` (optional): Filter by type (order, inventory, system, revenue, user)
- `limit` (default: 20)
- `page` (default: 1)

**Response**:
```json
{
  "notifications": [
    {
      "id": "string",
      "type": "order",
      "title": "string",
      "message": "string",
      "timestamp": "2025-01-01T00:00:00Z",
      "read": false,
      "priority": "high"
    }
  ],
  "unreadCount": 5
}
```

#### POST `/api/notifications/:id/read`
**Purpose**: Mark notification as read

#### POST `/api/notifications/mark-all-read`
**Purpose**: Mark all notifications as read

### Order Notes

#### GET `/api/orders/:orderId/notes`
**Purpose**: Get notes for an order
**Note**: Currently notes are embedded in order object, may need separate endpoint

#### DELETE `/api/orders/:orderId/notes/:noteId`
**Purpose**: Delete a note from an order

#### PUT `/api/orders/:orderId/notes/:noteId`
**Purpose**: Update an existing note

### Dashboard Metrics Enhancement

#### Enhancement needed for GET `/api/dashboard/stats`
**Need to add**:
- `newCustomers`: Number of new customers in period
- `returningCustomers`: Number of returning customers
- `totalCustomers`: Total customers
- `averageLifetimeValue`: Customer lifetime value
- `customerRetention`: Retention rate percentage
- `customerAcquisitionCost`: CAC metric

## Implementation Notes

1. **Authentication**: All endpoints should require authentication and respect role-based access control
2. **Store Isolation**: Multi-tenant endpoints should filter data by user's accessible stores
3. **Real-time Updates**: Consider WebSocket events for inventory alerts and notifications
4. **Caching**: Implement caching for frequently accessed data (stats, configurations)
5. **Rate Limiting**: Add rate limiting to prevent abuse
6. **Error Handling**: Return consistent error responses with proper HTTP status codes

## Testing Checklist

- [ ] Inventory alerts generation based on stock levels
- [ ] Stock update with transaction logging
- [ ] User search with proper filtering
- [ ] Enhanced order statistics with period comparison
- [ ] Notification system with real-time delivery
- [ ] Role-based access control for all endpoints
- [ ] Multi-tenant data isolation


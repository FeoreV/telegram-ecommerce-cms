# Configuration API Examples

## Currency Configuration

### Get Supported Currencies

```bash
GET /api/config/currencies
```

Response:
```json
{
  "success": true,
  "currencies": [
    {
      "code": "USD",
      "name": "US Dollar", 
      "symbol": "$",
      "decimals": 2
    },
    {
      "code": "EUR",
      "name": "Euro",
      "symbol": "€", 
      "decimals": 2
    }
  ]
}
```

### Get Currency Configuration

```bash
GET /api/config/currencies/USD
```

Response:
```json
{
  "success": true,
  "currency": {
    "code": "USD",
    "symbol": "$",
    "name": "US Dollar",
    "decimals": 2,
    "position": "before",
    "thousandsSeparator": ",",
    "decimalSeparator": ".",
    "locale": "en-US"
  }
}
```

### Format Currency

```bash
POST /api/config/currencies/USD/format
Content-Type: application/json

{
  "amount": 1234.56,
  "showDecimals": true,
  "useLocale": true
}
```

Response:
```json
{
  "success": true,
  "formatted": "$1,234.56",
  "displayFormatted": "$1,234.56",
  "amount": 1234.56,
  "currency": "USD"
}
```

## Inventory Configuration

### Get Store Inventory Config

```bash
GET /api/config/inventory/stores/store_123
```

Response:
```json
{
  "success": true,
  "config": {
    "storeId": "store_123",
    "enableStockAlerts": true,
    "enableAutoReorder": false,
    "thresholds": {
      "criticalStock": 5,
      "lowStock": 25,
      "reorderPoint": 50,
      "maxStock": 5000,
      "safetyStock": 20
    },
    "alertChannels": ["socket", "telegram"],
    "alertRecipients": [],
    "alertFrequency": "immediate",
    "currency": "USD",
    "timezone": "UTC"
  }
}
```

### Update Store Inventory Config

```bash
PUT /api/config/inventory/stores/store_123
Content-Type: application/json

{
  "enableStockAlerts": true,
  "thresholds": {
    "criticalStock": 3,
    "lowStock": 15,
    "reorderPoint": 30
  },
  "alertChannels": ["socket", "telegram", "email"],
  "currency": "EUR"
}
```

### Get Effective Thresholds for Product

```bash
GET /api/config/inventory/thresholds/store_123/product_456?variantId=variant_789
```

Response:
```json
{
  "success": true,
  "thresholds": {
    "criticalStock": 3,
    "lowStock": 15, 
    "reorderPoint": 30,
    "maxStock": 1000,
    "safetyStock": 10
  },
  "storeId": "store_123",
  "productId": "product_456",
  "variantId": "variant_789"
}
```

### Get Inventory Health Score

```bash
GET /api/config/inventory/health/store_123/product_456
```

Response:
```json
{
  "success": true,
  "healthData": {
    "productId": "product_456",
    "variantId": null,
    "currentStock": 45,
    "healthScore": 75,
    "severity": "MEDIUM",
    "salesVelocity": 2.3,
    "daysInStock": 20,
    "reorderQuantity": 15,
    "thresholds": {
      "criticalStock": 5,
      "lowStock": 25,
      "reorderPoint": 50,
      "safetyStock": 20
    },
    "recommendations": {
      "action": "normal_monitoring",
      "message": "Normal monitoring required"
    }
  }
}
```

### Get Default Threshold Templates

```bash
GET /api/config/inventory/templates
```

Response:
```json
{
  "success": true,
  "templates": {
    "small": {
      "criticalStock": 2,
      "lowStock": 10,
      "reorderPoint": 15,
      "maxStock": 1000,
      "safetyStock": 5
    },
    "medium": {
      "criticalStock": 5,
      "lowStock": 25, 
      "reorderPoint": 50,
      "maxStock": 5000,
      "safetyStock": 20
    }
  },
  "description": {
    "small": "For small stores with limited inventory (< 100 products)",
    "medium": "For medium stores with moderate inventory (100-1000 products)"
  }
}
```

## Security Configuration Status

### Get Security Status

```bash
GET /api/security/status
```

Response:
```json
{
  "security": {
    "suspiciousIPs": 0,
    "blockedIPs": 0,
    "redisConnected": true,
    "environment": "development",
    "corsOriginsConfigured": true,
    "adminIPWhitelistConfigured": false,
    "httpsEnabled": false
  },
  "timestamp": "2025-09-23T10:30:00.000Z"
}
```

## Environment Configuration

Configuration can be set via environment variables:

### Currency Settings
- `DEFAULT_CURRENCY=USD` - Default store currency
- `SUPPORTED_CURRENCIES=USD,EUR,RUB,UAH` - Comma-separated list

### Inventory Settings
- `DEFAULT_LOW_STOCK_THRESHOLD=10` - Default low stock threshold
- `DEFAULT_CRITICAL_STOCK_THRESHOLD=5` - Default critical stock threshold
- `DEFAULT_REORDER_POINT=20` - Default reorder point

### Security Settings
- `CORS_WHITELIST=https://mystore.com,https://admin.mystore.com`
- `ADMIN_IP_WHITELIST=192.168.1.100,10.0.0.0/24`
- `ENABLE_SECURITY_HEADERS=true`
- `ENABLE_BRUTE_FORCE_PROTECTION=true`

### Rate Limiting
- `RATE_LIMIT_MAX=100` - General requests per 15 minutes
- `AUTH_RATE_LIMIT_MAX=5` - Auth attempts per 15 minutes  
- `UPLOAD_RATE_LIMIT_MAX=10` - File uploads per minute
- `API_RATE_LIMIT_MAX=200` - API requests per 15 minutes
- `ADMIN_RATE_LIMIT_MAX=50` - Admin requests per 15 minutes

## JWT Configuration

- `JWT_SECRET` - Access token secret (32+ characters)
- `JWT_REFRESH_SECRET` - Refresh token secret
- `JWT_ACCESS_EXPIRY=15m` - Access token expiry
- `JWT_REFRESH_EXPIRY=7d` - Refresh token expiry
- `JWT_CLOCK_SKEW=30` - Clock skew tolerance in seconds
- `JWT_ISSUER=telegram-store-api` - Token issuer
- `JWT_AUDIENCE=telegram-store-users` - Token audience

## Logging Configuration

- `LOG_LEVEL=info` - Log level (error, warn, info, debug, etc.)
- `LOG_FILE_MAX_SIZE=20m` - Maximum log file size
- `LOG_FILE_MAX_FILES=14d` - Log file retention period

## Redis Configuration

- `REDIS_URL=redis://82.147.84.78:6379` - Redis connection URL
- Used for: session storage, rate limiting, token blacklist, caching

## SSL/HTTPS Configuration

- `USE_HTTPS=true` - Enable HTTPS
- `SSL_KEY_PATH=/path/to/private-key.pem` - SSL private key
- `SSL_CERT_PATH=/path/to/certificate.pem` - SSL certificate

## Notification Configuration

- `EMAIL_HOST=smtp.gmail.com` - Email server host
- `EMAIL_USER=notifications@mystore.com` - Email username
- `EMAIL_PASS=password` - Email password
- `TELEGRAM_WEBHOOK_URL=https://mystore.com/webhook/telegram` - Telegram webhook

## Production Security Checklist

✅ **Completed in this update:**
- [x] Enhanced CORS configuration with production whitelist
- [x] Rate limiting profiles (global, auth, API, admin, upload)  
- [x] Helmet security headers configuration
- [x] JWT with TTL, invalidation, and Redis blacklist
- [x] Enhanced environment validation
- [x] IP reputation tracking and blocking
- [x] Request sanitization and security monitoring
- [x] Currency formatting and inventory thresholds

⚠️ **Still needed for production:**
- [ ] Real SSL certificates configuration
- [ ] External Redis for production
- [ ] Real exchange rate API integration
- [ ] Email notification service setup
- [ ] Telegram webhook configuration
- [ ] Database migration to MySQL/PostgreSQL
- [ ] CI/CD pipeline setup
- [ ] Monitoring and alerting setup

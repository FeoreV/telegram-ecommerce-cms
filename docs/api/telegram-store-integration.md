# Telegram Store Integration Guide

## Полное руководство по интеграции Telegram бота с системой электронной коммерции

### 📋 Содержание
1. [Архитектура интеграции](#архитектура-интеграции)
2. [Создание магазина через бота](#создание-магазина-через-бота)
3. [Управление товарами](#управление-товарами)
4. [Система заказов](#система-заказов)
5. [Обработка платежей](#обработка-платежей)
6. [Уведомления и статусы](#уведомления-и-статусы)
7. [API интеграция](#api-интеграция)
8. [Безопасность и роли](#безопасность-и-роли)

---

## 🏗️ Архитектура интеграции

### Компоненты системы

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Telegram      │    │   Backend API    │    │   Frontend      │
│   Bot           │◄──►│                  │◄──►│   Admin Panel   │
│                 │    │   - Store Mgmt   │    │                 │
│   - Store Setup │    │   - Order Proc   │    │   - Analytics   │
│   - Shopping    │    │   - Payment Ver  │    │   - Management  │
│   - Payments    │    │   - Notifications│    │   - Reports     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │              ┌─────────▼──────────┐             │
         │              │     Database       │             │
         └──────────────►│                   │◄────────────┘
                        │  - Users/Stores    │
                        │  - Products/Orders │
                        │  - Payments        │
                        └────────────────────┘
```

### Ключевые возможности

#### 🏪 **Store Management**
- Создание магазина через Telegram
- Настройка валют и налогов
- Управление ассортиментом
- Аналитика продаж

#### 🛒 **Shopping Experience**
- Каталог товаров в Telegram
- Корзина покупок
- Вариации товаров (размеры, цвета)
- Поиск и фильтрация

#### 💰 **Payment Processing**
- Загрузка чеков оплаты
- Ручная верификация админом
- Поддержка множественных валют
- Уведомления о статусах

#### 📊 **Analytics & Reporting**
- KPI дашборд
- Отчеты по продажам
- Инвентарь и остатки
- Клиентская аналитика

---

## 🏪 Создание магазина через бота

### Пошаговый процесс создания

#### 1. Инициация создания магазина
```
Пользователь: /create_store
Бот: 🏪 Создание нового магазина
     Шаг 1/5: Как назовем ваш магазин?
```

#### 2. Сбор основной информации
```javascript
// Диалог создания магазина
const storeCreationSteps = [
  {
    step: 1,
    field: 'name',
    question: '🏪 Как назовем ваш магазин?',
    validation: (text) => text.length >= 3 && text.length <= 50
  },
  {
    step: 2, 
    field: 'description',
    question: '📝 Опишите ваш магазин (что продаете?)',
    validation: (text) => text.length >= 10 && text.length <= 500
  },
  {
    step: 3,
    field: 'slug',
    question: '🔗 URL адрес магазина (например: my-awesome-store)',
    validation: (text) => /^[a-z0-9-]+$/.test(text)
  },
  {
    step: 4,
    field: 'currency',
    question: '💰 Выберите валюту:',
    options: ['USD', 'EUR', 'RUB', 'UAH']
  },
  {
    step: 5,
    field: 'contacts',
    question: '📞 Укажите контакты (телефон, email)',
    validation: (text) => text.length >= 5
  }
];
```

#### 3. Завершение создания
```
Бот: ✅ Магазин "My Store" успешно создан!
     
     🔗 Ссылка: https://bot.t.me/store_my-awesome-store
     💰 Валюта: USD
     👤 Роль: Владелец
     
     Что делаем дальше?
     📦 Добавить товары
     ⚙️ Настройки
     📊 Статистика
```

### Валидация и проверки

- **Уникальность slug:** Проверка что URL уже не занят
- **Права доступа:** Лимит магазинов на пользователя  
- **Антидублирование:** Предотвращение создания копий
- **Санитизация данных:** Очистка от вредоносного контента

---

## 📦 Управление товарами

### Добавление товаров

#### Простое добавление товара
```
Пользователь: /add_product
Бот: 📦 Добавление товара
     Отправьте фото товара или нажмите "Пропустить"
     
Пользователь: [отправляет фото]
Бот: 📝 Название товара?

Пользователь: iPhone 15 Pro
Бот: 💰 Цена в USD?

Пользователь: 999
Бот: 📄 Описание товара (опционально)?

Пользователь: Новый iPhone с тремя камерами
Бот: ✅ Товар добавлен! 
     Хотите добавить варианты (размеры/цвета)?
```

#### Управление вариациями товара
```javascript
// Пример структуры товара с вариациями
{
  "productId": "prod_123",
  "name": "iPhone 15 Pro",
  "price": 999,
  "currency": "USD",
  "variants": [
    {
      "id": "var_1",
      "name": "Цвет",
      "value": "Space Black",
      "priceModifier": 0,
      "stock": 15
    },
    {
      "id": "var_2", 
      "name": "Цвет",
      "value": "Natural Titanium",
      "priceModifier": 0,
      "stock": 8
    },
    {
      "id": "var_3",
      "name": "Память",
      "value": "512GB", 
      "priceModifier": 200,
      "stock": 5
    }
  ]
}
```

### Каталог товаров в Telegram

#### Просмотр каталога
```
Пользователь: /catalog @my_store_bot
Бот: 🛍️ Каталог магазина "My Store"
     
     📱 Электроника (12 товаров)
     👕 Одежда (8 товаров)  
     🏠 Дом и сад (15 товаров)
     
     🔍 Поиск  |  🛒 Корзина (3)
```

#### Карточка товара
```
Бот: 📱 iPhone 15 Pro - $999
     
     [📸 Фото товара]
     
     📄 Новый iPhone с тремя камерами
     
     🎨 Цвет:
     ⚫ Space Black  ⚪ Natural Titanium
     
     💾 Память:  
     📦 128GB (+$0)  📦 512GB (+$200)
     
     📦 В наличии: 15 шт.
     
     [🛒 В корзину]  [❤️ В избранное]
```

---

## 🛒 Система заказов

### Процесс оформления заказа

#### 1. Корзина покупок
```
Пользователь: /cart
Бот: 🛒 Ваша корзина (3 товара)
     
     📱 iPhone 15 Pro (Space Black, 128GB)
     💰 $999 × 1 = $999
     
     👕 T-Shirt (L, Blue) 
     💰 $25 × 2 = $50
     
     📦 Итого: $1,049
     🚚 Доставка: $15
     💵 К оплате: $1,064
     
     [✅ Оформить заказ]  [🗑️ Очистить]
```

#### 2. Подтверждение заказа
```javascript
// Процесс создания заказа
const orderCreation = {
  steps: [
    'validate_cart',      // Проверка наличия товаров
    'calculate_total',    // Расчет итоговой суммы
    'reserve_stock',      // Резервирование товаров
    'create_order',       // Создание заказа в БД
    'send_payment_info'   // Отправка реквизитов оплаты
  ]
}
```

#### 3. Информация для оплаты
```
Бот: 🎉 Заказ #12345 создан!
     
     💰 Сумма к оплате: $1,064
     
     💳 Способы оплаты:
     - Перевод на карту: 4111 **** **** 1234
     - PayPal: store@example.com
     - Криптовалюта: bc1q...xyz
     
     📸 После оплаты отправьте чек командой:
     /payment_proof 12345
     
     ⏰ Заказ ожидает оплаты 24 часа
```

### Состояния заказа

```javascript
// Жизненный цикл заказа
const orderStates = {
  'PENDING_ADMIN': {
    description: 'Ожидает подтверждения администратора',
    actions: ['confirm_payment', 'reject_order'],
    notifications: ['admin_new_order']
  },
  'PAID': {
    description: 'Оплачен, готов к отправке',
    actions: ['ship_order', 'cancel_order'],  
    notifications: ['customer_payment_confirmed']
  },
  'SHIPPED': {
    description: 'Отправлен',
    actions: ['deliver_order'],
    notifications: ['customer_shipped', 'tracking_info']
  },
  'DELIVERED': {
    description: 'Доставлен',
    actions: [],
    notifications: ['customer_delivered', 'request_review']
  },
  'CANCELLED': {
    description: 'Отменен',
    actions: [],
    notifications: ['customer_cancelled', 'refund_issued']
  },
  'REJECTED': {
    description: 'Отклонен (неверная оплата)',
    actions: ['retry_payment'],
    notifications: ['customer_rejected']
  }
};
```

---

## 💰 Обработка платежей

### Загрузка чека оплаты

#### Команда загрузки
```
Пользователь: /payment_proof 12345
Бот: 📸 Загрузите чек об оплате заказа #12345
     
     Принимаются:
     • Скриншоты переводов
     • Фото банковских чеков  
     • PDF документы
     
     Максимальный размер: 10MB
```

#### Обработка загруженного файла
```javascript
// Валидация загруженного чека
const paymentProofValidation = {
  formats: ['jpg', 'png', 'pdf', 'heic'],
  maxSize: 10 * 1024 * 1024, // 10MB
  checks: [
    'virus_scan',
    'format_validation', 
    'size_validation',
    'order_association'
  ]
};

// Сохранение чека
const savePaymentProof = async (orderId, fileBuffer, fileInfo) => {
  const filename = `payment_${orderId}_${Date.now()}.${fileInfo.extension}`;
  const path = `uploads/payment-proofs/${filename}`;
  
  await fs.writeFile(path, fileBuffer);
  
  // Обновление заказа
  await updateOrder(orderId, {
    paymentProof: filename,
    paymentProofUploadedAt: new Date(),
    status: 'PENDING_ADMIN'
  });
};
```

### Верификация админом

#### Уведомление админа
```
Админ получает уведомление:
🔔 Новая оплата требует проверки
   
   📋 Заказ: #12345
   💰 Сумма: $1,064
   👤 Клиент: @username
   📸 Чек: [Просмотреть]
   
   [✅ Подтвердить]  [❌ Отклонить]
```

#### Интерфейс верификации
```javascript
// Админские команды для верификации
const adminCommands = {
  confirm_payment: async (orderId, adminId, reason) => {
    await updateOrderStatus(orderId, 'PAID', {
      verifiedBy: adminId,
      verificationReason: reason,
      verifiedAt: new Date()
    });
    
    // Уведомить клиента
    await notifyCustomer(orderId, 'payment_confirmed');
    
    // Уведомить админов о необходимости отправки
    await notifyAdmins(orderId, 'ready_to_ship');
  },
  
  reject_payment: async (orderId, adminId, reason) => {
    await updateOrderStatus(orderId, 'REJECTED', {
      rejectedBy: adminId, 
      rejectionReason: reason,
      rejectedAt: new Date()
    });
    
    // Восстановить товары в наличии
    await restoreStockForOrder(orderId);
    
    // Уведомить клиента
    await notifyCustomer(orderId, 'payment_rejected', { reason });
  }
};
```

---

## 🔔 Уведомления и статусы

### Система уведомлений

#### Каналы доставки
```javascript
const notificationChannels = {
  TELEGRAM: {
    priority: 'HIGH',
    realtime: true,
    fallback: 'EMAIL'
  },
  EMAIL: {
    priority: 'MEDIUM', 
    batch: true,
    templates: 'rich_html'
  },
  PUSH: {
    priority: 'LOW',
    mobile: true,
    silent: false
  },
  SOCKET: {
    priority: 'CRITICAL',
    realtime: true,
    admin_only: true
  }
};
```

#### Типы уведомлений для клиентов

**Создание заказа:**
```
🎉 Заказ #12345 создан!
💰 Сумма: $1,064
📸 Загрузите чек: /payment_proof 12345
⏰ Ожидаем оплату до: 24.09.2025 18:00
```

**Подтверждение оплаты:**
```
✅ Оплата подтверждена!
📋 Заказ #12345 принят в работу
📦 Подготовим к отправке в течение 1-2 дней
🔔 Уведомим о отправке
```

**Отправка заказа:**
```
🚚 Заказ #12345 отправлен!
📦 Трек номер: 1234567890
🔗 Отслеживание: track.post.ru/1234567890
📅 Ожидаемая доставка: 26-28.09.2025
```

**Доставка заказа:**
```
🎉 Заказ #12345 доставлен!
📦 Посылка получена
⭐ Оцените качество товаров и сервиса:
[⭐⭐⭐⭐⭐] Отлично!
```

#### Уведомления для админов

**Новый заказ:**
```
🔔 НОВЫЙ ЗАКАЗ #12345

👤 Клиент: @username (ID: 123456789)
💰 Сумма: $1,064
📱 Товары:
   • iPhone 15 Pro × 1
   • T-Shirt × 2
   
🏪 Магазин: My Store
⏰ Время: 23.09.2025 15:30

[📸 Чек загружен] [⚡ Обработать]
```

**Критический остаток товара:**
```
⚠️ НИЗКИЙ ОСТАТОК!

📦 iPhone 15 Pro (Space Black)
📊 Остаток: 2 шт. (критично!)
📈 Продано за неделю: 15 шт.
📅 Закончится через: ~1 день

🏪 Магазин: My Store
⚡ Требуется пополнение
```

### Настройка уведомлений

```javascript
// Персонализация уведомлений
const notificationSettings = {
  customer: {
    order_updates: true,
    promotional: false,
    inventory: false,
    language: 'ru'
  },
  store_admin: {
    new_orders: true,
    payment_alerts: true, 
    inventory_alerts: true,
    customer_messages: true,
    quiet_hours: '22:00-08:00'
  },
  store_owner: {
    all_notifications: true,
    financial_reports: 'daily',
    performance_alerts: true,
    security_alerts: true
  }
};
```

---

## 🔗 API интеграция

### Customer Notification API

#### Отправка уведомления клиенту
```http
POST /api/notify-customer
Content-Type: application/json
Authorization: Bearer your_api_token

{
  "telegramId": 123456789,
  "type": "order_status_changed",
  "orderData": {
    "orderId": "12345", 
    "status": "SHIPPED",
    "trackingNumber": "1234567890",
    "estimatedDelivery": "2025-09-28"
  },
  "customMessage": "Ваш заказ отправлен!"
}
```

#### Ответ API
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "telegramId": 123456789,
  "type": "order_status_changed",
  "timestamp": "2025-09-23T15:30:00.000Z"
}
```

### Store Management API

#### Получение статистики магазина
```http
GET /api/stores/store_123/stats
Authorization: Bearer your_api_token

Response:
{
  "storeId": "store_123",
  "period": "last_30_days",
  "metrics": {
    "totalOrders": 145,
    "totalRevenue": 15678.50,
    "averageOrderValue": 108.12,
    "conversionRate": 3.2,
    "topProducts": [
      {"name": "iPhone 15 Pro", "sold": 15, "revenue": 14985.00}
    ],
    "ordersByStatus": {
      "delivered": 120,
      "shipped": 15, 
      "paid": 8,
      "pending": 2
    }
  }
}
```

#### Создание товара через API
```http
POST /api/stores/store_123/products
Authorization: Bearer your_api_token
Content-Type: application/json

{
  "name": "iPhone 15 Pro",
  "description": "Latest iPhone with three cameras",
  "price": 999.00,
  "currency": "USD",
  "category": "electronics",
  "stock": 15,
  "variants": [
    {
      "name": "Color",
      "values": ["Space Black", "Natural Titanium"]
    },
    {
      "name": "Storage", 
      "values": [
        {"value": "128GB", "priceModifier": 0},
        {"value": "512GB", "priceModifier": 200}
      ]
    }
  ],
  "images": ["image1.jpg", "image2.jpg"]
}
```

### Webhook Integration

#### Настройка webhook для получения событий
```http
POST /api/stores/store_123/webhooks
Authorization: Bearer your_api_token

{
  "url": "https://yoursite.com/webhook/telegram",
  "events": [
    "order.created",
    "order.paid", 
    "order.shipped",
    "order.delivered",
    "inventory.low_stock"
  ],
  "secret": "your_webhook_secret"
}
```

#### Пример webhook payload
```json
{
  "event": "order.created",
  "timestamp": "2025-09-23T15:30:00.000Z",
  "data": {
    "orderId": "12345",
    "storeId": "store_123", 
    "customerId": 123456789,
    "total": 1064.00,
    "currency": "USD",
    "items": [
      {
        "productId": "prod_123",
        "name": "iPhone 15 Pro",
        "quantity": 1,
        "price": 999.00
      }
    ],
    "customer": {
      "telegramId": 123456789,
      "username": "customer_username",
      "firstName": "John"
    }
  },
  "signature": "sha256=..."
}
```

---

## 🔒 Безопасность и роли

### Система ролей

#### Иерархия доступа
```
OWNER (Владелец магазина)
├── Полный доступ ко всем функциям
├── Управление админами и вендорами  
├── Финансовая отчетность
└── Настройки безопасности

ADMIN (Администратор магазина)  
├── Управление заказами
├── Верификация платежей
├── Управление товарами
└── Клиентская поддержка

VENDOR (Поставщик/Менеджер)
├── Добавление товаров
├── Управление инвентарем  
├── Просмотр заказов (свои товары)
└── Базовая аналитика

CUSTOMER (Покупатель)
├── Просмотр каталога
├── Оформление заказов
├── Отслеживание заказов
└── Связь с поддержкой
```

#### Проверки доступа
```javascript
// Middleware для проверки прав доступа
const checkStoreAccess = async (userId, storeId, requiredRole) => {
  const user = await User.findById(userId);
  
  // OWNER имеет доступ ко всем магазинам
  if (user.role === 'OWNER') return true;
  
  // Проверка специфических прав на магазин
  const storeAccess = await StoreAdmin.findOne({
    userId,
    storeId,
    role: { $in: getRoleHierarchy(requiredRole) }
  });
  
  return !!storeAccess;
};

// Иерархия ролей (высшие включают права низших)
const getRoleHierarchy = (role) => {
  const hierarchy = {
    'CUSTOMER': ['CUSTOMER'],
    'VENDOR': ['CUSTOMER', 'VENDOR'],  
    'ADMIN': ['CUSTOMER', 'VENDOR', 'ADMIN'],
    'OWNER': ['CUSTOMER', 'VENDOR', 'ADMIN', 'OWNER']
  };
  
  return hierarchy[role] || [];
};
```

### Безопасность данных

#### Шифрование чувствительных данных
```javascript
// Шифрование данных платежей
const encryptPaymentData = (data) => {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.PAYMENT_ENCRYPTION_KEY);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

// Валидация входных данных
const validateOrderData = (orderData) => {
  const schema = Joi.object({
    items: Joi.array().items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().positive().required(),
        variantId: Joi.string().optional()
      })
    ).min(1).required(),
    
    customerInfo: Joi.object({
      telegramId: Joi.number().required(),
      deliveryAddress: Joi.string().min(10).required(),
      phone: Joi.string().pattern(/^\+\d{10,15}$/).required()
    }).required()
  });
  
  return schema.validate(orderData);
};
```

#### Аудит действий
```javascript
// Логирование всех критических действий
const auditLog = async (action, userId, details) => {
  await AuditLog.create({
    action,
    userId,
    timestamp: new Date(),
    details: JSON.stringify(details),
    ipAddress: details.ipAddress,
    userAgent: details.userAgent
  });
};

// Примеры аудируемых действий
const auditableActions = [
  'store.created',
  'product.added', 
  'order.status_changed',
  'payment.verified',
  'user.role_changed',
  'settings.updated'
];
```

### Fraud Detection

#### Мониторинг подозрительной активности
```javascript
const fraudDetection = {
  // Обнаружение подозрительных заказов
  detectSuspiciousOrder: (order, customer) => {
    const suspicionScore = 0;
    
    // Новый клиент с крупным заказом
    if (customer.ordersCount === 0 && order.total > 1000) {
      suspicionScore += 30;
    }
    
    // Слишком много заказов за короткое время
    if (customer.ordersToday > 5) {
      suspicionScore += 40;
    }
    
    // Заказ из другой страны  
    if (customer.country !== store.country) {
      suspicionScore += 20;
    }
    
    return suspicionScore > 50;
  },
  
  // Анализ паттернов платежей
  detectPaymentFraud: (paymentProof, order) => {
    // Проверка на дубликаты чеков
    const duplicateCheck = await PaymentProof.findOne({
      hash: calculateFileHash(paymentProof),
      orderId: { $ne: order.id }
    });
    
    if (duplicateCheck) {
      return { fraud: true, reason: 'duplicate_payment_proof' };
    }
    
    // Проверка размера файла (слишком маленький = подозрителен)
    if (paymentProof.size < 10000) {
      return { fraud: true, reason: 'suspicious_file_size' };
    }
    
    return { fraud: false };
  }
};
```

---

## 📊 Аналитика и отчеты

### Дашборд владельца магазина

#### KPI виджеты
```
┌─────────────────────────────────────────────────────┐
│  💰 Выручка за месяц: $15,678 (+12% к прошлому)    │
├─────────────────────────────────────────────────────┤ 
│  📦 Заказов: 145 (+8%)   📈 Конверсия: 3.2% (+0.5%)│
├─────────────────────────────────────────────────────┤
│  👥 Новых клиентов: 23   🔄 Повторных: 67%         │
├─────────────────────────────────────────────────────┤
│  ⭐ Средняя оценка: 4.8   📞 Поддержка: 95%        │
└─────────────────────────────────────────────────────┘
```

#### Команды аналитики в Telegram
```
/stats - Общая статистика магазина
/sales - Отчет по продажам
/inventory - Состояние склада
/customers - Аналитика клиентов
/performance - Показатели эффективности
```

### Система отчетов

#### Автоматические отчеты
```javascript
const reportScheduler = {
  daily: {
    time: '09:00',
    recipients: ['store_owners', 'admins'],
    content: [
      'orders_summary',
      'revenue_summary', 
      'inventory_alerts',
      'customer_support_stats'
    ]
  },
  
  weekly: {
    time: 'Monday 10:00',
    recipients: ['store_owners'],
    content: [
      'performance_analysis',
      'top_products',
      'customer_retention',
      'competitor_analysis'
    ]
  },
  
  monthly: {
    time: '1st 09:00',
    recipients: ['store_owners'],
    content: [
      'financial_summary',
      'growth_analysis', 
      'market_trends',
      'strategic_recommendations'
    ]
  }
};
```

---

## 🚀 Deployment и Production

### Docker конфигурация

#### docker-compose.yml для полной системы
```yaml
version: '3.8'
services:
  # Backend API
  backend:
    build: ./backend
    environment:
      DATABASE_URL: mysql://user:pass@mysql:3306/ecommerce
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3001:3001"
    depends_on:
      - mysql
      - redis

  # Telegram Bot
  telegram-bot:
    build: ./bot
    environment:
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      WEBHOOK_BASE_URL: ${WEBHOOK_BASE_URL}
      API_URL: http://backend:3001
      REDIS_URL: redis://redis:6379
    ports:
      - "8443:8443" 
    depends_on:
      - backend
      - redis

  # Frontend Admin Panel
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

  # Database
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ecommerce
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  # Cache & Sessions
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  # Reverse Proxy
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
      - frontend
      - telegram-bot

volumes:
  mysql_data:
  redis_data:
```

### Мониторинг production

#### Health checks
```bash
# Проверка всех сервисов
curl https://yourdomain.com/api/health
curl https://yourdomain.com/webhook/telegram/health

# Метрики приложения
curl https://yourdomain.com/metrics

# Статус базы данных
docker exec mysql mysqladmin ping

# Redis статус
docker exec redis redis-cli ping
```

#### Логирование и мониторинг
```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  # Grafana для визуализации
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana

  # Prometheus для метрик  
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  # Alertmanager для уведомлений
  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  grafana_data:
  prometheus_data:
```

---

## 🤝 Поддержка и развитие

### Roadmap развития

#### Phase 1 (Completed) ✅
- [x] Базовый функционал создания магазинов
- [x] Система заказов и платежей
- [x] Telegram интерфейс
- [x] Админ панель
- [x] Продвинутая система безопасности

#### Phase 2 (In Progress) 🚧
- [ ] Machine Learning рекомендации
- [ ] Интеграция с платежными системами
- [ ] Мобильное приложение
- [ ] Расширенная аналитика

#### Phase 3 (Planned) 📅
- [ ] Multi-tenant архитектура
- [ ] Международные продажи
- [ ] B2B функционал
- [ ] AI чат-бот поддержки

### Техническая поддержка

**Контакты:**
- 📧 Email: support@telegram-commerce.com
- 💬 Telegram: @commerce_support
- 📖 Documentation: [docs.telegram-commerce.com]
- 🐛 Issues: [GitHub Repository]

**SLA:**
- 🔴 Critical issues: 2 hours
- 🟡 High priority: 24 hours  
- 🟢 Regular support: 48 hours
- 📝 Feature requests: Weekly review

---

**📅 Последнее обновление:** 23.09.2025  
**🏆 Полнофункциональная e-commerce система готова к запуску!**

*Система включает продвинутые возможности безопасности, аналитику в реальном времени, и полную интеграцию между Telegram ботом и веб-интерфейсом.*

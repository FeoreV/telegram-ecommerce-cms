# @botrt/types

Централизованные TypeScript типы для всех приложений в монорепозитории BotRT.

## Установка

```bash
pnpm add @botrt/types@workspace:*
```

## Использование

```typescript
import type { User, Order, Product, Store } from '@botrt/types';

// Использование типов
const user: User = {
  id: 1,
  telegramId: '123456789',
  role: UserRole.CUSTOMER,
  balance: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## Экспортируемые типы

### User Types
- `User` - Пользователь системы
- `UserRole` - Роли пользователей (CUSTOMER, VENDOR, ADMIN, OWNER)

### Store Types
- `Store` - Магазин
- `StoreSettings` - Настройки магазина
- `NotificationSettings` - Настройки уведомлений

### Product Types
- `Product` - Товар
- `ProductVariant` - Вариант товара

### Order Types
- `Order` - Заказ
- `OrderItem` - Товар в заказе
- `OrderStatus` - Статусы заказа
- `PaymentStatus` - Статусы оплаты

### Другие
- `Cart`, `CartItem` - Корзина
- `Notification` - Уведомления
- `ApiResponse`, `PaginatedResponse` - API ответы
- `TelegramUser`, `TelegramMessage` - Telegram типы


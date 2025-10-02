# Frontend Structure Overview

## 📂 Component Organization

### Core Components (`components/core/`)
Базовые переиспользуемые компоненты:
- **LoadingSpinner** - Индикатор загрузки
- **PageDebugger** - Отладочная панель для разработки
- **ThemedToastContainer** - Тематизированный контейнер уведомлений

### Layout Components (`components/layout/`)
Компоненты структуры приложения:
- **Layout** - Основной layout с навигацией, header, sidebar

### Authentication (`components/auth/`)
Компоненты аутентификации:
- **QRAuthDialog** - Диалог авторизации через QR код Telegram

### Bot Management (`components/bots/`)
Управление Telegram ботами:
- **BotConstructor** - Конструктор ботов
- **BotManagement** - Управление существующими ботами
- **BotTemplates** - Шаблоны ботов

### Charts (`components/charts/`)
Компоненты визуализации данных:
- **ProductPerformanceChart** - График производительности товаров
- **RevenueChart** - График выручки

### Dashboard (`components/dashboard/`)
Компоненты дашборда:
- **DashboardLayout** - Layout дашборда
- **DashboardWidget** - Базовый виджет
- **EnhancedDashboardPage** - Расширенная страница дашборда
- **widgets/** - Специализированные виджеты
  - NotificationsWidget
  - QuickActionsWidget
  - RevenueChartWidget
  - TopPerformersWidget

### E-commerce (`components/ecommerce/`)
E-commerce функциональность:
- **OrderTimeline** - Таймлайн заказа
- **PaymentVerification** - Верификация платежей
- **PaymentVerificationCard** - Карточка верификации

### Error Handling (`components/error/`)
Обработка ошибок:
- **ErrorBoundary** - Компонент-обертка для перехвата ошибок
- **ErrorFallback** - Fallback UI при ошибках

### Forms (`components/forms/`)
Формы и валидация:
- **FormWizard** - Многошаговые формы
- **ValidatedTextField** - Текстовое поле с валидацией

### Inventory (`components/inventory/`)
Управление инвентарем:
- **InventoryAlertsPanel** - Панель уведомлений о запасах

### Mobile (`components/mobile/`)
Мобильные компоненты:
- **MobileCard** - Мобильная карточка
- **MobileForm** - Мобильная форма
- **MobileLayout** - Мобильный layout
- **SwipeableCard** - Карточка с swipe жестами

### Notifications (`components/notifications/`)
Система уведомлений:
- **ConnectionStatus** - Статус подключения к WebSocket
- **NotificationCenter** - Центр уведомлений
- **NotificationSettings** - Настройки уведомлений (каналы: EMAIL, TELEGRAM, PUSH, SOCKET)

### Orders (`components/orders/`)
Управление заказами:
- **BulkOrderActions** - Массовые операции с заказами
- **EnhancedNotifications** - Расширенная система уведомлений
- **OrderAnalytics** - Аналитика заказов
- **OrderCard** - Карточка заказа
- **OrderDetailsDialog** - Детали заказа
- **OrderKPIDashboard** - KPI дашборд заказов
- **OrderNotesManager** - Управление заметками к заказам
- **OrderNotificationSettings** - Настройки уведомлений о заказах (браузерные)
- **PaymentVerificationScreen** - Экран верификации платежей
- **TrackingDialog** - Отслеживание заказа

### Products (`components/products/`)
Управление товарами:
- **AdvancedFilters** - Расширенные фильтры
- **BulkOperations** - Массовые операции
- **CategoryManager** - Управление категориями
- **DuplicateProduct** - Дублирование товара
- **EnhancedSorting** - Расширенная сортировка
- **ExportImport** - Экспорт/импорт
- **KeyboardShortcutsHelp** - Горячие клавиши
- **ProductAnalytics** - Аналитика товаров
- **ProductCard** - Карточка товара
- **ProductDialog** - Диалог редактирования
- **ProductPreviewDialog** - Предпросмотр товара

### Stores (`components/stores/`)
Управление магазинами:
- **BotPreviewCard** - Превью бота магазина
- **BulkStoreOperations** - Массовые операции
- **StoreAdminManagement** - Управление администраторами
- **StoreAnalytics** - Аналитика магазина
- **StoreCard** - Карточка магазина
- **StoreCardEnhanced** - Расширенная карточка
- **StoreDialog** - Диалог создания/редактирования
- **StoreExport** - Экспорт данных
- **StoreFilters** - Фильтры магазинов
- **StoreFormDialog** - Форма магазина
- **StorePerformanceCharts** - Графики производительности
- **StoreTemplates** - Шаблоны магазинов
- **StoreTemplatesDialog** - Диалог шаблонов
- **TelegramStoreCreator** - Создание магазина в Telegram

### UI Components (`components/ui/`)
Переиспользуемые UI элементы:
- **AccessibleButton** - Доступная кнопка
- **AnimatedButton** - Анимированная кнопка
- **EmptyState** - Пустое состояние
- **EnhancedTable** - Расширенная таблица
- **EnhancedToast** - Расширенные toast уведомления
- **FadeInView** - Анимация появления
- **LoadingFallback** - Fallback загрузки
- **LoadingOverlay** - Оверлей загрузки
- **LoadingSkeleton** - Skeleton загрузки
- **PageHeader** - Заголовок страницы
- **SectionCard** - Карточка секции
- **Skeleton** - Базовый skeleton
- **StatCard** - Статистическая карточка
- **StatusChip** - Чип статуса

### Users (`components/users/`)
Управление пользователями:
- **UserCard** - Карточка пользователя
- **UserDialog** - Диалог редактирования пользователя

## 📄 Pages

Все страницы следуют паттерну `{Name}Page.tsx` + `{Name}Page.module.css`:

- **AccessDeniedPage** - Доступ запрещен
- **BotsPage** - Управление ботами
- **DashboardPage** - Главный дашборд
- **LoginPage** - Страница входа
- **MobileDashboardPage** - Мобильный дашборд
- **NotFoundPage** - 404
- **OrdersPage** - Заказы
- **PaymentVerificationPage** - Верификация платежей
- **ProductsPage** - Товары
- **PublicHealthPage** - Публичный health check
- **ReportsPage** - Отчеты
- **StoresPage** - Магазины
- **StyleGuidePage** - Style guide
- **UsersPage** - Пользователи

## 🎣 Hooks

Custom React hooks:
- **useAccessibility** - Хуки доступности
- **useKeyboardShortcuts** - Горячие клавиши
- **useMobileOptimizations** - Мобильная оптимизация
- **usePerformanceMonitor** - Мониторинг производительности
- **useRealTimeUpdates** - Real-time обновления
- **useRoutePermissions** - Права доступа к роутам
- **useStoresRealTime** - Real-time обновления магазинов

## 🌐 Contexts

React Context провайдеры:
- **AuthContext** - Аутентификация и авторизация
- **NotificationContext** - Глобальные уведомления
- **SocketContext** - WebSocket подключение
- **ThemeModeContext** - Темная/светлая тема

## 🛠️ Services

API сервисы для взаимодействия с backend:
- **apiClient** - Базовый HTTP клиент (Axios)
- **authService** - Аутентификация
- **dashboardService** - Данные дашборда
- **orderService** - Заказы
- **productService** - Товары
- **storeService** - Магазины
- **userService** - Пользователи

## 🎨 Styles

- **main.css** - Глобальные стили (BEM методология)
- **accessibility.css** - Стили доступности
- **Component.module.css** - CSS Modules для компонентов

## 🎯 Theme

- **responsive.ts** - Breakpoints и responsive утилиты
- **tokens.ts** - Design tokens (цвета, размеры, отступы)
- **variants.ts** - Варианты тем

## 🧪 Testing

- **cypress/e2e/** - E2E тесты
- **setupTests.ts** - Конфигурация тестов

## 📦 Build & Config

- **vite.config.ts** - Vite конфигурация
- **tsconfig.json** - TypeScript конфигурация
- **Dockerfile** - Docker образ для продакшена
- **nginx.conf** - Nginx конфигурация
- **.eslintrc.json** - ESLint правила
- **.gitignore** - Игнорируемые файлы

## 🔑 Naming Conventions

- **Components**: PascalCase (e.g., `UserCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`)
- **Services**: camelCase with `Service` suffix (e.g., `authService.ts`)
- **Contexts**: PascalCase with `Context` suffix (e.g., `AuthContext.tsx`)
- **Types**: PascalCase (e.g., `User`, `Order`)
- **CSS Modules**: `{ComponentName}.module.css`

## 📝 Import Patterns

```tsx
// External libraries
import React from 'react'
import { Box, Typography } from '@mui/material'

// Internal absolute imports
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../services/apiClient'

// Local relative imports
import styles from './Component.module.css'
```

## 🚀 Development Workflow

1. Создайте компонент в соответствующей папке
2. Добавьте типы в начало файла
3. Создайте CSS Module если нужны специфичные стили
4. Экспортируйте default export
5. Обновите импорты в использующих файлах
6. Проверьте линтером: `npm run lint`

## 📐 Component Structure

```tsx
import React, { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import styles from './MyComponent.module.css'

// Types
interface MyComponentProps {
  title: string
  onAction?: () => void
}

// Component
const MyComponent: React.FC<MyComponentProps> = ({ 
  title, 
  onAction 
}) => {
  // State
  const [isActive, setIsActive] = useState(false)
  
  // Effects
  useEffect(() => {
    // ...
  }, [])
  
  // Handlers
  const handleClick = () => {
    setIsActive(!isActive)
    onAction?.()
  }
  
  // Render
  return (
    <Box className={styles.container}>
      <Typography variant="h6">{title}</Typography>
    </Box>
  )
}

export default MyComponent
```

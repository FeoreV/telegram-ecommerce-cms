# Frontend Admin Panel

Admin panel для управления Telegram E-Commerce ботами. Построен на React + TypeScript + Material-UI.

## 📋 Технологический стек

- **React 18.2** - UI библиотека
- **TypeScript 5.2** - Type safety
- **Material-UI (MUI) 5.14** - UI компоненты
- **React Router 6** - Роутинг
- **React Query 3** - Управление серверным состоянием
- **Socket.io Client** - Real-time уведомления
- **Recharts** - Графики и аналитика
- **Axios** - HTTP клиент
- **Vite** - Build tool

## 🗂️ Структура проекта

```
frontend/
├── public/               # Статические ресурсы
│   └── sounds/          # Звуки уведомлений
├── src/
│   ├── components/      # React компоненты
│   │   ├── auth/       # Компоненты аутентификации (QR коды)
│   │   ├── bots/       # Управление ботами (Constructor, Management, Templates)
│   │   ├── charts/     # Графики и визуализация данных
│   │   ├── core/       # Базовые компоненты (LoadingSpinner, PageDebugger)
│   │   ├── dashboard/  # Компоненты дашборда и виджеты
│   │   ├── ecommerce/  # E-commerce компоненты (OrderTimeline, PaymentVerification)
│   │   ├── error/      # Обработка ошибок (ErrorBoundary, ErrorFallback)
│   │   ├── forms/      # Формы (FormWizard, ValidatedTextField)
│   │   ├── inventory/  # Управление инвентарем
│   │   ├── layout/     # Layout компоненты (основной Layout)
│   │   ├── mobile/     # Мобильные компоненты и адаптация
│   │   ├── notifications/ # Система уведомлений
│   │   ├── orders/     # Управление заказами
│   │   ├── performance/ # Мониторинг производительности
│   │   ├── products/   # Управление продуктами
│   │   ├── responsive/ # Адаптивные layouts
│   │   ├── settings/   # Настройки приложения
│   │   ├── stores/     # Управление магазинами
│   │   ├── theme/      # Темы и стилизация
│   │   ├── ui/         # UI компоненты (кнопки, карточки, модалки)
│   │   └── users/      # Управление пользователями
│   ├── contexts/       # React Context провайдеры
│   │   ├── AuthContext.tsx        # Аутентификация
│   │   ├── NotificationContext.tsx # Уведомления
│   │   ├── SocketContext.tsx      # WebSocket подключение
│   │   └── ThemeModeContext.tsx   # Темная/светлая тема
│   ├── hooks/          # Custom React hooks
│   │   ├── useAccessibility.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useMobileOptimizations.ts
│   │   ├── usePerformanceMonitor.ts
│   │   ├── useRealTimeUpdates.ts
│   │   ├── useRoutePermissions.ts
│   │   └── useStoresRealTime.ts
│   ├── pages/          # Страницы приложения
│   │   ├── AccessDeniedPage.tsx
│   │   ├── BotsPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── MobileDashboardPage.tsx
│   │   ├── NotFoundPage.tsx
│   │   ├── OrdersPage.tsx
│   │   ├── PaymentVerificationPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── PublicHealthPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── StoresPage.tsx
│   │   ├── StyleGuidePage.tsx
│   │   └── UsersPage.tsx
│   ├── routes/         # Конфигурация роутинга
│   │   └── config.ts  # Роуты и права доступа
│   ├── services/       # API сервисы
│   │   ├── apiClient.ts       # Базовый HTTP клиент
│   │   ├── authService.ts     # Сервис аутентификации
│   │   ├── dashboardService.ts # Данные дашборда
│   │   ├── orderService.ts    # Управление заказами
│   │   ├── productService.ts  # Управление продуктами
│   │   ├── storeService.ts    # Управление магазинами
│   │   └── userService.ts     # Управление пользователями
│   ├── styles/         # Глобальные стили
│   │   ├── main.css           # Основные стили (BEM)
│   │   ├── accessibility.css  # Стили доступности
│   │   └── README.md          # Документация стилей
│   ├── theme/          # Конфигурация темы
│   │   ├── responsive.ts      # Адаптивные breakpoints
│   │   ├── tokens.ts          # Design tokens
│   │   └── variants.ts        # Варианты тем
│   ├── types/          # TypeScript типы
│   │   └── index.ts
│   ├── utils/          # Утилиты
│   │   ├── authClient.ts      # Утилиты аутентификации
│   │   └── chartTheme.ts      # Конфигурация графиков
│   ├── App.tsx         # Главный компонент
│   ├── main.tsx        # Entry point
│   └── vite-env.d.ts   # Vite type definitions
├── cypress/            # E2E тесты
│   └── e2e/
│       └── order-flow.cy.ts
├── .gitignore
├── Dockerfile
├── nginx.conf          # Конфигурация Nginx для продакшена
├── package.json
├── tsconfig.json       # TypeScript конфигурация
├── tsconfig.node.json  # TypeScript для Node.js
├── vite.config.ts      # Vite конфигурация
└── README.md

```

## 🚀 Быстрый старт

### Установка зависимостей

```bash
npm install
```

### Разработка

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

### Сборка для продакшена

```bash
npm run build
```

### Предпросмотр продакшен сборки

```bash
npm run preview
```

### Линтинг

```bash
npm run lint
```

## 🎨 Архитектурные особенности

### Организация компонентов

Компоненты организованы по **функциональным доменам**:

- **Базовые компоненты** (`core/`) - переиспользуемые UI элементы
- **Доменные компоненты** (`orders/`, `products/`, `stores/`) - бизнес-логика
- **Layout компоненты** (`layout/`) - структура приложения
- **UI компоненты** (`ui/`) - низкоуровневые UI элементы

### State Management

- **React Context** - глобальное состояние (auth, theme, notifications)
- **React Query** - серверное состояние и кэширование
- **Local State** - локальное состояние компонентов

### Стилизация

- **Material-UI** - основная UI система
- **CSS Modules** - изолированные стили компонентов
- **BEM методология** - для глобальных стилей

### Роутинг и права доступа

Роли пользователей:
- `OWNER` - полный доступ ко всем функциям
- `ADMIN` - управление магазином
- `VENDOR` - управление товарами и заказами
- `CUSTOMER` - просмотр своих заказов

Конфигурация прав в `routes/config.ts`

### Real-time обновления

- **Socket.io** - WebSocket подключение
- **Уведомления** - 4 уровня приоритета (LOW, MEDIUM, HIGH, CRITICAL)
- **Каналы** - EMAIL, TELEGRAM, PUSH, SOCKET

## 📱 Адаптивность

Приложение полностью адаптивно и поддерживает:
- Desktop (1920px+)
- Tablet (768px - 1919px)
- Mobile (320px - 767px)

Специальные мобильные компоненты в `components/mobile/`

## ♿ Доступность

- Поддержка клавиатурной навигации
- ARIA атрибуты
- Экранные читалки
- Высококонтрастные темы
- Настройки в `components/settings/AccessibilitySettings.tsx`

## 🔒 Безопасность

- QR-код аутентификация через Telegram
- JWT токены с refresh механизмом
- Проверка прав доступа на каждом роуте
- XSS защита
- CSRF токены

## 📊 Производительность

- **Code Splitting** - автоматически через Vite
- **Lazy Loading** - для больших компонентов
- **Мемоизация** - React.memo, useMemo, useCallback
- **Virtual Scrolling** - для больших списков
- **Performance Monitor** - встроенный мониторинг

## 🧪 Тестирование

```bash
# E2E тесты с Cypress
npm run cypress:open
```

## 🌐 API интеграция

Базовый URL настраивается через переменные окружения:

```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

## 📦 Сборка Docker образа

```bash
docker build -t telegram-ecommerce-admin .
docker run -p 80:80 telegram-ecommerce-admin
```

## 🎯 Основные фичи

### Управление магазинами
- Создание и настройка магазинов
- Брендинг (логотипы, цвета)
- Настройка валют и платежей
- Шаблоны магазинов

### Управление ботами
- Конструктор ботов
- Настройка команд и сообщений
- Webhook управление
- Тестирование ботов

### Управление заказами
- Отслеживание статусов
- Подтверждение платежей
- Массовые операции
- Экспорт данных

### Управление товарами
- CRUD операции
- Варианты товаров
- Управление инвентарем
- Категории и теги

### Аналитика
- Графики продаж
- Конверсии
- Performance метрики
- Экспорт отчетов

### Уведомления
- Real-time через Socket.io
- Email уведомления
- Telegram уведомления
- Push уведомления в браузере
- Настраиваемые правила

## 🛠️ Разработка

### Добавление нового роута

1. Создайте страницу в `pages/`
2. Добавьте роут в `routes/config.ts`
3. Укажите требуемую роль
4. Добавьте пункт в меню (если нужно)

### Создание нового компонента

```tsx
// components/domain/MyComponent.tsx
import React from 'react'
import { Box, Typography } from '@mui/material'

interface MyComponentProps {
  title: string
}

const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
  return (
    <Box>
      <Typography variant="h6">{title}</Typography>
    </Box>
  )
}

export default MyComponent
```

### Использование API

```tsx
import { apiClient, unwrap } from '../services/apiClient'

// GET запрос
const data = unwrap(await apiClient.get('/endpoint'))

// POST запрос
const result = unwrap(await apiClient.post('/endpoint', { data }))
```

## 📝 Соглашения о коде

- **Именование**: PascalCase для компонентов, camelCase для функций
- **Файлы**: один компонент = один файл
- **Стили**: CSS Modules для компонент-специфичных стилей
- **Импорты**: абсолютные пути через `../`
- **TypeScript**: строгая типизация, избегайте `any`

## 🔄 CI/CD

Проект готов к деплою через:
- Docker
- Nginx
- CI/CD пайплайны

## 📚 Дополнительная документация

- [Стили и темы](src/styles/README.md)
- [API документация](../docs/api/)
- [Архитектура](../docs/architecture/)
- [Безопасность](../docs/security/)

## 🤝 Contributing

См. [CONTRIBUTING.md](../CONTRIBUTING.md)

## 📄 Лицензия

См. [LICENSE](../LICENSE)

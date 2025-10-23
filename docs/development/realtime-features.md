# Real-time функционал админ панели

## Обзор

Админ панель теперь поддерживает real-time обновления через Socket.IO, что позволяет администраторам получать мгновенные уведомления о важных событиях в системе.

## Основные возможности

### 🔔 Типы уведомлений

1. **Новые заказы** - мгновенные уведомления о поступлении заказов
2. **Изменения статусов** - обновления по платежам, отгрузкам, доставке
3. **Управление запасами** - предупреждения о низких остатках товаров
4. **Пользователи** - уведомления о регистрации новых пользователей
5. **Системные сообщения** - важные объявления от администрации

### 🔊 Звуковые уведомления

- **Новый заказ** - двойной высокий сигнал (привлекает внимание)
- **Подтверждение платежа** - мелодичное трио нот (C-E-G)  
- **Низкие запасы** - предупреждающий двойной сигнал
- **Ошибки** - низкий продолжительный сигнал

### 📱 Уведомления браузера

Поддержка native уведомлений браузера, которые показываются даже когда вкладка неактивна.

## Настройка

### Индикатор подключения

В правом верхнем углу админ панели расположен индикатор подключения:
- 🟢 **Зеленый** - подключено к серверу
- 🟡 **Желтый** - подключение...
- 🔴 **Красный** - ошибка подключения

### Настройки уведомлений

Кликните на индикатор подключения для доступа к настройкам:

1. **Включить уведомления** - главный переключатель
2. **Звуковые уведомления** - вкл/выкл звуки
3. **Уведомления браузера** - настройка native уведомлений

## Использование в коде

### Контекст Socket.IO

```tsx
import { useSocket } from '../contexts/SocketContext'

const MyComponent = () => {
  const { socket, isConnected, on, off, emit } = useSocket()
  
  useEffect(() => {
    const handleNewOrder = (data) => {
      console.log('Новый заказ:', data)
    }
    
    on('order:new', handleNewOrder)
    
    return () => {
      off('order:new', handleNewOrder)  
    }
  }, [on, off])
  
  return <div>Статус: {isConnected ? 'Подключено' : 'Отключено'}</div>
}
```

### Хуки для real-time обновлений

```tsx
import { useDashboardRealTime, useOrdersRealTime } from '../hooks/useRealTimeUpdates'

// Для дашборда
const Dashboard = () => {
  const loadData = () => {
    // Перезагрузка данных
  }
  
  useDashboardRealTime(loadData)
  
  return <div>Dashboard content</div>
}

// Для страницы заказов
const OrdersPage = () => {
  const refreshOrders = () => {
    // Обновление списка заказов
  }
  
  useOrdersRealTime(refreshOrders)
  
  return <div>Orders content</div>
}
```

### Доступные хуки

- `useDashboardRealTime(onUpdate)` - для дашборда
- `useOrdersRealTime(onUpdate)` - для страницы заказов  
- `useProductsRealTime(onUpdate)` - для товаров
- `useStoresRealTime(onUpdate)` - для магазинов
- `useUsersRealTime(onUpdate)` - для пользователей

## События Socket.IO

### События заказов
- `order:new` - новый заказ
- `order:updated` - изменение статуса
- `order:payment_confirmed` - подтверждение платежа
- `order:rejected` - отклонение заказа

### События товаров
- `product:created` - новый товар
- `product:stock_low` - мало товара (≤10 шт)
- `product:out_of_stock` - товар закончился

### События магазинов
- `store:created` - новый магазин
- `store:updated` - изменения в магазине

### События пользователей
- `user:new_registration` - новый пользователь
- `user:role_changed` - изменение роли

### Системные события
- `admin:broadcast` - рассылка от администрации

## Настройка сервера

Для работы real-time функций необходимо настроить Socket.IO сервер:

```javascript
// Пример настройки в backend
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
})

// Аутентификация при подключении
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  // Проверка токена...
  next()
})

// Обработка подключений
io.on('connection', (socket) => {
  console.log('Admin connected:', socket.userId)
  
  // Присоединение к комнате админов
  socket.join('admins')
  
  // Эмит событий при изменениях
  socket.on('order:created', (data) => {
    io.to('admins').emit('order:new', data)
  })
})
```

## Переменные окружения

```env
VITE_SOCKET_URL=http://82.147.84.78:3001  # URL Socket.IO сервера
```

## Отладка

Для отладки Socket.IO событий включите логи в консоли браузера:

```javascript
localStorage.debug = 'socket.io-client:*'
```

## Производительность

- Автоматическое переподключение при потере соединения
- Ограничение количества одновременных уведомлений (до 5)
- Умное кэширование для предотвращения дублирования событий
- Очистка обработчиков событий при размонтировании компонентов

## Безопасность

- Аутентификация через JWT токены
- Проверка ролей пользователей
- Фильтрация событий по правам доступа
- Защита от spam-атак через rate limiting

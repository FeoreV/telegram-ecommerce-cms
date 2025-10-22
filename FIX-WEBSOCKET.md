# Исправление WebSocket ошибки

## Проблема:
```
WebSocket connection to 'wss://megapenis.work.gd/socket.io/?EIO=4&transport=websocket' failed: 
WebSocket is closed before the connection is established.
```

## Причины:

1. **Бэкенд не запущен** - Socket.IO сервер не слушает подключения
2. **Nginx неправильно проксирует WebSocket** - отсутствуют нужные заголовки
3. **CORS блокирует подключение** - неправильная конфигурация CORS для WebSocket
4. **Фронтенд пытается подключиться до авторизации** - нет токена

## Решение:

### 1. Проверьте, что бэкенд запущен

```bash
# Проверьте статус
pm2 status

# Проверьте логи
pm2 logs telegram-backend --lines 50

# Проверьте, что порт 3001 слушается
sudo netstat -tlnp | grep 3001
```

Должно быть:
```
tcp  0  0  127.0.0.1:3001  0.0.0.0:*  LISTEN  12345/node
```

### 2. Проверьте nginx конфигурацию для WebSocket

Конфигурация уже правильная в `nginx-megapenis.work.gd.conf`:

```nginx
# WebSocket support for Socket.IO
location /socket.io/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Disable buffering for WebSocket
    proxy_buffering off;
    
    # Timeouts for WebSocket
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

Убедитесь, что она применена:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Проверьте CORS в бэкенде

В `backend/src/lib/socket.ts` должна быть правильная конфигурация:

```typescript
ioInstance = new SocketServer(server, {
  cors: {
    origin: origin || '*',
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});
```

### 4. Проверьте, что Socket.IO инициализируется

В `backend/src/index.ts` должна быть инициализация:

```typescript
// Initialize Socket.IO with proper CORS configuration
const allowedOrigins = [
  env.FRONTEND_URL,
  'localhost',
  'http://localhost:3000',
  'http://localhost:5173'
];

const io = initSocket(server, allowedOrigins.join(','));
```

### 5. Тестирование WebSocket

#### Тест 1: Проверьте, что Socket.IO endpoint доступен
```bash
curl -I localhost/socket.io/
```

Должен вернуть `400 Bad Request` (это нормально для Socket.IO без правильных параметров).

#### Тест 2: Проверьте WebSocket через wscat
```bash
# Установите wscat (если нет)
npm install -g wscat

# Попробуйте подключиться
wscat -c "wss://megapenis.work.gd/socket.io/?EIO=4&transport=websocket"
```

#### Тест 3: Проверьте в браузере
Откройте консоль браузера (F12) и выполните:

```javascript
// Проверьте, что Socket.IO клиент загружен
console.log(typeof io);

// Попробуйте подключиться вручную
const socket = io('localhost', {
  transports: ['websocket', 'polling'],
  auth: { token: localStorage.getItem('accessToken') }
});

socket.on('connect', () => console.log('✅ Connected!'));
socket.on('connect_error', (err) => console.error('❌ Error:', err));
socket.on('disconnect', (reason) => console.log('Disconnected:', reason));
```

## Временное решение - отключить WebSocket

Если WebSocket не критичен для работы приложения, можно временно отключить его:

### Вариант 1: Условное подключение

В `frontend/src/contexts/SocketContext.tsx`:

```typescript
useEffect(() => {
  const token = tokenManager.getAccessToken()
  
  // Временно отключаем WebSocket в production
  if (import.meta.env.PROD) {
    console.log('WebSocket disabled in production');
    return undefined;
  }
  
  if (!user || !token) {
    teardownSocket()
    return undefined
  }
  
  // ... остальной код
}, [user, socketUrl, teardownSocket])
```

### Вариант 2: Graceful degradation

Приложение уже должно работать без WebSocket - уведомления просто не будут приходить в реальном времени.

## Проверка после исправления:

### 1. Проверьте логи бэкенда:
```bash
pm2 logs telegram-backend | grep -i socket
```

Должны быть сообщения типа:
```
Socket.IO initialized
Socket.IO listening on port 3001
```

### 2. Проверьте логи nginx:
```bash
sudo tail -f /var/log/nginx/megapenis-access.log | grep socket.io
```

Должны быть запросы:
```
GET /socket.io/?EIO=4&transport=polling HTTP/1.1" 200
GET /socket.io/?EIO=4&transport=websocket HTTP/1.1" 101
```

Код 101 означает успешный upgrade до WebSocket.

### 3. Проверьте в браузере:

Откройте localhost и в консоли (F12) должно быть:

```
✅ Socket connected
```

Или в Network tab (вкладка WS) должно быть активное WebSocket соединение.

## Распространенные проблемы:

### Проблема: "WebSocket is closed before the connection is established"

**Причина:** Бэкенд не отвечает на WebSocket запросы.

**Решение:**
```bash
# Перезапустите бэкенд
pm2 restart telegram-backend

# Проверьте, что Socket.IO инициализирован
pm2 logs telegram-backend | grep -i "socket"
```

### Проблема: "CORS error" в консоли

**Причина:** CORS не настроен для WebSocket.

**Решение:** Проверьте `backend/src/lib/socket.ts`:
```typescript
cors: {
  origin: 'localhost',
  credentials: true
}
```

### Проблема: "401 Unauthorized" при подключении

**Причина:** Токен не передается или невалиден.

**Решение:** Проверьте, что пользователь авторизован:
```javascript
console.log('Token:', localStorage.getItem('accessToken'));
```

### Проблема: Подключается через polling, но не через websocket

**Причина:** Nginx не проксирует WebSocket upgrade.

**Решение:** Убедитесь, что в nginx есть:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

## Если ничего не помогает:

### Вариант 1: Используйте polling вместо websocket

В `frontend/src/contexts/SocketContext.tsx`:

```typescript
const SOCKET_OPTIONS = {
  transports: ['polling'], // Только polling, без websocket
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  forceNew: true,
}
```

### Вариант 2: Отключите WebSocket полностью

Закомментируйте использование `SocketProvider` в `App.tsx`:

```typescript
// <SocketProvider>
  <YourApp />
// </SocketProvider>
```

Приложение будет работать без real-time уведомлений.

## Итоговая проверка:

После всех исправлений выполните:

```bash
# 1. Перезапустите бэкенд
pm2 restart telegram-backend

# 2. Проверьте логи
pm2 logs telegram-backend --lines 20

# 3. Проверьте nginx
sudo nginx -t
sudo systemctl reload nginx

# 4. Откройте сайт
# localhost

# 5. Проверьте консоль браузера (F12)
# Не должно быть ошибок WebSocket
```

Если WebSocket подключился успешно, в консоли будет:
```
Socket.IO connected
Socket ID: abc123...
```

И в Network tab (WS) будет активное соединение с `wss://megapenis.work.gd/socket.io/`.

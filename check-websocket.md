# Диагностика WebSocket ошибки

## Что было исправлено:

### 1. Backend Socket.IO конфигурация
- ✅ Добавлены правильные CORS настройки
- ✅ Включены оба транспорта: websocket и polling
- ✅ Увеличены таймауты для стабильного соединения
- ✅ Добавлена поддержка credentials

### 2. Переменные окружения
- ✅ FRONTEND_URL уже настроен на HTTPS: `82.147.84.78`
- ✅ CORS_WHITELIST включает HTTPS домен

### 3. Nginx конфигурация
Проверьте, что в `/etc/nginx/sites-enabled/` есть симлинк на конфиг:
```bash
ls -la /etc/nginx/sites-enabled/
```

## Шаги для исправления:

### 1. Перезапустите backend сервер
```bash
# Windows
restart-backend.bat

# Или вручную:
cd backend
npm start
```

### 2. Проверьте nginx
```bash
# На сервере Linux
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Проверьте логи
```bash
# Backend логи
cd backend
npm start

# Nginx логи (на сервере)
sudo tail -f /var/log/nginx/megapenis-error.log
```

### 4. Тест WebSocket соединения
Откройте браузер и проверьте консоль разработчика (F12):
- Перейдите на 82.147.84.78
- Откройте вкладку Network
- Фильтр: WS (WebSocket)
- Должно быть соединение к `wss://megapenis.work.gd/socket.io/`

## Возможные ошибки и решения:

### Ошибка: "WebSocket connection failed"
**Причина:** Backend не запущен или недоступен
**Решение:** Запустите backend сервер

### Ошибка: "401 Unauthorized"
**Причина:** Проблема с токеном авторизации
**Решение:** Перелогиньтесь в приложении

### Ошибка: "CORS error"
**Причина:** Неправильные CORS настройки
**Решение:** Уже исправлено в коде

### Ошибка: "Timeout"
**Причина:** Nginx не проксирует WebSocket
**Решение:** Проверьте nginx конфигурацию

## Проверка статуса:

### Backend
```bash
curl http://82.147.84.78:3001/health
```

### Frontend через nginx
```bash
curl 82.147.84.78/health
```

### WebSocket через nginx
```bash
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
  82.147.84.78/socket.io/
```

## Дополнительная информация:

### Порты:
- Backend: 3001 (локально)
- Frontend: 3000 (локально)
- Nginx: 443 (HTTPS), 80 (HTTP redirect)

### WebSocket URL:
- Локально: `ws://82.147.84.78:3001`
- Через nginx: `wss://megapenis.work.gd/socket.io/`

### Транспорты Socket.IO:
1. WebSocket (основной, быстрый)
2. Polling (fallback, если WebSocket недоступен)

# Исправление ошибки подключения Backend к Frontend

## Проблема
Frontend не может подключиться к Backend, получает ошибку "server error".

## Диагностика

### 1. Запустите скрипт проверки
```bash
check-backend-connection.bat
```

### 2. Проверьте, что Backend запущен
```bash
netstat -ano | findstr ":3001"
```

Должен показать процесс, слушающий порт 3001.

### 3. Проверьте health endpoint
```bash
curl http://localhost:3001/health
```

Должен вернуть: `{"status":"OK","timestamp":"..."}`

## Возможные причины и решения

### Причина 1: Backend не запущен

**Решение:**
```bash
cd backend
npm start
```

Или через PM2 (на сервере):
```bash
pm2 restart backend
pm2 logs backend
```

### Причина 2: CORS ошибка

**Проверка:**
Откройте консоль браузера (F12) и посмотрите на ошибки. Если видите:
```
Access to fetch at 'https://megapenis.work.gd/api/...' from origin 'https://megapenis.work.gd' has been blocked by CORS policy
```

**Решение:**
Убедитесь, что в `backend/.env` правильно настроен CORS:
```env
CORS_WHITELIST=https://megapenis.work.gd,http://localhost:3000,http://localhost:5173
FRONTEND_URL=https://megapenis.work.gd
```

Перезапустите backend после изменений.

### Причина 3: Nginx не проксирует запросы

**Проверка:**
```bash
curl -v https://megapenis.work.gd/api/health
```

Если получаете 502 Bad Gateway, значит nginx не может достучаться до backend.

**Решение:**
1. Проверьте, что backend слушает на 127.0.0.1:3001
2. Проверьте nginx конфигурацию:
```bash
nginx -t
```
3. Перезапустите nginx:
```bash
systemctl restart nginx
```

### Причина 4: Backend слушает неправильный адрес

**Проверка в backend/src/index.ts:**
Должно быть:
```typescript
const PORT = env.PORT || 3001;
server.listen(PORT, async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});
```

**Если backend слушает только 0.0.0.0:**
Измените на:
```typescript
server.listen(PORT, '127.0.0.1', async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});
```

### Причина 5: Firewall блокирует соединение

**Проверка (на сервере):**
```bash
# Проверка firewall
ufw status

# Если порт 3001 не открыт для localhost, это нормально
# Nginx должен иметь доступ к localhost
```

### Причина 6: Frontend неправильно собран

**Решение:**
```bash
cd frontend
npm run build
```

Затем перезапустите nginx или скопируйте файлы:
```bash
# На сервере
systemctl restart nginx
```

## Быстрое исправление

### Вариант 1: Локальная разработка
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Откройте http://localhost:3000

### Вариант 2: Production на сервере

```bash
# 1. Проверьте backend
pm2 logs backend --lines 50

# 2. Если есть ошибки, перезапустите
pm2 restart backend

# 3. Проверьте nginx
systemctl status nginx
tail -f /var/log/nginx/megapenis-error.log

# 4. Если nginx показывает ошибки, перезапустите
systemctl restart nginx

# 5. Пересоберите frontend если нужно
cd /root/telegram-ecommerce-cms/frontend
npm run build
systemctl restart nginx
```

## Проверка после исправления

1. **Backend health:**
```bash
curl http://localhost:3001/health
```

2. **API через nginx:**
```bash
curl https://megapenis.work.gd/api/health
```

3. **Frontend в браузере:**
Откройте https://megapenis.work.gd и проверьте консоль (F12)

## Логи для диагностики

### Backend логи
```bash
# PM2
pm2 logs backend

# Или напрямую
cd backend
npm start
```

### Nginx логи
```bash
tail -f /var/log/nginx/megapenis-error.log
tail -f /var/log/nginx/megapenis-access.log
```

### Frontend консоль
Откройте браузер → F12 → Console → Network

## Контрольный список

- [ ] Backend запущен и слушает порт 3001
- [ ] `curl http://localhost:3001/health` возвращает OK
- [ ] `curl http://localhost:3001/api` возвращает JSON
- [ ] CORS_WHITELIST включает https://megapenis.work.gd
- [ ] Nginx конфигурация корректна (`nginx -t`)
- [ ] Nginx запущен (`systemctl status nginx`)
- [ ] Frontend собран (`npm run build` в frontend/)
- [ ] SSL сертификаты валидны
- [ ] Нет ошибок в логах nginx
- [ ] Нет ошибок в логах backend

## Если ничего не помогло

1. Полный перезапуск:
```bash
# Остановить все
pm2 stop all
systemctl stop nginx

# Запустить заново
pm2 start all
systemctl start nginx

# Проверить
pm2 status
systemctl status nginx
```

2. Проверьте переменные окружения:
```bash
cat backend/.env | grep -E "PORT|FRONTEND_URL|CORS"
cat frontend/.env | grep -E "VITE_API_URL|VITE_SOCKET"
```

3. Проверьте, что процессы не конфликтуют:
```bash
netstat -tulpn | grep -E "3000|3001"
```

# 🔧 Быстрое исправление проблем

## ✅ Исправлено

### 1. CSRF 403 ошибка при создании магазина
**Проблема:** Двойная CSRF защита - глобальная в `index.ts` + route-level middleware
**Решение:** Убрал дублирование CSRF middleware из routes, теперь используется только глобальная защита

**Файлы изменены:**
- `backend/src/routes/stores.ts` - убрал `csrfProtection` из всех endpoints
- `frontend/src/services/apiClient.ts` - автоматическая подстановка CSRF токена + retry при 403
- `backend/src/middleware/csrfProtection.ts` - поддержка `__Host-csrf.token` cookie

### 2. Telegram Bot 404 ошибка
**Проблема:** Бот использует placeholder токен `YOUR_BOT_TOKEN_FROM_BOTFATHER`
**Решение:** Добавил проверку и понятное сообщение об ошибке

**Файлы изменены:**
- `bot/src/index.ts` - улучшенная валидация токена с инструкциями

---

## 📋 Что нужно сделать на сервере

### 1. Настроить Telegram бота

```bash
# На сервере откройте файл конфигурации бота
nano bot/.env

# Замените строку:
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER

# На реальный токен от @BotFather:
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGhIJklmNOpqRStuvwXYz
```

**Как получить токен:**
1. Откройте Telegram и найдите @BotFather
2. Отправьте команду `/newbot` (для нового) или `/token` (для существующего)
3. Следуйте инструкциям
4. Скопируйте полученный токен
5. Вставьте его в `bot/.env`

### 2. Обновить код на сервере

```bash
ssh user@82.147.84.78

cd /var/www/telegram-ecommerce-cms

# Получить изменения
git fetch --all
git pull origin main

# Установить зависимости
pnpm -r install

# Пересобрать проекты
pnpm -r build

# Перезапустить сервисы
pm2 restart all
# или
pm2 startOrReload config/services/ecosystem.config.cjs --env production

# Проверить статус
pm2 status
pm2 logs telegram-bot --lines 50
pm2 logs telegram-backend --lines 50
```

### 3. Проверить HTTPS для CSRF

⚠️ **Важно:** CSRF cookie `__Host-csrf.token` работает только через HTTPS

**Если API на HTTP:**
```bash
# Проверьте nginx конфигурацию
sudo nano /etc/nginx/sites-available/your-site

# Убедитесь что есть SSL и проксирование на бэкенд
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    location /api {
        proxy_pass http://82.147.84.78:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Перезагрузить nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🧪 Проверка работы

### 1. Проверить CSRF токен
```bash
# Тест получения CSRF токена
curl -i https://yourdomain.com/api/csrf-token

# Должен вернуть:
# Set-Cookie: __Host-csrf.token=...
# {"csrfToken":"...","message":"CSRF token generated successfully"}
```

### 2. Проверить создание магазина
1. Откройте фронтенд приложение
2. Перейдите в раздел "Магазины"
3. Нажмите "Создать магазин"
4. Заполните форму:
   - Название: Test Store
   - Slug: test-store
   - Описание: Test description
   - Валюта: USD
5. Нажмите "Создать"
6. Проверьте логи: `pm2 logs telegram-backend --lines 100`

### 3. Проверить Telegram бота
```bash
# Проверить логи бота
pm2 logs telegram-bot --lines 50

# Должно быть:
# ✅ Telegram Bot initialized successfully
# ✅ Bot is running...

# НЕ должно быть:
# ❌ TELEGRAM_BOT_TOKEN is not configured properly!
# error: Polling error: ETELEGRAM: 404 Not Found
```

---

## 🐛 Возможные проблемы

### CSRF все еще не работает
1. Проверьте что API доступен по HTTPS
2. Убедитесь что `withCredentials: true` в apiClient
3. Проверьте что CORS настроен правильно:
   ```typescript
   // backend/src/index.ts
   app.use(cors({
     origin: process.env.FRONTEND_URL,
     credentials: true
   }));
   ```

### Бот все еще 404
1. Проверьте токен в `bot/.env`
2. Убедитесь что токен реальный (начинается с цифр, содержит `:`)
3. Проверьте что бот не заблокирован в Telegram
4. Попробуйте создать новый токен через @BotFather

### Права доступа (403)
1. Убедитесь что пользователь имеет роль OWNER или ADMIN
2. Проверьте JWT токен в localStorage
3. Проверьте логи для деталей:
   ```bash
   pm2 logs telegram-backend | grep "Insufficient permissions"
   ```

---

## 📝 Коммит и пуш

```bash
# На локальной машине
cd D:\projects\telegram-ecommerce-cms

git add -A
git commit -m "fix: remove duplicate CSRF middleware and add bot token validation"
git push origin main
```

---

## 📚 Дополнительная информация

- **CSRF Protection:** [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- **Telegram Bot API:** [Official Documentation](https://core.telegram.org/bots/api)
- **PM2 Process Manager:** [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)

---

**Создано:** 2025-10-06
**Статус:** ✅ Готово к развертыванию


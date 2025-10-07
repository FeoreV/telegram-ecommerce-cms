# 🔧 CORS Fix Instructions

## Problem
Frontend на `http://82.147.84.78:3000` не может обратиться к backend на `http://82.147.84.78:3001` из-за CORS блокировки.

## Solution

### На сервере выполните:

```bash
cd ~/telegram-ecommerce-cms/backend
```

### Добавьте в `.env` файл следующие строки:

```bash
# Откройте .env для редактирования
nano .env

# Добавьте или обновите эти переменные:
FRONTEND_URL=http://82.147.84.78:3000
CORS_WHITELIST=http://localhost:3000,http://localhost:5173,http://82.147.84.78:3000,http://82.147.84.78:3001
ADMIN_PANEL_URL=http://82.147.84.78:3001/admin
CORS_CREDENTIALS=true
ADDITIONAL_CORS_ORIGINS=http://82.147.84.78:3000,http://82.147.84.78:3001
```

### Или используйте команды:

```bash
cd ~/telegram-ecommerce-cms/backend

# Backup .env
cp .env .env.backup.cors

# Add/Update FRONTEND_URL
if grep -q "^FRONTEND_URL=" .env; then
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=http://82.147.84.78:3000|" .env
else
    echo "FRONTEND_URL=http://82.147.84.78:3000" >> .env
fi

# Add/Update CORS_WHITELIST
if grep -q "^CORS_WHITELIST=" .env; then
    sed -i "s|^CORS_WHITELIST=.*|CORS_WHITELIST=http://localhost:3000,http://localhost:5173,http://82.147.84.78:3000,http://82.147.84.78:3001|" .env
else
    echo "CORS_WHITELIST=http://localhost:3000,http://localhost:5173,http://82.147.84.78:3000,http://82.147.84.78:3001" >> .env
fi

# Add/Update CORS_CREDENTIALS
if grep -q "^CORS_CREDENTIALS=" .env; then
    sed -i "s|^CORS_CREDENTIALS=.*|CORS_CREDENTIALS=true|" .env
else
    echo "CORS_CREDENTIALS=true" >> .env
fi

echo "✅ CORS settings updated!"
```

### Перезапустите backend:

```bash
# Если используете PM2
pm2 restart backend

# Или если запускаете напрямую
pkill -f "tsx watch"
npm run dev
```

### Проверьте что работает:

```bash
# Проверьте что backend запустился
curl http://localhost:3001/health

# Проверьте CORS headers
curl -H "Origin: http://82.147.84.78:3000" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     -v http://82.147.84.78:3001/api/csrf-token
```

В ответе должны быть headers:
- `Access-Control-Allow-Origin: http://82.147.84.78:3000`
- `Access-Control-Allow-Credentials: true`

## Альтернатива: Используйте готовый скрипт

После `git pull`:

```bash
cd ~/telegram-ecommerce-cms/backend
chmod +x fix-cors.sh fix-jwt-secrets.sh
./fix-jwt-secrets.sh
./fix-cors.sh
npm run dev
```

---

## Что было исправлено:

1. ✅ `FRONTEND_URL` - указывает на frontend сервера
2. ✅ `CORS_WHITELIST` - список разрешённых origins
3. ✅ `CORS_CREDENTIALS` - разрешает cookies и credentials
4. ✅ Backend разрешит CORS запросы с фронтенда

**После этого CORS ошибки исчезнут!** 🎉


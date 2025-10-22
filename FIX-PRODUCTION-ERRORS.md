# Исправление ошибок на production сервере

## Проблемы, которые были найдены:

1. ❌ **require() в ErrorBoundary** - не работает в production build
2. ❌ **Nginx проксирует на dev сервер** - должен отдавать статические файлы
3. ❌ **502 Bad Gateway** - бэкенд не запущен или недоступен
4. ❌ **WebSocket не подключается** - проблема с бэкендом

## Решение:

### 1. Исправлен код ErrorBoundary ✅
Заменил `require()` на ES6 import - уже исправлено в коде.

### 1.1. Исправлен health endpoint ✅
Создан упрощенный health endpoint, который не падает с 500 ошибкой.

### 2. Пересобрать фронтенд

На сервере выполните:

```bash
cd /root/telegram-ecommerce-cms/frontend
npm run build
```

Или если используете pnpm:

```bash
cd /root/telegram-ecommerce-cms
pnpm --filter telegram-ecommerce-admin build
```

### 3. Обновить nginx конфигурацию

Обновленная конфигурация уже сохранена в `nginx-megapenis.work.gd.conf`.

Скопируйте на сервер:

```bash
# На сервере
sudo cp /root/telegram-ecommerce-cms/nginx-megapenis.work.gd.conf /etc/nginx/sites-available/megapenis.work.gd.conf

# Проверьте конфигурацию
sudo nginx -t

# Если OK, перезагрузите nginx
sudo systemctl reload nginx
```

### 4. Проверить и запустить бэкенд

```bash
# Проверьте, запущен ли бэкенд
pm2 list

# Если не запущен, запустите:
cd /root/telegram-ecommerce-cms/backend
pm2 start npm --name "telegram-backend" -- start

# Или если используете другой способ:
npm start

# Проверьте логи
pm2 logs telegram-backend
```

### 5. Проверить переменные окружения

Убедитесь, что в `/root/telegram-ecommerce-cms/backend/.env` есть:

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=localhost
CORS_ORIGIN=localhost
```

### 6. Полная последовательность команд для сервера:

```bash
# 1. Перейти в директорию проекта
cd /root/telegram-ecommerce-cms

# 2. Получить последние изменения
git pull

# 3. Установить зависимости (если нужно)
npm install

# 4. Собрать фронтенд
cd frontend
npm run build
cd ..

# 5. Обновить nginx
sudo cp nginx-megapenis.work.gd.conf /etc/nginx/sites-available/megapenis.work.gd.conf
sudo nginx -t
sudo systemctl reload nginx

# 6. Перезапустить бэкенд
cd backend
pm2 restart telegram-backend || pm2 start npm --name "telegram-backend" -- start

# 7. Проверить статус
pm2 status
pm2 logs telegram-backend --lines 50
```

## Проверка работы:

После выполнения команд проверьте:

1. **Бэкенд работает**: `curl http://localhost:3001/health`
2. **Фронтенд собран**: `ls -la /root/telegram-ecommerce-cms/frontend/dist`
3. **Nginx отдает файлы**: `curl -I localhost`
4. **API доступен**: `curl localhost/api/csrf-token`

## Если ошибки остались:

### Проверьте логи nginx:
```bash
sudo tail -f /var/log/nginx/megapenis-error.log
```

### Проверьте логи бэкенда:
```bash
pm2 logs telegram-backend
```

### Проверьте, слушает ли бэкенд порт 3001:
```bash
sudo netstat -tlnp | grep 3001
# или
sudo ss -tlnp | grep 3001
```

### Если бэкенд не запускается:
```bash
cd /root/telegram-ecommerce-cms/backend
npm run build
node dist/src/index.js
```

## Быстрый скрипт для деплоя:

Создайте файл `deploy-production.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

cd /root/telegram-ecommerce-cms

echo "📥 Pulling latest changes..."
git pull

echo "📦 Installing dependencies..."
npm install

echo "🏗️  Building frontend..."
cd frontend
npm run build
cd ..

echo "🏗️  Building backend..."
cd backend
npm run build
cd ..

echo "🔧 Updating nginx config..."
sudo cp nginx-megapenis.work.gd.conf /etc/nginx/sites-available/megapenis.work.gd.conf
sudo nginx -t
sudo systemctl reload nginx

echo "🔄 Restarting backend..."
cd backend
pm2 restart telegram-backend || pm2 start npm --name "telegram-backend" -- start

echo "✅ Deployment complete!"
echo "📊 Checking status..."
pm2 status

echo ""
echo "🌐 Your site should now be available at: localhost"
```

Сделайте его исполняемым:
```bash
chmod +x deploy-production.sh
```

И запускайте при каждом деплое:
```bash
./deploy-production.sh
```

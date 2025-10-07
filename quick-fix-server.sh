#!/bin/bash
# Быстрое исправление проблем на сервере
# Копируйте и выполните этот скрипт на сервере

set -e

cd /root/telegram-ecommerce-cms

echo "🔐 Генерация security keys..."

# Функция генерации ключа
gen_key() { openssl rand -hex 32; }
gen_b64() { openssl rand -base64 64 | tr -d '\n'; }

# Создаем backend/.env если нет
[ ! -f backend/.env ] && touch backend/.env

# Добавляем или обновляем ключи в backend/.env
update_env() {
    local key=$1
    local value=$2
    local file=${3:-backend/.env}
    
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# Генерируем все ключи
echo "Генерация ключей..."
update_env "SECURITY_LOGS_KEY_ID" "$(gen_key)"
update_env "SBOM_SIGNING_KEY_ID" "$(gen_key)"
update_env "COMMUNICATION_KEY_ID" "$(gen_key)"
update_env "WEBSOCKET_KEY_ID" "$(gen_key)"
update_env "BACKUP_KEY_ID" "$(gen_key)"
update_env "STORAGE_KEY_ID" "$(gen_key)"
update_env "LOG_KEY_ID" "$(gen_key)"
update_env "JWT_SECRET" "$(gen_b64)"
update_env "JWT_REFRESH_SECRET" "$(gen_b64)"
update_env "SESSION_SECRET" "$(gen_b64)"
update_env "COOKIE_SECRET" "$(gen_b64)"
update_env "NODE_ENV" "production"
update_env "PORT" "3002"

echo "✓ Ключи сгенерированы"

# Проверяем bot token
echo ""
echo "🤖 Проверка bot token..."
[ ! -f bot/.env ] && touch bot/.env

if ! grep -q "^TELEGRAM_BOT_TOKEN=" bot/.env || grep -q "TELEGRAM_BOT_TOKEN=$" bot/.env; then
    echo "⚠️  Bot token не настроен!"
    echo "Получите токен от @BotFather и выполните:"
    echo "echo 'TELEGRAM_BOT_TOKEN=ваш_токен' >> /root/telegram-ecommerce-cms/bot/.env"
    BOT_TOKEN_MISSING=1
else
    echo "✓ Bot token найден"
fi

update_env "NODE_ENV" "production" "bot/.env"
update_env "API_URL" "http://localhost:3002" "bot/.env"

# Исправляем права
echo ""
echo "🔧 Исправление прав доступа..."
chmod -R 755 frontend/node_modules/.bin 2>/dev/null || true
chmod +x frontend/node_modules/.bin/vite 2>/dev/null || true

# Создаем директории для логов
mkdir -p backend/logs bot/logs frontend/logs
chmod -R 755 backend/logs bot/logs frontend/logs

echo "✓ Права исправлены"

# Пересобираем приложения
echo ""
echo "🏗️  Пересборка приложений..."

cd backend
npm install --production=false 2>/dev/null || true
npm run build
cd ..

cd bot
npm install --production=false 2>/dev/null || true
npm run build
cd ..

cd frontend  
npm install --production=false 2>/dev/null || true
npm run build
cd ..

echo "✓ Приложения пересобраны"

# Перезапускаем PM2
echo ""
echo "🔄 Перезапуск сервисов..."
pm2 stop all
sleep 2
pm2 delete all
pm2 start config/services/ecosystem.config.cjs
pm2 save

echo ""
echo "✅ Готово!"
echo ""
pm2 status

if [ -n "$BOT_TOKEN_MISSING" ]; then
    echo ""
    echo "⚠️  ВАЖНО: Настройте bot token:"
    echo "echo 'TELEGRAM_BOT_TOKEN=ваш_токен' >> /root/telegram-ecommerce-cms/bot/.env"
    echo "pm2 restart telegram-bot"
fi

echo ""
echo "📊 Просмотр логов: pm2 logs"


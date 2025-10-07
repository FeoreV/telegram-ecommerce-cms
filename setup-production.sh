#!/bin/bash
# Автоматическая настройка production окружения
# Использование: bash setup-production.sh

set -e

echo "🚀 Автоматическая настройка Telegram E-Commerce CMS"
echo "===================================================="
echo ""

# Определяем корневую директорию
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Функция генерации ключей
generate_key() {
    openssl rand -hex 32
}

generate_base64() {
    openssl rand -base64 64 | tr -d '\n'
}

# ========================================
# 1. Настройка Backend .env
# ========================================
echo "📝 Настройка backend/.env..."

if [ ! -f backend/.env ]; then
    cat > backend/.env << EOF
# Node Environment
NODE_ENV=production
PORT=3002

# Database
DATABASE_URL="file:./prisma/dev.db"

# Frontend
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002

# JWT Secrets
JWT_SECRET=$(generate_base64)
JWT_REFRESH_SECRET=$(generate_base64)
SESSION_SECRET=$(generate_base64)
COOKIE_SECRET=$(generate_base64)
CSRF_SECRET=$(generate_base64)

# Encryption Key IDs
SECURITY_LOGS_KEY_ID=$(generate_key)
SBOM_SIGNING_KEY_ID=$(generate_key)
COMMUNICATION_KEY_ID=$(generate_key)
WEBSOCKET_KEY_ID=$(generate_key)
BACKUP_KEY_ID=$(generate_key)
STORAGE_KEY_ID=$(generate_key)
LOG_KEY_ID=$(generate_key)

# Admin credentials (измените после первого запуска!)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme123

# Optional services
REDIS_URL=redis://localhost:6379
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@example.com
EOF
    echo "✅ backend/.env создан с новыми ключами"
else
    echo "⚠️  backend/.env уже существует, пропускаем"
fi

# ========================================
# 2. Настройка Bot .env
# ========================================
echo ""
echo "📝 Настройка bot/.env..."

if [ ! -f bot/.env ]; then
    cat > bot/.env << EOF
NODE_ENV=production
API_URL=http://localhost:3002
TELEGRAM_BOT_TOKEN=
EOF
    echo "✅ bot/.env создан"
    echo "⚠️  ВНИМАНИЕ: Добавьте TELEGRAM_BOT_TOKEN в bot/.env!"
else
    echo "⚠️  bot/.env уже существует, пропускаем"
fi

# ========================================
# 3. Создание директорий
# ========================================
echo ""
echo "📁 Создание необходимых директорий..."
mkdir -p backend/logs
mkdir -p bot/logs
mkdir -p frontend/logs
mkdir -p storage/logs
mkdir -p backend/uploads/payment-proofs
chmod -R 755 backend/logs bot/logs frontend/logs storage/logs backend/uploads
echo "✅ Директории созданы"

# ========================================
# 4. Сборка Backend
# ========================================
echo ""
echo "🏗️  Сборка backend..."
cd backend

# Установка зависимостей
npm install --production=false

# Исправление прав
chmod -R 755 node_modules/.bin 2>/dev/null || true

# Настройка базы данных
echo "📦 Настройка базы данных..."
npx prisma generate
npx prisma migrate deploy || npx prisma db push

# Сборка
npm run build

cd ..
echo "✅ Backend собран"

# ========================================
# 5. Сборка Bot
# ========================================
echo ""
echo "🤖 Сборка bot..."
cd bot

npm install --production=false
chmod -R 755 node_modules/.bin 2>/dev/null || true
npm run build

cd ..
echo "✅ Bot собран"

# ========================================
# 6. Сборка Frontend
# ========================================
echo ""
echo "🎨 Сборка frontend..."
cd frontend

npm install --production=false
chmod -R 755 node_modules/.bin 2>/dev/null || true
npm run build

cd ..
echo "✅ Frontend собран"

# ========================================
# 7. Настройка PM2
# ========================================
echo ""
echo "🔄 Настройка PM2..."

# Остановка старых процессов
pm2 stop all 2>/dev/null || true
sleep 2
pm2 delete all 2>/dev/null || true
sleep 1

# Запуск с новой конфигурацией
pm2 start config/services/ecosystem.config.cjs

# Сохранение конфигурации
pm2 save

# Настройка автозапуска (если root или sudo)
if [ "$EUID" -eq 0 ]; then
    pm2 startup systemd -u ${SUDO_USER:-$USER} --hp /home/${SUDO_USER:-$USER} 2>/dev/null || pm2 startup
fi

echo "✅ PM2 настроен"

# ========================================
# 8. Финальная проверка
# ========================================
echo ""
echo "✅ ВСЁ ГОТОВО!"
echo "===================================================="
echo ""
echo "📊 Статус сервисов:"
pm2 status

echo ""
echo "📝 Следующие шаги:"
echo ""
echo "1. Проверьте логи:"
echo "   pm2 logs"
echo ""
echo "2. Если используете Telegram бота, добавьте токен:"
echo "   nano bot/.env"
echo "   Добавьте: TELEGRAM_BOT_TOKEN=ваш_токен"
echo "   pm2 restart telegram-bot"
echo ""
echo "3. Измените пароль администратора:"
echo "   После первого входа в систему"
echo ""
echo "4. Доступ к приложению:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:3002"
echo ""
echo "5. Мониторинг:"
echo "   pm2 monit"
echo ""

# Показать предупреждения
if ! grep -q "TELEGRAM_BOT_TOKEN=.*[0-9]" bot/.env 2>/dev/null; then
    echo "⚠️  ВНИМАНИЕ: Telegram bot token не настроен!"
    echo "   Получите токен от @BotFather и добавьте в bot/.env"
    echo ""
fi

echo "✨ Установка завершена успешно!"


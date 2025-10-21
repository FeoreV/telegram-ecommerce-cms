#!/bin/bash
# Быстрое исправление для сервера
# Запустите на сервере: bash fix-server-now.sh YOUR_BOT_TOKEN

if [ -z "$1" ]; then
    echo "❌ Ошибка: Укажите токен бота"
    echo "Использование: bash fix-server-now.sh YOUR_BOT_TOKEN"
    echo "Пример: bash fix-server-now.sh 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
    exit 1
fi

BOT_TOKEN=$1

echo "🔧 Исправление конфигурации..."

cd /root/telegram-ecommerce-cms/backend

# Создаем резервную копию
cp .env .env.backup.$(date +%s)

# Добавляем недостающие переменные
cat >> .env << EOF

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=$BOT_TOKEN

# Security Settings
ENABLE_SECURITY_HEADERS=true
ENABLE_BRUTE_FORCE_PROTECTION=true
USE_HTTPS=false
ADMIN_IP_WHITELIST=

# Security Key IDs
SECURITY_LOGS_KEY_ID=security-logs-key-1
SBOM_SIGNING_KEY_ID=sbom-signing-key-1
COMMUNICATION_KEY_ID=communication-key-1
WEBSOCKET_KEY_ID=websocket-key-1
BACKUP_KEY_ID=backup-key-1
STORAGE_KEY_ID=storage-key-1
LOG_KEY_ID=log-key-1
EOF

echo "✅ Конфигурация обновлена"

# Убиваем процесс на порту 3003 если занят
echo "🔪 Освобождаем порт 3003..."
lsof -ti:3003 | xargs kill -9 2>/dev/null || true

# Пересборка
echo "🔨 Пересборка backend..."
cd /root/telegram-ecommerce-cms/backend
npm run build

echo "🔨 Пересборка frontend..."
cd /root/telegram-ecommerce-cms/frontend
npm run build

# Перезапуск
echo "♻️  Перезапуск сервисов..."
cd /root/telegram-ecommerce-cms
pm2 delete all
pm2 start ecosystem.config.js

echo ""
echo "✅ Готово!"
echo ""
echo "Проверьте статус:"
echo "  pm2 status"
echo "  pm2 logs"

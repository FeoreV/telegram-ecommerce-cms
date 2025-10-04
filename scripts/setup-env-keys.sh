#!/bin/bash

# Скрипт автоматической установки ключей в backend/.env
# Использование: bash scripts/setup-env-keys.sh

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   🔧 Автоматическая установка ключей в backend/.env     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
RED='\033[0;31m'
WHITE='\033[1;37m'
NC='\033[0m'

# Функция генерации ключа
generate_key() {
    openssl rand -hex 32
}

# Функция генерации base64 секрета
generate_base64() {
    local length=$1
    openssl rand -base64 "$length"
}

# Проверка openssl
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}❌ ОШИБКА: openssl не установлен${NC}"
    echo "   Установите: apt-get install openssl (Ubuntu/Debian)"
    echo "            или: brew install openssl (macOS)"
    exit 1
fi

ENV_PATH="backend/.env"

# Проверяем существование файла
if [ -f "$ENV_PATH" ]; then
    echo -e "${YELLOW}⚠️  Файл backend/.env уже существует!${NC}"
    read -p "Добавить ключи в конец файла? (y/n): " response
    if [[ ! "$response" =~ ^([yYдД])$ ]]; then
        echo ""
        echo -e "${RED}❌ Отменено пользователем${NC}"
        exit 0
    fi
    MODE="append"
else
    echo -e "${GREEN}📄 Создаю новый файл backend/.env...${NC}"
    MODE="create"
fi

echo ""
echo -e "${YELLOW}📝 Генерация ключей безопасности...${NC}"

# Генерируем ключи
SECURITY_LOGS_KEY_ID=$(generate_key)
SBOM_SIGNING_KEY_ID=$(generate_key)
COMMUNICATION_KEY_ID=$(generate_key)
WEBSOCKET_KEY_ID=$(generate_key)
BACKUP_KEY_ID=$(generate_key)
STORAGE_KEY_ID=$(generate_key)
LOG_KEY_ID=$(generate_key)

JWT_SECRET=$(generate_base64 64)
JWT_REFRESH_SECRET=$(generate_base64 64)
SESSION_SECRET=$(generate_base64 32)
COOKIE_SECRET=$(generate_base64 32)

# Если файл не существует, создаем с базовой конфигурацией
if [ "$MODE" = "create" ]; then
    cat > "$ENV_PATH" << EOF
# ============================================
# Environment Configuration
# Generated: $(date '+%d.%m.%Y %H:%M:%S')
# ============================================

NODE_ENV=development
PORT=3000

# ============================================
# Database Configuration
# ============================================
DATABASE_URL="file:./prisma/dev.db"

EOF
fi

# Добавляем ключи
cat >> "$ENV_PATH" << EOF

# ============================================
# Security Key IDs для шифрования и защиты данных
# Сгенерировано: $(date '+%d.%m.%Y %H:%M:%S')
# ============================================

# Ключи шифрования
SECURITY_LOGS_KEY_ID=$SECURITY_LOGS_KEY_ID
SBOM_SIGNING_KEY_ID=$SBOM_SIGNING_KEY_ID
COMMUNICATION_KEY_ID=$COMMUNICATION_KEY_ID
WEBSOCKET_KEY_ID=$WEBSOCKET_KEY_ID
BACKUP_KEY_ID=$BACKUP_KEY_ID
STORAGE_KEY_ID=$STORAGE_KEY_ID
LOG_KEY_ID=$LOG_KEY_ID

# JWT и сессии
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
SESSION_SECRET=$SESSION_SECRET
COOKIE_SECRET=$COOKIE_SECRET

# Дополнительные настройки безопасности
ENABLE_CSRF_PROTECTION=true
HASH_ALGORITHM=sha256
ENCRYPTION_ALGORITHM=aes-256-gcm

EOF

echo ""
echo -e "${GREEN}✅ Ключи успешно добавлены в backend/.env!${NC}"
echo ""
echo -e "${BLUE}📋 Добавлены следующие переменные:${NC}"
echo -e "${WHITE}   • SECURITY_LOGS_KEY_ID${NC}"
echo -e "${WHITE}   • SBOM_SIGNING_KEY_ID${NC}"
echo -e "${WHITE}   • COMMUNICATION_KEY_ID${NC}"
echo -e "${WHITE}   • WEBSOCKET_KEY_ID${NC}"
echo -e "${WHITE}   • BACKUP_KEY_ID${NC}"
echo -e "${WHITE}   • STORAGE_KEY_ID${NC}"
echo -e "${WHITE}   • LOG_KEY_ID${NC}"
echo -e "${WHITE}   • JWT_SECRET${NC}"
echo -e "${WHITE}   • JWT_REFRESH_SECRET${NC}"
echo -e "${WHITE}   • SESSION_SECRET${NC}"
echo -e "${WHITE}   • COOKIE_SECRET${NC}"

echo ""
echo -e "${YELLOW}🔄 Следующие шаги:${NC}"
echo -e "${WHITE}   1. Перезапустите приложение${NC}"
echo -e "${WHITE}   2. Предупреждения о временных ключах исчезнут${NC}"

echo ""
echo -e "${RED}⚠️  ВАЖНО:${NC}"
echo -e "${WHITE}   • backend/.env в .gitignore - можете безопасно работать${NC}"
echo -e "${WHITE}   • Эти ключи для DEVELOPMENT окружения${NC}"
echo -e "${WHITE}   • Для PRODUCTION сгенерируйте новые ключи!${NC}"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                     ✓ ГОТОВО!                            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""


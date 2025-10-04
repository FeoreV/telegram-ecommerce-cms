#!/bin/bash

# Security Keys Generation Script
# Telegram E-Commerce CMS Platform
# 
# This script generates secure random keys for encryption and signing

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║      🔐 Генератор Key IDs для всех сервисов              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to generate a random hex string
generate_key() {
    openssl rand -hex 32
}

# Проверка наличия openssl
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}❌ ОШИБКА: openssl не установлен${NC}"
    echo "   Установите: apt-get install openssl (Ubuntu/Debian)"
    echo "            или: brew install openssl (macOS)"
    exit 1
fi

echo -e "${YELLOW}📝 Генерация ключей...${NC}"
echo ""

# Generate keys
SECURITY_LOGS_KEY_ID=$(generate_key)
SBOM_SIGNING_KEY_ID=$(generate_key)
COMMUNICATION_KEY_ID=$(generate_key)
WEBSOCKET_KEY_ID=$(generate_key)
BACKUP_KEY_ID=$(generate_key)
STORAGE_KEY_ID=$(generate_key)
LOG_KEY_ID=$(generate_key)

echo -e "${GREEN}✓${NC} SECURITY_LOGS_KEY_ID       - Шифрование логов безопасности"
echo -e "${GREEN}✓${NC} SBOM_SIGNING_KEY_ID        - Подпись списка компонентов (SBOM)"
echo -e "${GREEN}✓${NC} COMMUNICATION_KEY_ID       - Шифрование коммуникаций"
echo -e "${GREEN}✓${NC} WEBSOCKET_KEY_ID           - Защита WebSocket соединений"
echo -e "${GREEN}✓${NC} BACKUP_KEY_ID              - Шифрование бэкапов"
echo -e "${GREEN}✓${NC} STORAGE_KEY_ID             - Шифрование данных в хранилище"
echo -e "${GREEN}✓${NC} LOG_KEY_ID                 - Шифрование обычных логов"

# Generate JWT secrets
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 32)
COOKIE_SECRET=$(openssl rand -base64 32)

echo ""
echo -e "${GREEN}✓${NC} JWT_SECRET                 - JWT токены"
echo -e "${GREEN}✓${NC} JWT_REFRESH_SECRET         - JWT refresh токены"
echo -e "${GREEN}✓${NC} SESSION_SECRET             - Сессии пользователей"
echo -e "${GREEN}✓${NC} COOKIE_SECRET              - Защита cookies"

echo ""
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📋 Копируйте следующие строки в ваш .env файл:${NC}"
echo ""
echo "# ============================================"
echo "# Key IDs для шифрования и защиты данных"
echo "# Сгенерировано: $(date '+%d.%m.%Y %H:%M:%S')"
echo "# ============================================"
echo ""
echo "# Ключи шифрования"
echo "SECURITY_LOGS_KEY_ID=$SECURITY_LOGS_KEY_ID"
echo "SBOM_SIGNING_KEY_ID=$SBOM_SIGNING_KEY_ID"
echo "COMMUNICATION_KEY_ID=$COMMUNICATION_KEY_ID"
echo "WEBSOCKET_KEY_ID=$WEBSOCKET_KEY_ID"
echo "BACKUP_KEY_ID=$BACKUP_KEY_ID"
echo "STORAGE_KEY_ID=$STORAGE_KEY_ID"
echo "LOG_KEY_ID=$LOG_KEY_ID"
echo ""
echo "# JWT и сессии"
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "SESSION_SECRET=$SESSION_SECRET"
echo "COOKIE_SECRET=$COOKIE_SECRET"
echo ""
echo "# Дополнительные настройки безопасности"
echo "ENABLE_CSRF_PROTECTION=true"
echo "HASH_ALGORITHM=sha256"
echo "ENCRYPTION_ALGORITHM=aes-256-gcm"
echo ""

# Optionally write to a file
echo -e "${YELLOW}Сохранить в файл .env.keys? (y/n): ${NC}"
read -r response
if [[ "$response" =~ ^([yYдД][eE]?[sS]?|[yYдД][aА]?)$ ]]; then
    cat > .env.keys << EOF
# ============================================
# Key IDs для шифрования и защиты данных
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
    echo -e "${GREEN}✓ Ключи сохранены в .env.keys${NC}"
    echo -e "${YELLOW}⚠️  ВАЖНО:${NC}"
    echo "   1. Скопируйте содержимое .env.keys в ваш .env файл"
    echo "   2. Удалите .env.keys после копирования"
    echo "   3. Убедитесь, что .env в .gitignore"
else
    echo ""
    echo -e "${BLUE}✓ Скопируйте ключи вручную из вывода выше${NC}"
fi

echo ""
echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║                     ✓ ГОТОВО!                            ║${NC}"
echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${RED}⚠️  ПРЕДУПРЕЖДЕНИЯ БЕЗОПАСНОСТИ:${NC}"
echo "   • НИКОГДА не коммитьте .env файлы в Git"
echo "   • Храните ключи в безопасном месте"
echo "   • Используйте разные ключи для dev/prod"
echo "   • Регулярно ротируйте ключи в продакшене"
echo ""


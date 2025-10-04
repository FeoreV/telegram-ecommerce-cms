#!/bin/bash
# Security Secrets Generator
# Генерирует криптографически стойкие секреты для приложения

set -e

echo "🔐 Генератор секретов безопасности"
echo "===================================="
echo ""

# Функция генерации секрета
generate_secret() {
    local length=$1
    openssl rand -base64 "$length" | tr -d '\n'
}

# Проверка наличия openssl
if ! command -v openssl &> /dev/null; then
    echo "❌ ОШИБКА: openssl не установлен"
    echo "   Установите: apt-get install openssl (Ubuntu/Debian)"
    echo "            или: brew install openssl (macOS)"
    exit 1
fi

echo "Генерация секретов..."
echo ""

# Генерация JWT секретов (32+ байт)
JWT_SECRET=$(generate_secret 48)
JWT_REFRESH_SECRET=$(generate_secret 48)

# Генерация других секретов
CA_PASSWORD=$(generate_secret 24)
SESSION_SECRET=$(generate_secret 48)
CSRF_SECRET=$(generate_secret 48)

# Генерация паролей для баз данных
DB_PASSWORD=$(generate_secret 24)
REDIS_PASSWORD=$(generate_secret 24)

echo "✅ Секреты успешно сгенерированы!"
echo ""
echo "=========================================="
echo "СЕКРЕТЫ БЕЗОПАСНОСТИ"
echo "=========================================="
echo ""
echo "# ============================================"
echo "# JWT Configuration"
echo "# ============================================"
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "JWT_EXPIRES_IN=1h"
echo "JWT_REFRESH_EXPIRES_IN=7d"
echo ""
echo "# ============================================"
echo "# Session & CSRF Protection"
echo "# ============================================"
echo "SESSION_SECRET=$SESSION_SECRET"
echo "CSRF_SECRET=$CSRF_SECRET"
echo ""
echo "# ============================================"
echo "# TLS/CA Configuration"
echo "# ============================================"
echo "CA_PASSWORD=$CA_PASSWORD"
echo ""
echo "# ============================================"
echo "# Database Passwords"
echo "# ============================================"
echo "DB_PASSWORD=$DB_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
echo ""
echo "=========================================="
echo ""
echo "⚠️  ВАЖНЫЕ ИНСТРУКЦИИ:"
echo ""
echo "1. Скопируйте секреты выше в файл .env"
echo "2. НИКОГДА не коммитьте .env в git"
echo "3. Храните секреты в безопасном месте (password manager)"
echo "4. В продакшене используйте secret management (Vault, AWS Secrets Manager)"
echo "5. Регулярно ротируйте секреты"
echo ""
echo "Быстрое создание .env:"
echo "  ./scripts/security/generate-secrets.sh > .env.generated"
echo "  cat .env.generated >> .env"
echo "  rm .env.generated"
echo ""


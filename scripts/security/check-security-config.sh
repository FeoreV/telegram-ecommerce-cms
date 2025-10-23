#!/bin/bash
# Security Configuration Checker
# Проверяет все критические настройки безопасности перед развертыванием

set -e

echo "🔍 Проверка конфигурации безопасности..."
echo "=========================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Функция для вывода ошибок
error() {
    echo -e "${RED}❌ ОШИБКА:${NC} $1"
    ERRORS=$((ERRORS + 1))
}

# Функция для вывода предупреждений
warning() {
    echo -e "${YELLOW}⚠️  ПРЕДУПРЕЖДЕНИЕ:${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

# Функция для успешных проверок
success() {
    echo -e "${GREEN}✅${NC} $1"
}

echo "1. Проверка JWT Secrets"
echo "------------------------"

# Проверка JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    error "JWT_SECRET не установлен"
elif [ ${#JWT_SECRET} -lt 32 ]; then
    error "JWT_SECRET слишком короткий (${#JWT_SECRET} символов, требуется минимум 32)"
else
    success "JWT_SECRET установлен (${#JWT_SECRET} символов)"
fi

# Проверка JWT_REFRESH_SECRET
if [ -z "$JWT_REFRESH_SECRET" ]; then
    error "JWT_REFRESH_SECRET не установлен"
elif [ ${#JWT_REFRESH_SECRET} -lt 32 ]; then
    error "JWT_REFRESH_SECRET слишком короткий (${#JWT_REFRESH_SECRET} символов, требуется минимум 32)"
else
    success "JWT_REFRESH_SECRET установлен (${#JWT_REFRESH_SECRET} символов)"
fi

echo ""
echo "2. Проверка Database Configuration"
echo "-----------------------------------"

if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL не установлен"
else
    # Проверка, что пароль не является default
    if [[ "$DATABASE_URL" == *"password=postgres"* ]] || [[ "$DATABASE_URL" == *"password=password"* ]]; then
        warning "DATABASE_URL содержит слабый пароль (postgres/password)"
    else
        success "DATABASE_URL установлен"
    fi
fi

echo ""
echo "3. Проверка Redis Configuration"
echo "--------------------------------"

if [ -z "$REDIS_URL" ]; then
    warning "REDIS_URL не установлен (будет использоваться 82.147.84.78:6379)"
else
    success "REDIS_URL установлен"
fi

if [ -n "$REDIS_PASSWORD" ]; then
    if [ ${#REDIS_PASSWORD} -lt 16 ]; then
        warning "REDIS_PASSWORD слишком короткий (${#REDIS_PASSWORD} символов, рекомендуется минимум 16)"
    else
        success "REDIS_PASSWORD установлен (${#REDIS_PASSWORD} символов)"
    fi
fi

echo ""
echo "4. Проверка CA Password (если используется TLS)"
echo "------------------------------------------------"

if [ -n "$CA_PASSWORD" ]; then
    if [ ${#CA_PASSWORD} -lt 16 ]; then
        error "CA_PASSWORD слишком короткий (${#CA_PASSWORD} символов, требуется минимум 16)"
    else
        success "CA_PASSWORD установлен (${#CA_PASSWORD} символов)"
    fi
fi

echo ""
echo "5. Проверка Vault Configuration"
echo "--------------------------------"

if [ -n "$ENVIRONMENT" ]; then
    success "ENVIRONMENT установлен: $ENVIRONMENT"

    if [ "$ENVIRONMENT" = "production" ]; then
        # Проверки для продакшена
        VAULT_SHARES=${VAULT_KEY_SHARES:-1}
        VAULT_THRESHOLD=${VAULT_KEY_THRESHOLD:-1}

        if [ "$VAULT_SHARES" -lt 3 ]; then
            warning "VAULT_KEY_SHARES=$VAULT_SHARES (рекомендуется минимум 5 для продакшена)"
        else
            success "VAULT_KEY_SHARES=$VAULT_SHARES"
        fi

        if [ "$VAULT_THRESHOLD" -lt 3 ]; then
            warning "VAULT_KEY_THRESHOLD=$VAULT_THRESHOLD (рекомендуется минимум 3 для продакшена)"
        else
            success "VAULT_KEY_THRESHOLD=$VAULT_THRESHOLD"
        fi

        if [ "$VAULT_SHARES" -eq 1 ] && [ "$ALLOW_SINGLE_KEY_PROD" != "true" ]; then
            error "Single-key Vault конфигурация заблокирована в production"
        fi
    fi
else
    warning "ENVIRONMENT не установлен (будет использоваться development)"
fi

echo ""
echo "6. Проверка Session Security"
echo "-----------------------------"

if [ -z "$SESSION_SECRET" ]; then
    warning "SESSION_SECRET не установлен"
elif [ ${#SESSION_SECRET} -lt 32 ]; then
    warning "SESSION_SECRET слишком короткий (${#SESSION_SECRET} символов, рекомендуется минимум 32)"
else
    success "SESSION_SECRET установлен (${#SESSION_SECRET} символов)"
fi

echo ""
echo "7. Проверка CSRF Protection"
echo "---------------------------"

if [ -z "$CSRF_SECRET" ]; then
    warning "CSRF_SECRET не установлен"
elif [ ${#CSRF_SECRET} -lt 32 ]; then
    warning "CSRF_SECRET слишком короткий (${#CSRF_SECRET} символов, рекомендуется минимум 32)"
else
    success "CSRF_SECRET установлен (${#CSRF_SECRET} символов)"
fi

echo ""
echo "8. Проверка Node Environment"
echo "-----------------------------"

NODE_ENV_VALUE=${NODE_ENV:-development}
success "NODE_ENV установлен: $NODE_ENV_VALUE"

if [ "$NODE_ENV_VALUE" = "production" ] && [ "$ENVIRONMENT" != "production" ]; then
    warning "NODE_ENV=production но ENVIRONMENT!==production (несоответствие)"
fi

echo ""
echo "9. Проверка файлов конфигурации"
echo "--------------------------------"

# Проверка .env файла
if [ -f ".env" ]; then
    success ".env файл существует"

    # Проверка прав доступа
    PERMS=$(stat -c '%a' .env 2>/dev/null || stat -f '%A' .env 2>/dev/null)
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "0600" ]; then
        warning ".env файл имеет слишком открытые права ($PERMS), рекомендуется 600"
        echo "   Выполните: chmod 600 .env"
    else
        success ".env файл имеет правильные права доступа ($PERMS)"
    fi
else
    warning ".env файл не найден (используются переменные окружения)"
fi

# Проверка .gitignore
if [ -f ".gitignore" ]; then
    if grep -q "^\.env$" .gitignore; then
        success ".env добавлен в .gitignore"
    else
        error ".env НЕ добавлен в .gitignore (риск утечки секретов!)"
    fi
fi

echo ""
echo "10. Проверка зависимостей"
echo "-------------------------"

# Проверка backend
if [ -d "backend" ]; then
    echo "Backend зависимости:"
    cd backend
    if command -v npm &> /dev/null; then
        BACKEND_VULNS=$(npm audit --json 2>/dev/null | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
        if [ "$BACKEND_VULNS" -eq 0 ]; then
            success "Нет уязвимостей"
        else
            warning "Найдено $BACKEND_VULNS уязвимостей (запустите: npm audit)"
        fi
    fi
    cd ..
fi

# Проверка bot
if [ -d "bot" ]; then
    echo "Bot зависимости:"
    cd bot
    if command -v npm &> /dev/null; then
        BOT_VULNS=$(npm audit --json 2>/dev/null | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
        if [ "$BOT_VULNS" -eq 0 ]; then
            success "Нет уязвимостей"
        else
            # Проверяем критические
            BOT_CRITICAL=$(npm audit --json 2>/dev/null | grep -o '"critical":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
            if [ "$BOT_CRITICAL" -gt 0 ]; then
                error "Найдено $BOT_CRITICAL критических уязвимостей (запустите: npm audit fix)"
            else
                warning "Найдено $BOT_VULNS некритических уязвимостей"
            fi
        fi
    fi
    cd ..
fi

echo ""
echo "=========================================="
echo "РЕЗУЛЬТАТЫ ПРОВЕРКИ"
echo "=========================================="

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ Найдено ошибок: $ERRORS${NC}"
    echo "   Исправьте критические проблемы перед развертыванием!"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Найдено предупреждений: $WARNINGS${NC}"
    echo "   Рекомендуется исправить перед развертыванием в продакшен."
    exit 0
else
    echo -e "${GREEN}✅ Все проверки пройдены успешно!${NC}"
    echo "   Конфигурация безопасности соответствует требованиям."
    exit 0
fi


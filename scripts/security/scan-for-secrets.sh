#!/bin/bash
# Secret Leak Scanner
# Сканирует код на наличие случайно закоммиченных секретов

set -e

echo "🔍 Сканирование кода на утечки секретов..."
echo "==========================================="
echo ""

FOUND_ISSUES=0

# Цвета
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Паттерны для поиска секретов
declare -a PATTERNS=(
    # API Keys
    "api[_-]?key['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{20,}['\"]"
    "apikey['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{20,}['\"]"

    # Tokens
    "token['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{20,}['\"]"
    "access[_-]?token['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{20,}['\"]"
    "secret[_-]?token['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{20,}['\"]"

    # Passwords (очевидные)
    "password['\"]?\s*[:=]\s*['\"][^'\"\s]{8,}['\"]"
    "passwd['\"]?\s*[:=]\s*['\"][^'\"\s]{8,}['\"]"

    # Private Keys
    "private[_-]?key['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{20,}['\"]"
    "-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----"

    # AWS
    "AKIA[0-9A-Z]{16}"
    "aws[_-]?access[_-]?key[_-]?id['\"]?\s*[:=]\s*['\"][A-Z0-9]{20}['\"]"
    "aws[_-]?secret[_-]?access[_-]?key['\"]?\s*[:=]\s*['\"][A-Za-z0-9/+=]{40}['\"]"

    # GitHub
    "ghp_[0-9a-zA-Z]{36}"
    "gho_[0-9a-zA-Z]{36}"
    "github[_-]?token['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{40}['\"]"

    # Stripe
    "sk_live_[0-9a-zA-Z]{24,}"
    "pk_live_[0-9a-zA-Z]{24,}"

    # Database URLs with passwords
    "postgresql://[^:]+:[^@]{8,}@"
    "mysql://[^:]+:[^@]{8,}@"
)

echo "Сканируемые директории:"
echo "  - backend/src"
echo "  - bot/src"
echo "  - frontend/src"
echo "  - config/"
echo ""

# Исключения (файлы, которые можно игнорировать)
EXCLUDE_PATTERNS="test|spec|example|mock|fixture|scan-for-secrets"

# Функция сканирования
scan_directory() {
    local dir=$1

    if [ ! -d "$dir" ]; then
        return
    fi

    echo "Сканирование: $dir"

    for pattern in "${PATTERNS[@]}"; do
        # Ищем паттерн, исключая тестовые файлы и примеры
        results=$(grep -riE "$pattern" "$dir" \
            --exclude-dir=node_modules \
            --exclude-dir=dist \
            --exclude-dir=build \
            --exclude-dir=.git \
            --exclude="*.log" \
            --exclude="*.lock" \
            --exclude="*.json.map" \
            --exclude="package-lock.json" \
            --exclude="pnpm-lock.yaml" \
            | grep -vE "$EXCLUDE_PATTERNS" \
            || true)

        if [ -n "$results" ]; then
            echo -e "${RED}⚠️  Найдены потенциальные секреты:${NC}"
            echo "$results"
            echo ""
            FOUND_ISSUES=$((FOUND_ISSUES + 1))
        fi
    done
}

# Сканирование директорий
scan_directory "backend/src"
scan_directory "bot/src"
scan_directory "frontend/src"
scan_directory "config"

# Проверка .env файлов в git
echo ""
echo "Проверка .env файлов в git..."
if git ls-files | grep -E "^\.env$|\.env\.production$|\.env\.local$" > /dev/null 2>&1; then
    echo -e "${RED}❌ КРИТИЧНО: .env файлы найдены в git!${NC}"
    git ls-files | grep -E "^\.env"
    echo ""
    echo "Удалите их немедленно:"
    echo "  git rm --cached .env"
    echo "  git commit -m 'Remove .env from git'"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
    echo -e "${GREEN}✅ .env файлы не закоммичены в git${NC}"
fi

# Проверка истории git на секреты (последние 10 коммитов)
echo ""
echo "Проверка последних коммитов на секреты..."
RECENT_SECRETS=$(git log -10 --all --full-history -p | grep -E "password|secret|token|api_key" | grep -vE "PASSWORD|SECRET|TOKEN|API_KEY|Test|test" || true)

if [ -n "$RECENT_SECRETS" ]; then
    echo -e "${YELLOW}⚠️  Найдены упоминания секретов в последних коммитах:${NC}"
    echo "$RECENT_SECRETS" | head -20
    echo ""
    echo "Проверьте, не были ли случайно закоммичены реальные секреты."
fi

# Итоги
echo ""
echo "==========================================="
echo "РЕЗУЛЬТАТЫ СКАНИРОВАНИЯ"
echo "==========================================="

if [ $FOUND_ISSUES -gt 0 ]; then
    echo -e "${RED}❌ Найдено потенциальных проблем: $FOUND_ISSUES${NC}"
    echo ""
    echo "РЕКОМЕНДАЦИИ:"
    echo "1. Проверьте найденные совпадения"
    echo "2. Удалите любые реальные секреты из кода"
    echo "3. Используйте переменные окружения"
    echo "4. Если секреты уже в git:"
    echo "   - Измените все скомпрометированные секреты"
    echo "   - Очистите git history: git filter-branch или BFG Repo-Cleaner"
    exit 1
else
    echo -e "${GREEN}✅ Секреты не обнаружены${NC}"
    echo "   Код безопасен для коммита."
    exit 0
fi


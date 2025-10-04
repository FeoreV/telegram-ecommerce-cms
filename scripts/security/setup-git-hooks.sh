#!/bin/bash
# Setup Git Hooks for Security
# Устанавливает git hooks для автоматических проверок безопасности

set -e

echo "🔧 Установка Git Hooks для безопасности..."
echo "=========================================="
echo ""

# Создаем директорию hooks если её нет
if [ ! -d ".git/hooks" ]; then
    echo "❌ Директория .git/hooks не найдена"
    echo "   Убедитесь, что вы находитесь в корне git репозитория"
    exit 1
fi

# Копируем pre-commit hook
echo "Установка pre-commit hook..."
if [ -f ".githooks/pre-commit" ]; then
    cp .githooks/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo "✅ Pre-commit hook установлен"
else
    echo "❌ Файл .githooks/pre-commit не найден"
    exit 1
fi

# Тестируем hook
echo ""
echo "Тестирование hook..."
if .git/hooks/pre-commit; then
    echo "✅ Hook работает корректно"
else
    echo "⚠️  Hook выдал предупреждения (это нормально)"
fi

echo ""
echo "=========================================="
echo "✅ Git hooks успешно установлены!"
echo ""
echo "Теперь при каждом коммите будут автоматически проверяться:"
echo "  - Отсутствие секретов в коде"
echo "  - Отсутствие .env файлов"
echo "  - Отсутствие hardcoded credentials"
echo "  - Отсутствие debug кода"
echo ""
echo "Для пропуска проверок (НЕ РЕКОМЕНДУЕТСЯ):"
echo "  git commit --no-verify"
echo ""


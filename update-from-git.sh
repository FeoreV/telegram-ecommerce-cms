#!/bin/bash
# Автоматическое обновление с GitHub с сохранением важных настроек

echo "🔄 Обновление кода с GitHub..."
echo ""

cd /root/telegram-ecommerce-cms

# Сохраняем важные файлы
echo "1. Сохранение текущих настроек..."
cp backend/.env backend/.env.server-backup-$(date +%s)
cp frontend/vite.config.ts frontend/vite.config.ts.backup 2>/dev/null || true

# Откатываем локальные изменения
echo "2. Откат локальных изменений..."
git reset --hard HEAD

# Обновляем код
echo "3. Получение обновлений..."
git pull origin main

# Проверяем что получили
echo ""
echo "✅ Обновлённые файлы:"
git log -1 --stat

# Пересборка
echo ""
echo "4. Пересборка frontend..."
cd frontend
npm run build

echo ""
echo "5. Пересборка backend..."
cd ../backend
npm run build

# Перезапуск
echo ""
echo "6. Перезапуск сервисов..."
cd ..
pm2 restart all

sleep 3

echo ""
echo "✅ Статус сервисов:"
pm2 status

echo ""
echo "🔍 Проверка портов:"
netstat -tlnp | grep -E '3000|3001|3003'

echo ""
echo "🏥 Проверка backend:"
curl -s http://82.147.84.78:3001/api/health | jq . 2>/dev/null || curl -s http://82.147.84.78:3001/api/health

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ГОТОВО!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Проверь сайт: 82.147.84.78"
echo ""
echo "Если нужно восстановить старые настройки:"
echo "  ls -la backend/.env.server-backup-*"
echo ""
echo "Логи в реальном времени:"
echo "  pm2 logs"
echo ""

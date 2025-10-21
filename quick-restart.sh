#!/bin/bash
# Быстрый перезапуск всех сервисов

echo "🔄 Быстрый перезапуск сервисов..."
echo ""

# Убиваем процессы на портах
echo "1. Освобождение портов..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3003 | xargs kill -9 2>/dev/null || true

sleep 2

# Перезапуск PM2
echo "2. Перезапуск PM2..."
cd /root/telegram-ecommerce-cms
pm2 delete all
pm2 start ecosystem.config.js

sleep 5

# Статус
echo ""
echo "✅ Статус сервисов:"
pm2 status

echo ""
echo "🔍 Проверка портов:"
netstat -tlnp | grep -E '3000|3001|3003'

echo ""
echo "🏥 Проверка здоровья backend:"
curl -s http://localhost:3001/api/health | jq . 2>/dev/null || curl -s http://localhost:3001/api/health

echo ""
echo "✅ Готово! Проверь сайт: https://megapenis.work.gd"

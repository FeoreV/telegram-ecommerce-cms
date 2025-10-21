#!/bin/bash
# Диагностика и исправление 502 Bad Gateway

echo "🔍 Диагностика проблемы 502 Bad Gateway..."
echo ""

# 1. Проверка портов
echo "1️⃣ Проверка портов:"
echo "Backend (3001):"
netstat -tlnp | grep 3001 || echo "❌ Backend не слушает порт 3001"
echo ""
echo "Frontend (3000):"
netstat -tlnp | grep 3000 || echo "❌ Frontend не слушает порт 3000"
echo ""
echo "Bot (3003):"
netstat -tlnp | grep 3003 || echo "❌ Bot не слушает порт 3003"
echo ""

# 2. Проверка PM2
echo "2️⃣ Статус PM2:"
pm2 status
echo ""

# 3. Проверка логов
echo "3️⃣ Последние ошибки в логах:"
echo "--- Backend logs ---"
pm2 logs backend --lines 10 --nostream --err
echo ""
echo "--- Frontend logs ---"
pm2 logs frontend --lines 10 --nostream --err
echo ""

# 4. Проверка nginx
echo "4️⃣ Статус Nginx:"
systemctl status nginx --no-pager | head -10
echo ""

# 5. Тест подключения
echo "5️⃣ Тест локальных подключений:"
echo "Backend health:"
curl -s http://localhost:3001/api/health || echo "❌ Backend не отвечает"
echo ""
echo "Frontend:"
curl -s -I http://localhost:3000 | head -5 || echo "❌ Frontend не отвечает"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 ИСПРАВЛЕНИЕ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Хотите перезапустить сервисы? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Перезапуск сервисов..."
    
    # Остановка всех процессов на портах
    echo "Освобождение портов..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3003 | xargs kill -9 2>/dev/null || true
    
    sleep 2
    
    # Перезапуск через PM2
    echo "Перезапуск через PM2..."
    pm2 delete all
    pm2 start ecosystem.config.js
    
    sleep 5
    
    echo ""
    echo "✅ Сервисы перезапущены"
    echo ""
    echo "Новый статус:"
    pm2 status
    
    echo ""
    echo "Проверка портов:"
    netstat -tlnp | grep -E '3000|3001|3003'
    
    echo ""
    echo "Тест backend:"
    curl -s http://localhost:3001/api/health | jq . || curl -s http://localhost:3001/api/health
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 СЛЕДУЮЩИЕ ШАГИ:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Проверь логи в реальном времени:"
echo "   pm2 logs"
echo ""
echo "2. Проверь сайт:"
echo "   https://megapenis.work.gd"
echo ""
echo "3. Если всё ещё 502, проверь nginx логи:"
echo "   tail -f /var/log/nginx/megapenis-error.log"
echo ""
echo "4. Если backend не запускается, проверь .env:"
echo "   cat backend/.env"
echo ""

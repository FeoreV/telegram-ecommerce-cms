#!/bin/bash
# Быстрый перезапуск backend после исправления кнопок товаров

echo "===================================="
echo " Перезапуск Backend после исправления"
echo "===================================="
echo ""

cd backend || exit 1

echo "[1/3] Компиляция TypeScript кода..."
npm run build
if [ $? -ne 0 ]; then
    echo "Ошибка компиляции!"
    exit 1
fi

echo "[2/3] Перезапуск backend сервиса..."
# Проверяем, используется ли PM2
if command -v pm2 &> /dev/null; then
    echo "Используется PM2..."
    pm2 restart backend 2>/dev/null || pm2 start dist/src/index.js --name backend
elif systemctl is-active --quiet telegram-backend; then
    echo "Используется systemd..."
    sudo systemctl restart telegram-backend
else
    echo "Запуск через npm..."
    pkill -f "node.*backend" 2>/dev/null
    nohup npm start > backend.log 2>&1 &
fi

echo "[3/3] Проверка статуса..."
sleep 2

if command -v pm2 &> /dev/null; then
    pm2 status backend
elif systemctl is-active --quiet telegram-backend; then
    systemctl status telegram-backend --no-pager
else
    ps aux | grep "node.*backend" | grep -v grep
fi

echo ""
echo "===================================="
echo " Backend успешно перезапущен!"
echo "===================================="
echo ""
echo "Проверьте Telegram бот:"
echo "1. Откройте бот в Telegram"
echo "2. Отправьте команду /catalog"
echo "3. Убедитесь, что под товарами есть кнопки"
echo ""


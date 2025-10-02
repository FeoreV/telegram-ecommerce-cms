#!/bin/bash

echo "=== Запуск Telegram E-commerce Platform ==="
echo

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "ОШИБКА: Файл .env не найден!"
    echo "Скопируйте config/environments/env.example в .env и заполните необходимые данные"
    exit 1
fi

echo "Останавливаем существующие контейнеры..."
docker-compose -f config/docker/docker-compose.dev.yml down

echo "Запускаем все сервисы..."
docker-compose -f config/docker/docker-compose.dev.yml up -d --build

echo "Ожидаем запуска сервисов..."
sleep 10

echo "Проверяем состояние контейнеров..."
docker-compose -f config/docker/docker-compose.dev.yml ps

echo
echo "=== ✅ Сервисы запущены ==="
echo "- Frontend:    http://localhost:3000"
echo "- Backend API: http://localhost:3001"
echo "- AdminJS:     http://localhost:3001/admin"
echo "- Database:    localhost:3307"  
echo "- Redis:       localhost:6379"
echo
echo "Для просмотра логов: docker-compose -f config/docker/docker-compose.dev.yml logs -f"
echo "Для остановки: docker-compose -f config/docker/docker-compose.dev.yml down"

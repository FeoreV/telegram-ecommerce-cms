#!/bin/bash

echo "=== Запуск Telegram E-commerce Bot в ПРОДАКШЕН режиме ==="

# Проверяем наличие .env.production файла
if [ ! -f .env.production ]; then
    echo "ОШИБКА: Файл .env.production не найден!"
    echo "Создайте .env.production файл с продакшен конфигурацией"
    exit 1
fi

echo "ВНИМАНИЕ: Запуск в ПРОДАКШЕН режиме!"
echo "Убедитесь, что все настройки безопасности корректны."
read -p "Продолжить? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo "Останавливаем существующие контейнеры..."
docker-compose -f config/docker/docker-compose.postgres-prod.yml --env-file .env.production down

echo "Пересоздаем контейнеры для продакшена..."
docker-compose -f config/docker/docker-compose.postgres-prod.yml --env-file .env.production up --build -d

echo "Ожидаем запуска всех сервисов..."
sleep 30

echo "Запускаем миграции базы данных..."
docker-compose -f config/docker/docker-compose.postgres-prod.yml --env-file .env.production exec backend npx prisma migrate deploy

echo "=== Продакшен сервисы запущены ==="
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:3001"
echo "- Bot Webhook: http://localhost:8443"
echo "- Grafana: http://localhost:3001 (admin/admin)"
echo "- Prometheus: http://localhost:9090"
echo "- Kibana: http://localhost:5601"
echo ""
echo "Для просмотра логов: docker-compose -f config/docker/docker-compose.postgres-prod.yml logs -f"

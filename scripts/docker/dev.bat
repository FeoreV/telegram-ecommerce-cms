@echo off
echo "=== Запуск Telegram E-commerce Bot в режиме разработки ==="

REM Проверяем наличие .env файла
if not exist .env (
    echo "ОШИБКА: Файл .env не найден!"
    echo "Скопируйте config/environments/env.example в .env и заполните необходимые данные"
    pause
    exit /b 1
)

echo "Останавливаем существующие контейнеры..."
docker-compose -f config/docker/docker-compose.dev.yml down

echo "Пересоздаем контейнеры с последними изменениями..."
docker-compose -f config/docker/docker-compose.dev.yml up --build -d

echo "Ожидаем запуска баз данных..."
timeout /t 15 /nobreak

echo "Запускаем миграции базы данных..."
docker-compose -f config/docker/docker-compose.dev.yml exec backend npx prisma migrate dev --name init

echo "Запускаем заполнение базы данных тестовыми данными..."
docker-compose -f config/docker/docker-compose.dev.yml exec backend npm run db:seed

echo "=== Сервисы запущены ==="
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:3001"
echo "- AdminJS: http://localhost:3001/admin"
echo "- Database: localhost:3307"
echo "- Redis: localhost:6379"
echo ""
echo "Для просмотра логов используйте: docker-compose -f config/docker/docker-compose.dev.yml logs -f"
echo "Для остановки используйте: docker-dev-stop.bat"

pause

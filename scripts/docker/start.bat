@echo off
echo "=== Запуск Telegram E-commerce Platform ==="
echo.

REM Проверяем наличие .env файла
if not exist .env (
    echo "ОШИБКА: Файл .env не найден!"
    echo "Скопируйте config/environments/env.example в .env и заполните необходимые данные"
    pause
    exit /b 1
)

echo "Останавливаем существующие контейнеры..."
docker-compose -f config/docker/docker-compose.dev.yml down

echo "Запускаем все сервисы..."
docker-compose -f config/docker/docker-compose.dev.yml up -d --build

echo "Ожидаем запуска сервисов..."
timeout /t 10 /nobreak

echo "Проверяем состояние контейнеров..."
docker-compose -f config/docker/docker-compose.dev.yml ps

echo.
echo "=== ✅ Сервисы запущены ==="
echo "- Frontend:    http://localhost:3000"
echo "- Backend API: http://localhost:3001" 
echo "- AdminJS:     http://localhost:3001/admin"
echo "- Database:    localhost:3307"
echo "- Redis:       localhost:6379"
echo.
echo "Для просмотра логов: docker-compose -f config/docker/docker-compose.dev.yml logs -f"
echo "Для остановки: docker-compose -f config/docker/docker-compose.dev.yml down"

pause

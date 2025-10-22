@echo off
echo ========================================
echo Исправление подключения Backend-Frontend
echo ========================================
echo.

echo Шаг 1: Проверка текущего состояния...
echo.

REM Проверка, запущен ли backend
netstat -ano | findstr ":3001" >nul
if %errorlevel% equ 0 (
    echo [OK] Backend слушает на порту 3001
) else (
    echo [ОШИБКА] Backend НЕ запущен на порту 3001
    echo.
    echo Запустите backend командой:
    echo   cd backend
    echo   npm start
    echo.
    pause
    exit /b 1
)

echo.
echo Шаг 2: Тест локального подключения к backend...
echo.
curl -s http://localhost:3001/health
if %errorlevel% equ 0 (
    echo [OK] Backend отвечает локально
) else (
    echo [ОШИБКА] Backend не отвечает на localhost:3001
    echo Проверьте логи backend
    pause
    exit /b 1
)

echo.
echo.
echo Шаг 3: Проверка конфигурации...
echo.

echo Backend .env:
type backend\.env | findstr "FRONTEND_URL CORS_WHITELIST PORT"
echo.

echo Frontend .env:
type frontend\.env | findstr "VITE_API_URL VITE_SOCKET_URL"
echo.

echo.
echo Шаг 4: Проверка API endpoint...
echo.
curl -s http://localhost:3001/api
echo.
echo.

echo ========================================
echo Диагностика завершена
echo ========================================
echo.
echo Если backend запущен и отвечает локально,
echo но frontend получает ошибку "server error",
echo проблема может быть в:
echo.
echo 1. CORS настройках - проверьте CORS_WHITELIST в backend/.env
echo 2. Nginx конфигурации - проверьте nginx-megapenis.work.gd.conf
echo 3. SSL сертификатах - проверьте Let's Encrypt
echo 4. Firewall правилах
echo.
echo Для перезапуска backend:
echo   cd backend
echo   npm start
echo.
echo Для пересборки frontend:
echo   cd frontend
echo   npm run build
echo.
pause

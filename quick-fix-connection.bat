@echo off
chcp 65001 >nul
echo ╔════════════════════════════════════════════════════════╗
echo ║   Быстрое исправление Backend-Frontend подключения    ║
echo ╚════════════════════════════════════════════════════════╝
echo.

echo [1/5] Проверка Backend порта 3001...
netstat -ano | findstr ":3001" >nul
if %errorlevel% equ 0 (
    echo ✓ Backend слушает порт 3001
) else (
    echo ✗ Backend НЕ запущен!
    echo.
    echo Запускаю Backend...
    start "Backend Server" cmd /k "cd backend && npm start"
    timeout /t 5 >nul
)

echo.
echo [2/5] Тест Backend health endpoint...
curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Backend отвечает
) else (
    echo ✗ Backend не отвечает
    echo   Подождите несколько секунд и попробуйте снова
)

echo.
echo [3/5] Проверка конфигурации CORS...
findstr /C:"CORS_WHITELIST" backend\.env >nul
if %errorlevel% equ 0 (
    echo ✓ CORS настроен
    type backend\.env | findstr "CORS_WHITELIST"
) else (
    echo ✗ CORS не найден в backend/.env
)

echo.
echo [4/5] Проверка Frontend конфигурации...
findstr /C:"VITE_API_URL" frontend\.env >nul
if %errorlevel% equ 0 (
    echo ✓ Frontend API URL настроен
    type frontend\.env | findstr "VITE_API_URL"
) else (
    echo ✗ VITE_API_URL не найден в frontend/.env
)

echo.
echo [5/5] Тест API endpoint...
curl -s http://localhost:3001/api >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ API endpoint работает
) else (
    echo ✗ API endpoint не отвечает
)

echo.
echo ════════════════════════════════════════════════════════
echo.
echo Результаты диагностики:
echo.
echo Backend URL: http://localhost:3001
echo Frontend должен использовать:
echo   - Локально: http://localhost:3001/api
echo   - Production: https://megapenis.work.gd/api
echo.
echo Текущая конфигурация Frontend:
type frontend\.env | findstr "VITE_API_URL"
echo.
echo ════════════════════════════════════════════════════════
echo.
echo Что делать дальше:
echo.
echo 1. Если Backend не запущен - он запустится автоматически
echo 2. Откройте браузер: http://localhost:3000 (dev) или https://megapenis.work.gd (prod)
echo 3. Откройте консоль браузера (F12) и проверьте ошибки
echo 4. Если видите CORS ошибки - проверьте backend/.env
echo.
pause

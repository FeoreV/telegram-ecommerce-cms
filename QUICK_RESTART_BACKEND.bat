@echo off
REM Быстрый перезапуск backend после исправления кнопок товаров
echo ====================================
echo  Перезапуск Backend после исправления
echo ====================================
echo.

cd backend

echo [1/3] Компиляция TypeScript кода...
call npm run build
if errorlevel 1 (
    echo Ошибка компиляции!
    pause
    exit /b 1
)

echo [2/3] Остановка backend...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq backend*" 2>nul

echo [3/3] Запуск backend...
start "backend" cmd /k "npm start"

echo.
echo ====================================
echo  Backend успешно перезапущен!
echo ====================================
echo.
echo Проверьте Telegram бот:
echo 1. Откройте бот в Telegram
echo 2. Отправьте команду /catalog
echo 3. Убедитесь, что под товарами есть кнопки
echo.
pause


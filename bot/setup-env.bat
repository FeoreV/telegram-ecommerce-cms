@echo off
chcp 65001 >nul
echo ========================================
echo   Быстрая настройка Telegram бота
echo ========================================
echo.
echo Этот скрипт создаст файл .env для бота
echo.
echo Шаг 1: Получите токен от @BotFather
echo   1. Откройте https://t.me/BotFather
echo   2. Отправьте /newbot
echo   3. Следуйте инструкциям
echo   4. Скопируйте токен (выглядит как: 1234567890:ABCdef...)
echo.
set /p TOKEN="Введите токен бота (или Enter для пропуска): "
echo.

if "%TOKEN%"=="" (
    set TOKEN=your-telegram-bot-token-here
    echo ⚠ Токен не введён! Будет использован заглушка.
    echo   Отредактируйте bot\.env вручную!
)

echo # Bot Configuration > .env
echo NODE_ENV=development >> .env
echo BOT_PORT=3003 >> .env
echo. >> .env
echo # API Configuration >> .env
echo API_URL=http://localhost:3001 >> .env
echo. >> .env
echo # Telegram Bot Token >> .env
echo TELEGRAM_BOT_TOKEN=%TOKEN% >> .env
echo. >> .env
echo # Logging >> .env
echo LOG_LEVEL=info >> .env

echo.
echo ✅ Файл .env создан!
echo.
type .env
echo.
echo ========================================
echo Запустите бота: npm run dev
echo ========================================
pause

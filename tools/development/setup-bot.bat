@echo off
echo ========================================
echo   Настройка Telegram бота
echo ========================================
echo.
echo Для работы бота вам нужен токен от @BotFather
echo.
echo Как получить токен:
echo 1. Откройте @BotFather в Telegram
echo 2. Отправьте /newbot (или /mybots для существующего)
echo 3. Скопируйте токен
echo.
set /p TOKEN="Введите токен бота: "

if "%TOKEN%"=="" (
    echo.
    echo ❌ Токен не введён!
    pause
    exit /b 1
)

cd /d "%~dp0..\..\bot"
powershell -ExecutionPolicy Bypass -File "setup-bot-token.ps1" -Token "%TOKEN%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Настройка завершена!
    echo.
    echo Запустите бота командой:
    echo   cd bot
    echo   npm run dev
) else (
    echo.
    echo ❌ Ошибка при настройке
)

pause

@echo off
REM Скрипт для проверки статуса бота
REM Использование: check-bot.bat [имя_бота_или_магазина]

set BOT_NAME=%1
if "%BOT_NAME%"=="" set BOT_NAME=paymenttest

echo.
echo ============================================
echo   Проверка статуса бота: %BOT_NAME%
echo ============================================
echo.

cd /d "%~dp0\..\.."
node backend\scripts\check-bot-token.js %BOT_NAME%

echo.
echo ============================================
echo   Готово!
echo ============================================
echo.
pause


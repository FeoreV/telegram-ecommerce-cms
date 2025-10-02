@echo off
REM Скрипт для добавления токена боту
REM Использование: add-bot-token.bat <STORE_ID> <TOKEN>

set STORE_ID=%1
set BOT_TOKEN=%2

if "%STORE_ID%"=="" (
    echo.
    echo ========================================
    echo   Добавление токена боту
    echo ========================================
    echo.
    echo Использование:
    echo   add-bot-token.bat ^<STORE_ID^> ^<TOKEN^>
    echo.
    echo Пример:
    echo   add-bot-token.bat cmg9asld800056s4cqgw1xufd "1234567890:ABCxyz..."
    echo.
    echo Сначала найдите ID магазина:
    echo   check-bot.bat paymenttest
    echo.
    pause
    exit /b 1
)

if "%BOT_TOKEN%"=="" (
    echo.
    echo ОШИБКА: Не указан токен бота!
    echo.
    echo Использование:
    echo   add-bot-token.bat %STORE_ID% "ВАШ_ТОКЕН"
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Добавление токена для магазина
echo ============================================
echo   Store ID: %STORE_ID%
echo   Token: %BOT_TOKEN:~0,15%...
echo ============================================
echo.

cd /d "%~dp0\..\.."
node backend\scripts\add-bot-token.js %STORE_ID% %BOT_TOKEN%

echo.
echo ============================================
echo   Готово!
echo ============================================
echo.
pause


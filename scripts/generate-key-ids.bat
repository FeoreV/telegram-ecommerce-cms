@echo off
REM Скрипт генерации всех KEY_ID для системы (Windows Batch)
REM Использование: scripts\generate-key-ids.bat

echo.
echo ========================================
echo   Генератор Key IDs для всех сервисов
echo ========================================
echo.

REM Проверяем наличие Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js не установлен!
    echo Скачайте с: https://nodejs.org/
    pause
    exit /b 1
)

REM Запускаем Node.js скрипт
echo Запускаем генератор ключей...
echo.
node "%~dp0generate-key-ids.js"

echo.
pause


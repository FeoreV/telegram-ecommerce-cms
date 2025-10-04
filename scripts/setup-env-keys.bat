@echo off
REM Скрипт автоматической установки ключей в backend/.env
REM Использование: scripts\setup-env-keys.bat

echo.
echo ========================================
echo   Установка ключей в backend\.env
echo ========================================
echo.

REM Проверяем наличие PowerShell
where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PowerShell не найден!
    echo Используйте Windows 7 или новее
    pause
    exit /b 1
)

REM Запускаем PowerShell скрипт
echo Запускаем установку ключей...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0setup-env-keys.ps1"

echo.
pause


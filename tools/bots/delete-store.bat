@echo off
REM Скрипт для удаления магазина
REM Использование: delete-store.bat [название_магазина]

set STORE_NAME=%1
if "%STORE_NAME%"=="" set STORE_NAME=paymenttest

echo.
echo ============================================
echo   УДАЛЕНИЕ МАГАЗИНА: %STORE_NAME%
echo ============================================
echo.
echo ВНИМАНИЕ: Этот скрипт удалит магазин без подтверждения!
echo.

cd /d "%~dp0\..\.."
node backend\scripts\force-delete-store.js %STORE_NAME%

echo.
echo ============================================
echo   Готово!
echo ============================================
echo.
pause


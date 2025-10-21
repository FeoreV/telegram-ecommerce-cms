@echo off
echo Перезапуск backend сервера...

cd backend

echo Останавливаем текущий процесс...
taskkill /F /IM node.exe 2>nul

echo Ожидание 2 секунды...
timeout /t 2 /nobreak >nul

echo Запускаем backend сервер...
start "Backend Server" cmd /k "npm start"

echo.
echo Backend сервер перезапущен!
echo Проверьте окно "Backend Server" для логов
echo.
pause

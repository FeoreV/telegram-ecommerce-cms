@echo off
chcp 65001 >nul
echo ========================================
echo   Остановка процессов на портах
echo ========================================
echo.

echo Ищем процессы на портах 3000, 3001, 3003...
echo.

REM Порт 3000 (Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Убиваем процесс на порту 3000 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

REM Порт 3001 (Backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo Убиваем процесс на порту 3001 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

REM Порт 3003 (Bot)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3003" ^| findstr "LISTENING"') do (
    echo Убиваем процесс на порту 3003 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ✅ Готово! Порты освобождены.
echo.
echo Теперь можно запустить проект заново:
echo   npm run dev
echo.
pause

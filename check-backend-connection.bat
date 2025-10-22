@echo off
echo ========================================
echo Проверка подключения Backend к Frontend
echo ========================================
echo.

echo 1. Проверка портов:
echo.
netstat -ano | findstr ":3001"
echo.

echo 2. Проверка backend health:
echo.
curl -v http://localhost:3001/health
echo.
echo.

echo 3. Проверка API endpoint:
echo.
curl -v http://localhost:3001/api
echo.
echo.

echo 4. Проверка через nginx (если доступен):
echo.
curl -v https://megapenis.work.gd/api/health
echo.
echo.

echo 5. Проверка CORS настроек:
echo.
echo Backend CORS_WHITELIST:
type backend\.env | findstr "CORS_WHITELIST"
echo.
echo Frontend API URL:
type frontend\.env | findstr "VITE_API_URL"
echo.

echo ========================================
echo Готово!
echo ========================================
pause

@echo off
echo ========================================
echo    Rebuilding All Docker Containers
echo ========================================
echo.

echo Stopping all containers...
docker-compose down

echo.
echo Rebuilding all images with latest code changes...
docker-compose build --no-cache

echo.
echo Starting all containers...
docker-compose up -d

echo.
echo ========================================
echo    All Containers Rebuilt Successfully!
echo ========================================
echo.

echo Checking services status...
timeout /t 3 >nul
docker-compose ps

echo.
echo Press any key to view logs...
pause >nul

docker-compose logs -f --tail=50

pause

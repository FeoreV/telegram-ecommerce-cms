@echo off
REM Monitoring Stop Script for Telegram E-commerce Platform (Windows)
REM Stops all monitoring services

echo Stopping Monitoring Stack...
echo.

docker-compose -f docker-compose.monitoring.yml down

echo.
echo Monitoring Stack Stopped!
echo.
echo To remove all data, run:
echo   docker-compose -f docker-compose.monitoring.yml down -v
echo.

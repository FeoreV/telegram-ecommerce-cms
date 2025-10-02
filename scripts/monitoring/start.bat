@echo off
REM Monitoring Start Script for Telegram E-commerce Platform (Windows)
REM Starts Prometheus, Grafana and all exporters

echo Starting Monitoring Stack...
echo.

REM Check if docker-compose is installed
where docker-compose >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: docker-compose is not installed
    exit /b 1
)

REM Start monitoring stack
echo Starting Prometheus...
docker-compose -f docker-compose.monitoring.yml up -d prometheus

echo Starting Grafana...
docker-compose -f docker-compose.monitoring.yml up -d grafana

echo Starting Node Exporter...
docker-compose -f docker-compose.monitoring.yml up -d node-exporter

echo Starting Redis Exporter...
docker-compose -f docker-compose.monitoring.yml up -d redis-exporter 2>nul || echo WARNING: Redis Exporter failed

echo Starting Postgres Exporter...
docker-compose -f docker-compose.monitoring.yml up -d postgres-exporter 2>nul || echo WARNING: Postgres Exporter failed

echo.
echo Monitoring Stack Started!
echo.
echo Access the services:
echo   - Grafana:        http://localhost:3030 (admin/admin)
echo   - Prometheus:     http://localhost:9090
echo   - Node Exporter:  http://localhost:9100/metrics
echo   - Backend Metrics: http://localhost:3001/metrics
echo   - AdminJS Monitor: http://localhost:3001/admin -^> Monitoring
echo.
echo Check status:
echo   docker-compose -f docker-compose.monitoring.yml ps
echo.
echo View logs:
echo   docker-compose -f docker-compose.monitoring.yml logs -f
echo.

timeout /t 3 >nul
echo Setup complete!

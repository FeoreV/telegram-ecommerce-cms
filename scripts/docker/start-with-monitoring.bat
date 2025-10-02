@echo off
echo ========================================
echo  Starting Telegram E-commerce Platform
echo  WITH Monitoring (Prometheus + Grafana)
echo ========================================
echo.

echo [1/3] Starting all services...
docker-compose up -d

echo.
echo [2/3] Waiting for services to start (15 seconds)...
timeout /t 15 /nobreak >nul

echo.
echo [3/3] Checking service status...
docker-compose ps

echo.
echo ========================================
echo  Services Started Successfully!
echo ========================================
echo.
echo  Frontend:    http://localhost:3000
echo  Backend:     http://localhost:3001
echo  Grafana:     http://localhost:3030 (admin/admin)
echo  Prometheus:  http://localhost:9090
echo  Monitoring:  http://localhost:3000/monitoring
echo.
echo  Metrics API: http://localhost:3001/metrics
echo.
echo ========================================
echo.
echo To stop all services: docker-compose down
echo To view logs: docker-compose logs -f
echo.
pause


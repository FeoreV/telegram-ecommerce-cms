@echo off
echo =========================================
echo  Checking Monitoring Services Status
echo =========================================
echo.

echo [1/5] Checking Docker containers...
docker-compose ps
echo.

echo [2/5] Checking Prometheus container...
docker ps --filter "name=prometheus" --format "table {{.Names}}\t{{.Status}}"
echo.

echo [3/5] Checking Prometheus logs (last 10 lines)...
docker-compose logs --tail 10 prometheus
echo.

echo [4/5] Testing Prometheus endpoint...
curl -s http://localhost:9090/-/healthy
echo.
echo.

echo [5/5] Testing backend metrics...
curl -s http://localhost:3001/metrics | findstr "# HELP"
echo.

echo.
echo =========================================
echo  Monitoring URLs:
echo =========================================
echo  Prometheus:  http://localhost:9090
echo  Grafana:     http://localhost:3030
echo  Backend:     http://localhost:3001/metrics
echo  UI Monitor:  http://localhost:3000/monitoring
echo =========================================
echo.
pause


# Quick Docker Rebuild Script
# Usage: .\rebuild.ps1 [service_name] [-NoCache]

param(
    [string]$Service = "",
    [switch]$NoCache
)

Write-Host "Docker Rebuild" -ForegroundColor Cyan
Write-Host ""

# Check Docker
try {
    docker info | Out-Null
    Write-Host "[OK] Docker is running" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker Desktop is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop first" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Stop containers
Write-Host "Stopping containers..." -ForegroundColor Yellow
docker-compose down

Write-Host ""

# Build
if ($Service) {
    Write-Host "Building service: $Service" -ForegroundColor Cyan
    if ($NoCache) {
        docker-compose build --no-cache $Service
    } else {
        docker-compose build $Service
    }
} else {
    Write-Host "Building all services..." -ForegroundColor Cyan
    if ($NoCache) {
        docker-compose build --no-cache
    } else {
        docker-compose build
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Build completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Start services? (y/n): " -NoNewline
    $response = Read-Host

    if ($response -eq 'y') {
        Write-Host ""
        Write-Host "Starting services..." -ForegroundColor Cyan
        docker-compose up -d

        Write-Host ""
        docker-compose ps
        Write-Host ""
        Write-Host "Services:"
        Write-Host "  Backend:   http://82.147.84.78:3001"
        Write-Host "  Frontend:  http://82.147.84.78:3000"
        Write-Host "  Grafana:   http://82.147.84.78:3030"
    }
} else {
    Write-Host ""
    Write-Host "[ERROR] Build failed!" -ForegroundColor Red
}


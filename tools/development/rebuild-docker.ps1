# Rebuild Docker Images Script
# This script rebuilds all Docker services with fresh images

param(
    [switch]$NoCache,
    [switch]$Service,
    [string]$ServiceName = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Docker Rebuild Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to project root
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Stop all containers
Write-Host "🛑 Stopping containers..." -ForegroundColor Yellow
docker-compose down
Write-Host ""

# Rebuild images
if ($Service -and $ServiceName) {
    # Rebuild specific service
    Write-Host "🔨 Rebuilding service: $ServiceName" -ForegroundColor Cyan
    if ($NoCache) {
        docker-compose build --no-cache $ServiceName
    } else {
        docker-compose build $ServiceName
    }
} else {
    # Rebuild all services
    Write-Host "🔨 Rebuilding all services..." -ForegroundColor Cyan
    if ($NoCache) {
        Write-Host "   Using --no-cache flag (fresh build)" -ForegroundColor Yellow
        docker-compose build --no-cache
    } else {
        docker-compose build
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build completed successfully!" -ForegroundColor Green
Write-Host ""

# Ask if user wants to start services
$start = Read-Host "Start services now? (y/n)"
if ($start -eq 'y' -or $start -eq 'Y' -or $start -eq 'yes') {
    Write-Host ""
    Write-Host "🚀 Starting services..." -ForegroundColor Cyan
    docker-compose up -d

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ All services started!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Services status:" -ForegroundColor Cyan
        docker-compose ps
    } else {
        Write-Host ""
        Write-Host "❌ Failed to start services!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "ℹ️  To start services later, run:" -ForegroundColor Yellow
    Write-Host "   docker-compose up -d" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Rebuild Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Available services:" -ForegroundColor Yellow
Write-Host "  - Backend:    http://82.147.84.78:3001"
Write-Host "  - Frontend:   http://82.147.84.78:3000"
Write-Host "  - Prometheus: http://82.147.84.78:9090"
Write-Host "  - Grafana:    http://82.147.84.78:3030"
Write-Host ""


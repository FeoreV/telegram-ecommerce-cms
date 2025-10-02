#!/usr/bin/env pwsh
# Rebuild All Docker Containers with latest code changes

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Rebuilding All Docker Containers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Check if Docker is running
    Write-Host "Checking Docker status..." -ForegroundColor Yellow
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: Docker is not running!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please start Docker Desktop first, then run this script again." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    Write-Host "✅ Docker is running" -ForegroundColor Green
    Write-Host ""

    # Stop all containers
    Write-Host "⏹️  Stopping all containers..." -ForegroundColor Yellow
    docker-compose down
    Write-Host ""

    # Rebuild all images
    Write-Host "🔨 Rebuilding all images with latest code changes..." -ForegroundColor Yellow
    Write-Host "   (This may take several minutes...)" -ForegroundColor Gray
    Write-Host ""
    docker-compose build --no-cache
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to build images!" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
    Write-Host "✅ All images rebuilt successfully" -ForegroundColor Green
    Write-Host ""

    # Start all containers
    Write-Host "🚀 Starting all containers..." -ForegroundColor Yellow
    docker-compose up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start containers!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ All containers started" -ForegroundColor Green
    Write-Host ""

    # Wait for containers to initialize
    Write-Host "Waiting for services to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    Write-Host ""

    # Show status
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Services Status" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    docker-compose ps
    Write-Host ""

    Write-Host "✅ Rebuild completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Useful commands:" -ForegroundColor Cyan
    Write-Host "   View all logs: docker-compose logs -f" -ForegroundColor Gray
    Write-Host "   View bot logs: docker-compose logs -f bot" -ForegroundColor Gray
    Write-Host "   View backend logs: docker-compose logs -f backend" -ForegroundColor Gray
    Write-Host "   Restart all: docker-compose restart" -ForegroundColor Gray
    Write-Host "   Stop all: docker-compose down" -ForegroundColor Gray
    Write-Host ""

    # Ask to view logs
    Write-Host "View logs now? (Y/N): " -ForegroundColor Yellow -NoNewline
    $response = Read-Host
    if ($response -eq 'Y' -or $response -eq 'y') {
        Write-Host ""
        Write-Host "Showing logs (press Ctrl+C to exit)..." -ForegroundColor Cyan
        docker-compose logs -f --tail=50
    }

} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

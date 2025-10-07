# Скрипт для полной остановки и перезапуска бота
Write-Host "Останавливаю все процессы node..." -ForegroundColor Yellow

# Останавливаем все процессы node
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Ожидание 3 секунды..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Переходим в директорию бота
Set-Location $PSScriptRoot

Write-Host "Пересборка бота..." -ForegroundColor Cyan
npm run build

Write-Host "Запуск бота..." -ForegroundColor Green
npm start



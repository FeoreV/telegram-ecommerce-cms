# Скрипт для настройки токена Telegram бота
param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$envFile = Join-Path $PSScriptRoot ".env"

if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    $content = $content -replace 'TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here', "TELEGRAM_BOT_TOKEN=$Token"
    Set-Content $envFile $content -NoNewline
    Write-Host "✅ Токен бота успешно установлен!" -ForegroundColor Green
    Write-Host "Теперь можно запустить бота: npm run dev" -ForegroundColor Cyan
} else {
    Write-Host "❌ Файл .env не найден в директории bot/" -ForegroundColor Red
}

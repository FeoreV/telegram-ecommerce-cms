Param(
  [switch]$Up,
  [switch]$Down
)

if ($Up) {
  docker-compose up -d database redis medusa-db medusa backend bot
} elseif ($Down) {
  docker-compose down
} else {
  Write-Host "Usage: .\scripts\dev-compose.ps1 -Up | -Down"
}



# PowerShell script to upload updated .env files to server
# Usage: .\upload-env-to-server.ps1 [server-ip-or-hostname]

param(
    [string]$Server = "megapenis.worg.gd",
    [string]$ServerUser = "root"
)

$ProjectPath = "/root/telegram-ecommerce-cms"

Write-Host "🚀 Uploading .env files to $Server..." -ForegroundColor Green

# Check if scp is available
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: scp command not found. Please install OpenSSH client." -ForegroundColor Red
    Write-Host "You can install it via: Settings > Apps > Optional Features > OpenSSH Client" -ForegroundColor Yellow
    exit 1
}

try {
    # Upload root .env
    Write-Host "📤 Uploading .env..." -ForegroundColor Cyan
    scp .env "${ServerUser}@${Server}:${ProjectPath}/.env"

    # Upload backend .env
    Write-Host "📤 Uploading backend/.env..." -ForegroundColor Cyan
    scp backend/.env "${ServerUser}@${Server}:${ProjectPath}/backend/.env"

    # Upload frontend .env
    Write-Host "📤 Uploading frontend/.env..." -ForegroundColor Cyan
    scp frontend/.env "${ServerUser}@${Server}:${ProjectPath}/frontend/.env"

    # Upload nginx config
    Write-Host "📤 Uploading nginx config..." -ForegroundColor Cyan
    scp nginx-megapenis.worg.gd.conf "${ServerUser}@${Server}:/tmp/nginx-megapenis.worg.gd.conf"

    Write-Host ""
    Write-Host "✅ Files uploaded successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps on the server:" -ForegroundColor Yellow
    Write-Host "1. Install nginx config:"
    Write-Host "   sudo cp /tmp/nginx-megapenis.worg.gd.conf /etc/nginx/sites-available/megapenis.worg.gd"
    Write-Host "   sudo ln -sf /etc/nginx/sites-available/megapenis.worg.gd /etc/nginx/sites-enabled/"
    Write-Host ""
    Write-Host "2. Get SSL certificate:"
    Write-Host "   sudo certbot --nginx -d megapenis.worg.gd -d www.megapenis.worg.gd"
    Write-Host ""
    Write-Host "3. Rebuild and restart:"
    Write-Host "   cd ${ProjectPath}/frontend && npm run build"
    Write-Host "   cd ${ProjectPath} && pm2 restart all"
    Write-Host "   sudo systemctl restart nginx"
    Write-Host ""
    Write-Host "Or connect to server and follow SETUP-MEGAPENIS-WORG-HTTPS.md" -ForegroundColor Cyan
    Write-Host "   ssh ${ServerUser}@${Server}"

} catch {
    Write-Host "❌ Error uploading files: $_" -ForegroundColor Red
    exit 1
}

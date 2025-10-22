# Full deployment script for megapenis.worg.gd
# This script uploads files and executes deployment commands on the server

param(
    [string]$Server = "megapenis.worg.gd",
    [string]$ServerUser = "root"
)

$ProjectPath = "/root/telegram-ecommerce-cms"

Write-Host "🚀 Starting full deployment to $Server..." -ForegroundColor Green
Write-Host ""

# Step 1: Upload files
Write-Host "📤 Step 1: Uploading configuration files..." -ForegroundColor Cyan

try {
    scp .env "${ServerUser}@${Server}:${ProjectPath}/.env"
    Write-Host "  ✅ .env uploaded" -ForegroundColor Green
    
    scp backend/.env "${ServerUser}@${Server}:${ProjectPath}/backend/.env"
    Write-Host "  ✅ backend/.env uploaded" -ForegroundColor Green
    
    scp frontend/.env "${ServerUser}@${Server}:${ProjectPath}/frontend/.env"
    Write-Host "  ✅ frontend/.env uploaded" -ForegroundColor Green
    
    scp nginx-megapenis.worg.gd.conf "${ServerUser}@${Server}:/tmp/nginx-megapenis.worg.gd.conf"
    Write-Host "  ✅ nginx config uploaded" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error uploading files: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 Step 2: Installing nginx configuration..." -ForegroundColor Cyan

$nginxCommands = @"
sudo cp /tmp/nginx-megapenis.worg.gd.conf /etc/nginx/sites-available/megapenis.worg.gd
sudo ln -sf /etc/nginx/sites-available/megapenis.worg.gd /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/megapenis.work.gd
sudo nginx -t
"@

ssh "${ServerUser}@${Server}" $nginxCommands

Write-Host ""
Write-Host "🔨 Step 3: Building frontend..." -ForegroundColor Cyan

$buildCommands = @"
cd ${ProjectPath}/frontend
npm run build
"@

ssh "${ServerUser}@${Server}" $buildCommands

Write-Host ""
Write-Host "♻️  Step 4: Restarting services..." -ForegroundColor Cyan

$restartCommands = @"
cd ${ProjectPath}
pm2 restart all
sudo systemctl restart nginx
"@

ssh "${ServerUser}@${Server}" $restartCommands

Write-Host ""
Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your site should be available at:" -ForegroundColor Yellow
Write-Host "   https://megapenis.worg.gd" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Check status:" -ForegroundColor Yellow
Write-Host "   ssh ${ServerUser}@${Server} 'pm2 status'"
Write-Host "   ssh ${ServerUser}@${Server} 'sudo systemctl status nginx'"
Write-Host ""
Write-Host "📝 View logs:" -ForegroundColor Yellow
Write-Host "   ssh ${ServerUser}@${Server} 'pm2 logs'"
Write-Host "   ssh ${ServerUser}@${Server} 'sudo tail -f /var/log/nginx/megapenis-worg-error.log'"
Write-Host ""
Write-Host "⚠️  Note: If SSL certificate is not set up yet, run:" -ForegroundColor Yellow
Write-Host "   ssh ${ServerUser}@${Server} 'sudo certbot --nginx -d megapenis.worg.gd -d www.megapenis.worg.gd'"

#!/bin/bash
# Easy HTTPS Setup with Caddy (Automatic SSL)

set -e

echo "🔒 Quick HTTPS Setup with Caddy"
echo "================================="
echo ""
echo "Caddy automatically obtains and renews SSL certificates!"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi

# Get domain
echo "Enter your domain name (e.g., mystore.com):"
read -r DOMAIN

if [ -z "$DOMAIN" ]; then
    print_error "Domain name is required!"
    exit 1
fi

echo "Enter API subdomain (default: api.$DOMAIN):"
read -r API_DOMAIN

if [ -z "$API_DOMAIN" ]; then
    API_DOMAIN="api.$DOMAIN"
fi

echo ""
echo "Configuration:"
echo "  Main: $DOMAIN"
echo "  API: $API_DOMAIN"
echo ""
echo "Continue? (y/n)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ]; then
    exit 1
fi

# Install Caddy
print_info "Installing Caddy..."
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy -y

# Create Caddyfile
print_info "Creating Caddyfile..."
cat > /etc/caddy/Caddyfile << EOF
$DOMAIN, www.$DOMAIN {
    reverse_proxy localhost:3000
    
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
    
    encode gzip
}

$API_DOMAIN {
    reverse_proxy localhost:3001 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    
    header {
        Access-Control-Allow-Origin "https://$DOMAIN"
        Access-Control-Allow-Credentials "true"
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-csrf-token, X-CSRF-Token"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        -Server
    }
    
    encode gzip
}
EOF

# Test configuration
print_info "Testing Caddy configuration..."
caddy validate --config /etc/caddy/Caddyfile

# Restart Caddy
print_info "Starting Caddy..."
systemctl restart caddy
systemctl enable caddy

# Configure firewall
print_info "Configuring firewall..."
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Update backend .env
BACKEND_DIR="/root/telegram-ecommerce-cms/backend"
if [ -f "$BACKEND_DIR/.env" ]; then
    print_info "Updating backend .env..."
    cp "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.backup.caddy.$(date +%s)"
    
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|" "$BACKEND_DIR/.env"
    sed -i "s|^ADMIN_PANEL_URL=.*|ADMIN_PANEL_URL=https://$API_DOMAIN/admin|" "$BACKEND_DIR/.env"
    sed -i "s|^CORS_WHITELIST=.*|CORS_WHITELIST=https://$DOMAIN,https://www.$DOMAIN,https://$API_DOMAIN|" "$BACKEND_DIR/.env"
    sed -i "s|^ADDITIONAL_CORS_ORIGINS=.*|ADDITIONAL_CORS_ORIGINS=https://$DOMAIN,https://$API_DOMAIN|" "$BACKEND_DIR/.env"
    sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$BACKEND_DIR/.env"
fi

# Update frontend .env
FRONTEND_DIR="/root/telegram-ecommerce-cms/frontend"
if [ -f "$FRONTEND_DIR/.env" ]; then
    print_info "Updating frontend .env..."
    cp "$FRONTEND_DIR/.env" "$FRONTEND_DIR/.env.backup.caddy.$(date +%s)"
    
    sed -i "s|^VITE_API_URL=.*|VITE_API_URL=https://$API_DOMAIN/api|" "$FRONTEND_DIR/.env"
    sed -i "s|^VITE_SOCKET_URL=.*|VITE_SOCKET_URL=https://$API_DOMAIN|" "$FRONTEND_DIR/.env"
fi

echo ""
echo "==========================================="
print_info "✅ Caddy HTTPS setup complete!"
echo "==========================================="
echo ""
echo "Caddy is automatically obtaining SSL certificates..."
echo ""
echo "Next steps:"
echo "  1. Rebuild applications:"
echo "     cd $BACKEND_DIR && npm run build && pm2 restart backend"
echo "     cd $FRONTEND_DIR && npm run build && pm2 restart frontend"
echo ""
echo "  2. Check Caddy status:"
echo "     systemctl status caddy"
echo "     journalctl -u caddy -f"
echo ""
echo "  3. Visit:"
echo "     https://$DOMAIN"
echo "     https://$API_DOMAIN/health"
echo ""
print_warning "Wait 1-2 minutes for Caddy to obtain SSL certificates"
echo ""


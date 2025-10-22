#!/bin/bash
# HTTPS Setup Script for Production Server

set -e

echo "🔒 HTTPS Setup for Telegram E-commerce CMS"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Get domain name from user
echo "Enter your domain name (e.g., mystore.com):"
read -r DOMAIN

if [ -z "$DOMAIN" ]; then
    print_error "Domain name is required!"
    exit 1
fi

echo ""
echo "Enter API subdomain (default: api.$DOMAIN):"
read -r API_DOMAIN

if [ -z "$API_DOMAIN" ]; then
    API_DOMAIN="api.$DOMAIN"
fi

echo ""
echo "Configuration:"
echo "  Main domain: $DOMAIN"
echo "  WWW domain: www.$DOMAIN"
echo "  API domain: $API_DOMAIN"
echo ""
echo "Is this correct? (y/n)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ]; then
    print_error "Setup cancelled"
    exit 1
fi

# Update system
print_info "Updating system packages..."
apt update && apt upgrade -y

# Install Nginx
print_info "Installing Nginx..."
apt install nginx -y
systemctl start nginx
systemctl enable nginx

# Install Certbot
print_info "Installing Certbot..."
apt install certbot python3-certbot-nginx -y

# Create Nginx configuration
print_info "Creating Nginx configuration..."
cat > /etc/nginx/sites-available/telegram-ecommerce << EOF
# Frontend
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# Backend API
server {
    listen 80;
    server_name $API_DOMAIN;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
print_info "Enabling Nginx site..."
ln -sf /etc/nginx/sites-available/telegram-ecommerce /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
print_info "Testing Nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
    print_error "Nginx configuration test failed!"
    exit 1
fi

# Reload Nginx
systemctl reload nginx

# Get SSL certificate
print_info "Obtaining SSL certificate from Let's Encrypt..."
echo ""
echo "You will be prompted to enter your email and agree to terms."
echo ""

certbot --nginx -d $DOMAIN -d www.$DOMAIN -d $API_DOMAIN

if [ $? -ne 0 ]; then
    print_error "Failed to obtain SSL certificate!"
    exit 1
fi

# Update backend .env
print_info "Updating backend .env file..."
BACKEND_DIR="/root/telegram-ecommerce-cms/backend"

if [ -f "$BACKEND_DIR/.env" ]; then
    # Backup .env
    cp "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.backup.https.$(date +%s)"
    
    # Update URLs
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|" "$BACKEND_DIR/.env"
    sed -i "s|^ADMIN_PANEL_URL=.*|ADMIN_PANEL_URL=https://$API_DOMAIN/admin|" "$BACKEND_DIR/.env"
    sed -i "s|^CORS_WHITELIST=.*|CORS_WHITELIST=https://$DOMAIN,https://www.$DOMAIN,https://$API_DOMAIN|" "$BACKEND_DIR/.env"
    sed -i "s|^ADDITIONAL_CORS_ORIGINS=.*|ADDITIONAL_CORS_ORIGINS=https://$DOMAIN,https://$API_DOMAIN|" "$BACKEND_DIR/.env"
    
    # Add NODE_ENV if not exists
    if ! grep -q "^NODE_ENV=" "$BACKEND_DIR/.env"; then
        echo "NODE_ENV=production" >> "$BACKEND_DIR/.env"
    else
        sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$BACKEND_DIR/.env"
    fi
    
    # Add secure cookie flags
    if ! grep -q "^COOKIE_SECURE=" "$BACKEND_DIR/.env"; then
        echo "COOKIE_SECURE=true" >> "$BACKEND_DIR/.env"
    fi
    
    print_info "Backend .env updated"
else
    print_warning "Backend .env not found at $BACKEND_DIR/.env"
fi

# Update frontend .env
print_info "Updating frontend .env file..."
FRONTEND_DIR="/root/telegram-ecommerce-cms/frontend"

if [ -f "$FRONTEND_DIR/.env" ]; then
    # Backup .env
    cp "$FRONTEND_DIR/.env" "$FRONTEND_DIR/.env.backup.https.$(date +%s)"
    
    # Update URLs
    sed -i "s|^VITE_API_URL=.*|VITE_API_URL=https://$API_DOMAIN/api|" "$FRONTEND_DIR/.env"
    sed -i "s|^VITE_SOCKET_URL=.*|VITE_SOCKET_URL=https://$API_DOMAIN|" "$FRONTEND_DIR/.env"
    
    print_info "Frontend .env updated"
else
    print_warning "Frontend .env not found at $FRONTEND_DIR/.env"
fi

# Configure firewall
print_info "Configuring firewall..."
ufw allow 'Nginx Full'
ufw --force enable

# Test certificate auto-renewal
print_info "Testing certificate auto-renewal..."
certbot renew --dry-run

if [ $? -ne 0 ]; then
    print_warning "Auto-renewal test failed, but certificates are installed"
fi

echo ""
echo "==========================================="
print_info "✅ HTTPS setup completed successfully!"
echo "==========================================="
echo ""
echo "Next steps:"
echo "  1. Rebuild and restart your applications:"
echo "     cd /root/telegram-ecommerce-cms/backend && npm run build && pm2 restart backend"
echo "     cd /root/telegram-ecommerce-cms/frontend && npm run build && pm2 restart frontend"
echo ""
echo "  2. Visit your site:"
echo "     Frontend: https://$DOMAIN"
echo "     Backend:  https://$API_DOMAIN/health"
echo ""
echo "  3. Check for the padlock icon in your browser"
echo ""
echo "Certificate will auto-renew before expiration."
echo ""


# 🔒 HTTPS Setup Guide for Production Server

## Overview

This guide will help you set up HTTPS for your production server using:
- **Nginx** as reverse proxy
- **Let's Encrypt** for free SSL certificates
- **Certbot** for automatic certificate management

## Prerequisites

- Domain name pointing to your server IP (82.147.84.78)
- SSH access to the server
- Root or sudo privileges

## Step 1: Get a Domain Name

You need a domain name (e.g., `mystore.com`) pointing to `82.147.84.78`

### Option A: Use your own domain
1. Buy domain from registrar (Namecheap, GoDaddy, etc.)
2. Add A records:
   ```
   @ (or mystore.com)     A    82.147.84.78
   www                    A    82.147.84.78
   api                    A    82.147.84.78
   ```

### Option B: Free subdomain services
- Use services like FreeDNS, Duck DNS, or No-IP
- Point subdomain to 82.147.84.78

For this guide, let's assume your domain is: `yourdomain.com`

## Step 2: Install Nginx

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Nginx
sudo apt install nginx -y

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

## Step 3: Install Certbot (Let's Encrypt)

```bash
# Install Certbot and Nginx plugin
sudo apt install certbot python3-certbot-nginx -y
```

## Step 4: Configure Nginx (HTTP first)

Create Nginx configuration for your site:

```bash
sudo nano /etc/nginx/sites-available/telegram-ecommerce
```

Add this configuration:

```nginx
# Frontend (port 3000)
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://82.147.84.78:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API (port 3001)
server {
    listen 80;
    server_name api.yourdomain.com;

    # Increase body size for uploads
    client_max_body_size 10M;

    location / {
        proxy_pass http://82.147.84.78:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers (if needed)
        add_header 'Access-Control-Allow-Origin' 'https://yourdomain.com' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-csrf-token, X-CSRF-Token' always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://82.147.84.78:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Important:** Replace `yourdomain.com` with your actual domain!

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/telegram-ecommerce /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 5: Obtain SSL Certificate

```bash
# Get certificate for both domains
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Follow the prompts:
# 1. Enter your email
# 2. Agree to Terms of Service
# 3. Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

Certbot will automatically:
- Obtain SSL certificates
- Update Nginx configuration
- Set up automatic renewal

## Step 6: Update Backend .env

```bash
cd ~/telegram-ecommerce-cms/backend
nano .env
```

Update these variables:

```env
# Change from http to https
FRONTEND_URL=https://yourdomain.com
ADMIN_PANEL_URL=https://api.yourdomain.com/admin
CORS_WHITELIST=https://yourdomain.com,https://www.yourdomain.com,https://api.yourdomain.com
ADDITIONAL_CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# Add NODE_ENV
NODE_ENV=production

# Session cookies need secure flag
SESSION_SECURE=true
COOKIE_SECURE=true
```

## Step 7: Update Frontend .env

```bash
cd ~/telegram-ecommerce-cms/frontend
nano .env
```

Update:

```env
VITE_API_URL=https://api.yourdomain.com/api
VITE_SOCKET_URL=https://api.yourdomain.com
```

## Step 8: Rebuild and Restart

```bash
# Backend
cd ~/telegram-ecommerce-cms/backend
npm run build
pm2 restart backend

# Frontend
cd ~/telegram-ecommerce-cms/frontend
npm run build
pm2 restart frontend
```

## Step 9: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Remove direct access to backend/frontend ports (optional, for security)
# sudo ufw deny 3000
# sudo ufw deny 3001

# Check status
sudo ufw status
```

## Step 10: Test HTTPS

Visit in browser:
- `https://yourdomain.com` - Should show frontend
- `https://api.yourdomain.com/health` - Should return backend health check
- Check for padlock icon in browser

Test redirect:
- `http://yourdomain.com` - Should redirect to HTTPS

## Automatic Certificate Renewal

Certbot sets up automatic renewal. Test it:

```bash
# Dry run renewal
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer
```

Certificates will auto-renew 30 days before expiration.

## Advanced Nginx Configuration (Optional)

For better security and performance:

```bash
sudo nano /etc/nginx/sites-available/telegram-ecommerce
```

Add security headers:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://82.147.84.78:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
```

### Nginx Errors
```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### CORS Issues with HTTPS
If you get CORS errors after switching to HTTPS:
1. Make sure all URLs in .env use `https://`
2. Verify CORS_WHITELIST includes HTTPS URLs
3. Check browser console for mixed content warnings
4. Restart backend after .env changes

### Mixed Content Warnings
If you see "Mixed Content" warnings:
- All resources must be loaded over HTTPS
- Check for hardcoded `http://` URLs in your code
- Update any external resources to use HTTPS

## Quick Reference Commands

```bash
# Restart Nginx
sudo systemctl restart nginx

# Test Nginx config
sudo nginx -t

# View SSL certificate info
sudo certbot certificates

# Renew certificates manually
sudo certbot renew

# Check certificate expiry
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## Alternative: Using Caddy (Easier)

If you prefer automatic HTTPS without manual configuration:

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Create Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Add:
```
yourdomain.com, www.yourdomain.com {
    reverse_proxy 82.147.84.78:3000
}

api.yourdomain.com {
    reverse_proxy 82.147.84.78:3001
}
```

Caddy automatically obtains and renews SSL certificates!

```bash
# Restart Caddy
sudo systemctl restart caddy
```

## Security Checklist

- [ ] SSL certificate installed and valid
- [ ] HTTP redirects to HTTPS
- [ ] Security headers configured
- [ ] Firewall configured
- [ ] Direct port access blocked (3000, 3001)
- [ ] Auto-renewal working
- [ ] Backend .env updated with HTTPS URLs
- [ ] Frontend .env updated with HTTPS URLs
- [ ] CORS configured for HTTPS
- [ ] Cookies set with Secure flag
- [ ] Testing in browser shows padlock

---

**After setup, your site will be accessible via:**
- Frontend: `https://yourdomain.com`
- Backend API: `https://api.yourdomain.com/api`
- Backend Health: `https://api.yourdomain.com/health`


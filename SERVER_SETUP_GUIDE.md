# 🚀 Production Server Setup Guide

## Current Problem: CORS / Connection Issues

The frontend at `http://82.147.84.78:3000` cannot connect to backend at `http://82.147.84.78:3001` due to CORS blocking.

## Quick Fix (Execute on Server)

### 1. Navigate to backend directory
```bash
cd ~/telegram-ecommerce-cms/backend
```

### 2. Update .env file with CORS settings
```bash
# Backup current .env
cp .env .env.backup.$(date +%s)

# Add/Update CORS settings
cat >> .env << 'EOF'

# Production Server CORS Settings
FRONTEND_URL=http://82.147.84.78:3000
CORS_WHITELIST=http://localhost:3000,http://localhost:5173,http://82.147.84.78:3000,http://82.147.84.78:3001
ADMIN_PANEL_URL=http://82.147.84.78:3001/admin
CORS_CREDENTIALS=true
ADDITIONAL_CORS_ORIGINS=http://82.147.84.78:3000,http://82.147.84.78:3001
NODE_ENV=production
EOF
```

### 3. Or use the automated script
```bash
cd ~/telegram-ecommerce-cms/backend
chmod +x fix-cors.sh
./fix-cors.sh
```

### 4. Restart backend service
```bash
# If using PM2
pm2 restart backend

# Or if running with npm
pkill -f "node.*dist/index.js"
npm run build
npm run start

# Or in development mode
npm run dev
```

### 5. Verify the fix
```bash
# Check backend is running
curl http://localhost:3001/health

# Test CORS headers
curl -H "Origin: http://82.147.84.78:3000" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     -v http://82.147.84.78:3001/api/csrf-token 2>&1 | grep -i "access-control"
```

Expected output should include:
- `Access-Control-Allow-Origin: http://82.147.84.78:3000`
- `Access-Control-Allow-Credentials: true`

## Full Production Setup

### Prerequisites
- Node.js 18+ installed
- PostgreSQL or SQLite database
- PM2 for process management (recommended)

### Environment Variables Setup
```bash
cd ~/telegram-ecommerce-cms/backend

# Copy environment template
cp config/environments/env.production.example .env

# Edit .env with your settings
nano .env
```

Required variables:
```env
# Server
NODE_ENV=production
PORT=3001

# URLs
FRONTEND_URL=http://82.147.84.78:3000
ADMIN_PANEL_URL=http://82.147.84.78:3001/admin

# CORS
CORS_WHITELIST=http://82.147.84.78:3000,http://82.147.84.78:3001
CORS_CREDENTIALS=true
ADDITIONAL_CORS_ORIGINS=http://82.147.84.78:3000

# Database
DATABASE_URL=file:./prisma/dev.db

# JWT Secrets (generate secure ones)
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
MASTER_ENCRYPTION_KEY=<64-char-hex>
ENCRYPTION_KEY_ID=prod-key-1
ENCRYPTION_ALGORITHM=aes-256-gcm
```

### Build and Start
```bash
cd ~/telegram-ecommerce-cms/backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build
npm run build

# Start with PM2 (recommended)
pm2 start npm --name "backend" -- run start
pm2 save

# Or start directly
npm run start
```

### Frontend Setup
```bash
cd ~/telegram-ecommerce-cms/frontend

# Install dependencies
npm install

# Build for production
npm run build

# Serve with a static server or PM2
pm2 serve dist 3000 --name "frontend" --spa
pm2 save
```

## Troubleshooting

### CORS Still Not Working?
1. Check backend logs: `pm2 logs backend` or `cat backend/logs/combined-*.log`
2. Verify .env is loaded: `cd backend && node -e "require('dotenv').config(); console.log(process.env.FRONTEND_URL)"`
3. Ensure backend restarted: `pm2 restart backend`

### Can't Connect to Backend?
```bash
# Check if backend is running
pm2 status
# or
ps aux | grep node

# Check port is listening
netstat -tlnp | grep 3001
# or
lsof -i :3001

# Check firewall
sudo ufw status
sudo ufw allow 3001
```

### Database Issues?
```bash
cd backend

# Reset database (WARNING: deletes all data)
npx prisma migrate reset --force

# Or just migrate
npx prisma migrate deploy
```

## Security Checklist

- [ ] Change all default secrets in .env
- [ ] Set NODE_ENV=production
- [ ] Configure firewall (allow only necessary ports)
- [ ] Use HTTPS in production (setup reverse proxy with nginx/caddy)
- [ ] Regular backups enabled
- [ ] Monitor logs regularly

## PM2 Useful Commands
```bash
# View all processes
pm2 status

# View logs
pm2 logs backend
pm2 logs frontend

# Restart services
pm2 restart all
pm2 restart backend

# Stop services
pm2 stop all
pm2 delete all

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Monitoring
```bash
# View real-time stats
pm2 monit

# View metrics
curl http://localhost:3001/metrics

# Check health
curl http://localhost:3001/health
```

---

## Quick Reference

### Start Everything
```bash
cd ~/telegram-ecommerce-cms
pm2 start ecosystem.config.js
pm2 save
```

### Stop Everything
```bash
pm2 stop all
```

### View Logs
```bash
pm2 logs --lines 100
```

### Update Code
```bash
cd ~/telegram-ecommerce-cms
git pull
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
pm2 restart all
```


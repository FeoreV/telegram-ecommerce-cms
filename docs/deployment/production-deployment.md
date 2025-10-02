# 🚀 Production Deployment Guide
## Telegram E-commerce Bot Platform

This guide provides comprehensive instructions for deploying the Telegram E-commerce Bot Platform to production.

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Docker-compatible Linux
- **RAM**: Minimum 8GB (16GB+ recommended)
- **CPU**: 4+ cores
- **Storage**: 100GB+ SSD
- **Network**: Static IP, domain name, SSL certificate

### Required Software
- **Docker** 20.10+
- **Docker Compose** 2.0+
- **Git**
- **SSL Certificate** (Let's Encrypt recommended)

### Domain Configuration
- Main domain: `yourdomain.com`
- Bot webhooks: `bot-webhook.yourdomain.com` 
- Admin panel: `admin.yourdomain.com`

## 🔧 Pre-deployment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/telegram-ecommerce-platform.git
cd telegram-ecommerce-platform
```

### 2. Environment Configuration
```bash
# Copy and configure environment file
cp env.production.example .env.production

# Edit configuration (see Environment Variables section)
nano .env.production
```

### 3. SSL Certificates
```bash
# Create SSL directory
mkdir -p config/ssl

# Option A: Let's Encrypt (recommended)
./scripts/setup-letsencrypt.sh yourdomain.com

# Option B: Self-signed (development only)
./scripts/generate-ssl.sh yourdomain.com
```

### 4. NGINX Configuration
```bash
# Update domain names in NGINX config
sed -i 's/yourdomain.com/your-actual-domain.com/g' config/nginx/nginx.conf
```

## 📊 Environment Variables

### Required Configuration
```bash
# Database
DATABASE_URL=postgresql://postgres:secure_password@postgres:5432/telegram_ecommerce
POSTGRES_PASSWORD=your_secure_password

# Security
JWT_SECRET=your_very_long_jwt_secret_minimum_32_characters
JWT_REFRESH_SECRET=your_very_long_jwt_refresh_secret_minimum_32_characters

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Domain
WEBHOOK_BASE_URL=https://bot-webhook.yourdomain.com
FRONTEND_URL=https://yourdomain.com
API_URL=https://yourdomain.com/api
```

### Security Settings
```bash
# CORS
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

# Rate Limiting
API_RATE_LIMIT_MAX=100
RATE_LIMIT_MAX_REQUESTS=30

# SSL
USE_HTTPS=true
SSL_CERT_PATH=/etc/nginx/ssl/certificate.crt
SSL_KEY_PATH=/etc/nginx/ssl/private.key
```

### Monitoring
```bash
# Logging
LOG_LEVEL=info
ENABLE_JSON_LOGS=true

# Metrics
ENABLE_METRICS=true
PROMETHEUS_PORT=9090
GRAFANA_ADMIN_PASSWORD=secure_grafana_password

# Health Checks
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_INTERVAL=30000
```

## 🚀 Deployment Process

### 1. Pre-flight Checks
```bash
# Make deployment script executable
chmod +x scripts/deploy-production.sh

# Run pre-deployment checks
./scripts/deploy-production.sh --help
```

### 2. Deploy to Production
```bash
# Interactive deployment with confirmation
./scripts/deploy-production.sh

# Or specify environment explicitly
./scripts/deploy-production.sh --env production
```

### 3. Verify Deployment
The script will automatically:
- ✅ Create backup of existing deployment
- ✅ Pull latest Docker images
- ✅ Run database migrations
- ✅ Start all services in correct order
- ✅ Perform health checks
- ✅ Run smoke tests
- ✅ Show deployment summary

## 🔍 Post-deployment Verification

### Service Status
```bash
# Check all services are running
docker-compose -f docker-compose.production.yml ps

# Check service logs
docker-compose -f docker-compose.production.yml logs backend
docker-compose -f docker-compose.production.yml logs bot
```

### Health Checks
```bash
# Backend API
curl -f https://yourdomain.com/api/health

# Bot webhook
curl -f https://bot-webhook.yourdomain.com/health

# Frontend
curl -f https://yourdomain.com/
```

### Database Connectivity
```bash
# Test database connection
docker-compose -f docker-compose.production.yml exec backend npx prisma studio --browser none &
```

## 📊 Monitoring Setup

### Access Monitoring Dashboards
- **Grafana**: http://your-server-ip:3001
  - Username: `admin`
  - Password: From `GRAFANA_ADMIN_PASSWORD` env var
- **Prometheus**: http://your-server-ip:9090
- **Kibana**: http://your-server-ip:5601

### Key Metrics to Monitor
- Bot message processing rate
- API response times
- Database connection pool
- Memory and CPU usage
- Error rates
- Active bot count

## 📝 Logging

### Log Locations
```bash
# Application logs
./logs/app.log
./logs/error.log

# Service-specific logs
docker-compose -f docker-compose.production.yml logs -f backend
docker-compose -f docker-compose.production.yml logs -f bot
docker-compose -f docker-compose.production.yml logs -f postgres
```

### Centralized Logging
Logs are automatically collected by:
- **Logstash**: Processes and enriches logs
- **Elasticsearch**: Stores searchable logs
- **Kibana**: Provides log visualization

## 💾 Backup & Recovery

### Automated Backups
```bash
# Backups run automatically via cron (configured in Docker Compose)
# Manual backup:
./scripts/backup.sh

# List available backups
ls -la backups/
```

### Recovery Process
```bash
# Restore from specific backup
./scripts/restore.sh backup_name_20240125_143022

# Emergency rollback during deployment
# (automatically triggered on deployment failure)
```

## 🔐 Security Hardening

### SSL/TLS Configuration
- ✅ TLS 1.2/1.3 only
- ✅ Strong cipher suites
- ✅ HSTS headers
- ✅ OCSP stapling

### Security Headers
- ✅ Content Security Policy
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ Referrer-Policy

### Access Control
```bash
# Configure IP whitelist for admin panel
nano config/nginx/nginx.conf
# Uncomment and configure IP restrictions
```

## ⚡ Performance Optimization

### Database Optimization
```bash
# After deployment, create performance indexes
docker-compose -f docker-compose.production.yml exec postgres psql -U postgres -d telegram_ecommerce

# Run the SQL commands from backend/scripts/init-db.sql (uncommented sections)
```

### Connection Pooling
- **PgBouncer**: Configured for PostgreSQL connection pooling
- **Redis**: Used for session storage and caching

## 🔧 Maintenance

### Regular Maintenance Tasks
```bash
# Weekly tasks (can be automated)
# 1. Update Docker images
docker-compose -f docker-compose.production.yml pull

# 2. Clean old images and containers
docker system prune -f

# 3. Check disk usage
df -h
docker system df

# 4. Review logs for errors
./scripts/check-errors.sh

# 5. Backup verification
./scripts/verify-backups.sh
```

### Updates and Patches
```bash
# Application updates
git pull origin main
./scripts/deploy-production.sh

# System updates
sudo apt update && sudo apt upgrade -y
```

## 🚨 Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check Docker logs
docker-compose -f docker-compose.production.yml logs

# Check system resources
htop
df -h

# Check port conflicts
netstat -tulpn | grep :3001
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
docker-compose -f docker-compose.production.yml exec postgres pg_isready -U postgres

# Check connection string
docker-compose -f docker-compose.production.yml exec backend node -e "console.log(process.env.DATABASE_URL)"
```

#### Bot Not Receiving Messages
```bash
# Check bot token
docker-compose -f docker-compose.production.yml logs bot | grep "Bot started"

# Test webhook URL
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

# Check webhook logs
docker-compose -f docker-compose.production.yml logs bot | grep webhook
```

#### High Memory Usage
```bash
# Check memory usage by service
docker stats

# Check for memory leaks in logs
docker-compose -f docker-compose.production.yml logs | grep -i "memory\|heap"
```

### Emergency Contacts
- **System Administrator**: admin@yourdomain.com
- **Developer Team**: dev-team@yourdomain.com
- **On-call**: +1-xxx-xxx-xxxx

## 📈 Scaling

### Horizontal Scaling
```bash
# Scale backend service
docker-compose -f docker-compose.production.yml up -d --scale backend=3

# Scale bot service  
docker-compose -f docker-compose.production.yml up -d --scale bot=2
```

### Load Balancing
NGINX is configured to load balance between multiple instances automatically.

## 🔄 CI/CD Integration

### GitHub Actions (Example)
```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production
on:
  push:
    branches: [main]
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to production
        run: |
          ssh production-server "cd /opt/telegram-ecommerce && git pull && ./scripts/deploy-production.sh"
```

## 📞 Support

### Documentation
- **API Documentation**: https://yourdomain.com/api/docs
- **Admin Guide**: ./docs/ADMIN-GUIDE.md
- **Developer Guide**: ./docs/DEVELOPER-GUIDE.md

### Monitoring Alerts
Configure alerts for:
- Service downtime
- High error rates
- Database connection failures
- Disk space warnings
- Memory usage spikes

---

## ✅ Production Checklist

Before going live, ensure:

- [ ] Domain DNS configured correctly
- [ ] SSL certificates installed and valid
- [ ] Environment variables configured
- [ ] Database backups working
- [ ] Monitoring dashboards accessible
- [ ] Error alerting configured
- [ ] Security headers verified
- [ ] Performance tests passed
- [ ] Documentation updated
- [ ] Team trained on operations

---

**🎉 Congratulations! Your Telegram E-commerce Bot Platform is now running in production.**

For ongoing support and updates, please refer to the documentation or contact the development team.

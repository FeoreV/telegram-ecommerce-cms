# Services Configuration

PM2 ecosystem configuration for process management.

## 📁 File

### `ecosystem.config.js`
**Purpose:** PM2 process manager configuration

**Manages:**
- Backend API process
- Bot service process
- Process clustering
- Auto-restart on failure
- Log management
- Environment variables

**Usage:**
```bash
# Start all services
pm2 start config/services/ecosystem.config.js

# Start specific service
pm2 start config/services/ecosystem.config.js --only backend

# Production mode
pm2 start config/services/ecosystem.config.js --env production

# Cluster mode
pm2 start config/services/ecosystem.config.js --instances max
```

## 🔧 Configuration

### Basic Structure
```javascript
module.exports = {
  apps: [
    {
      name: 'backend',
      script: './backend/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'bot',
      script: './bot/dist/index.js',
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
```

## 📊 PM2 Commands

```bash
# Status
pm2 status
pm2 monit

# Logs
pm2 logs
pm2 logs backend
pm2 logs bot --lines 100

# Restart
pm2 restart all
pm2 restart backend

# Stop
pm2 stop all
pm2 delete all

# Save configuration
pm2 save

# Startup script
pm2 startup
```

## 🔄 Auto-Restart

PM2 automatically restarts failed processes. Configure behavior:

```javascript
{
  max_restarts: 10,
  min_uptime: '10s',
  max_memory_restart: '500M',
  autorestart: true,
  watch: false  // Don't use in production
}
```

## 📚 Resources
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 Ecosystem File](https://pm2.keymetrics.io/docs/usage/application-declaration/)

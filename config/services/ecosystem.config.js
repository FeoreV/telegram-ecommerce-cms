module.exports = {
  apps: [
    {
      name: 'telegram-ecommerce-backend',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        ADMIN_COOKIE_SECRET: 'your-admin-cookie-secret',
        SESSION_SECRET: 'your-session-secret'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        ADMIN_COOKIE_SECRET: 'your-admin-cookie-secret',
        SESSION_SECRET: 'your-session-secret'
      }
    },
    {
      name: 'telegram-ecommerce-bot',
      cwd: './bot',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        BOT_PORT: 3002
      },
      env_production: {
        NODE_ENV: 'production',
        BOT_PORT: 3002
      }
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:username/telegram-ecommerce-bot.git',
      path: '/var/www/telegram-ecommerce-bot',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};

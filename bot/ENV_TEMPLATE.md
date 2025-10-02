# Bot Environment Configuration Template

Create a file `bot/.env` with the following content:

```env
# Telegram Bot Configuration Example
# Copy this content to bot/.env and configure your values

# ===================================
# REQUIRED SETTINGS
# ===================================

# Your Telegram Bot Token from @BotFather
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Backend API URL
API_URL=http://localhost:3001

# Node Environment (development | production)
NODE_ENV=development

# ===================================
# REDIS CONFIGURATION
# ===================================

# Option 1: WITH REDIS (recommended - requires Docker)
# Uncomment the line below to enable Redis session storage
# Make sure Docker is running: docker-compose up -d redis
REDIS_URL=redis://localhost:6379

# Option 2: WITHOUT REDIS (in-memory mode - for quick local development)
# Comment out REDIS_URL above to use in-memory session storage
# Note: Sessions will be lost when bot restarts

# ===================================
# BOT SERVER (Polling Mode)
# ===================================

# Port for bot API server (notifications, health checks)
BOT_PORT=3003

# ===================================
# SECURITY
# ===================================

# Enable security features (rate limiting, spam detection)
# Set to false for local development
ENABLE_SECURITY=false

# ===================================
# LOGGING
# ===================================

# Log level: debug | info | warn | error
LOG_LEVEL=debug

# Enable debug mode
DEBUG_ENABLED=true
VERBOSE_LOGGING=true
```

## Quick Start

1. **Create the .env file:**
   ```bash
   # In the bot/ directory, create .env file with the content above
   ```

2. **Set your bot token:**
   - Replace `your_bot_token_here` with your actual token from @BotFather

3. **Choose Redis mode:**
   
   **WITH Redis (recommended):**
   ```env
   REDIS_URL=redis://localhost:6379
   ```
   Then start Redis: `docker-compose up -d redis`
   
   **WITHOUT Redis (quick dev):**
   ```env
   # REDIS_URL=redis://localhost:6379
   ```
   (Comment out or remove the REDIS_URL line)

4. **Start the bot:**
   ```bash
   cd bot
   npm run dev
   ```

# Development Tools

Utilities and scripts to help with local development setup and workflows.

## 📁 Available Tools

### Setup Scripts

#### `setup-dev.sh` / `setup-dev.bat`
Cross-platform development environment setup script.

**Usage:**
```bash
# Linux/macOS
chmod +x tools/development/setup-dev.sh
./tools/development/setup-dev.sh

# Windows
tools\development\setup-dev.bat
```

**What it does:**
1. Checks system requirements (Node.js, npm, Docker)
2. Installs project dependencies
3. Copies environment configuration
4. Sets up database
5. Runs initial migrations
6. Seeds test data
7. Starts development servers

---

#### `setup-xampp.sh` / `setup-xampp.bat`
Setup script for XAMPP-based local development.

**Usage:**
```bash
# Linux/macOS
./tools/development/setup-xampp.sh

# Windows
tools\development\setup-xampp.bat
```

**Prerequisites:**
- XAMPP installed
- MySQL running on port 3306
- PHP 8.0+ (included in XAMPP)

**What it does:**
1. Verifies XAMPP installation
2. Configures MySQL for the project
3. Creates database
4. Imports initial schema
5. Configures PHP settings
6. Sets up environment variables

**For detailed XAMPP setup:** See [XAMPP Setup Guide](../../docs/development/xampp-setup.md)

---

### PowerShell Tools

#### `dev-compose.ps1`
PowerShell script for managing Docker Compose in development.

**Usage:**
```powershell
# Start development environment
.\tools\development\dev-compose.ps1 -Action start

# Stop services
.\tools\development\dev-compose.ps1 -Action stop

# Rebuild containers
.\tools\development\dev-compose.ps1 -Action rebuild

# View logs
.\tools\development\dev-compose.ps1 -Action logs

# Full reset
.\tools\development\dev-compose.ps1 -Action reset
```

**Available actions:**
- `start` - Start all services
- `stop` - Stop all services
- `restart` - Restart all services
- `rebuild` - Rebuild and start containers
- `logs` - Show container logs
- `status` - Show service status
- `reset` - Complete reset (removes volumes)

---

#### `kill-project-ports.ps1`
Kills processes occupying project ports (Windows only).

**Usage:**
```powershell
# Kill all project ports
.\tools\development\kill-project-ports.ps1

# Kill specific port
.\tools\development\kill-project-ports.ps1 -Port 3001

# Dry run (show what would be killed)
.\tools\development\kill-project-ports.ps1 -DryRun
```

**Default ports:**
- 3000 (Frontend)
- 3001 (Backend API)
- 3002 (Bot service)
- 6379 (Redis)
- 3306 (MySQL)

**Use case:** When port conflicts prevent services from starting.

---

### Fixes and Patches

#### `fix-adminjs-design-system.js`
Applies patches to AdminJS design system for compatibility.

**Usage:**
```bash
cd backend
node ../tools/development/fix-adminjs-design-system.js
```

**What it fixes:**
- React 18 compatibility issues
- CSS styling conflicts
- Bundle size optimization
- TypeScript type definitions

**When to run:**
- After `npm install`
- When AdminJS updates
- If admin panel displays incorrectly

**Note:** This fix is also applied automatically via `patches/` directory.

---

## 🛠️ Development Workflows

### Initial Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd botrt

# 2. Run setup script
./tools/development/setup-dev.sh

# 3. Start development servers
npm run dev
```

### Daily Development

```bash
# Start services
docker-compose up -d

# Or use dev script
npm run dev

# View logs
npm run logs

# Run tests
npm test

# Lint code
npm run lint
```

### Working with Database

```bash
# Create migration
cd backend
npx prisma migrate dev --name your_migration_name

# Reset database
npx prisma migrate reset

# View database
npx prisma studio

# Seed data
npm run db:seed
```

### Troubleshooting Development Issues

```bash
# Clear all caches
npm run clean

# Kill stuck ports (Windows)
.\tools\development\kill-project-ports.ps1

# Reset everything
docker-compose down -v
rm -rf node_modules
npm install
npm run dev
```

---

## 🔧 Environment Configuration

### Development `.env`

```env
NODE_ENV=development
PORT=3001

# Database (SQLite for dev)
DATABASE_URL=file:./dev.db
DATABASE_PROVIDER=sqlite

# Redis (optional in dev)
REDIS_URL=redis://localhost:6379

# Frontend
FRONTEND_URL=http://localhost:3000

# Bot (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_dev_bot_token
SUPER_ADMIN_TELEGRAM_ID=your_telegram_id

# Security (dev keys)
JWT_SECRET=dev-secret-key
SESSION_SECRET=dev-session-key
```

### Using Different Databases

**SQLite (easiest for development):**
```env
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./dev.db
```

**MySQL with XAMPP:**
```env
DATABASE_PROVIDER=mysql
DATABASE_URL=mysql://root:@localhost:3306/telegram_ecommerce
```

**PostgreSQL with Docker:**
```env
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://postgres:password@localhost:5432/telegram_ecommerce
```

---

## 🐛 Debugging

### Backend API

```bash
# Enable debug logging
DEBUG=* npm run dev

# Debug specific module
DEBUG=prisma:* npm run dev

# Use Node.js inspector
node --inspect node_modules/.bin/ts-node backend/src/index.ts
```

### Frontend

```bash
# Run with source maps
npm run dev

# React Developer Tools
# Install browser extension: React Developer Tools
```

### Bot Service

```bash
# Enable bot debugging
DEBUG=telegram-bot* npm run bot:dev

# Test bot locally
npm run bot:dev:local
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- auth.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 📝 Code Quality

```bash
# Lint code
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run typecheck
```

---

## 🔥 Hot Reload

All services support hot reload in development:

- **Backend**: TypeScript files auto-recompile
- **Frontend**: Vite HMR (Hot Module Replacement)
- **Bot**: Nodemon watches for changes

No manual restart needed during development!

---

## 📚 Additional Resources

- [Development Quick Start](../../docs/development/dev-quickstart.md)
- [Environment Setup Guide](../../docs/development/environment-setup.md)
- [XAMPP Setup](../../docs/development/xampp-setup.md)
- [Debugging Guide](../../docs/development/debugging.md)

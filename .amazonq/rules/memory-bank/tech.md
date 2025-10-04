# Technology Stack

## Programming Languages

### TypeScript (Primary)
- **Version**: 5.9.2 (backend), 5.2.2 (frontend/bot)
- **Usage**: All services (backend, frontend, bot)
- **Configuration**: Strict mode enabled with comprehensive type checking
- **Compiler Options**: ES2020 target, ESNext module resolution

### JavaScript
- **Usage**: Build scripts, configuration files, utility scripts
- **Version**: ES2020+

## Runtime and Frameworks

### Node.js
- **Version**: 20+ (LTS)
- **Package Manager**: pnpm 8.15.0 (monorepo), npm (individual services)
- **Architecture**: Monorepo with workspace support

### Backend Framework
- **Express.js**: 4.18.2
- **Purpose**: REST API server, middleware stack
- **Features**: Async/await support, middleware composition

### Frontend Framework
- **React**: 18.2.0
- **Build Tool**: Vite 7.1.7
- **UI Library**: Material-UI 5.14.15
- **State Management**: React Context + React Query 3.39.3

### Bot Framework
- **node-telegram-bot-api**: 0.66.0
- **Purpose**: Telegram Bot API integration
- **Features**: Webhook and polling support

## Database and ORM

### Prisma ORM
- **Version**: 5.6.0
- **Client**: @prisma/client 5.6.0
- **Supported Databases**: 
  - SQLite (development)
  - PostgreSQL (production)
  - MySQL (production alternative)
- **Features**: Type-safe queries, migrations, schema management

### Database Engines
- **SQLite**: Development and testing
- **PostgreSQL**: Production (recommended)
- **MySQL**: Production (alternative)

## Caching and Sessions

### Redis
- **Client**: ioredis 5.8.0
- **Alternative**: redis 4.6.10
- **Usage**: Session storage, caching, rate limiting
- **Optional**: Can run without Redis in development

## Real-Time Communication

### Socket.IO
- **Server**: socket.io 4.7.4
- **Client**: socket.io-client 4.8.1
- **Purpose**: Real-time notifications, live updates
- **Features**: Room-based broadcasting, event-driven architecture

## Admin Panel

### AdminJS
- **Core**: adminjs 7.8.17
- **Express Adapter**: @adminjs/express 6.1.1
- **Prisma Adapter**: @adminjs/prisma 5.0.4
- **Upload Plugin**: @adminjs/upload 4.0.2
- **Purpose**: Database administration interface

## Authentication and Security

### Authentication
- **JWT**: jsonwebtoken 9.0.2
- **Password Hashing**: bcrypt 6.0.0, bcryptjs 2.4.3
- **Session Management**: express-session 1.18.2
- **2FA**: speakeasy 2.0.0, qrcode 1.5.4

### Security Middleware
- **Helmet**: 7.2.0 (Security headers)
- **CORS**: cors 2.8.5
- **Rate Limiting**: express-rate-limit 7.5.1
- **Slow Down**: express-slow-down 3.0.0
- **Sanitization**: isomorphic-dompurify 2.28.0

## Validation

### Schema Validation
- **Zod**: 4.1.11 (Backend validation)
- **Yup**: 1.3.3 (Frontend validation)
- **Express Validator**: express-validator 7.0.1

## File Handling

### Upload and Processing
- **Multer**: 1.4.5-lts.1 (File uploads)
- **Sharp**: 0.34.4 (Image processing)
- **File Type**: file-type 21.0.0 (MIME detection)
- **AWS SDK**: aws-sdk 2.1692.0 (S3 integration)

## Logging and Monitoring

### Logging
- **Winston**: 3.11.0
- **Daily Rotate**: winston-daily-rotate-file 5.0.0
- **Purpose**: Application logging, audit trails

### Monitoring
- **Prometheus**: prom-client 15.1.3
- **Grafana**: Dashboard visualization
- **Health Checks**: Custom health endpoints

## HTTP and API

### HTTP Clients
- **Axios**: 1.6.0 (Frontend and bot)
- **Purpose**: API communication, external integrations

### API Tools
- **Express Formidable**: express-formidable 1.2.0
- **CSV Parser**: csv-parser 3.2.0

## Testing

### Backend Testing
- **Jest**: 29.5.0
- **ts-jest**: 29.1.0
- **Supertest**: 6.3.0
- **Coverage**: Built-in Jest coverage

### Frontend Testing
- **Testing Library**: @testing-library/react 16.3.0
- **Jest DOM**: @testing-library/jest-dom 6.8.0
- **Cypress**: e2e testing (configured)

## Development Tools

### Build Tools
- **TypeScript Compiler**: tsc
- **Vite**: Frontend bundler
- **tsx**: 4.20.5 (TypeScript execution)
- **ts-node**: 10.9.1 (TypeScript execution)

### Code Quality
- **ESLint**: 8.53.0
- **Prettier**: 3.1.0
- **Husky**: 8.0.3 (Git hooks)
- **lint-staged**: 15.2.0

### Development Servers
- **nodemon**: 3.0.1 (Backend hot reload)
- **Vite Dev Server**: Frontend hot reload
- **cross-env**: 7.0.3 (Environment variables)

## Containerization

### Docker
- **Base Images**: node:20-alpine
- **Orchestration**: docker-compose
- **Multi-stage Builds**: Production optimization
- **Volumes**: Persistent storage for uploads and databases

## UI Components and Styling

### Material-UI Ecosystem
- **Core**: @mui/material 5.14.15
- **Icons**: @mui/icons-material 5.14.15
- **Data Grid**: @mui/x-data-grid 6.20.4
- **Charts**: @mui/x-charts 6.19.8
- **Date Pickers**: @mui/x-date-pickers 8.11.3
- **Lab**: @mui/lab 5.0.0-alpha.170

### Additional UI Libraries
- **Emotion**: @emotion/react 11.11.1, @emotion/styled 11.11.0
- **React Beautiful DnD**: 13.1.1 (Drag and drop)
- **React Grid Layout**: 1.5.2 (Dashboard layouts)
- **React Toastify**: 9.1.3 (Notifications)
- **Recharts**: 2.15.4 (Alternative charts)

### Form Libraries
- **React Hook Form**: 7.47.0
- **Hookform Resolvers**: 3.3.2
- **React Datepicker**: 8.7.0

## Utilities

### Date and Time
- **date-fns**: 4.1.0

### Audio
- **Howler**: 2.2.4 (Notification sounds)

### QR Codes
- **qrcode**: 1.5.4
- **qrcode.react**: 4.2.0

## Development Commands

### Monorepo Commands (Root)
```bash
# Development
pnpm dev                    # Start all services in parallel
pnpm dev:backend            # Start backend only
pnpm dev:frontend           # Start frontend only
pnpm dev:bot                # Start bot only

# Building
pnpm build                  # Build all services
pnpm build:backend          # Build backend
pnpm build:frontend         # Build frontend
pnpm build:bot              # Build bot

# Production
pnpm start                  # Start all services
pnpm start:backend          # Start backend
pnpm start:frontend         # Start frontend preview
pnpm start:bot              # Start bot

# Testing
pnpm test                   # Run all tests
pnpm test:backend           # Run backend tests

# Code Quality
pnpm lint                   # Lint all services
pnpm lint:fix               # Fix linting issues
pnpm format                 # Format code with Prettier
pnpm format:check           # Check code formatting

# Database
pnpm db:generate            # Generate Prisma client
pnpm db:migrate             # Run migrations
pnpm db:reset               # Reset database
pnpm db:seed                # Seed database
pnpm db:studio              # Open Prisma Studio
```

### Backend Commands
```bash
# Development
npm run dev                 # Start with hot reload (AdminJS skipped)
npm run build               # Compile TypeScript
npm start                   # Run production build

# Testing
npm test                    # Run Jest tests
npm run lint                # Lint TypeScript files
npm run lint:fix            # Fix linting issues

# Database
npm run db:generate         # Generate Prisma client
npm run db:migrate          # Run migrations
npm run db:reset            # Reset database
npm run db:seed             # Seed database
npm run db:studio           # Open Prisma Studio
```

### Frontend Commands
```bash
# Development
npm run dev                 # Start Vite dev server (port 3000)
npm run build               # Build for production
npm run preview             # Preview production build

# Code Quality
npm run lint                # Lint with ESLint
npm run lint:fix            # Fix linting issues
```

### Bot Commands
```bash
# Development
npm run dev                 # Start with nodemon
npm run build               # Compile TypeScript
npm start                   # Run production build
```

### Docker Commands
```bash
# Development
docker-compose up           # Start all services
docker-compose up -d        # Start in detached mode
docker-compose down         # Stop all services
docker-compose logs -f      # Follow logs

# Production
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Rebuild
docker-compose build        # Rebuild images
docker-compose up --build   # Rebuild and start
```

## Environment Requirements

### System Requirements
- **OS**: Windows, macOS, Linux
- **Node.js**: 20.0.0 or higher
- **pnpm**: 8.0.0 or higher (monorepo)
- **Docker**: 20.10+ (optional, for containerized deployment)
- **Redis**: 6.0+ (optional, for caching)

### Development Environment
- **IDE**: VS Code (recommended), WebStorm, or any TypeScript-compatible editor
- **Extensions**: ESLint, Prettier, Prisma
- **Terminal**: PowerShell, Bash, or Zsh

### Production Environment
- **Database**: PostgreSQL 13+ or MySQL 8+
- **Redis**: 6.0+ (recommended)
- **Reverse Proxy**: Nginx (recommended)
- **Process Manager**: PM2 or Docker
- **Monitoring**: Prometheus + Grafana stack

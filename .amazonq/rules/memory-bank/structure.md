# Project Structure

## Directory Organization

### Root Level
```
telegram-ecommerce-cms/
├── backend/              # Express.js API server with AdminJS
├── frontend/             # React admin dashboard
├── bot/                  # Telegram bot service
├── config/               # Infrastructure configurations
├── docs/                 # Project documentation
├── scripts/              # Automation and deployment scripts
├── tools/                # Development and maintenance utilities
├── tests/                # Cross-service test suites
├── storage/              # Shared storage for uploads and backups
└── docker-compose.yml    # Service orchestration
```

## Backend Service (`/backend`)

### Core Structure
```
backend/src/
├── admin/                # AdminJS configuration and components
│   ├── components/       # Custom AdminJS React components
│   ├── resources/        # Resource configurations for models
│   └── theme/            # AdminJS theme customization
├── auth/                 # Authentication system
│   ├── strategies/       # Auth strategies (JWT, session)
│   ├── middleware/       # Auth middleware (requireAuth, requireRole)
│   └── providers/        # Auth providers and utilities
├── config/               # Application configuration
│   ├── database.ts       # Database connection config
│   ├── redis.ts          # Redis configuration
│   └── security.ts       # Security settings
├── controllers/          # Request handlers
│   ├── authController.ts
│   ├── storeController.ts
│   ├── productController.ts
│   ├── orderController.ts
│   └── botController.ts
├── lib/                  # Core libraries
│   ├── prisma.ts         # Prisma client instance
│   ├── redis.ts          # Redis client instance
│   └── socket.ts         # Socket.IO server setup
├── middleware/           # Express middleware stack
│   ├── auth.ts           # Authentication middleware
│   ├── validation.ts     # Request validation
│   ├── errorHandler.ts   # Global error handling
│   ├── rateLimiter.ts    # Rate limiting
│   └── security.ts       # Security headers and CORS
├── repositories/         # Data access layer
│   ├── StoreRepository.ts
│   ├── ProductRepository.ts
│   ├── OrderRepository.ts
│   └── UserRepository.ts
├── routes/               # API route definitions
│   ├── auth.routes.ts
│   ├── store.routes.ts
│   ├── product.routes.ts
│   └── order.routes.ts
├── schemas/              # Zod validation schemas
│   └── validationSchemas.ts
├── services/             # Business logic layer
│   ├── AuthService.ts
│   ├── StoreService.ts
│   ├── OrderService.ts
│   ├── PaymentService.ts
│   ├── InventoryService.ts
│   ├── NotificationService.ts
│   └── ReconciliationSecurityService.ts
├── types/                # TypeScript type definitions
│   ├── express.d.ts      # Express type extensions
│   ├── models.ts         # Domain model types
│   └── api.ts            # API request/response types
├── utils/                # Utility functions
│   ├── logger.ts         # Winston logger setup
│   ├── encryption.ts     # Encryption utilities
│   └── validators.ts     # Custom validators
└── index.ts              # Application entry point
```

### Database Layer (`/backend/prisma`)
```
prisma/
├── migrations/           # Database migration history
├── schema.prisma         # Prisma schema definition
└── seed.ts               # Database seeding script
```

## Frontend Service (`/frontend`)

### Core Structure
```
frontend/src/
├── components/           # Reusable React components
│   ├── common/           # Shared UI components
│   ├── layout/           # Layout components (Header, Sidebar)
│   ├── forms/            # Form components
│   ├── tables/           # Data table components
│   └── charts/           # Chart and visualization components
├── contexts/             # React Context providers
│   ├── AuthContext.tsx   # Authentication state
│   ├── ThemeContext.tsx  # Theme configuration
│   └── NotificationContext.tsx
├── hooks/                # Custom React hooks
│   ├── useAuth.ts
│   ├── useRealTimeUpdates.ts
│   ├── useAccessibility.ts
│   └── useApi.ts
├── pages/                # Page components
│   ├── Dashboard/
│   ├── Stores/
│   ├── Products/
│   ├── Orders/
│   ├── Analytics/
│   └── Settings/
├── routes/               # Route configuration
│   └── AppRoutes.tsx
├── services/             # API service layer
│   ├── api.ts            # Axios instance configuration
│   ├── authService.ts
│   ├── storeService.ts
│   └── orderService.ts
├── styles/               # Global styles
│   └── theme.ts          # Material-UI theme
├── types/                # TypeScript types
│   └── index.ts
├── utils/                # Utility functions
│   ├── formatters.ts
│   └── validators.ts
├── App.tsx               # Root component
└── main.tsx              # Application entry point
```

## Bot Service (`/bot`)

### Core Structure
```
bot/src/
├── handlers/             # Telegram message handlers
│   ├── commandHandlers.ts
│   ├── callbackHandlers.ts
│   └── messageHandlers.ts
├── middleware/           # Bot middleware
│   ├── auth.ts
│   ├── rateLimiter.ts
│   └── logger.ts
├── services/             # Bot business logic
│   ├── CartService.ts
│   ├── OrderService.ts
│   └── ProductService.ts
├── types/                # TypeScript types
│   └── bot.ts
├── utils/                # Utility functions
│   ├── keyboards.ts      # Telegram keyboard builders
│   └── formatters.ts
└── index.ts              # Bot entry point
```

## Configuration (`/config`)

### Infrastructure Configurations
```
config/
├── docker/               # Docker configurations
│   ├── docker-compose.*.yml
│   └── *.dockerfile
├── environments/         # Environment templates
│   ├── env.example
│   └── env.production.example
├── nginx/                # Nginx configurations
│   └── nginx.conf
├── postgres/             # PostgreSQL configurations
│   └── postgresql.conf
├── redis/                # Redis configurations
│   └── redis.conf
├── prometheus/           # Prometheus monitoring
│   └── prometheus.yml
├── grafana/              # Grafana dashboards
│   └── grafana.ini
└── security/             # Security configurations
    └── security-headers.conf
```

## Documentation (`/docs`)

### Documentation Structure
```
docs/
├── ai/                   # AI assistant context
│   ├── code-map.md
│   ├── data-models.md
│   └── rbac.md
├── api/                  # API documentation
│   └── telegram-store-integration.md
├── architecture/         # Architecture documentation
│   ├── cms-architecture.md
│   └── project-structure.md
├── deployment/           # Deployment guides
│   ├── production-deployment.md
│   └── docker-setup.md
├── development/          # Development guides
│   ├── quick-start.md
│   └── environment-setup.md
└── security/             # Security documentation
    └── security-architecture-overview.md
```

## Core Components and Relationships

### Service Communication
```
Frontend (React) ←→ Backend API (Express)
                      ↓
                   Prisma ORM
                      ↓
                   Database (PostgreSQL/MySQL/SQLite)
                      
Backend API ←→ Redis (Caching/Sessions)
Backend API ←→ Socket.IO ←→ Frontend (Real-time)
Backend API ←→ Bot Service (API calls)
Bot Service ←→ Telegram API
```

### Data Flow
1. **User Request**: Frontend → Backend API
2. **Authentication**: JWT validation → Session check
3. **Authorization**: RBAC permission check
4. **Business Logic**: Service layer processing
5. **Data Access**: Repository → Prisma → Database
6. **Response**: Backend → Frontend
7. **Real-time Updates**: Socket.IO broadcast to connected clients

### Key Architectural Patterns

#### Layered Architecture
- **Presentation Layer**: React components and pages
- **API Layer**: Express routes and controllers
- **Business Logic Layer**: Service classes
- **Data Access Layer**: Repositories and Prisma
- **Database Layer**: PostgreSQL/MySQL/SQLite

#### Repository Pattern
- Abstracts data access logic
- Provides consistent interface for data operations
- Enables easier testing and database switching

#### Service Layer Pattern
- Encapsulates business logic
- Coordinates between repositories
- Handles complex operations and transactions

#### Middleware Chain
- Request validation → Authentication → Authorization → Rate limiting → Business logic → Response

#### Real-Time Architecture
- Socket.IO for bidirectional communication
- Event-based notifications
- Room-based broadcasting for store isolation

## Module Dependencies

### Backend Dependencies
- **Core**: Express, Prisma, TypeScript
- **Authentication**: jsonwebtoken, bcrypt
- **Validation**: Zod, express-validator
- **Real-time**: Socket.IO
- **Admin**: AdminJS with Prisma adapter
- **Security**: helmet, cors, express-rate-limit
- **Logging**: winston
- **Cache**: ioredis

### Frontend Dependencies
- **Core**: React, TypeScript, Vite
- **UI**: Material-UI (@mui/material)
- **State**: React Context, React Query
- **Routing**: react-router-dom
- **Forms**: react-hook-form, yup
- **Real-time**: socket.io-client
- **Charts**: recharts, @mui/x-charts

### Bot Dependencies
- **Core**: node-telegram-bot-api
- **HTTP**: axios
- **Cache**: ioredis
- **Logging**: winston

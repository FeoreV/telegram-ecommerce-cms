# Backend API

Backend API for multi-store Telegram e-commerce platform with hierarchical role-based access control.

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: Prisma ORM (SQLite/PostgreSQL)
- **Cache**: Redis/IORedis
- **Real-time**: Socket.IO
- **Admin Panel**: AdminJS
- **Authentication**: JWT with session management
- **Validation**: Zod schemas

### Key Features
- Multi-store architecture with tenant isolation
- Hierarchical RBAC (OWNER > ADMIN > VENDOR > CUSTOMER)
- Store-specific Telegram bot provisioning
- Custom order state machine
- Manual payment verification workflow
- Real-time inventory tracking
- Advanced security middleware stack
- Comprehensive audit logging

## 📁 Project Structure

```
backend/
├── src/
│   ├── admin/              # AdminJS components and configurations
│   ├── auth/               # Authentication system and middleware
│   ├── config/             # Application configuration
│   ├── controllers/        # Request handlers
│   ├── lib/                # Core libraries (database, redis, socket)
│   ├── middleware/         # Express middleware stack
│   ├── repositories/       # Data access layer
│   ├── routes/             # API route definitions
│   ├── schemas/            # Zod validation schemas
│   ├── services/           # Business logic layer
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions and helpers
│   └── __tests__/          # Unit and integration tests
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Database seeding script
├── scripts/                # Utility scripts
├── tools/                  # Development and admin tools
├── docs/                   # Documentation
├── patches/                # Package patches
└── Dockerfile              # Container configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Redis server
- PostgreSQL (production) or SQLite (development)

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### Development

```bash
# Start development server
npm run dev

# Start with AdminJS enabled
npm run dev:admin

# Start without AdminJS
npm run dev:noadmin
```

### Building

```bash
# Compile TypeScript
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm test:watch

# Coverage report
npm test:coverage
```

## 🔐 Environment Variables

Create a `.env` file in the backend root:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="file:./prisma/dev.db"

# Redis
REDIS_HOST=82.147.84.78
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
```

See `../config/environments/env.example` for complete configuration reference.

## 📚 Documentation

- [Authentication System](./docs/README.md) - Auth configuration and integration
- [Custom Roles](./docs/CUSTOM_ROLES_AND_INVITE_LINKS.md) - Role management system
- [Employee Management](./docs/EMPLOYEE_MANAGEMENT_SETUP.md) - Employee access control
- [Admin Theme](./docs/admin-theme.md) - AdminJS customization
- [Session Management](./docs/SESSION_FIX_GUIDE.md) - Session handling guide
- [Integration Examples](./docs/INTEGRATION_EXAMPLES.md) - API integration examples

## 🏛️ Core Business Domains

### Store Management (95% importance)
- Multi-store architecture with isolated configurations
- Store-specific bot provisioning
- Hierarchical permissions system
- Template-based deployment

### Order Processing (90% importance)
- Custom state machine: PENDING_ADMIN → PAID → SHIPPED → DELIVERED
- Manual payment verification with proof submission
- Multi-currency support
- Real-time stock adjustments

### Bot Management (85% importance)
- Store-specific bot configuration
- Template-based deployment
- Automated webhook management
- Custom spam detection

### Inventory Control (80% importance)
- Multi-level stock alerts
- Automated reorder calculations
- Real-time monitoring
- Stock predictions

### Analytics Engine (75% importance)
- Store-specific metrics
- Cross-currency revenue tracking
- Custom conversion calculations
- Performance scoring

## 🔒 Security Features

- **Multi-layer Security**: Content validation, CORS, helmet, rate limiting
- **Authentication**: JWT with refresh tokens, session management
- **Authorization**: RBAC with custom roles and permissions
- **Audit Logging**: Comprehensive security and activity tracking
- **Data Protection**: Encryption at rest, DLP, data masking
- **Attack Prevention**: CSRF, XSS, SQL injection protection
- **Compromise Detection**: Honeytokens, threat detection, anomaly monitoring

## 🧪 Testing

Tests are organized in `src/__tests__/`:
- `unit/` - Unit tests for services and utilities
- `integration/` - Integration tests for API endpoints
- `*.test.ts` - Component-specific tests

## 🛠️ Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Run production server
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## 📦 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout

### Stores
- `GET /api/stores` - List stores
- `POST /api/stores` - Create store
- `GET /api/stores/:id` - Get store details
- `PUT /api/stores/:id` - Update store
- `DELETE /api/stores/:id` - Delete store

### Products
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order
- `PUT /api/orders/:id` - Update order status
- `POST /api/orders/:id/payment-proof` - Upload payment proof

### Bots
- `GET /api/bots` - List bots
- `POST /api/bots` - Create bot
- `PUT /api/bots/:id` - Update bot configuration
- `DELETE /api/bots/:id` - Delete bot

### Admin Panel
- `GET /admin` - AdminJS dashboard

See API documentation in `docs/api/` for complete endpoint reference.

## 🤝 Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

## 📝 License

See [LICENSE](../LICENSE) for license information.

## 🔗 Related Projects

- **Frontend**: React-based admin dashboard
- **Bot**: Telegram bot service
- **Config**: Infrastructure configuration

---

**Version**: 1.0.0  
**Node**: 20+  
**Prisma**: 5.6.0  
**TypeScript**: 5.9.2

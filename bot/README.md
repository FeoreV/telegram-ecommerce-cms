# Telegram E-commerce Bot

A Telegram bot service for managing e-commerce stores with multi-store support, order processing, and payment verification.

## Features

- 🏪 **Multi-store Management**: Support for multiple independent stores with isolated configurations
- 🛒 **Shopping Cart**: Full shopping cart functionality with session management
- 📦 **Order Processing**: Complete order lifecycle management from creation to delivery
- 💳 **Payment Verification**: Manual payment proof submission and verification workflow
- 🔔 **Notifications**: Priority-based notification system for order updates
- 🛡️ **Security**: Built-in spam detection and rate limiting
- 📊 **Store Administration**: Comprehensive admin tools for store management
- 🔄 **Session Management**: Redis-based session storage for reliability

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Bot Framework**: node-telegram-bot-api
- **Cache**: Redis for session and cache management
- **HTTP Client**: Axios for API communication
- **Logging**: Winston for structured logging
- **QR Codes**: QR code generation for payment processing

## Project Structure

```
bot/
├── src/
│   ├── handlers/          # Message and callback handlers
│   │   ├── startHandler.ts
│   │   ├── storeHandler.ts
│   │   ├── productHandler.ts
│   │   ├── cartHandler.ts
│   │   ├── orderHandler.ts
│   │   ├── paymentProofHandler.ts
│   │   ├── adminHandler.ts
│   │   └── notificationHandler.ts
│   ├── services/          # Business logic services
│   │   ├── apiService.ts
│   │   ├── webhookService.ts
│   │   ├── qrPaymentService.ts
│   │   ├── smartVerificationService.ts
│   │   └── cmsService.ts
│   ├── middleware/        # Bot middleware
│   │   └── security.ts
│   ├── utils/            # Utility functions
│   │   ├── logger.ts
│   │   ├── cache.ts
│   │   ├── sessionManager.ts
│   │   ├── redisStore.ts
│   │   └── telegramWebhookValidator.ts
│   ├── types/            # TypeScript type definitions
│   │   └── apiResponses.ts
│   └── index.ts          # Application entry point
├── Dockerfile            # Docker configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── .env.example          # Environment variables template
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## Environment Variables

See `.env.example` for all required environment variables:

- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token from @BotFather
- `API_URL` - Backend API URL
- `REDIS_HOST` - Redis server hostname
- `REDIS_PORT` - Redis server port
- `NODE_ENV` - Environment (development/production)

## Running the Bot

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Using Docker
```bash
docker build -t telegram-bot .
docker run -d --env-file .env telegram-bot
```

## Development

### Available Scripts

- `npm run dev` - Run in development mode with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

### Code Structure

The bot follows a modular architecture:

- **Handlers**: Process incoming messages and callback queries
- **Services**: Encapsulate business logic and external API calls
- **Middleware**: Implement security, logging, and validation
- **Utils**: Provide common utilities and helpers

## Key Features

### Store Management
Users can browse multiple stores, each with their own:
- Product catalog
- Shopping cart
- Order history
- Payment methods

### Order Flow
1. Browse products
2. Add to cart
3. Submit order
4. Upload payment proof
5. Admin verification
6. Order fulfillment
7. Delivery tracking

### Admin Features
- Order verification
- Payment proof review
- Store configuration
- Customer management
- Notification broadcasting

## Security

- Rate limiting per user
- Spam detection
- Webhook signature validation
- Secure session management
- Input validation and sanitization

## Integration

The bot integrates with:
- Backend REST API for business logic
- Redis for session and cache storage
- File storage for payment proofs and media

## License

See LICENSE file in the root directory.

## Support

For issues and questions, please open an issue in the repository.

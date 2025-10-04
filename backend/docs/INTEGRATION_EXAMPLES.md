# 🔐 Secure Authentication System - Integration Examples

## Quick Start Integration

### 1. Basic App Setup

```typescript
// app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import {
  secureAuthRoutes,
  securityMiddlewareStack,
  secureAuthMiddleware,
  requireRole,
  UserRole
} from './auth';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Apply global security stack
app.use(securityMiddlewareStack);

// Auth routes
app.use('/auth', secureAuthRoutes);

// Protected API routes
app.use('/api', secureAuthMiddleware);

// Admin routes
app.use('/admin', 
  secureAuthMiddleware, 
  requireRole([UserRole.OWNER, UserRole.ADMIN])
);

export default app;
```

### 2. Environment Variables

```env
# .env
JWT_SECRET=your-super-secure-256-bit-secret-key-here-change-in-production
JWT_REFRESH_SECRET=your-different-super-secure-256-bit-refresh-key-here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
BCRYPT_ROUNDS=12
REDIS_URL=redis://localhost:6379
```

## API Endpoints

### Authentication Endpoints

```typescript
// POST /auth/login/email
{
  "email": "admin@example.com",
  "password": "<your-secure-password>"
}

// Response:
{
  "success": true,
  "message": "Authentication successful",
  "user": {
    "id": "user-id",
    "email": "admin@example.com",
    "role": "ADMIN",
    ...
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": "15m"
  }
}
```

```typescript
// POST /auth/login/telegram
{
  "telegramId": "123456789",
  "username": "telegram_user",
  "firstName": "John",
  "lastName": "Doe"
}
```

```typescript
// POST /auth/refresh-token
{
  "refreshToken": "eyJ..."
}
```

```typescript
// POST /auth/logout (requires auth)
{
  "refreshToken": "eyJ..." // optional
}
```

### Protected Endpoints

```typescript
// GET /auth/profile (requires auth)
// Headers: Authorization: Bearer <accessToken>

// PATCH /auth/profile (requires auth)
{
  "username": "newUsername",
  "firstName": "New First Name"
}

// POST /auth/change-password (requires auth)
{
  "currentPassword": "<current-password>",
  "newPassword": "<new-secure-password>"
}
```

## Frontend Integration

### React Example

```typescript
// AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthState {
  user: any | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string) => {
    const response = await fetch('/auth/login/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (data.success) {
      setUser(data.user);
      // Store tokens in localStorage or handle via cookies
      localStorage.setItem('accessToken', data.tokens.accessToken);
    } else {
      throw new Error(data.error);
    }
  };

  const logout = async () => {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    
    setUser(null);
    localStorage.removeItem('accessToken');
  };

  const refreshToken = async () => {
    const response = await fetch('/auth/refresh-token', {
      method: 'POST',
      credentials: 'include'
    });

    const data = await response.json();
    if (data.success) {
      setUser(data.user);
      localStorage.setItem('accessToken', data.tokens.accessToken);
    }
  };

  // Auto-refresh logic
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Verify token and refresh if needed
      refreshToken().catch(() => {
        localStorage.removeItem('accessToken');
      });
    }
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### API Client with Auto-Refresh

```typescript
// apiClient.ts
class APIClient {
  private baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  async request(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('accessToken');
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      credentials: 'include' as const
    };

    let response = await fetch(`${this.baseURL}${endpoint}`, config);

    // Auto-refresh on token expiry
    if (response.status === 401) {
      const refreshResponse = await fetch(`${this.baseURL}/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include'
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        localStorage.setItem('accessToken', data.tokens.accessToken);
        
        // Retry original request
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${data.tokens.accessToken}`
        };
        response = await fetch(`${this.baseURL}${endpoint}`, config);
      }
    }

    return response;
  }
}

export const apiClient = new APIClient();
```

## Route Protection Examples

### Basic Route Protection

```typescript
// routes/products.ts
import express from 'express';
import { secureAuthMiddleware, requirePermission } from '../auth';
import { Permission } from '../auth/RolePermissionManager';

const router = express.Router();

// All product routes require authentication
router.use(secureAuthMiddleware);

// Get products (any authenticated user)
router.get('/', async (req, res) => {
  // Handle product listing
});

// Create product (requires permission)
router.post('/', 
  requirePermission(Permission.PRODUCT_CREATE),
  async (req, res) => {
    // Handle product creation
  }
);

// Update product (requires permission + store access)
router.patch('/:id',
  requirePermission(Permission.PRODUCT_UPDATE),
  async (req, res) => {
    // Store access validation would be in controller
  }
);

export default router;
```

### Store-Specific Protection

```typescript
// routes/stores.ts
import express from 'express';
import { 
  secureAuthMiddleware, 
  requireRole, 
  requireStoreAccess 
} from '../auth';
import { UserRole } from '../auth';

const router = express.Router();

router.use(secureAuthMiddleware);

// Store management (requires store access)
router.get('/:storeId', 
  requireStoreAccess('storeId'),
  async (req, res) => {
    const storeId = req.params.storeId;
    // User has verified access to this store
  }
);

// Create store (owner only)
router.post('/',
  requireRole(UserRole.OWNER),
  async (req, res) => {
    // Only owners can create stores
  }
);

export default router;
```

### Custom Permission Middleware

```typescript
// Custom middleware example
import { RolePermissionManager } from '../auth';

const requireStoreOwnershipOrAdmin = async (req: any, res: any, next: any) => {
  const storeId = req.params.storeId;
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const permissionChecker = new RolePermissionManager(user);
  
  // Owner can access everything
  if (permissionChecker.isOwner()) {
    return next();
  }
  
  // Check if user owns this specific store
  if (await permissionChecker.hasStoreAccess(storeId)) {
    return next();
  }
  
  return res.status(403).json({ error: 'Store access denied' });
};

// Usage
router.delete('/:storeId', requireStoreOwnershipOrAdmin, deleteStoreHandler);
```

## Telegram Bot Integration

```typescript
// bot/authHandler.ts
import { SecureAuthSystem } from '../src/auth';

export const handleTelegramAuth = async (bot: any, msg: any) => {
  const telegramId = msg.from.id.toString();
  const userData = {
    username: msg.from.username,
    firstName: msg.from.first_name,
    lastName: msg.from.last_name
  };

  try {
    const result = await SecureAuthSystem.authenticateWithTelegram(telegramId, userData);
    
    // Store token securely (in memory or secure storage)
    // You might want to create a session mapping for telegram users
    
    bot.sendMessage(msg.chat.id, 
      `✅ Добро пожаловать, ${userData.firstName}!\nВы вошли как: ${result.user.role}`
    );
    
    return result.accessToken;
  } catch (error) {
    bot.sendMessage(msg.chat.id, '❌ Ошибка авторизации');
    throw error;
  }
};
```

## Error Handling

```typescript
// Error handling middleware
export const authErrorHandler = (err: any, req: any, res: any, next: any) => {
  // Auth-specific errors
  if (err.code === 'TOKEN_EXPIRED') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
      action: 'refresh_token'
    });
  }
  
  if (err.code === 'INSUFFICIENT_PERMISSIONS') {
    return res.status(403).json({
      error: 'Access denied',
      code: 'INSUFFICIENT_PERMISSIONS',
      required: err.required,
      current: err.current
    });
  }
  
  if (err.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: err.retryAfter
    });
  }
  
  next(err);
};
```

## Testing Examples

```typescript
// auth.test.ts
import request from 'supertest';
import app from '../app';

describe('Authentication', () => {
  test('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/auth/login/email')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tokens).toHaveProperty('accessToken');
    expect(response.body.tokens).toHaveProperty('refreshToken');
  });

  test('should refresh token', async () => {
    // First login
    const loginResponse = await request(app)
      .post('/auth/login/email')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    const refreshToken = loginResponse.body.tokens.refreshToken;

    // Then refresh
    const refreshResponse = await request(app)
      .post('/auth/refresh-token')
      .send({ refreshToken });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.tokens).toHaveProperty('accessToken');
  });

  test('should deny access without token', async () => {
    const response = await request(app)
      .get('/auth/profile');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });
});
```

## Performance Considerations

### Redis Configuration for Production

```typescript
// redis.ts
import { createClient } from 'redis';

export const createRedisClient = () => {
  return createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 5000,
      lazyConnect: true
    },
    retry_strategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });
};
```

### JWT Token Optimization

```env
# Shorter tokens for high-traffic scenarios
ACCESS_TOKEN_EXPIRY=5m  # More frequent refresh, better security
REFRESH_TOKEN_EXPIRY=24h # Shorter refresh window

# Or longer for lower traffic
ACCESS_TOKEN_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=30d
```

This comprehensive integration guide shows how to implement the secure authentication system across your entire application stack.

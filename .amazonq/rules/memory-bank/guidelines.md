# Development Guidelines

## Code Quality Standards

### TypeScript Configuration
- **Strict Mode**: All services use TypeScript strict mode with comprehensive type checking
- **Target**: ES2020 for backend/bot, ES2020+ for frontend
- **Module Resolution**: ESNext with full type safety
- **No Implicit Any**: All variables and parameters must have explicit types
- **Null Checks**: Strict null checking enabled across all services

### Code Formatting
- **Indentation**: 2 spaces (consistent across backend, frontend, bot)
- **Line Length**: Maximum 120 characters (enforced by ESLint)
- **Semicolons**: Required at end of statements
- **Quotes**: Single quotes for strings, double quotes in JSX
- **Trailing Commas**: Required in multi-line objects and arrays
- **Arrow Functions**: Preferred for callbacks and functional components

### Naming Conventions
- **Files**: camelCase for utilities, PascalCase for components/classes
  - Controllers: `orderController.ts`, `storeController.ts`
  - Services: `NotificationService.ts`, `ReconciliationSecurityService.ts`
  - Components: `Dashboard.tsx`, `OrderList.tsx`
  - Hooks: `useRealTimeUpdates.ts`, `useAccessibility.ts`
- **Variables**: camelCase (`totalAmount`, `orderNumber`, `isConnected`)
- **Constants**: UPPER_SNAKE_CASE for true constants (`MAX_FILE_SIZE`, `API_BASE_URL`)
- **Enums**: PascalCase for enum names, UPPER_SNAKE_CASE for values
  - Example: `ReconciliationType.INVENTORY_RECONCILIATION`
- **Interfaces/Types**: PascalCase with descriptive names
  - Example: `AuthenticatedRequest`, `OrderWithRelations`, `AccessibilityState`
- **Functions**: camelCase with verb prefixes (`getOrders`, `createOrder`, `handleNewOrder`)
- **React Components**: PascalCase (`OrderList`, `ProductCard`, `DashboardLayout`)
- **Custom Hooks**: camelCase starting with "use" (`useRealTimeUpdates`, `useAccessibility`)

### Documentation Standards
- **JSDoc Comments**: Required for all exported functions, classes, and complex logic
- **Inline Comments**: Used sparingly, only for complex business logic
- **README Files**: Present in each major directory (backend, frontend, bot)
- **API Documentation**: Endpoint documentation in comments above route handlers
- **Type Documentation**: Complex types documented with inline comments

## Semantic Patterns

### Error Handling Pattern
```typescript
// Consistent error handling with custom AppError class
try {
  // Business logic
  const result = await someOperation();
  return result;
} catch (error: unknown) {
  logger.error('Operation failed:', toLogMetadata(error));
  throw new AppError('User-friendly message', statusCode);
}
```

**Key Characteristics**:
- Always type errors as `unknown` and cast appropriately
- Use custom `AppError` class for application errors
- Log errors with structured metadata using `toLogMetadata()`
- Provide user-friendly error messages separate from technical logs
- Used in: All controllers, services, and middleware

### Async Handler Wrapper Pattern
```typescript
export const getOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Controller logic without try-catch
  const orders = await prisma.order.findMany();
  res.json({ orders });
});
```

**Key Characteristics**:
- Wrap all async route handlers with `asyncHandler` utility
- Eliminates need for try-catch in controllers
- Centralizes error handling in middleware
- Automatically passes errors to error handler middleware
- Used in: All controller functions (100% adoption)

### Role-Based Access Control Pattern
```typescript
// Check user role and build appropriate query filters
if (req.user.role !== 'OWNER') {
  whereClause.store = {
    OR: [
      { ownerId: req.user.id },
      { admins: { some: { userId: req.user.id } } }
    ]
  };
}
```

**Key Characteristics**:
- OWNER role has unrestricted access
- Non-owners filtered to their accessible stores
- Uses Prisma's nested OR conditions for complex permissions
- Applied at query level for data isolation
- Used in: All data retrieval endpoints (orders, products, stores)

### Transaction Pattern for Data Consistency
```typescript
const order = await prisma.$transaction(async (tx) => {
  const newOrder = await tx.order.create({ data: orderData });
  
  for (const item of items) {
    await tx.orderItem.create({ data: itemData });
    await tx.product.update({ 
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } }
    });
  }
  
  return newOrder;
});
```

**Key Characteristics**:
- Use Prisma transactions for multi-step operations
- Ensures atomicity (all-or-nothing execution)
- Automatic rollback on errors
- Used for: Order creation, stock updates, payment processing
- Frequency: All operations modifying multiple related entities

### Audit Logging Pattern
```typescript
await prisma.adminLog.create({
  data: {
    action: 'confirm_payment',
    adminId: req.user.id,
    orderId: id,
    details: JSON.stringify({
      orderNumber: order.orderNumber,
      amount: order.totalAmount.toString(),
    }),
  },
});
```

**Key Characteristics**:
- Log all administrative actions
- Store structured data as JSON in details field
- Include actor (adminId), target (orderId), and action type
- Timestamp automatically added by Prisma
- Used in: All state-changing admin operations (90%+ coverage)

### Real-Time Update Pattern (Socket.IO)
```typescript
const { SocketRoomService } = await import('../services/socketRoomService.js');
SocketRoomService.notifyOrderUpdate(orderId, storeId, 'order:payment_confirmed', {
  orderId,
  orderNumber,
  status: 'PAID',
  adminId: req.user.id,
  customerId: order.customerId,
});
```

**Key Characteristics**:
- Dynamic import of SocketRoomService to avoid circular dependencies
- Room-based broadcasting for store isolation
- Event naming convention: `entity:action` (e.g., `order:payment_confirmed`)
- Include all relevant data in payload for client updates
- Used in: All real-time operations (orders, products, inventory)

### Notification Service Pattern
```typescript
await NotificationService.send({
  title: 'Новый заказ',
  message: `Получен новый заказ #${orderNumber}`,
  type: NotificationType.ORDER_CREATED,
  priority: NotificationPriority.HIGH,
  recipients: [store.ownerId],
  channels: [NotificationChannel.SOCKET, NotificationChannel.TELEGRAM],
  data: { orderId, orderNumber, storeId, totalAmount }
});
```

**Key Characteristics**:
- Centralized notification system with multiple channels
- Type-safe notification types and priorities using enums
- Support for multiple recipients and channels
- Include structured data for client-side handling
- Used in: Order lifecycle events, inventory alerts, user actions

### Zod Validation Schema Pattern
```typescript
export const orderSchemas = {
  create: z.object({
    customerId: commonSchemas.uuid.optional(),
    items: z.array(z.object({
      productId: commonSchemas.uuid,
      quantity: commonSchemas.positiveInt,
      price: commonSchemas.price,
    })).min(1, 'Order must contain at least one item'),
    // ... more fields
  }),
};
```

**Key Characteristics**:
- Centralized validation schemas in `validationSchemas.ts`
- Reusable common schemas for consistency
- Descriptive error messages for user feedback
- Nested object validation with type inference
- Used in: All API endpoints requiring input validation

### React Custom Hook Pattern
```typescript
export const useRealTimeUpdates = (options: UseRealTimeUpdatesOptions = {}) => {
  const { socket, isConnected, on, off } = useSocket();
  const { onOrderUpdate, enableNotifications = true } = options;

  const handleNewOrder = useCallback((data: any) => {
    if (onOrderUpdate) onOrderUpdate();
    if (enableNotifications) {
      toast.success(`🛒 Новый заказ от ${data.order.customerInfo?.name}`);
    }
  }, [onOrderUpdate, enableNotifications]);

  useEffect(() => {
    if (!socket || !isConnected) return;
    on('order:new', handleNewOrder);
    return () => off('order:new', handleNewOrder);
  }, [socket, isConnected, handleNewOrder, on, off]);

  return { isConnected, socket };
};
```

**Key Characteristics**:
- Custom hooks for reusable stateful logic
- Use `useCallback` for event handlers to prevent re-renders
- Proper cleanup in `useEffect` return function
- Dependency arrays include all used variables
- Options object pattern for flexible configuration
- Used in: Real-time updates, accessibility, form handling

### Specialized Hook Variants Pattern
```typescript
// Base hook with full options
export const useRealTimeUpdates = (options) => { /* ... */ };

// Specialized variants for specific use cases
export const useDashboardRealTime = (onDataUpdate) => {
  return useRealTimeUpdates({
    onOrderUpdate: onDataUpdate,
    onProductUpdate: onDataUpdate,
    enableNotifications: true,
  });
};

export const useOrdersRealTime = (onOrderUpdate) => {
  return useRealTimeUpdates({
    onOrderUpdate,
    enableNotifications: false,
  });
};
```

**Key Characteristics**:
- Create specialized variants of base hooks for common use cases
- Simplify API for consumers with preset configurations
- Maintain single source of truth in base hook
- Used in: Real-time hooks, form hooks, data fetching hooks

### Accessibility Pattern
```typescript
const announceToScreenReader = useCallback((message: string) => {
  let announcer = document.getElementById('screen-reader-announcer');
  
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    // Position off-screen
    announcer.style.position = 'absolute';
    announcer.style.left = '-10000px';
    document.body.appendChild(announcer);
  }

  announcer.textContent = '';
  setTimeout(() => { announcer!.textContent = message; }, 100);
}, []);
```

**Key Characteristics**:
- ARIA live regions for screen reader announcements
- Off-screen positioning for visual hiding
- Clear and re-announce pattern with timeout
- Detect system preferences (reduced motion, high contrast)
- Store preferences in localStorage
- Used in: Accessibility features, notifications, form validation

### Singleton Service Pattern
```typescript
export class ReconciliationSecurityService {
  private static instance: ReconciliationSecurityService;
  private reconciliationJobs: Map<string, ReconciliationJob> = new Map();

  private constructor() {
    this.initializeReconciliationSecurity();
    this.loadReconciliationJobs();
  }

  public static getInstance(): ReconciliationSecurityService {
    if (!ReconciliationSecurityService.instance) {
      ReconciliationSecurityService.instance = new ReconciliationSecurityService();
    }
    return ReconciliationSecurityService.instance;
  }
}

export const reconciliationSecurityService = ReconciliationSecurityService.getInstance();
```

**Key Characteristics**:
- Private constructor prevents direct instantiation
- Static getInstance() method for global access
- Export singleton instance for convenience
- Initialize state in constructor
- Used in: Security services, notification services, socket services

### Enum-Based Type Safety Pattern
```typescript
export enum ReconciliationType {
  INVENTORY_RECONCILIATION = 'inventory_reconciliation',
  FINANCIAL_RECONCILIATION = 'financial_reconciliation',
  ORDER_RECONCILIATION = 'order_reconciliation',
}

export enum ReconciliationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

**Key Characteristics**:
- String enums for serialization compatibility
- Descriptive enum names in PascalCase
- Values in snake_case or lowercase
- Used for: Status types, priorities, notification types, user roles
- Provides type safety and autocomplete in IDEs

### Comprehensive Interface Documentation Pattern
```typescript
export interface ReconciliationJob {
  id: string;
  name: string;
  type: ReconciliationType;
  
  // Scheduling
  schedule: string; // Cron expression
  priority: ReconciliationPriority;
  enabled: boolean;
  
  // Data sources
  sourceA: {
    type: 'database' | 'external_api' | 'file' | 'cache';
    connection: string;
    query?: string;
  };
  
  // Security settings
  encryptLogs: boolean;
  signLogs: boolean;
  auditLevel: 'minimal' | 'standard' | 'comprehensive';
}
```

**Key Characteristics**:
- Group related fields with comments
- Use union types for constrained values
- Optional fields marked with `?`
- Inline comments for complex fields
- Used in: All complex domain models and service interfaces

## Internal API Usage Patterns

### Prisma Query Patterns

#### Include Relations Pattern
```typescript
const order = await prisma.order.findUnique({
  where: { id },
  include: {
    customer: { select: { id: true, username: true, firstName: true } },
    store: { select: { id: true, name: true, currency: true } },
    items: {
      include: {
        product: { select: { id: true, name: true, images: true } },
        variant: { select: { id: true, name: true, value: true } }
      }
    },
    adminLogs: {
      include: { admin: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' }
    }
  }
});
```

**Usage**: Always use `select` to limit fields, nest `include` for deep relations, add `orderBy` for sorted relations

#### Pagination Pattern
```typescript
const skip = (Number(page) - 1) * Number(limit);
const total = await prisma.order.count({ where: whereClause });

const orders = await prisma.order.findMany({
  where: whereClause,
  skip,
  take: Number(limit),
  orderBy: { [sortBy]: sortOrder }
});

res.json({
  items: orders,
  pagination: {
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / Number(limit))
  }
});
```

**Usage**: Always return pagination metadata, calculate skip from page/limit, include total count

#### Conditional Where Clause Pattern
```typescript
const whereClause: Prisma.OrderWhereInput = {};

if (status) whereClause.status = status;
if (storeId) whereClause.storeId = storeId;
if (search) {
  whereClause.OR = [
    { orderNumber: { contains: search } },
    { customer: { firstName: { contains: search } } }
  ];
}
if (dateFrom || dateTo) {
  whereClause.createdAt = {};
  if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
  if (dateTo) whereClause.createdAt.lte = new Date(dateTo);
}
```

**Usage**: Build where clause incrementally, use Prisma types for type safety, use OR for multi-field search

### Socket.IO Patterns

#### Room-Based Broadcasting
```typescript
// Join store-specific room
socket.join(`store:${storeId}`);

// Broadcast to room
io.to(`store:${storeId}`).emit('order:new', orderData);

// Broadcast to multiple rooms
io.to(`store:${storeId}`).to(`user:${userId}`).emit('notification', data);
```

**Usage**: Use rooms for data isolation, namespace events with entity:action format

#### Event Handler Pattern
```typescript
useEffect(() => {
  if (!socket || !isConnected) return;

  const handleEvent = (data: any) => {
    // Handle event
  };

  on('event:name', handleEvent);
  return () => off('event:name', handleEvent);
}, [socket, isConnected, on, off]);
```

**Usage**: Check connection before subscribing, always cleanup in return function, include dependencies

### React Query Patterns (Frontend)

#### Data Fetching with Caching
```typescript
const { data, isLoading, error, refetch } = useQuery(
  ['orders', page, status],
  () => fetchOrders({ page, status }),
  {
    staleTime: 30000,
    cacheTime: 300000,
    refetchOnWindowFocus: true,
  }
);
```

**Usage**: Use array keys for cache invalidation, set appropriate stale/cache times, enable refetch on focus

## Code Idioms

### Optional Chaining and Nullish Coalescing
```typescript
// Preferred
const customerName = order.customer?.firstName ?? 'Unknown';
const total = order.items?.reduce((sum, item) => sum + item.price, 0) ?? 0;

// Avoid
const customerName = order.customer && order.customer.firstName ? order.customer.firstName : 'Unknown';
```

### Array Methods Over Loops
```typescript
// Preferred
const orderIds = orders.map(order => order.id);
const paidOrders = orders.filter(order => order.status === 'PAID');
const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

// Avoid
const orderIds = [];
for (let i = 0; i < orders.length; i++) {
  orderIds.push(orders[i].id);
}
```

### Destructuring for Cleaner Code
```typescript
// Preferred
const { id, name, price } = product;
const { page = 1, limit = 20, sortBy = 'createdAt' } = req.query;

// Avoid
const id = product.id;
const name = product.name;
const price = product.price;
```

### Template Literals for String Composition
```typescript
// Preferred
const message = `Order #${orderNumber} has been ${status}`;
const url = `${API_BASE_URL}/orders/${orderId}`;

// Avoid
const message = 'Order #' + orderNumber + ' has been ' + status;
```

### Early Returns for Guard Clauses
```typescript
// Preferred
if (!req.user) {
  throw new AppError('Authentication required', 401);
}

if (!order) {
  throw new AppError('Order not found', 404);
}

// Continue with main logic

// Avoid
if (req.user) {
  if (order) {
    // Main logic nested deeply
  }
}
```

### Async/Await Over Promise Chains
```typescript
// Preferred
const order = await prisma.order.create({ data });
await prisma.adminLog.create({ data: logData });
await notifyCustomer(order);

// Avoid
prisma.order.create({ data })
  .then(order => prisma.adminLog.create({ data: logData }))
  .then(() => notifyCustomer(order));
```

## Frequently Used Annotations

### TypeScript Type Assertions
```typescript
// Type assertion for unknown errors
catch (error: unknown) {
  logger.error('Error:', toLogMetadata(error));
}

// Type assertion for DOM elements
const element = document.querySelector('.selector') as HTMLElement;

// Type assertion for Express request
const file = req.file as Express.Multer.File;
```

### JSDoc Comments
```typescript
/**
 * Execute reconciliation job
 * @param jobId - Unique identifier for the reconciliation job
 * @param options - Execution options including manual trigger and force execution
 * @returns Execution ID for tracking
 */
async executeReconciliationJob(jobId: string, options: {
  manualTrigger?: boolean;
  triggeredBy?: string;
  forceExecution?: boolean;
} = {}): Promise<string>
```

### React Component Props Documentation
```typescript
interface UseRealTimeUpdatesOptions {
  /** Callback fired when order data changes */
  onOrderUpdate?: () => void;
  /** Callback fired when product data changes */
  onProductUpdate?: () => void;
  /** Enable toast notifications for updates */
  enableNotifications?: boolean;
}
```

### Prisma Type Helpers
```typescript
// Extract type from Prisma query
type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    store: true;
    items: { include: { product: true; variant: true } };
  };
}>;

// Use in function signatures
async function processOrder(order: OrderWithRelations): Promise<void>
```

## Best Practices Summary

1. **Type Safety**: Use TypeScript strictly, avoid `any`, prefer `unknown` for errors
2. **Error Handling**: Use `asyncHandler` wrapper, custom `AppError` class, structured logging
3. **Data Access**: Use Prisma transactions for multi-step operations, include only needed fields
4. **Real-Time**: Use Socket.IO rooms for isolation, consistent event naming (entity:action)
5. **Validation**: Centralize Zod schemas, reuse common patterns, provide clear error messages
6. **React Hooks**: Use `useCallback` for handlers, proper cleanup, exhaustive dependencies
7. **Accessibility**: ARIA live regions, keyboard navigation, system preference detection
8. **Security**: RBAC at query level, audit logging, digital signatures for critical operations
9. **Code Style**: Consistent formatting, descriptive naming, minimal comments, early returns
10. **Testing**: Unit tests for services, integration tests for APIs, E2E tests for critical flows

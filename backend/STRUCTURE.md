# Backend Structure Guide

## 📁 Directory Organization

### `/src` - Source Code
The main application source code organized by responsibility:

#### `/src/__tests__` - Tests
- `unit/` - Unit tests for individual functions and services
- `integration/` - Integration tests for API endpoints
- `*.test.ts` - Component-specific test files
- `setup.ts` - Test environment configuration

#### `/src/admin` - Admin Panel
AdminJS components and configurations:
- Custom dashboard components
- Role management interfaces
- Employee management UI
- Theme customization
- AdminJS initialization

#### `/src/auth` - Authentication System
Core authentication and authorization:
- `AuthConfig.ts` - Auth configuration
- `SecureAuthSystem.ts` - Main auth system
- `SecureAuthController.ts` - Auth endpoints
- `SecureAuthMiddleware.ts` - Auth middleware
- `RolePermissionManager.ts` - Permission logic

#### `/src/config` - Configuration
Application-wide configuration:
- `security.ts` - Security settings and policies

#### `/src/controllers` - Request Handlers
HTTP request handlers (20 controllers):
- `authController.ts` - Authentication endpoints
- `storeController.ts` - Store management
- `productController.ts` - Product operations
- `orderController.ts` - Order processing
- `botController.ts` - Bot management
- `userController.ts` - User operations
- `employeeController.ts` - Employee management
- And 13 more specialized controllers

#### `/src/lib` - Core Libraries
Foundational libraries and clients:
- `prisma.ts` - Prisma ORM client
- `redis.ts` - Redis cache client
- `database.ts` - Database utilities
- `socket.ts` - Socket.IO configuration

#### `/src/middleware` - Express Middleware
29 middleware functions for request processing:
- **Security**: `security.ts`, `jwtSecurity.ts`, `mtlsMiddleware.ts`
- **Authentication**: `auth.ts`, `socketAuth.ts`
- **Authorization**: `permissions.ts`, `rbacMiddleware.ts`, `customRolePermissions.ts`
- **Validation**: `validation.ts`, `inputValidationMiddleware.ts`
- **Protection**: `compromiseGuard.ts`, `exfiltrationTrap.ts`, `webhookQuarantineGuard.ts`
- **Logging**: `auditLog.ts`, `httpLogger.ts`, `securityAuditMiddleware.ts`
- **Monitoring**: `activityTracker.ts`, `performanceTracker.ts`, `metrics.ts`
- **Upload**: `upload.ts`, `uploadPaymentProof.ts`, `uploadRateLimit.ts`
- **Security Headers**: `corsSecurityMiddleware.ts`, `contentSecurityMiddleware.ts`
- **Error Handling**: `errorHandler.ts`, `notFoundHandler.ts`
- **Utilities**: `requestId.ts`, `responseDLP.ts`, `vaultHealthCheck.ts`

#### `/src/repositories` - Data Access Layer
Data access patterns and tenant isolation:
- `TenantScopedRepository.ts` - Multi-tenant data access

#### `/src/routes` - API Routes
24 route definition files:
- `auth.ts` - Authentication routes
- `stores.ts` - Store management
- `products.ts` - Product operations
- `orders.ts` - Order processing
- `bots.ts` - Bot management
- `users.ts` - User operations
- `employees.ts` - Employee routes
- `inventory.ts` - Inventory management
- `analytics.ts` - Analytics endpoints
- And 15 more route modules

#### `/src/schemas` - Validation Schemas
Zod validation schemas:
- `validationSchemas.ts` - General validation
- `customRoleSchemas.ts` - Role validation
- `employeeSchemas.ts` - Employee validation
- `inviteLinkSchemas.ts` - Invite link validation

#### `/src/services` - Business Logic
58 service files implementing business logic:

**Core Services:**
- `backupService.ts` - Backup management
- `botDataService.ts` - Bot data handling
- `botFactoryService.ts` - Bot creation
- `botHandlerService.ts` - Bot operations
- `employeeService.ts` - Employee management
- `healthService.ts` - Health checks
- `notificationService.ts` - Notification dispatch
- `socketRoomService.ts` - Socket room management

**Security Services:**
- `AdminSecurityService.ts`
- `BackupEncryptionService.ts`
- `CommunicationSecurityService.ts`
- `CompromiseResponseService.ts`
- `DatabaseEncryptionService.ts`
- `EncryptionService.ts`
- `FileUploadSecurityService.ts`
- `InventorySecurityService.ts`
- `LogEncryptionService.ts`
- `MultiTenantSecurityService.ts`
- `PaymentSecurityService.ts`
- `SecureAuthService.ts`
- `SecureBackupService.ts`
- `SecureStorageService.ts`
- `SecurityLogService.ts`
- `StorageEncryptionService.ts`
- `TelegramAuthService.ts`
- `TLSService.ts`
- `TokenRevocationService.ts`
- `VaultService.ts`
- `WAFSecurityService.ts`
- `WebSocketSecurityService.ts`

**Data Protection Services:**
- `CacheShredderService.ts`
- `DataClassificationService.ts`
- `DataMaskingService.ts`
- `DataPseudonymizationService.ts`
- `DataRetentionService.ts`

**Monitoring Services:**
- `AlertThrottlingService.ts`
- `RuntimeThreatDetectionService.ts`
- `SIEMIntegrationService.ts`
- `HoneytokenService.ts`
- `SecretLeakDetectionService.ts`

**Access Control Services:**
- `BreakGlassService.ts`
- `PrivilegedAccessService.ts`
- `ResourceLimitService.ts`
- `SeparationOfDutiesService.ts`

**Infrastructure Services:**
- `CertificateValidationService.ts`
- `ContainerSigningService.ts`
- `DisasterRecoveryService.ts`
- `EgressGuardService.ts`
- `NotificationQueueSecurityService.ts`
- `PaymentApprovalService.ts`
- `ReconciliationSecurityService.ts`
- `SBOMService.ts`
- `SSRFProtectionService.ts`
- `TenantCacheService.ts`
- `webhookManagerService.ts`

**Telegram Integration:**
- `telegramNotificationService.ts`
- `TelegramAuthService.ts`

**Permissions:**
- `employeePermissionService.ts`
- `employeeSecurityService.ts`

#### `/src/types` - TypeScript Types
Type definitions and declarations:
- `express.d.ts` - Express type extensions
- `isomorphic-dompurify.d.ts` - DOMPurify types
- `validator.d.ts` - Validator types

#### `/src/utils` - Utilities
Helper functions and utilities (22 files):

**Core Utilities:**
- `asyncHandler.ts` - Async error handling
- `currency.ts` - Currency operations
- `errorUtils.ts` - Error utilities
- `validation.ts` - Validation helpers

**JWT & Auth:**
- `jwt.ts` - JWT utilities
- `jwtEnhanced.ts` - Enhanced JWT
- `enhancedJwt.ts` - Additional JWT features

**Logging:**
- `logger.ts` - Winston logger configuration
- `loggerEnhanced.ts` - Enhanced logging

**Business Logic:**
- `orderStateMachine.ts` - Order state transitions
- `orderUtils.ts` - Order utilities
- `inventoryConfig.ts` - Inventory configuration

**File Handling:**
- `fileValidator.ts` - File validation

**Integration:**
- `cmsClient.ts` - CMS client
- `telegramWebhookValidator.ts` - Telegram validation

**Security:**
- `SecretManager.ts` - Secret management

**Configuration:**
- `env.ts` - Environment variables
- `envValidator.ts` - Environment validation

**Database Migrations (SQL):**
- `add-new-tables-only.sql`
- `customRoleMigration.sql`
- `customRoleMigration.sqlite.sql`
- `employeeMigration.sql`

### `/prisma` - Database
- `schema.prisma` - Database schema definition
- `seed.ts` - Database seeding script

### `/docs` - Documentation
Comprehensive project documentation:
- `README.md` - Documentation index
- `INTEGRATION_EXAMPLES.md` - API integration examples
- `SESSION_FIX_GUIDE.md` - Session troubleshooting
- `SOLUTION_SUMMARY.md` - Architecture overview
- `CUSTOM_ROLES_AND_INVITE_LINKS.md` - Role system
- `EMPLOYEE_MANAGEMENT_SETUP.md` - Employee setup
- `admin-theme.md` - Admin customization

### `/scripts` - Utility Scripts
Administrative and maintenance scripts:
- `promote-owner.js` - Promote user to owner role

### `/tools` - Development Tools
Tools for development and administration:
- `admin/` - Admin utility scripts
  - `fix_access.js` - Fix user access
  - `promote_user.js` - Promote user role
  - `query_user.js` - Query user data

### `/patches` - Package Patches
NPM package patches (managed by patch-package):
- `@adminjs+design-system+4.1.1.patch`

### Configuration Files

#### `.gitignore`
Excludes from version control:
- Build outputs (`dist/`, `*.js`, `*.d.ts`)
- Dependencies (`node_modules/`)
- Environment files (`.env*`)
- Runtime files (`logs/`, `*.db`, `backups/`, `uploads/`)
- Temporary files (`.adminjs/`, `tmp/`)

#### `.dockerignore`
Excludes from Docker builds:
- Development files
- Documentation
- Logs and databases
- Git files

#### `.eslintignore`
Excludes from linting:
- Build outputs
- Dependencies
- Generated files

#### `package.json`
Project metadata and scripts

#### `tsconfig.json`
TypeScript compiler configuration

#### `jest.config.js`
Test framework configuration

#### `Dockerfile`
Development container configuration

#### `Dockerfile.production`
Production container configuration

## 🏗️ Architecture Patterns

### Layered Architecture
```
Routes → Controllers → Services → Repositories → Database
         ↓
      Middleware
         ↓
      Validation
```

### Dependency Flow
- Routes define endpoints and apply middleware
- Controllers handle HTTP request/response
- Services implement business logic
- Repositories handle data access
- Middleware processes requests/responses

### Multi-Tenant Isolation
- Store-scoped data access
- Tenant-aware repositories
- Store-specific configurations
- Isolated bot instances

### Security Layers
1. Network (CORS, rate limiting)
2. Authentication (JWT, sessions)
3. Authorization (RBAC, permissions)
4. Input validation (Zod schemas)
5. Output sanitization (DLP, masking)
6. Audit logging (security events)

## 📝 Naming Conventions

### Files
- **Controllers**: `{entity}Controller.ts` (e.g., `storeController.ts`)
- **Services**: `{Entity}Service.ts` or `{purpose}Service.ts`
- **Routes**: `{entity}.ts` or `{entity}Routes.ts`
- **Middleware**: `{purpose}.ts` or `{purpose}Middleware.ts`
- **Schemas**: `{entity}Schemas.ts`
- **Types**: `{source}.d.ts`
- **Tests**: `{component}.test.ts`
- **Utils**: `{purpose}.ts`

### Code
- **Classes**: PascalCase (e.g., `AuthController`)
- **Functions**: camelCase (e.g., `getUserById`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)
- **Interfaces**: PascalCase with 'I' prefix (e.g., `IUserData`)
- **Types**: PascalCase (e.g., `UserRole`)

## 🚀 Development Workflow

1. **Feature Development**
   - Create feature branch
   - Implement in appropriate layer
   - Add tests in `__tests__/`
   - Update documentation

2. **Adding New Endpoint**
   - Define route in `/routes`
   - Create controller in `/controllers`
   - Implement service in `/services`
   - Add validation in `/schemas`
   - Add tests

3. **Database Changes**
   - Update `prisma/schema.prisma`
   - Run `npm run db:generate`
   - Create migration with `npm run db:migrate`
   - Update seed file if needed

4. **Testing**
   - Unit tests for services/utilities
   - Integration tests for endpoints
   - Run `npm test` before commit

## 🔒 Security Guidelines

1. **Always validate input** using Zod schemas
2. **Use middleware stack** for protection
3. **Log security events** in audit log
4. **Encrypt sensitive data** at rest
5. **Use RBAC** for authorization
6. **Sanitize output** to prevent data leakage
7. **Rate limit** expensive operations
8. **Follow least privilege** principle

## 📚 Best Practices

1. **Keep controllers thin** - business logic in services
2. **Use repositories** for data access
3. **Write tests** for all business logic
4. **Document complex logic** with comments
5. **Use TypeScript types** everywhere
6. **Handle errors properly** with try-catch
7. **Log important events** with appropriate level
8. **Keep services focused** - single responsibility

---

**Maintained**: September 30, 2025  
**Version**: 1.0.0

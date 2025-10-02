## AI Code Map

High-signal locations for core behaviors. Use these paths first when implementing changes.

### Backend (Node/Express + Prisma)
- Auth
  - `backend/src/auth/SecureAuthSystem.ts` — email/telegram auth, tokens, sessions
  - `backend/src/auth/SecureAuthController.ts` — login endpoints (email/telegram)
  - `backend/src/controllers/authController.ts` — telegramAuth with validation and welcome notification
  - `backend/src/auth/SecureAuthMiddleware.ts` — `requirePermission`, `requireStoreAccess`
  - `backend/src/middleware/auth.ts` — `requireRole`, `requireStoreAccess`
  - `backend/src/middleware/permissions.ts` — `PermissionChecker`, `requireStoreAccessAsync`
  - `backend/src/auth/RolePermissionManager.ts` — permission model, resource checks

- Orders
  - `backend/src/utils/orderStateMachine.ts` — status enum and `VALID_TRANSITIONS`
  - `backend/src/controllers/orderController.ts` — ship/confirm/reject flows, emits events, logs
  - `backend/src/controllers/inventoryController.ts` — stock updates/restoration

- Notifications & Metrics
  - `backend/src/services/notificationService.ts` — multi-channel notifications
  - `backend/src/services/prometheusService.ts` — metrics registry and exports

- Data layer
  - `backend/prisma/schema.prisma` — models and enums

### Frontend (React + MUI)
- Orders and verification
  - `frontend/src/pages/OrdersPage.tsx` — orchestrates tabs, routes to verification
  - `frontend/src/components/orders/PaymentVerificationScreen.tsx` — verification UI for PENDING_ADMIN
  - `frontend/src/pages/PaymentVerificationPage.tsx` — page wrapper calling API `/api/orders/:id/confirm-payment|reject`
  - `frontend/src/components/ecommerce/PaymentVerification.tsx` — alternative verification UI component

### Telegram Bot
- Carts and ordering
  - `bot/src/handlers/cartHandler.ts` — session cart, checkout flow, item updates
  - `backend/src/services/botHandlerService.ts` — checkout/customer info handling and order confirmation messages

### Configuration (Monitoring)
- `config/prometheus/prometheus.yml` — Prometheus scrape targets
- `config/grafana/provisioning/` — Grafana datasource and dashboards
- `docker-compose.monitoring.yml` — monitoring stack services (if present)

### Shared Types
- `packages/types/src/index.ts` — cross-package TypeScript types

Tips
- For store-scoped actions, always enforce access via `requireStoreAccess` or permission checker
- Update both backend transitions and frontend labels when adding order statuses



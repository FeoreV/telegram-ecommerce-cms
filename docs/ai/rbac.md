## RBAC and Authorization

Role hierarchy: OWNER > ADMIN > VENDOR > CUSTOMER

Key components
- backend/src/middleware/permissions.ts — store ownership checks, cross‑store access, admin delegation, vendor limits
- backend/src/auth/SecureAuthSystem.ts — Telegram auth, QR auth, session mgmt, multi‑device tokens (max 5)
- backend/src/auth/RolePermissionManager.ts — grouped permissions per domain
- backend/src/middleware/auth.ts — store‑specific session validation and role checks
- backend/src/services/authService.ts — session and invalidation rules

Rules of thumb
- Enforce store context on every privileged action
- Validate role at route layer and inside services with explicit checks
- Prefer permission helpers over ad‑hoc role comparisons

Danger zones
- Cross‑store data access; always verify storeId ownership/assignment
- Admin actions on OWNER are restricted; guard explicitly

_Context added by Giga authorization model: role hierarchy, where checks live, and session/auth details._



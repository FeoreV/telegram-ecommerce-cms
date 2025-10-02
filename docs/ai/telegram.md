## Telegram Integration Notes

Sessions
- bot/src/utils/sessionManager.ts — per‑chat sessions with store context, expiry, cart persistence

Cart
- bot/src/handlers/cartHandler.ts — store‑scoped carts, multi‑currency, variant selection, cleanup on expiry

Order flow
- bot/src/handlers/orderHandler.ts — PENDING → PAID → SHIPPED → DELIVERED; manual verification; store notifications; formatted multi‑currency display

Admin tools
- bot/src/handlers/adminHandler.ts — verification workflow, store settings, notification routing

Security
- bot/src/middleware/security.ts — store‑level rate limiting, spam detection, IP reputation, access control

Store creation
- bot/src/handlers/storeCreationHandler.ts — guided setup, template selection, slug validation, provisioning

_Context added by Giga telegram integration: sessions, cart handling, order flow, admin and security._



## Core Data Models and Relations

Order
- States: PENDING_ADMIN → PAID → SHIPPED → DELIVERED
- Multi‑currency; stores define currency settings
- Links: Store, User, Product(+Variant); timestamps for transitions

Store
- Admin hierarchy (Owner→Admin→Vendor)
- Bot config and webhooks; currency/payment settings
- Inventory alert thresholds; template‑based creation

Product
- Variants with option combinations and per‑variant stock/price/SKU
- Multi‑currency pricing; categories with nesting

User
- RBAC per store; Telegram auth; multi‑device sessions

Relations
- Store↔Product: product belongs to store; store‑specific inventory/pricing
- Store↔User: role per store; notification prefs
- Order↔Product: variant selections, quantities, historical pricing

Variant system
- Unlimited options; per‑variant stock/pricing; low‑stock alerts

_Context added by Giga data models and relationships: models, variant system, and key relations._



## Order Processing Flow

State machine
- PENDING_ADMIN → PAID → SHIPPED → DELIVERED
- Inventory updates only after payment verification

Key components
- backend/src/utils/orderStateMachine.ts — transitions, inventory hooks, store routing
- frontend/src/components/orders/PaymentVerificationScreen.tsx — manual verification UI, proof checks
- backend/src/controllers/inventoryController.ts — stock updates and restoration
- bot/src/handlers/notificationHandler.ts — status notifications

Business rules
1) Manual payment verification is required by a store admin
2) Stock changes on successful verification
3) Each store may define custom verification requirements
4) Notifications use store templates and priorities
5) Cross‑currency orders keep original amounts

_Context added by Giga order processing flow: state machine, verification, inventory and notifications._



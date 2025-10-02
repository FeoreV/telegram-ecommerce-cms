## Change Playbooks (AI)

### Add a new order status
1) Backend
   - Edit `backend/src/utils/orderStateMachine.ts`: add enum value and extend `VALID_TRANSITIONS`
   - Ensure controllers (e.g., `orderController.ts`) respect new transitions
   - Update notifications if needed
2) Frontend
   - Update labels/colors where statuses are mapped (e.g., verification components)
3) Tests
   - Add unit tests for valid/invalid transitions

### Enforce permission on a new endpoint
1) Add route middleware: `requireRole` and/or `requireStoreAccess`/`requireStoreAccessAsync`
2) If needed, extend permission checks in `RolePermissionManager` and `permissions.ts`
3) Verify cross-store access is denied for non-owners

### Adjust Telegram login flow
1) Use `SecureAuthSystem.authenticateWithTelegram` in controller
2) Verify cookie/token handling and session limits
3) If adding fields, extend Prisma model and selection in controllers

### Add metric and visualize
1) Register in `backend/src/services/prometheusService.ts`
2) Add panel to a Grafana dashboard JSON in `config/grafana/provisioning/dashboards/`
3) Restart/reload Grafana; confirm PromQL shows data

### Modify cart/checkout behavior in the bot
1) Update `bot/src/handlers/cartHandler.ts` for item logic and callbacks
2) If customer info/confirmation changes, adjust `backend/src/services/botHandlerService.ts`
3) Ensure messages are localized and amounts formatted



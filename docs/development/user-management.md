## User Management

Consolidated guide for capabilities, roles, and typical actions.

### Roles and access
- OWNER: full access (roles, block/unblock, delete, bulk actions)
- ADMIN: view, details, block/unblock (not OWNER)
- VENDOR/CUSTOMER: no access to user admin

### Features
- Listing with search and filters (role, status)
- Detail view: info, statistics, activity
- Actions: block/unblock with reason, change role (OWNER), delete (OWNER)
- Bulk actions (OWNER): block, unblock, delete (OWNER protected)

### Security rules
- Cannot modify your own account
- ADMIN cannot change OWNER
- Owners are excluded from bulk destructive actions

### Notifications and logging
- Telegram notifications on block/unblock/role change
- Admin logs record all critical actions



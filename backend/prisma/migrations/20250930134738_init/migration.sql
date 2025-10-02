-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" DATETIME,
    "profile_photo" TEXT
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "domain" TEXT,
    "contactInfo" TEXT,
    "contact_phone" TEXT,
    "settings" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 10,
    "critical_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "enable_stock_alerts" BOOLEAN NOT NULL DEFAULT true,
    "bot_token" TEXT,
    "bot_username" TEXT,
    "bot_status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "bot_webhook_url" TEXT,
    "bot_settings" TEXT,
    "bot_created_at" DATETIME,
    "bot_last_active" DATETIME,
    "owner_id" TEXT NOT NULL,
    CONSTRAINT "stores_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "store_admins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "store_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    CONSTRAINT "store_admins_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "store_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "store_admins_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "price" REAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "track_stock" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "images" TEXT,
    "store_id" TEXT NOT NULL,
    "category_id" TEXT,
    CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "price" REAL,
    "stock" INTEGER,
    "sku" TEXT,
    "product_id" TEXT NOT NULL,
    CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ADMIN',
    "totalAmount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "customerInfo" TEXT NOT NULL,
    "notes" TEXT,
    "paid_at" DATETIME,
    "rejected_at" DATETIME,
    "rejection_reason" TEXT,
    "shipped_at" DATETIME,
    "delivered_at" DATETIME,
    "cancelled_at" DATETIME,
    "tracking_number" TEXT,
    "carrier" TEXT,
    "delivery_notes" TEXT,
    "cancellation_reason" TEXT,
    "payment_proof" TEXT,
    "client_request_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "admin_id" TEXT NOT NULL,
    "order_id" TEXT,
    CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "admin_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integration_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "store_id" TEXT,
    CONSTRAINT "integration_mappings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "channels" TEXT NOT NULL,
    "data" TEXT,
    "read_at" DATETIME,
    "store_id" TEXT,
    "order_id" TEXT,
    "user_id" TEXT NOT NULL,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" DATETIME,
    CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "store_vendors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "store_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "permissions" TEXT,
    "custom_role_id" TEXT,
    CONSTRAINT "store_vendors_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "store_vendors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "store_vendors_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "changeType" TEXT NOT NULL,
    "previous_qty" INTEGER NOT NULL,
    "new_qty" INTEGER NOT NULL,
    "change_qty" INTEGER NOT NULL,
    "reason" TEXT,
    "user_id" TEXT,
    "order_id" TEXT,
    CONSTRAINT "stock_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_logs_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employee_invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "store_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "role" TEXT,
    "custom_role_id" TEXT,
    "permissions" TEXT,
    "token" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "accepted_at" DATETIME,
    "rejected_at" DATETIME,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invite_link_id" TEXT,
    CONSTRAINT "employee_invitations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "employee_invitations_invite_link_id_fkey" FOREIGN KEY ("invite_link_id") REFERENCES "invite_links" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employee_activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "store_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    CONSTRAINT "employee_activities_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invite_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "store_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT,
    "custom_role_id" TEXT,
    "permissions" TEXT,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    CONSTRAINT "invite_links_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invite_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invite_links_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    CONSTRAINT "custom_roles_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "custom_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "stores_domain_key" ON "stores"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "stores_bot_token_key" ON "stores"("bot_token");

-- CreateIndex
CREATE UNIQUE INDEX "stores_bot_username_key" ON "stores"("bot_username");

-- CreateIndex
CREATE INDEX "stores_owner_id_idx" ON "stores"("owner_id");

-- CreateIndex
CREATE INDEX "stores_bot_token_idx" ON "stores"("bot_token");

-- CreateIndex
CREATE INDEX "stores_bot_status_idx" ON "stores"("bot_status");

-- CreateIndex
CREATE INDEX "store_admins_user_id_idx" ON "store_admins"("user_id");

-- CreateIndex
CREATE INDEX "store_admins_assigned_by_idx" ON "store_admins"("assigned_by");

-- CreateIndex
CREATE UNIQUE INDEX "store_admins_store_id_user_id_key" ON "store_admins"("store_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_fkey" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "products_category_id_fkey" ON "products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_store_id_sku_key" ON "products"("store_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_name_value_key" ON "product_variants"("product_id", "name", "value");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_client_request_id_key" ON "orders"("client_request_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_fkey" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_store_id_fkey" ON "orders"("store_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_fkey" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_fkey" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_fkey" ON "order_items"("variant_id");

-- CreateIndex
CREATE INDEX "admin_logs_admin_id_fkey" ON "admin_logs"("admin_id");

-- CreateIndex
CREATE INDEX "admin_logs_order_id_fkey" ON "admin_logs"("order_id");

-- CreateIndex
CREATE INDEX "integration_mappings_store_id_fkey" ON "integration_mappings"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_mappings_source_entity_type_external_id_key" ON "integration_mappings"("source", "entity_type", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_mappings_source_entity_type_local_id_key" ON "integration_mappings"("source", "entity_type", "local_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_fkey" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_store_id_fkey" ON "notifications"("store_id");

-- CreateIndex
CREATE INDEX "notifications_order_id_fkey" ON "notifications"("order_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_key" ON "user_sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_refresh_token_idx" ON "user_sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "store_vendors_user_id_idx" ON "store_vendors"("user_id");

-- CreateIndex
CREATE INDEX "store_vendors_store_id_idx" ON "store_vendors"("store_id");

-- CreateIndex
CREATE INDEX "store_vendors_custom_role_id_idx" ON "store_vendors"("custom_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_vendors_store_id_user_id_key" ON "store_vendors"("store_id", "user_id");

-- CreateIndex
CREATE INDEX "stock_logs_product_id_idx" ON "stock_logs"("product_id");

-- CreateIndex
CREATE INDEX "stock_logs_store_id_idx" ON "stock_logs"("store_id");

-- CreateIndex
CREATE INDEX "stock_logs_created_at_idx" ON "stock_logs"("createdAt");

-- CreateIndex
CREATE INDEX "stock_logs_variant_id_idx" ON "stock_logs"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_invitations_token_key" ON "employee_invitations"("token");

-- CreateIndex
CREATE INDEX "employee_invitations_token_idx" ON "employee_invitations"("token");

-- CreateIndex
CREATE INDEX "employee_invitations_store_id_idx" ON "employee_invitations"("store_id");

-- CreateIndex
CREATE INDEX "employee_invitations_user_id_idx" ON "employee_invitations"("user_id");

-- CreateIndex
CREATE INDEX "employee_invitations_status_idx" ON "employee_invitations"("status");

-- CreateIndex
CREATE INDEX "employee_invitations_expires_at_idx" ON "employee_invitations"("expires_at");

-- CreateIndex
CREATE INDEX "employee_invitations_custom_role_id_idx" ON "employee_invitations"("custom_role_id");

-- CreateIndex
CREATE INDEX "employee_invitations_invite_link_id_idx" ON "employee_invitations"("invite_link_id");

-- CreateIndex
CREATE INDEX "employee_activities_store_id_idx" ON "employee_activities"("store_id");

-- CreateIndex
CREATE INDEX "employee_activities_user_id_idx" ON "employee_activities"("user_id");

-- CreateIndex
CREATE INDEX "employee_activities_created_at_idx" ON "employee_activities"("createdAt");

-- CreateIndex
CREATE INDEX "employee_activities_action_idx" ON "employee_activities"("action");

-- CreateIndex
CREATE UNIQUE INDEX "invite_links_token_key" ON "invite_links"("token");

-- CreateIndex
CREATE INDEX "invite_links_token_idx" ON "invite_links"("token");

-- CreateIndex
CREATE INDEX "invite_links_store_id_idx" ON "invite_links"("store_id");

-- CreateIndex
CREATE INDEX "invite_links_created_by_idx" ON "invite_links"("created_by");

-- CreateIndex
CREATE INDEX "invite_links_is_active_idx" ON "invite_links"("is_active");

-- CreateIndex
CREATE INDEX "invite_links_expires_at_idx" ON "invite_links"("expires_at");

-- CreateIndex
CREATE INDEX "custom_roles_store_id_idx" ON "custom_roles"("store_id");

-- CreateIndex
CREATE INDEX "custom_roles_is_active_idx" ON "custom_roles"("is_active");

-- CreateIndex
CREATE INDEX "custom_roles_created_by_idx" ON "custom_roles"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "custom_roles_store_id_name_key" ON "custom_roles"("store_id", "name");

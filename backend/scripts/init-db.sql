-- =============================================================================
-- Database Initialization Script for Telegram E-commerce Platform
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Set timezone
SET timezone = 'UTC';

-- =============================================================================
-- Performance Indexes (will be created after Prisma migrations)
-- =============================================================================

-- Note: These will be created after the database is initialized
-- Uncomment and run after first deployment

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_store_status
--   ON "Order" (store_id, status)
--   WHERE status IN ('PENDING_ADMIN', 'PAID', 'SHIPPED');

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_created
--   ON "Order" (user_id, created_at DESC);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_store_active
--   ON "Product" (store_id, is_active)
--   WHERE is_active = true;

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_telegram
--   ON "User" (telegram_id)
--   WHERE telegram_id IS NOT NULL;

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_active
--   ON "Store" (is_active)
--   WHERE is_active = true;

-- Full-text search indexes
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_search
--   ON "Product" USING gin(name gin_trgm_ops);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_description_search
--   ON "Product" USING gin(description gin_trgm_ops);

-- =============================================================================
-- Database Configuration
-- =============================================================================

-- Increase work memory for better query performance
ALTER DATABASE telegram_ecommerce SET work_mem = '16MB';

-- Set statement timeout (30 seconds)
ALTER DATABASE telegram_ecommerce SET statement_timeout = '30s';

-- Enable query logging for slow queries (queries > 1s)
ALTER DATABASE telegram_ecommerce SET log_min_duration_statement = 1000;

-- =============================================================================
-- Database User Permissions
-- =============================================================================

-- Grant necessary permissions
GRANT CONNECT ON DATABASE telegram_ecommerce TO postgres;
GRANT ALL PRIVILEGES ON DATABASE telegram_ecommerce TO postgres;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- =============================================================================
-- Maintenance Functions
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- Analytics Functions
-- =============================================================================

-- Function to calculate order statistics
CREATE OR REPLACE FUNCTION get_store_statistics(store_uuid UUID, days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_orders BIGINT,
    total_revenue DECIMAL,
    average_order_value DECIMAL,
    pending_orders BIGINT,
    completed_orders BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_orders,
        COALESCE(SUM(total_amount), 0)::DECIMAL as total_revenue,
        COALESCE(AVG(total_amount), 0)::DECIMAL as average_order_value,
        COUNT(*) FILTER (WHERE status IN ('PENDING_ADMIN', 'PAID'))::BIGINT as pending_orders,
        COUNT(*) FILTER (WHERE status = 'DELIVERED')::BIGINT as completed_orders
    FROM "Order"
    WHERE store_id = store_uuid
        AND created_at >= CURRENT_DATE - (days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Cleanup Functions
-- =============================================================================

-- Function to clean old logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM "AuditLog"
    WHERE created_at < CURRENT_DATE - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Scheduled Jobs (using pg_cron if available)
-- =============================================================================

-- Note: Requires pg_cron extension
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup job (runs daily at 3 AM)
-- SELECT cron.schedule('cleanup-old-logs', '0 3 * * *', $$
--     SELECT cleanup_old_audit_logs(90);
-- $$);

-- =============================================================================
-- Initialization Complete
-- =============================================================================

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully at %', CURRENT_TIMESTAMP;
END $$;


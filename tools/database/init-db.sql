-- =============================================================================
-- PostgreSQL Database Initialization Script
-- Telegram E-commerce Bot Platform
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Create read-only user for monitoring/reporting
CREATE USER telegram_readonly WITH PASSWORD 'readonly_password';

-- Grant read permissions
GRANT CONNECT ON DATABASE telegram_ecommerce TO telegram_readonly;
GRANT USAGE ON SCHEMA public TO telegram_readonly;

-- These permissions will be applied after tables are created
-- (Prisma will create the tables through migrations)

-- =============================================================================
-- Performance Optimization Settings
-- =============================================================================

-- Increase work memory for complex queries
ALTER DATABASE telegram_ecommerce SET work_mem = '16MB';

-- Optimize for mixed workload
ALTER DATABASE telegram_ecommerce SET random_page_cost = 1.1;

-- Enable parallel queries
ALTER DATABASE telegram_ecommerce SET max_parallel_workers_per_gather = 2;

-- =============================================================================
-- Connection and Resource Settings
-- =============================================================================

-- Set connection limits
ALTER DATABASE telegram_ecommerce CONNECTION LIMIT 100;

-- Set statement timeout (30 seconds)
ALTER DATABASE telegram_ecommerce SET statement_timeout = '30s';

-- Set idle session timeout (30 minutes)
ALTER DATABASE telegram_ecommerce SET idle_in_transaction_session_timeout = '30min';

-- =============================================================================
-- Logging and Monitoring Setup
-- =============================================================================

-- Enable slow query logging (queries > 1 second)
ALTER DATABASE telegram_ecommerce SET log_min_duration_statement = 1000;

-- Log all DDL statements
ALTER DATABASE telegram_ecommerce SET log_statement = 'ddl';

-- =============================================================================
-- Security Settings
-- =============================================================================

-- Ensure secure defaults
ALTER DATABASE telegram_ecommerce SET default_transaction_isolation = 'read committed';

-- =============================================================================
-- Custom Functions for Application
-- =============================================================================

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    current_month_year TEXT;
    sequence_num INTEGER;
    order_num TEXT;
BEGIN
    -- Generate MMYY prefix
    current_month_year := TO_CHAR(CURRENT_DATE, 'MMYY');
    
    -- Get next sequence number for this month
    -- This will be replaced by application logic, but kept as fallback
    sequence_num := 1;
    
    -- Format: MMYY-00001
    order_num := current_month_year || '-' || LPAD(sequence_num::TEXT, 5, '0');
    
    RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old sessions (if using database sessions)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- This function can be called by a cron job to cleanup old data
    -- Currently placeholder - actual cleanup logic will be in application
    deleted_count := 0;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update search vectors (for full-text search)
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    -- This will be used for product search optimization
    -- Implementation depends on final search requirements
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Indexes that will be created after Prisma migrations
-- These are defined here for reference and can be run after initial setup
-- =============================================================================

/*
-- Performance indexes (run these after Prisma migrations)

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_telegram_id_active 
    ON users(telegram_id) WHERE is_active = true;
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role 
    ON users(role);

-- Stores table indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_owner_active 
    ON stores(owner_id) WHERE status = 'ACTIVE';
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_bot_status 
    ON stores(bot_status) WHERE bot_status = 'ACTIVE';

-- Products table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_store_active 
    ON products(store_id) WHERE is_active = true;
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search 
    ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Orders table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_store_status 
    ON orders(store_id, status);
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_created 
    ON orders(customer_id, created_at DESC);
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at 
    ON orders(created_at DESC);

-- Notifications table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread 
    ON notifications(user_id) WHERE read_at IS NULL;
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created 
    ON notifications(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_store_category_active 
    ON products(store_id, category_id) WHERE is_active = true;
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_store_status_created 
    ON orders(store_id, status, created_at DESC);
*/

-- =============================================================================
-- Data Consistency Checks
-- =============================================================================

-- Add constraints that Prisma might not handle
-- (These will be run after Prisma setup through application migrations)

/*
-- Ensure telegram_id is always valid format
ALTER TABLE users ADD CONSTRAINT chk_telegram_id_format 
    CHECK (telegram_id ~ '^[0-9]+$');

-- Ensure order numbers are unique and properly formatted  
ALTER TABLE orders ADD CONSTRAINT chk_order_number_format 
    CHECK (order_number ~ '^[0-9]{4}-[0-9]{5}$');

-- Ensure prices are positive
ALTER TABLE products ADD CONSTRAINT chk_price_positive 
    CHECK (price >= 0);
    
ALTER TABLE order_items ADD CONSTRAINT chk_item_price_positive 
    CHECK (price >= 0);

-- Ensure stock is non-negative
ALTER TABLE products ADD CONSTRAINT chk_stock_non_negative 
    CHECK (stock >= 0);
*/

-- =============================================================================
-- Maintenance Tasks Setup
-- =============================================================================

-- Create a maintenance schema for housekeeping tasks
CREATE SCHEMA IF NOT EXISTS maintenance;

-- Table to track maintenance tasks
CREATE TABLE IF NOT EXISTS maintenance.task_log (
    id SERIAL PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'running',
    details TEXT,
    CONSTRAINT chk_status CHECK (status IN ('running', 'completed', 'failed'))
);

-- Grant permissions to readonly user for maintenance schema
GRANT USAGE ON SCHEMA maintenance TO telegram_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA maintenance TO telegram_readonly;

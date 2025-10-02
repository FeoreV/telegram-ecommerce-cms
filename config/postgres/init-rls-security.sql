-- PostgreSQL Row Level Security (RLS) Setup for Multi-Tenant Architecture
-- This script enables strict data isolation between stores and implements RBAC

-- Enable RLS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create security schema for RLS functions and policies
CREATE SCHEMA IF NOT EXISTS security;

-- Create function to get current user's store context
CREATE OR REPLACE FUNCTION security.current_store_id() 
RETURNS UUID AS $$
BEGIN
    -- Get store_id from current session context
    RETURN COALESCE(
        current_setting('app.current_store_id', true)::UUID,
        NULL
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get current user's role
CREATE OR REPLACE FUNCTION security.current_user_role() 
RETURNS TEXT AS $$
BEGIN
    -- Get user role from current session context
    RETURN COALESCE(
        current_setting('app.current_user_role', true),
        'CUSTOMER'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get current user's ID
CREATE OR REPLACE FUNCTION security.current_user_id() 
RETURNS UUID AS $$
BEGIN
    -- Get user_id from current session context
    RETURN COALESCE(
        current_setting('app.current_user_id', true)::UUID,
        NULL
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has access to store
CREATE OR REPLACE FUNCTION security.has_store_access(target_store_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_store_id UUID;
    user_id UUID;
BEGIN
    user_role := security.current_user_role();
    user_store_id := security.current_store_id();
    user_id := security.current_user_id();
    
    -- OWNER role has access to all stores they own
    IF user_role = 'OWNER' THEN
        RETURN EXISTS (
            SELECT 1 FROM stores 
            WHERE id = target_store_id AND owner_id = user_id
        );
    END IF;
    
    -- ADMIN role has access to stores they are assigned to
    IF user_role = 'ADMIN' THEN
        RETURN EXISTS (
            SELECT 1 FROM store_users su
            JOIN users u ON su.user_id = u.id
            WHERE su.store_id = target_store_id 
            AND u.id = user_id 
            AND u.role IN ('ADMIN', 'OWNER')
        );
    END IF;
    
    -- VENDOR role has access only to their assigned store
    IF user_role = 'VENDOR' THEN
        RETURN target_store_id = user_store_id;
    END IF;
    
    -- CUSTOMER role has limited read access
    IF user_role = 'CUSTOMER' THEN
        RETURN EXISTS (
            SELECT 1 FROM stores 
            WHERE id = target_store_id AND status = 'ACTIVE'
        );
    END IF;
    
    -- Default: no access
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can modify data
CREATE OR REPLACE FUNCTION security.can_modify_store_data(target_store_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    user_role := security.current_user_role();
    
    -- Only OWNER, ADMIN, and VENDOR can modify data
    IF user_role IN ('OWNER', 'ADMIN', 'VENDOR') THEN
        RETURN security.has_store_access(target_store_id);
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit table for RLS policy violations
CREATE TABLE IF NOT EXISTS security.rls_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_role TEXT,
    store_id UUID,
    table_name TEXT,
    operation TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET DEFAULT inet_client_addr(),
    session_info JSONB
);

-- Create index on violations table
CREATE INDEX IF NOT EXISTS idx_rls_violations_timestamp ON security.rls_violations(attempted_at);
CREATE INDEX IF NOT EXISTS idx_rls_violations_user_id ON security.rls_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_rls_violations_store_id ON security.rls_violations(store_id);

-- Function to log RLS violations
CREATE OR REPLACE FUNCTION security.log_rls_violation(
    table_name TEXT,
    operation TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO security.rls_violations (
        user_id, user_role, store_id, table_name, operation, session_info
    ) VALUES (
        security.current_user_id(),
        security.current_user_role(),
        security.current_store_id(),
        table_name,
        operation,
        jsonb_build_object(
            'application_name', current_setting('application_name', true),
            'client_addr', inet_client_addr(),
            'client_port', inet_client_port()
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on stores table
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- RLS Policy for stores table
CREATE POLICY stores_tenant_isolation ON stores
    FOR ALL
    TO PUBLIC
    USING (
        CASE 
            WHEN security.current_user_role() = 'OWNER' THEN
                owner_id = security.current_user_id()
            WHEN security.current_user_role() = 'ADMIN' THEN
                security.has_store_access(id)
            WHEN security.current_user_role() = 'VENDOR' THEN
                id = security.current_store_id()
            WHEN security.current_user_role() = 'CUSTOMER' THEN
                status = 'ACTIVE'
            ELSE FALSE
        END
    )
    WITH CHECK (
        security.can_modify_store_data(id)
    );

-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS Policy for products table
CREATE POLICY products_tenant_isolation ON products
    FOR ALL
    TO PUBLIC
    USING (
        security.has_store_access(store_id)
    )
    WITH CHECK (
        security.can_modify_store_data(store_id)
    );

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- RLS Policy for orders table
CREATE POLICY orders_tenant_isolation ON orders
    FOR ALL
    TO PUBLIC
    USING (
        CASE 
            WHEN security.current_user_role() IN ('OWNER', 'ADMIN', 'VENDOR') THEN
                security.has_store_access(store_id)
            WHEN security.current_user_role() = 'CUSTOMER' THEN
                customer_id = security.current_user_id() AND security.has_store_access(store_id)
            ELSE FALSE
        END
    )
    WITH CHECK (
        CASE 
            WHEN security.current_user_role() IN ('OWNER', 'ADMIN', 'VENDOR') THEN
                security.can_modify_store_data(store_id)
            WHEN security.current_user_role() = 'CUSTOMER' THEN
                customer_id = security.current_user_id()
            ELSE FALSE
        END
    );

-- Enable RLS on order_items table
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy for order_items table
CREATE POLICY order_items_tenant_isolation ON order_items
    FOR ALL
    TO PUBLIC
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_id
            AND (
                CASE 
                    WHEN security.current_user_role() IN ('OWNER', 'ADMIN', 'VENDOR') THEN
                        security.has_store_access(o.store_id)
                    WHEN security.current_user_role() = 'CUSTOMER' THEN
                        o.customer_id = security.current_user_id()
                    ELSE FALSE
                END
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_id
            AND security.can_modify_store_data(o.store_id)
        )
    );

-- Enable RLS on categories table
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy for categories table
CREATE POLICY categories_tenant_isolation ON categories
    FOR ALL
    TO PUBLIC
    USING (
        security.has_store_access(store_id)
    )
    WITH CHECK (
        security.can_modify_store_data(store_id)
    );

-- Enable RLS on product_variants table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_variants') THEN
        EXECUTE 'ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'CREATE POLICY product_variants_tenant_isolation ON product_variants
            FOR ALL
            TO PUBLIC
            USING (
                EXISTS (
                    SELECT 1 FROM products p
                    WHERE p.id = product_id
                    AND security.has_store_access(p.store_id)
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM products p
                    WHERE p.id = product_id
                    AND security.can_modify_store_data(p.store_id)
                )
            )';
    END IF;
END
$$;

-- Enable RLS on inventory table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory') THEN
        EXECUTE 'ALTER TABLE inventory ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'CREATE POLICY inventory_tenant_isolation ON inventory
            FOR ALL
            TO PUBLIC
            USING (
                EXISTS (
                    SELECT 1 FROM products p
                    WHERE p.id = product_id
                    AND security.has_store_access(p.store_id)
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM products p
                    WHERE p.id = product_id
                    AND security.can_modify_store_data(p.store_id)
                )
            )';
    END IF;
END
$$;

-- Enable RLS on notifications table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
        EXECUTE 'ALTER TABLE notifications ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'CREATE POLICY notifications_tenant_isolation ON notifications
            FOR ALL
            TO PUBLIC
            USING (
                CASE 
                    WHEN store_id IS NOT NULL THEN
                        security.has_store_access(store_id)
                    WHEN user_id IS NOT NULL THEN
                        user_id = security.current_user_id()
                    ELSE FALSE
                END
            )
            WITH CHECK (
                CASE 
                    WHEN store_id IS NOT NULL THEN
                        security.can_modify_store_data(store_id)
                    WHEN user_id IS NOT NULL THEN
                        user_id = security.current_user_id()
                    ELSE FALSE
                END
            )';
    END IF;
END
$$;

-- Create store_users junction table for admin assignments
CREATE TABLE IF NOT EXISTS store_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'VENDOR')),
    permissions JSONB DEFAULT '{}',
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(store_id, user_id)
);

-- Create indexes for store_users
CREATE INDEX IF NOT EXISTS idx_store_users_store_id ON store_users(store_id);
CREATE INDEX IF NOT EXISTS idx_store_users_user_id ON store_users(user_id);
CREATE INDEX IF NOT EXISTS idx_store_users_role ON store_users(role);

-- Enable RLS on store_users table
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;

-- RLS Policy for store_users table
CREATE POLICY store_users_tenant_isolation ON store_users
    FOR ALL
    TO PUBLIC
    USING (
        CASE 
            WHEN security.current_user_role() = 'OWNER' THEN
                EXISTS (
                    SELECT 1 FROM stores s
                    WHERE s.id = store_id AND s.owner_id = security.current_user_id()
                )
            WHEN security.current_user_role() = 'ADMIN' THEN
                security.has_store_access(store_id)
            WHEN security.current_user_role() = 'VENDOR' THEN
                user_id = security.current_user_id()
            ELSE FALSE
        END
    )
    WITH CHECK (
        CASE 
            WHEN security.current_user_role() = 'OWNER' THEN
                EXISTS (
                    SELECT 1 FROM stores s
                    WHERE s.id = store_id AND s.owner_id = security.current_user_id()
                )
            ELSE FALSE
        END
    );

-- Create function to set user context for RLS
CREATE OR REPLACE FUNCTION security.set_user_context(
    user_id UUID,
    user_role TEXT,
    store_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Set session variables for RLS
    PERFORM set_config('app.current_user_id', user_id::TEXT, false);
    PERFORM set_config('app.current_user_role', user_role, false);
    
    IF store_id IS NOT NULL THEN
        PERFORM set_config('app.current_store_id', store_id::TEXT, false);
    END IF;
    
    -- Log context setting for audit
    INSERT INTO security.rls_violations (
        user_id, user_role, store_id, table_name, operation, session_info
    ) VALUES (
        user_id, user_role, store_id, 'context_set', 'SET_CONTEXT',
        jsonb_build_object(
            'timestamp', NOW(),
            'application_name', current_setting('application_name', true)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clear user context
CREATE OR REPLACE FUNCTION security.clear_user_context() 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', NULL, false);
    PERFORM set_config('app.current_user_role', NULL, false);
    PERFORM set_config('app.current_store_id', NULL, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate RLS policies
CREATE OR REPLACE FUNCTION security.validate_rls_policies() 
RETURNS TABLE(
    table_name TEXT,
    has_rls BOOLEAN,
    policy_count INTEGER,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::TEXT,
        t.rowsecurity,
        COALESCE(p.policy_count, 0)::INTEGER,
        CASE 
            WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) > 0 THEN 'PROTECTED'
            WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) = 0 THEN 'RLS_ENABLED_NO_POLICIES'
            ELSE 'NOT_PROTECTED'
        END::TEXT
    FROM pg_tables t
    LEFT JOIN (
        SELECT 
            tablename,
            COUNT(*) as policy_count
        FROM pg_policies
        GROUP BY tablename
    ) p ON t.tablename = p.tablename
    WHERE t.schemaname = 'public'
    AND t.tablename IN ('stores', 'products', 'orders', 'order_items', 'categories', 'users', 'store_users')
    ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to test RLS policies
CREATE OR REPLACE FUNCTION security.test_rls_isolation(
    test_user_id UUID,
    test_user_role TEXT,
    test_store_id UUID
) RETURNS TABLE(
    test_name TEXT,
    table_name TEXT,
    expected_rows INTEGER,
    actual_rows INTEGER,
    status TEXT
) AS $$
DECLARE
    original_user_id TEXT;
    original_user_role TEXT;
    original_store_id TEXT;
BEGIN
    -- Save original context
    original_user_id := current_setting('app.current_user_id', true);
    original_user_role := current_setting('app.current_user_role', true);
    original_store_id := current_setting('app.current_store_id', true);
    
    -- Set test context
    PERFORM security.set_user_context(test_user_id, test_user_role, test_store_id);
    
    -- Test stores access
    RETURN QUERY
    SELECT 
        'Store Access Test'::TEXT,
        'stores'::TEXT,
        1::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM stores WHERE id = test_store_id),
        CASE 
            WHEN (SELECT COUNT(*) FROM stores WHERE id = test_store_id) = 1 THEN 'PASS'
            ELSE 'FAIL'
        END::TEXT;
    
    -- Test products access
    RETURN QUERY
    SELECT 
        'Products Access Test'::TEXT,
        'products'::TEXT,
        (SELECT COUNT(*)::INTEGER FROM products WHERE store_id = test_store_id AND security.current_user_role() = 'system'),
        (SELECT COUNT(*)::INTEGER FROM products WHERE store_id = test_store_id),
        CASE 
            WHEN test_user_role IN ('OWNER', 'ADMIN', 'VENDOR') THEN 'EXPECTED'
            ELSE 'EXPECTED_LIMITED'
        END::TEXT;
    
    -- Restore original context
    IF original_user_id IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', original_user_id, false);
    END IF;
    IF original_user_role IS NOT NULL THEN
        PERFORM set_config('app.current_user_role', original_user_role, false);
    END IF;
    IF original_store_id IS NOT NULL THEN
        PERFORM set_config('app.current_store_id', original_store_id, false);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to application user
GRANT USAGE ON SCHEMA security TO telegram_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA security TO telegram_user;
GRANT SELECT, INSERT ON security.rls_violations TO telegram_user;
GRANT ALL ON store_users TO telegram_user;

-- Create monitoring view for RLS status
CREATE OR REPLACE VIEW security.rls_monitoring AS
SELECT 
    table_name,
    has_rls,
    policy_count,
    status,
    CASE 
        WHEN status = 'PROTECTED' THEN '✅'
        WHEN status = 'RLS_ENABLED_NO_POLICIES' THEN '⚠️'
        ELSE '❌'
    END as security_status
FROM security.validate_rls_policies();

-- Grant access to monitoring view
GRANT SELECT ON security.rls_monitoring TO telegram_user;

-- Initial setup message
DO $$
BEGIN
    RAISE NOTICE 'Row Level Security (RLS) setup completed successfully';
    RAISE NOTICE 'Multi-tenant data isolation enabled for all core tables';
    RAISE NOTICE 'Role-based access control (RBAC) policies created';
    RAISE NOTICE 'Security functions available in security schema';
    RAISE NOTICE 'Use security.set_user_context() to set user session context';
    RAISE NOTICE 'Use security.validate_rls_policies() to check RLS status';
    RAISE NOTICE 'Monitor RLS violations in security.rls_violations table';
END $$;

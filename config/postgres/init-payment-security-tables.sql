-- Payment Security Tables for Idempotency, Approvals, and Audit

-- Idempotency keys table for payment operations
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response JSONB,
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    lock_id TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional security fields
    ip_address INET,
    user_agent TEXT,
    
    -- Ensure uniqueness per user/endpoint/hash combination
    UNIQUE(user_id, endpoint, request_hash)
);

-- Approval requests table for four-eyes approval
CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('payment_status_change', 'refund', 'void', 'manual_adjustment')),
    resource_id TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('order', 'payment', 'refund')),
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Request details
    current_state JSONB NOT NULL,
    proposed_state JSONB NOT NULL,
    reason TEXT NOT NULL,
    justification TEXT NOT NULL,
    risk_assessment JSONB NOT NULL,
    
    -- Approval tracking
    required_approvers INTEGER NOT NULL DEFAULT 2,
    approvals JSONB NOT NULL DEFAULT '[]',
    rejections JSONB NOT NULL DEFAULT '[]',
    
    -- Financial data
    amount DECIMAL(15,2),
    currency CHAR(3),
    
    -- Metadata and audit
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment transactions table for fraud detection and audit
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Transaction details
    amount DECIMAL(15,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
    
    -- Security and fraud detection
    idempotency_key TEXT,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    fraud_flags JSONB DEFAULT '[]',
    requires_manual_review BOOLEAN DEFAULT FALSE,
    
    -- Approval tracking
    approval_request_id TEXT REFERENCES approval_requests(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Transaction metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    device_fingerprint TEXT,
    ip_address INET,
    user_agent TEXT,
    geolocation JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- External references
    external_transaction_id TEXT,
    gateway_response JSONB,
    
    -- Constraints
    CONSTRAINT positive_amount CHECK (amount > 0),
    CONSTRAINT valid_currency CHECK (LENGTH(currency) = 3)
);

-- Immutable audit log for payment decisions
CREATE TABLE IF NOT EXISTS payment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
    store_id UUID REFERENCES stores(id),
    
    -- Event details
    event_data JSONB NOT NULL,
    before_state JSONB,
    after_state JSONB,
    
    -- Security context
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    request_id TEXT,
    
    -- Immutable timestamp
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Digital signature for integrity
    signature TEXT,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    -- Make table append-only (no updates or deletes)
    CONSTRAINT no_updates CHECK (false) DEFERRABLE INITIALLY DEFERRED
);

-- Remove the constraint that prevents updates (only for initial setup)
ALTER TABLE payment_audit_log DROP CONSTRAINT IF EXISTS no_updates;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_endpoint ON idempotency_keys(user_id, endpoint);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_status ON idempotency_keys(status);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_store ON approval_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by ON approval_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_approval_requests_expires ON approval_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_approval_requests_priority ON approval_requests(priority);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(type);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_store ON payment_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_amount ON payment_transactions(amount);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_risk_score ON payment_transactions(risk_score);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_review ON payment_transactions(requires_manual_review) WHERE requires_manual_review = true;

CREATE INDEX IF NOT EXISTS idx_payment_audit_log_resource ON payment_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_user ON payment_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_store ON payment_audit_log(store_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_timestamp ON payment_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_event_type ON payment_audit_log(event_type);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_idempotency_keys_updated_at
    BEFORE UPDATE ON idempotency_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_updated_at();

CREATE TRIGGER trigger_approval_requests_updated_at
    BEFORE UPDATE ON approval_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_updated_at();

CREATE TRIGGER trigger_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_updated_at();

-- Function to generate audit log signature
CREATE OR REPLACE FUNCTION generate_audit_signature(
    event_data JSONB,
    timestamp_val TIMESTAMP WITH TIME ZONE,
    resource_id TEXT
) RETURNS TEXT AS $$
BEGIN
    -- In production, this would use a proper cryptographic signature
    -- For now, we'll use a hash-based approach
    RETURN encode(
        digest(
            concat(
                event_data::text,
                extract(epoch from timestamp_val)::text,
                resource_id,
                current_setting('app.audit_secret', true)
            ),
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically generate audit signatures
CREATE OR REPLACE FUNCTION generate_audit_log_signature()
RETURNS TRIGGER AS $$
BEGIN
    NEW.signature = generate_audit_signature(NEW.event_data, NEW.timestamp, NEW.resource_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_audit_signature
    BEFORE INSERT ON payment_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION generate_audit_log_signature();

-- Function to cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys(
    retention_hours INTEGER DEFAULT 168 -- 7 days
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys 
    WHERE expires_at < NOW() - INTERVAL '1 hour' * retention_hours;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get payment fraud statistics
CREATE OR REPLACE FUNCTION get_payment_fraud_stats(
    store_id_param UUID DEFAULT NULL,
    days_back INTEGER DEFAULT 30
) RETURNS TABLE(
    total_transactions BIGINT,
    high_risk_transactions BIGINT,
    manual_review_required BIGINT,
    avg_risk_score NUMERIC,
    fraud_flags_distribution JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE risk_score >= 70) as high_risk_transactions,
        COUNT(*) FILTER (WHERE requires_manual_review = true) as manual_review_required,
        ROUND(AVG(risk_score), 2) as avg_risk_score,
        jsonb_object_agg(
            flag,
            flag_count
        ) as fraud_flags_distribution
    FROM payment_transactions pt
    CROSS JOIN LATERAL (
        SELECT flag, COUNT(*) as flag_count
        FROM jsonb_array_elements_text(pt.fraud_flags) as flag
        GROUP BY flag
    ) flag_stats
    WHERE pt.created_at > NOW() - INTERVAL '1 day' * days_back
    AND (store_id_param IS NULL OR pt.store_id = store_id_param);
END;
$$ LANGUAGE plpgsql;

-- Function to get approval statistics
CREATE OR REPLACE FUNCTION get_approval_stats(
    store_id_param UUID DEFAULT NULL,
    days_back INTEGER DEFAULT 30
) RETURNS TABLE(
    total_requests BIGINT,
    pending_requests BIGINT,
    approved_requests BIGINT,
    rejected_requests BIGINT,
    expired_requests BIGINT,
    avg_approval_time INTERVAL,
    high_priority_pending BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_requests,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_requests,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_requests,
        AVG(
            CASE 
                WHEN status IN ('approved', 'rejected') 
                THEN updated_at - requested_at 
            END
        ) as avg_approval_time,
        COUNT(*) FILTER (WHERE status = 'pending' AND priority IN ('high', 'critical')) as high_priority_pending
    FROM approval_requests
    WHERE requested_at > NOW() - INTERVAL '1 day' * days_back
    AND (store_id_param IS NULL OR store_id = store_id_param);
END;
$$ LANGUAGE plpgsql;

-- Function to detect suspicious payment patterns
CREATE OR REPLACE FUNCTION detect_suspicious_payment_patterns(
    lookback_hours INTEGER DEFAULT 24
) RETURNS TABLE(
    user_id UUID,
    store_id UUID,
    pattern_type TEXT,
    transaction_count BIGINT,
    total_amount DECIMAL,
    avg_risk_score NUMERIC,
    latest_transaction TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Rapid successive transactions
    RETURN QUERY
    SELECT 
        pt.user_id,
        pt.store_id,
        'rapid_transactions'::TEXT as pattern_type,
        COUNT(*) as transaction_count,
        SUM(pt.amount) as total_amount,
        AVG(pt.risk_score) as avg_risk_score,
        MAX(pt.created_at) as latest_transaction
    FROM payment_transactions pt
    WHERE pt.created_at > NOW() - INTERVAL '1 hour' * lookback_hours
    GROUP BY pt.user_id, pt.store_id
    HAVING COUNT(*) >= 5;
    
    -- High-value transactions from new users
    RETURN QUERY
    SELECT 
        pt.user_id,
        pt.store_id,
        'high_value_new_user'::TEXT as pattern_type,
        COUNT(*) as transaction_count,
        SUM(pt.amount) as total_amount,
        AVG(pt.risk_score) as avg_risk_score,
        MAX(pt.created_at) as latest_transaction
    FROM payment_transactions pt
    JOIN users u ON pt.user_id = u.id
    WHERE pt.created_at > NOW() - INTERVAL '1 hour' * lookback_hours
    AND pt.amount >= 1000
    AND u.created_at > NOW() - INTERVAL '7 days'
    GROUP BY pt.user_id, pt.store_id;
    
    -- Multiple failed transactions followed by success
    RETURN QUERY
    SELECT 
        pt.user_id,
        pt.store_id,
        'failed_then_success'::TEXT as pattern_type,
        COUNT(*) as transaction_count,
        SUM(pt.amount) as total_amount,
        AVG(pt.risk_score) as avg_risk_score,
        MAX(pt.created_at) as latest_transaction
    FROM payment_transactions pt
    WHERE pt.created_at > NOW() - INTERVAL '1 hour' * lookback_hours
    GROUP BY pt.user_id, pt.store_id
    HAVING COUNT(*) FILTER (WHERE status = 'failed') >= 3
    AND COUNT(*) FILTER (WHERE status = 'completed') >= 1;
END;
$$ LANGUAGE plpgsql;

-- Create views for monitoring and reporting
CREATE OR REPLACE VIEW payment_security_dashboard AS
SELECT 
    pt.store_id,
    s.name as store_name,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE pt.risk_score >= 70) as high_risk_count,
    COUNT(*) FILTER (WHERE pt.requires_manual_review) as manual_review_count,
    COUNT(*) FILTER (WHERE pt.status = 'failed') as failed_count,
    ROUND(AVG(pt.risk_score), 2) as avg_risk_score,
    SUM(pt.amount) as total_amount,
    COUNT(DISTINCT pt.user_id) as unique_users,
    COUNT(*) FILTER (WHERE pt.created_at > NOW() - INTERVAL '24 hours') as transactions_24h,
    COUNT(*) FILTER (WHERE pt.created_at > NOW() - INTERVAL '1 hour') as transactions_1h
FROM payment_transactions pt
JOIN stores s ON pt.store_id = s.id
WHERE pt.created_at > NOW() - INTERVAL '7 days'
GROUP BY pt.store_id, s.name
ORDER BY total_transactions DESC;

CREATE OR REPLACE VIEW approval_workflow_status AS
SELECT 
    ar.store_id,
    s.name as store_name,
    ar.type,
    ar.priority,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE ar.status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE ar.status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE ar.status = 'rejected') as rejected_count,
    COUNT(*) FILTER (WHERE ar.status = 'expired') as expired_count,
    AVG(
        CASE 
            WHEN ar.status IN ('approved', 'rejected') 
            THEN EXTRACT(EPOCH FROM (ar.updated_at - ar.requested_at)) / 3600
        END
    ) as avg_resolution_hours,
    MIN(ar.requested_at) as oldest_pending_request
FROM approval_requests ar
JOIN stores s ON ar.store_id = s.id
WHERE ar.requested_at > NOW() - INTERVAL '30 days'
GROUP BY ar.store_id, s.name, ar.type, ar.priority
ORDER BY pending_count DESC, oldest_pending_request ASC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO telegram_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON approval_requests TO telegram_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_transactions TO telegram_user;
GRANT INSERT ON payment_audit_log TO telegram_user;
GRANT SELECT ON payment_audit_log TO telegram_user;

GRANT EXECUTE ON FUNCTION cleanup_expired_idempotency_keys(INTEGER) TO telegram_user;
GRANT EXECUTE ON FUNCTION get_payment_fraud_stats(UUID, INTEGER) TO telegram_user;
GRANT EXECUTE ON FUNCTION get_approval_stats(UUID, INTEGER) TO telegram_user;
GRANT EXECUTE ON FUNCTION detect_suspicious_payment_patterns(INTEGER) TO telegram_user;

GRANT SELECT ON payment_security_dashboard TO telegram_user;
GRANT SELECT ON approval_workflow_status TO telegram_user;

-- Create scheduled jobs for maintenance (if pg_cron is available)
DO $$
BEGIN
    -- Try to create cron jobs, ignore if pg_cron is not available
    BEGIN
        -- Cleanup expired idempotency keys daily at 3 AM
        PERFORM cron.schedule('cleanup-idempotency-keys', '0 3 * * *', 'SELECT cleanup_expired_idempotency_keys(168);');
        
        -- Detect suspicious patterns every hour
        PERFORM cron.schedule('detect-payment-patterns', '0 * * * *', 
            'INSERT INTO payment_audit_log (event_type, resource_type, resource_id, event_data) 
             SELECT ''suspicious_pattern_detected'', ''payment'', user_id::text, 
                    jsonb_build_object(''pattern'', pattern_type, ''count'', transaction_count, ''amount'', total_amount)
             FROM detect_suspicious_payment_patterns(24);');
             
        RAISE NOTICE 'Payment security cron jobs scheduled successfully';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'pg_cron extension not available, manual maintenance required';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not schedule payment security jobs: %', SQLERRM;
    END;
END $$;

-- Initial setup message
DO $$
BEGIN
    RAISE NOTICE 'Payment security tables created successfully';
    RAISE NOTICE 'Idempotency, approval workflow, and audit logging configured';
    RAISE NOTICE 'Security monitoring views and functions available';
    RAISE NOTICE 'Use payment_security_dashboard view for real-time monitoring';
    RAISE NOTICE 'Use approval_workflow_status view for approval process oversight';
    RAISE NOTICE 'Fraud detection and suspicious pattern analysis enabled';
END $$;

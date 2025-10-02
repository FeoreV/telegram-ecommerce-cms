-- Create revoked tokens table for token blacklist management
CREATE TABLE IF NOT EXISTS revoked_tokens (
    token_id TEXT PRIMARY KEY, -- Hash of the token or token JTI
    token_type TEXT NOT NULL CHECK (token_type IN ('access', 'refresh')),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_by TEXT NOT NULL, -- Who revoked the token (user_id, system, admin, etc.)
    reason TEXT NOT NULL, -- Why the token was revoked
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When the original token would expire
    
    -- Additional metadata
    ip_address INET,
    user_agent TEXT,
    revocation_source TEXT DEFAULT 'api', -- 'api', 'admin', 'system', 'security'
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user_id ON revoked_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_session_id ON revoked_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_revoked_at ON revoked_tokens(revoked_at);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_token_type ON revoked_tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_reason ON revoked_tokens(reason);

-- Create partial index for active (non-expired) revocations
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_active ON revoked_tokens(token_id, expires_at) 
WHERE expires_at > NOW();

-- Create composite index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_cleanup ON revoked_tokens(expires_at, revoked_at);

-- Create function to clean up expired revocations
CREATE OR REPLACE FUNCTION cleanup_expired_revocations(
    retention_days INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete revocations that have expired and are older than retention period
    DELETE FROM revoked_tokens 
    WHERE expires_at < NOW() 
    AND revoked_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get revocation statistics
CREATE OR REPLACE FUNCTION get_revocation_statistics(
    days_back INTEGER DEFAULT 30
) RETURNS TABLE(
    total_revocations BIGINT,
    active_revocations BIGINT,
    expired_revocations BIGINT,
    revocations_today BIGINT,
    revocations_this_week BIGINT,
    top_reasons TEXT[],
    avg_revocations_per_day NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_revocations,
        COUNT(*) FILTER (WHERE expires_at > NOW()) as active_revocations,
        COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_revocations,
        COUNT(*) FILTER (WHERE revoked_at > CURRENT_DATE) as revocations_today,
        COUNT(*) FILTER (WHERE revoked_at > NOW() - INTERVAL '7 days') as revocations_this_week,
        ARRAY(
            SELECT reason 
            FROM revoked_tokens 
            WHERE revoked_at > NOW() - INTERVAL '1 day' * days_back
            GROUP BY reason 
            ORDER BY COUNT(*) DESC 
            LIMIT 5
        ) as top_reasons,
        ROUND(
            COUNT(*) FILTER (WHERE revoked_at > NOW() - INTERVAL '1 day' * days_back)::NUMERIC / 
            NULLIF(days_back, 0), 2
        ) as avg_revocations_per_day
    FROM revoked_tokens
    WHERE revoked_at > NOW() - INTERVAL '1 day' * days_back;
END;
$$ LANGUAGE plpgsql;

-- Create function to detect suspicious revocation patterns
CREATE OR REPLACE FUNCTION detect_suspicious_revocation_patterns()
RETURNS TABLE(
    pattern_type TEXT,
    user_id UUID,
    count BIGINT,
    latest_revocation TIMESTAMP WITH TIME ZONE,
    details JSONB
) AS $$
BEGIN
    -- High frequency revocations (same user, multiple tokens in short time)
    RETURN QUERY
    SELECT 
        'high_frequency_revocations'::TEXT,
        rt.user_id,
        COUNT(*),
        MAX(rt.revoked_at),
        jsonb_build_object(
            'revocations_last_hour', COUNT(*),
            'reasons', array_agg(DISTINCT rt.reason),
            'sources', array_agg(DISTINCT rt.revocation_source)
        )
    FROM revoked_tokens rt
    WHERE rt.revoked_at > NOW() - INTERVAL '1 hour'
    GROUP BY rt.user_id
    HAVING COUNT(*) > 5;
    
    -- Mass revocations by admin (potential security incident)
    RETURN QUERY
    SELECT 
        'mass_admin_revocation'::TEXT,
        rt.user_id,
        COUNT(*),
        MAX(rt.revoked_at),
        jsonb_build_object(
            'revoked_by', rt.revoked_by,
            'revocations_count', COUNT(*),
            'time_span_minutes', EXTRACT(EPOCH FROM (MAX(rt.revoked_at) - MIN(rt.revoked_at))) / 60
        )
    FROM revoked_tokens rt
    WHERE rt.revoked_at > NOW() - INTERVAL '24 hours'
    AND rt.revocation_source = 'admin'
    GROUP BY rt.user_id, rt.revoked_by
    HAVING COUNT(*) > 10;
    
    -- Unusual revocation reasons
    RETURN QUERY
    SELECT 
        'unusual_revocation_reason'::TEXT,
        rt.user_id,
        COUNT(*),
        MAX(rt.revoked_at),
        jsonb_build_object(
            'reason', rt.reason,
            'occurrences', COUNT(*),
            'first_seen', MIN(rt.revoked_at)
        )
    FROM revoked_tokens rt
    WHERE rt.revoked_at > NOW() - INTERVAL '24 hours'
    AND rt.reason IN ('security_breach', 'compromise_detected', 'forced_logout')
    GROUP BY rt.user_id, rt.reason;
END;
$$ LANGUAGE plpgsql;

-- Create function to revoke all user tokens
CREATE OR REPLACE FUNCTION revoke_all_user_tokens(
    p_user_id UUID,
    p_revoked_by TEXT,
    p_reason TEXT DEFAULT 'admin_action',
    p_revocation_source TEXT DEFAULT 'admin'
) RETURNS INTEGER AS $$
DECLARE
    session_rec RECORD;
    revoked_count INTEGER := 0;
BEGIN
    -- Get all active sessions for the user
    FOR session_rec IN 
        SELECT session_id, refresh_token_hash
        FROM user_sessions 
        WHERE user_id = p_user_id AND is_active = true
    LOOP
        -- Insert revocation record for refresh token
        INSERT INTO revoked_tokens (
            token_id, token_type, user_id, session_id,
            revoked_by, reason, expires_at, revocation_source
        ) VALUES (
            session_rec.refresh_token_hash,
            'refresh',
            p_user_id,
            session_rec.session_id,
            p_revoked_by,
            p_reason,
            NOW() + INTERVAL '7 days', -- Refresh tokens typically expire in 7 days
            p_revocation_source
        ) ON CONFLICT (token_id) DO NOTHING;
        
        revoked_count := revoked_count + 1;
    END LOOP;
    
    -- Mark all user sessions as inactive
    UPDATE user_sessions 
    SET is_active = false, updated_at = NOW()
    WHERE user_id = p_user_id AND is_active = true;
    
    RETURN revoked_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if token is revoked (for application use)
CREATE OR REPLACE FUNCTION is_token_revoked(
    p_token_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM revoked_tokens 
        WHERE token_id = p_token_id 
        AND expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Create view for revocation monitoring
CREATE OR REPLACE VIEW revocation_monitoring AS
SELECT 
    rt.token_id,
    rt.token_type,
    rt.user_id,
    u.username,
    u.email,
    rt.session_id,
    rt.revoked_at,
    rt.revoked_by,
    rt.reason,
    rt.expires_at,
    rt.revocation_source,
    rt.ip_address,
    CASE 
        WHEN rt.expires_at > NOW() THEN 'ACTIVE'
        ELSE 'EXPIRED'
    END as revocation_status,
    EXTRACT(EPOCH FROM (rt.expires_at - rt.revoked_at)) / 3600 as hours_until_expiry,
    us.last_activity as session_last_activity,
    us.device_info->>'platform' as device_platform
FROM revoked_tokens rt
JOIN users u ON rt.user_id = u.id
LEFT JOIN user_sessions us ON rt.session_id = us.session_id
ORDER BY rt.revoked_at DESC;

-- Create view for security dashboard
CREATE OR REPLACE VIEW security_revocation_summary AS
SELECT 
    DATE_TRUNC('day', revoked_at) as revocation_date,
    COUNT(*) as total_revocations,
    COUNT(*) FILTER (WHERE token_type = 'access') as access_token_revocations,
    COUNT(*) FILTER (WHERE token_type = 'refresh') as refresh_token_revocations,
    COUNT(DISTINCT user_id) as affected_users,
    COUNT(*) FILTER (WHERE revocation_source = 'security') as security_revocations,
    COUNT(*) FILTER (WHERE revocation_source = 'admin') as admin_revocations,
    COUNT(*) FILTER (WHERE reason LIKE '%security%' OR reason LIKE '%breach%') as security_related,
    array_agg(DISTINCT reason) as revocation_reasons
FROM revoked_tokens
WHERE revoked_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', revoked_at)
ORDER BY revocation_date DESC;

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON revoked_tokens TO telegram_user;
GRANT EXECUTE ON FUNCTION cleanup_expired_revocations(INTEGER) TO telegram_user;
GRANT EXECUTE ON FUNCTION get_revocation_statistics(INTEGER) TO telegram_user;
GRANT EXECUTE ON FUNCTION detect_suspicious_revocation_patterns() TO telegram_user;
GRANT EXECUTE ON FUNCTION revoke_all_user_tokens(UUID, TEXT, TEXT, TEXT) TO telegram_user;
GRANT EXECUTE ON FUNCTION is_token_revoked(TEXT) TO telegram_user;
GRANT SELECT ON revocation_monitoring TO telegram_user;
GRANT SELECT ON security_revocation_summary TO telegram_user;

-- Create scheduled job for cleanup (if pg_cron is available)
DO $$
BEGIN
    -- Try to create cron job, ignore if pg_cron is not available
    BEGIN
        -- Cleanup expired revocations daily at 2 AM
        PERFORM cron.schedule('revocation-cleanup', '0 2 * * *', 'SELECT cleanup_expired_revocations(30);');
        
        RAISE NOTICE 'Token revocation cleanup cron job scheduled successfully';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'pg_cron extension not available, manual cleanup required';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not schedule revocation cleanup job: %', SQLERRM;
    END;
END $$;

-- Create notification function for suspicious patterns (if needed)
CREATE OR REPLACE FUNCTION notify_suspicious_revocations() RETURNS VOID AS $$
DECLARE
    pattern_rec RECORD;
    notification_payload TEXT;
BEGIN
    FOR pattern_rec IN SELECT * FROM detect_suspicious_revocation_patterns() LOOP
        notification_payload := json_build_object(
            'pattern_type', pattern_rec.pattern_type,
            'user_id', pattern_rec.user_id,
            'count', pattern_rec.count,
            'details', pattern_rec.details
        )::TEXT;
        
        -- Send notification (this would integrate with your notification system)
        PERFORM pg_notify('security_alert', notification_payload);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Initial setup message
DO $$
BEGIN
    RAISE NOTICE 'Revoked tokens table created successfully';
    RAISE NOTICE 'Token revocation functions and views created';
    RAISE NOTICE 'Indexes created for optimal performance';
    RAISE NOTICE 'Use cleanup_expired_revocations() to clean up old revocations';
    RAISE NOTICE 'Use get_revocation_statistics() to monitor revocation patterns';
    RAISE NOTICE 'Use detect_suspicious_revocation_patterns() to find security issues';
    RAISE NOTICE 'Monitor revocations using revocation_monitoring and security_revocation_summary views';
    RAISE NOTICE 'Use revoke_all_user_tokens() for emergency user token revocation';
END $$;

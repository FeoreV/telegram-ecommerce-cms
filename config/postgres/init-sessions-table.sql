-- Create user sessions table for secure session management
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER')),
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    device_info JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    refresh_token_hash TEXT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    
    -- Additional security fields
    ip_address INET,
    user_agent TEXT,
    location TEXT,
    
    -- Session metadata
    login_method TEXT DEFAULT 'password', -- 'password', 'telegram', 'oauth'
    mfa_verified BOOLEAN DEFAULT FALSE,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    
    -- Audit fields
    created_by TEXT DEFAULT 'system',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_store_id ON user_sessions(store_id) WHERE store_id IS NOT NULL;

-- Create partial index for active sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_user ON user_sessions(user_id, last_activity) 
WHERE is_active = true;

-- Create composite index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_cleanup ON user_sessions(user_id, is_active, last_activity);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_sessions_updated_at
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_sessions_updated_at();

-- Create function to cleanup inactive sessions
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions(
    inactivity_hours INTEGER DEFAULT 24,
    max_sessions_per_user INTEGER DEFAULT 5
) RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
    user_record RECORD;
    session_record RECORD;
    sessions_to_keep INTEGER;
BEGIN
    -- Mark sessions as inactive if they haven't been used
    UPDATE user_sessions 
    SET is_active = false 
    WHERE is_active = true 
    AND last_activity < NOW() - INTERVAL '1 hour' * inactivity_hours;
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    -- Limit sessions per user (keep most recent ones)
    FOR user_record IN 
        SELECT user_id, COUNT(*) as session_count
        FROM user_sessions 
        WHERE is_active = true
        GROUP BY user_id
        HAVING COUNT(*) > max_sessions_per_user
    LOOP
        sessions_to_keep := max_sessions_per_user;
        
        -- Deactivate oldest sessions for this user
        UPDATE user_sessions 
        SET is_active = false
        WHERE session_id IN (
            SELECT session_id 
            FROM user_sessions 
            WHERE user_id = user_record.user_id AND is_active = true
            ORDER BY last_activity ASC
            LIMIT (user_record.session_count - sessions_to_keep)
        );
        
        GET DIAGNOSTICS sessions_to_keep = ROW_COUNT;
        cleaned_count := cleaned_count + sessions_to_keep;
    END LOOP;
    
    -- Delete old inactive sessions (older than 30 days)
    DELETE FROM user_sessions 
    WHERE is_active = false 
    AND updated_at < NOW() - INTERVAL '30 days';
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get session statistics
CREATE OR REPLACE FUNCTION get_session_statistics()
RETURNS TABLE(
    total_sessions BIGINT,
    active_sessions BIGINT,
    inactive_sessions BIGINT,
    sessions_last_24h BIGINT,
    unique_users_24h BIGINT,
    avg_session_duration INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE is_active = true) as active_sessions,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_sessions,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as sessions_last_24h,
        COUNT(DISTINCT user_id) FILTER (WHERE last_activity > NOW() - INTERVAL '24 hours') as unique_users_24h,
        AVG(last_activity - created_at) FILTER (WHERE is_active = false) as avg_session_duration
    FROM user_sessions;
END;
$$ LANGUAGE plpgsql;

-- Create function to detect suspicious sessions
CREATE OR REPLACE FUNCTION detect_suspicious_sessions()
RETURNS TABLE(
    session_id TEXT,
    user_id UUID,
    risk_factors TEXT[],
    risk_score INTEGER,
    last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.session_id,
        us.user_id,
        ARRAY[
            CASE WHEN us.risk_score > 70 THEN 'high_risk_score' END,
            CASE WHEN us.last_activity < NOW() - INTERVAL '1 hour' AND us.is_active THEN 'stale_session' END,
            CASE WHEN device_info->>'ipAddress' != us.ip_address::TEXT THEN 'ip_mismatch' END,
            CASE WHEN (
                SELECT COUNT(*) FROM user_sessions us2 
                WHERE us2.user_id = us.user_id 
                AND us2.is_active = true 
                AND us2.ip_address != us.ip_address
            ) > 1 THEN 'multiple_locations' END
        ]::TEXT[] as risk_factors,
        us.risk_score,
        us.last_activity
    FROM user_sessions us
    WHERE us.is_active = true
    AND (
        us.risk_score > 50 OR
        us.last_activity < NOW() - INTERVAL '2 hours' OR
        (device_info->>'ipAddress') != us.ip_address::TEXT OR
        EXISTS (
            SELECT 1 FROM user_sessions us2 
            WHERE us2.user_id = us.user_id 
            AND us2.is_active = true 
            AND us2.session_id != us.session_id
            AND us2.ip_address != us.ip_address
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate session risk score
CREATE OR REPLACE FUNCTION calculate_session_risk_score(
    p_session_id TEXT
) RETURNS INTEGER AS $$
DECLARE
    session_rec RECORD;
    risk_score INTEGER := 0;
    user_session_count INTEGER;
    location_changes INTEGER;
    device_changes INTEGER;
BEGIN
    -- Get session data
    SELECT * INTO session_rec 
    FROM user_sessions 
    WHERE session_id = p_session_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Check for multiple active sessions
    SELECT COUNT(*) INTO user_session_count
    FROM user_sessions 
    WHERE user_id = session_rec.user_id AND is_active = true;
    
    IF user_session_count > 3 THEN
        risk_score := risk_score + 20;
    END IF;
    
    -- Check for location changes
    SELECT COUNT(DISTINCT location) INTO location_changes
    FROM user_sessions 
    WHERE user_id = session_rec.user_id 
    AND created_at > NOW() - INTERVAL '24 hours';
    
    IF location_changes > 2 THEN
        risk_score := risk_score + 30;
    END IF;
    
    -- Check for device changes
    SELECT COUNT(DISTINCT device_info->>'deviceFingerprint') INTO device_changes
    FROM user_sessions 
    WHERE user_id = session_rec.user_id 
    AND created_at > NOW() - INTERVAL '24 hours';
    
    IF device_changes > 1 THEN
        risk_score := risk_score + 25;
    END IF;
    
    -- Check session age
    IF session_rec.created_at < NOW() - INTERVAL '7 days' THEN
        risk_score := risk_score + 15;
    END IF;
    
    -- Check inactivity
    IF session_rec.last_activity < NOW() - INTERVAL '1 hour' THEN
        risk_score := risk_score + 10;
    END IF;
    
    -- Cap at 100
    IF risk_score > 100 THEN
        risk_score := 100;
    END IF;
    
    -- Update session risk score
    UPDATE user_sessions 
    SET risk_score = calculate_session_risk_score.risk_score
    WHERE session_id = p_session_id;
    
    RETURN risk_score;
END;
$$ LANGUAGE plpgsql;

-- Create view for session monitoring
CREATE OR REPLACE VIEW session_monitoring AS
SELECT 
    us.session_id,
    us.user_id,
    u.username,
    u.email,
    us.role,
    s.name as store_name,
    us.created_at,
    us.last_activity,
    us.is_active,
    us.risk_score,
    us.device_info->>'platform' as platform,
    us.device_info->>'browser' as browser,
    us.device_info->>'deviceFingerprint' as device_fingerprint,
    us.ip_address,
    us.location,
    us.login_method,
    us.mfa_verified,
    EXTRACT(EPOCH FROM (us.last_activity - us.created_at)) / 60 as session_duration_minutes,
    EXTRACT(EPOCH FROM (NOW() - us.last_activity)) / 60 as minutes_since_activity
FROM user_sessions us
JOIN users u ON us.user_id = u.id
LEFT JOIN stores s ON us.store_id = s.id
WHERE us.is_active = true
ORDER BY us.last_activity DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO telegram_user;
GRANT EXECUTE ON FUNCTION cleanup_inactive_sessions(INTEGER, INTEGER) TO telegram_user;
GRANT EXECUTE ON FUNCTION get_session_statistics() TO telegram_user;
GRANT EXECUTE ON FUNCTION detect_suspicious_sessions() TO telegram_user;
GRANT EXECUTE ON FUNCTION calculate_session_risk_score(TEXT) TO telegram_user;
GRANT SELECT ON session_monitoring TO telegram_user;

-- Create scheduled job for session cleanup (if pg_cron is available)
DO $$
BEGIN
    -- Try to create cron job, ignore if pg_cron is not available
    BEGIN
        -- Cleanup inactive sessions every hour
        PERFORM cron.schedule('session-cleanup', '0 * * * *', 'SELECT cleanup_inactive_sessions(24, 5);');
        
        -- Update risk scores every 30 minutes
        PERFORM cron.schedule('session-risk-update', '*/30 * * * *', 
            'UPDATE user_sessions SET risk_score = calculate_session_risk_score(session_id) WHERE is_active = true;');
            
        RAISE NOTICE 'Session management cron jobs scheduled successfully';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'pg_cron extension not available, manual session cleanup required';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not schedule cron jobs: %', SQLERRM;
    END;
END $$;

-- Initial setup message
DO $$
BEGIN
    RAISE NOTICE 'User sessions table created successfully';
    RAISE NOTICE 'Session management functions and views created';
    RAISE NOTICE 'Indexes created for optimal performance';
    RAISE NOTICE 'Use cleanup_inactive_sessions() to clean up old sessions';
    RAISE NOTICE 'Use get_session_statistics() to monitor session usage';
    RAISE NOTICE 'Use detect_suspicious_sessions() to find potential security issues';
    RAISE NOTICE 'Monitor sessions using the session_monitoring view';
END $$;

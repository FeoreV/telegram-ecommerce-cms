-- PostgreSQL Encryption at Rest Setup
-- This script configures database-level encryption and security

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create encryption functions schema
CREATE SCHEMA IF NOT EXISTS encryption;

-- Function to encrypt data using AES-256
CREATE OR REPLACE FUNCTION encryption.encrypt_data(
    plaintext TEXT,
    key_name TEXT DEFAULT 'default'
) RETURNS TEXT AS $$
DECLARE
    encryption_key BYTEA;
    iv BYTEA;
    encrypted_data BYTEA;
BEGIN
    -- Get encryption key from environment or generate
    -- In production, this should come from Vault
    encryption_key := digest(COALESCE(current_setting('encryption.key_' || key_name, TRUE), 'default_key'), 'sha256');
    
    -- Generate random IV
    iv := gen_random_bytes(16);
    
    -- Encrypt the data
    encrypted_data := encrypt_iv(plaintext::BYTEA, encryption_key, iv, 'aes');
    
    -- Return base64 encoded result with IV prepended
    RETURN encode(iv || encrypted_data, 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt data
CREATE OR REPLACE FUNCTION encryption.decrypt_data(
    encrypted_text TEXT,
    key_name TEXT DEFAULT 'default'
) RETURNS TEXT AS $$
DECLARE
    encryption_key BYTEA;
    decoded_data BYTEA;
    iv BYTEA;
    encrypted_data BYTEA;
    decrypted_data BYTEA;
BEGIN
    -- Decode base64
    decoded_data := decode(encrypted_text, 'base64');
    
    -- Extract IV (first 16 bytes)
    iv := substring(decoded_data from 1 for 16);
    
    -- Extract encrypted data (rest)
    encrypted_data := substring(decoded_data from 17);
    
    -- Get encryption key
    encryption_key := digest(COALESCE(current_setting('encryption.key_' || key_name, TRUE), 'default_key'), 'sha256');
    
    -- Decrypt the data
    decrypted_data := decrypt_iv(encrypted_data, encryption_key, iv, 'aes');
    
    RETURN convert_from(decrypted_data, 'UTF8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to hash passwords securely
CREATE OR REPLACE FUNCTION encryption.hash_password(
    password TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify password
CREATE OR REPLACE FUNCTION encryption.verify_password(
    password TEXT,
    hash TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit log for encryption operations
CREATE TABLE IF NOT EXISTS encryption.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation VARCHAR(50) NOT NULL,
    table_name VARCHAR(100),
    column_name VARCHAR(100),
    user_id VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- Create index on audit log
CREATE INDEX IF NOT EXISTS idx_encryption_audit_timestamp ON encryption.audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_encryption_audit_operation ON encryption.audit_log(operation);

-- Function to log encryption operations
CREATE OR REPLACE FUNCTION encryption.log_operation(
    operation_type TEXT,
    table_name TEXT DEFAULT NULL,
    column_name TEXT DEFAULT NULL,
    user_id TEXT DEFAULT NULL,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO encryption.audit_log (
        operation, table_name, column_name, user_id, 
        ip_address, success, error_message
    ) VALUES (
        operation_type, table_name, column_name, user_id,
        inet_client_addr(), success, error_message
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create encrypted columns for sensitive data
-- Users table encryption
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name_encrypted TEXT;

-- Orders table encryption
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_info_encrypted TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes_encrypted TEXT;

-- Stores table encryption
ALTER TABLE stores ADD COLUMN IF NOT EXISTS contact_info_encrypted TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS bot_token_encrypted TEXT;

-- Create triggers for automatic encryption
CREATE OR REPLACE FUNCTION encrypt_user_data() RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt email if provided and not already encrypted
    IF NEW.email IS NOT NULL AND (OLD.email IS NULL OR NEW.email != OLD.email) THEN
        NEW.email_encrypted := encryption.encrypt_data(NEW.email, 'user_pii');
        PERFORM encryption.log_operation('ENCRYPT', 'users', 'email', NEW.id::TEXT);
    END IF;
    
    -- Encrypt phone if provided
    IF NEW.phone IS NOT NULL AND (OLD.phone IS NULL OR NEW.phone != OLD.phone) THEN
        NEW.phone_encrypted := encryption.encrypt_data(NEW.phone, 'user_pii');
        PERFORM encryption.log_operation('ENCRYPT', 'users', 'phone', NEW.id::TEXT);
    END IF;
    
    -- Encrypt first name if provided
    IF NEW.first_name IS NOT NULL AND (OLD.first_name IS NULL OR NEW.first_name != OLD.first_name) THEN
        NEW.first_name_encrypted := encryption.encrypt_data(NEW.first_name, 'user_pii');
        PERFORM encryption.log_operation('ENCRYPT', 'users', 'first_name', NEW.id::TEXT);
    END IF;
    
    -- Encrypt last name if provided
    IF NEW.last_name IS NOT NULL AND (OLD.last_name IS NULL OR NEW.last_name != OLD.last_name) THEN
        NEW.last_name_encrypted := encryption.encrypt_data(NEW.last_name, 'user_pii');
        PERFORM encryption.log_operation('ENCRYPT', 'users', 'last_name', NEW.id::TEXT);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table
DROP TRIGGER IF EXISTS trigger_encrypt_user_data ON users;
CREATE TRIGGER trigger_encrypt_user_data
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_user_data();

-- Create trigger function for orders
CREATE OR REPLACE FUNCTION encrypt_order_data() RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt customer info
    IF NEW.customer_info IS NOT NULL AND (OLD.customer_info IS NULL OR NEW.customer_info != OLD.customer_info) THEN
        NEW.customer_info_encrypted := encryption.encrypt_data(NEW.customer_info, 'order_data');
        PERFORM encryption.log_operation('ENCRYPT', 'orders', 'customer_info', NEW.id::TEXT);
    END IF;
    
    -- Encrypt notes if provided
    IF NEW.notes IS NOT NULL AND (OLD.notes IS NULL OR NEW.notes != OLD.notes) THEN
        NEW.notes_encrypted := encryption.encrypt_data(NEW.notes, 'order_data');
        PERFORM encryption.log_operation('ENCRYPT', 'orders', 'notes', NEW.id::TEXT);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for orders table
DROP TRIGGER IF EXISTS trigger_encrypt_order_data ON orders;
CREATE TRIGGER trigger_encrypt_order_data
    BEFORE INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_order_data();

-- Create trigger function for stores
CREATE OR REPLACE FUNCTION encrypt_store_data() RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt contact info
    IF NEW.contact_info IS NOT NULL AND (OLD.contact_info IS NULL OR NEW.contact_info != OLD.contact_info) THEN
        NEW.contact_info_encrypted := encryption.encrypt_data(NEW.contact_info, 'store_data');
        PERFORM encryption.log_operation('ENCRYPT', 'stores', 'contact_info', NEW.id::TEXT);
    END IF;
    
    -- Encrypt bot token (critical security data)
    IF NEW.bot_token IS NOT NULL AND (OLD.bot_token IS NULL OR NEW.bot_token != OLD.bot_token) THEN
        NEW.bot_token_encrypted := encryption.encrypt_data(NEW.bot_token, 'store_secrets');
        PERFORM encryption.log_operation('ENCRYPT', 'stores', 'bot_token', NEW.id::TEXT);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stores table
DROP TRIGGER IF EXISTS trigger_encrypt_store_data ON stores;
CREATE TRIGGER trigger_encrypt_store_data
    BEFORE INSERT OR UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_store_data();

-- Create views for transparent decryption
CREATE OR REPLACE VIEW users_decrypted AS
SELECT 
    id, created_at, updated_at, telegram_id, username,
    CASE 
        WHEN email_encrypted IS NOT NULL THEN encryption.decrypt_data(email_encrypted, 'user_pii')
        ELSE email 
    END as email,
    CASE 
        WHEN phone_encrypted IS NOT NULL THEN encryption.decrypt_data(phone_encrypted, 'user_pii')
        ELSE phone 
    END as phone,
    CASE 
        WHEN first_name_encrypted IS NOT NULL THEN encryption.decrypt_data(first_name_encrypted, 'user_pii')
        ELSE first_name 
    END as first_name,
    CASE 
        WHEN last_name_encrypted IS NOT NULL THEN encryption.decrypt_data(last_name_encrypted, 'user_pii')
        ELSE last_name 
    END as last_name,
    password, role, is_active, last_login_at, profile_photo
FROM users;

-- Create view for decrypted orders
CREATE OR REPLACE VIEW orders_decrypted AS
SELECT 
    id, created_at, updated_at, order_number, status, total_amount, currency,
    CASE 
        WHEN customer_info_encrypted IS NOT NULL THEN encryption.decrypt_data(customer_info_encrypted, 'order_data')
        ELSE customer_info 
    END as customer_info,
    CASE 
        WHEN notes_encrypted IS NOT NULL THEN encryption.decrypt_data(notes_encrypted, 'order_data')
        ELSE notes 
    END as notes,
    paid_at, rejected_at, rejection_reason, shipped_at, delivered_at,
    cancelled_at, tracking_number, carrier, delivery_notes,
    cancellation_reason, payment_proof, client_request_id,
    customer_id, store_id
FROM orders;

-- Create view for decrypted stores
CREATE OR REPLACE VIEW stores_decrypted AS
SELECT 
    id, created_at, updated_at, name, description, slug, status, currency,
    CASE 
        WHEN contact_info_encrypted IS NOT NULL THEN encryption.decrypt_data(contact_info_encrypted, 'store_data')
        ELSE contact_info 
    END as contact_info,
    contact_phone, settings, logo_url, banner_url,
    low_stock_threshold, critical_stock_threshold, enable_stock_alerts,
    CASE 
        WHEN bot_token_encrypted IS NOT NULL THEN encryption.decrypt_data(bot_token_encrypted, 'store_secrets')
        ELSE bot_token 
    END as bot_token,
    bot_username, bot_status, bot_webhook_url, bot_settings,
    bot_created_at, bot_last_active, owner_id
FROM stores;

-- Grant permissions
GRANT USAGE ON SCHEMA encryption TO telegram_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA encryption TO telegram_user;
GRANT SELECT ON encryption.audit_log TO telegram_user;

-- Grant permissions on decrypted views
GRANT SELECT ON users_decrypted TO telegram_user;
GRANT SELECT ON orders_decrypted TO telegram_user;
GRANT SELECT ON stores_decrypted TO telegram_user;

-- Create function to rotate encryption keys
CREATE OR REPLACE FUNCTION encryption.rotate_encryption_key(
    old_key_name TEXT,
    new_key_name TEXT,
    table_name TEXT,
    column_name TEXT
) RETURNS INTEGER AS $$
DECLARE
    row_count INTEGER := 0;
    sql_query TEXT;
BEGIN
    -- Build dynamic SQL for key rotation
    sql_query := format('
        UPDATE %I 
        SET %I = encryption.encrypt_data(
            encryption.decrypt_data(%I, %L), 
            %L
        )
        WHERE %I IS NOT NULL',
        table_name, column_name || '_encrypted', column_name || '_encrypted', 
        old_key_name, new_key_name, column_name || '_encrypted'
    );
    
    -- Execute the rotation
    EXECUTE sql_query;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    
    -- Log the operation
    PERFORM encryption.log_operation(
        'KEY_ROTATION', 
        table_name, 
        column_name, 
        current_user, 
        TRUE, 
        format('Rotated %s rows', row_count)
    );
    
    RETURN row_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create maintenance function to clean up old audit logs
CREATE OR REPLACE FUNCTION encryption.cleanup_audit_logs(
    retention_days INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM encryption.audit_log 
    WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    PERFORM encryption.log_operation(
        'AUDIT_CLEANUP', 
        NULL, 
        NULL, 
        current_user, 
        TRUE, 
        format('Cleaned up %s old audit records', deleted_count)
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initial setup message
DO $$
BEGIN
    RAISE NOTICE 'Database encryption setup completed successfully';
    RAISE NOTICE 'Encrypted columns added to users, orders, and stores tables';
    RAISE NOTICE 'Automatic encryption triggers created';
    RAISE NOTICE 'Decryption views available: users_decrypted, orders_decrypted, stores_decrypted';
    RAISE NOTICE 'Audit logging enabled in encryption.audit_log';
END $$;

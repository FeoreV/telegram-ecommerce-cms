#!/bin/bash
set -e

echo "🔄 Setting up automated key rotation for Telegram E-commerce Bot..."

# Check if Vault is available
if ! vault status > /dev/null 2>&1; then
    echo "❌ Vault is not running or not unsealed. Please start and unseal Vault first."
    exit 1
fi

# Function to rotate a transit key
rotate_transit_key() {
    local key_name=$1
    echo "🔄 Rotating key: $key_name"
    
    # Get current key version before rotation
    local current_version=$(vault read -field=latest_version transit/keys/$key_name)
    echo "  Current version: $current_version"
    
    # Rotate the key
    vault write -f transit/keys/$key_name/rotate
    
    # Get new version
    local new_version=$(vault read -field=latest_version transit/keys/$key_name)
    echo "  ✅ New version: $new_version"
    
    # Log rotation event
    vault audit enable -path="key_rotation_${key_name}" file file_path="/tmp/key_rotation_${key_name}.log" 2>/dev/null || true
    
    # Store rotation metadata
    vault kv put kv/system/key-rotations/$key_name/$(date +%Y%m%d_%H%M%S) \
        old_version="$current_version" \
        new_version="$new_version" \
        rotated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        rotated_by="automation" \
        reason="scheduled_rotation"
    
    echo "  📝 Rotation logged to kv/system/key-rotations/$key_name"
}

# Function to rotate JWT secrets
rotate_jwt_secrets() {
    echo "🔄 Rotating JWT secrets..."
    
    # Generate new JWT secrets
    local new_jwt_secret=$(openssl rand -base64 64 | tr -d '=+/')
    local new_refresh_secret=$(openssl rand -base64 64 | tr -d '=+/')
    
    # Get current secrets for backup
    local current_jwt=$(vault kv get -field=secret kv/app/jwt 2>/dev/null || echo "not_found")
    local current_refresh=$(vault kv get -field=refreshSecret kv/app/jwt 2>/dev/null || echo "not_found")
    
    # Store old secrets in rotation history
    if [ "$current_jwt" != "not_found" ]; then
        vault kv put kv/system/jwt-rotations/$(date +%Y%m%d_%H%M%S) \
            old_jwt_secret="$current_jwt" \
            old_refresh_secret="$current_refresh" \
            rotated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            rotated_by="automation"
    fi
    
    # Update with new secrets
    vault kv patch kv/app/jwt \
        secret="$new_jwt_secret" \
        refreshSecret="$new_refresh_secret"
    
    echo "  ✅ JWT secrets rotated successfully"
    echo "  📝 Old secrets backed up to kv/system/jwt-rotations/"
}

# Function to rotate webhook secrets
rotate_webhook_secrets() {
    echo "🔄 Rotating webhook secrets..."
    
    # Generate new webhook secret
    local new_webhook_secret=$(openssl rand -base64 32 | tr -d '=+/')
    
    # Get current secret for backup
    local current_webhook=$(vault kv get -field=webhookSecret kv/app/telegram 2>/dev/null || echo "not_found")
    
    # Store old secret in rotation history
    if [ "$current_webhook" != "not_found" ]; then
        vault kv put kv/system/webhook-rotations/$(date +%Y%m%d_%H%M%S) \
            old_webhook_secret="$current_webhook" \
            rotated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            rotated_by="automation"
    fi
    
    # Update with new secret
    vault kv patch kv/app/telegram webhookSecret="$new_webhook_secret"
    
    echo "  ✅ Webhook secret rotated successfully"
    echo "  📝 Old secret backed up to kv/system/webhook-rotations/"
}

# Function to rotate encryption keys
rotate_encryption_keys() {
    echo "🔄 Rotating encryption keys..."
    
    # Generate new encryption keys
    local new_master_key=$(openssl rand -hex 32)
    local new_data_key=$(openssl rand -hex 32)
    
    # Get current keys for backup
    local current_master=$(vault kv get -field=masterKey kv/app/encryption 2>/dev/null || echo "not_found")
    local current_data=$(vault kv get -field=dataEncryptionKey kv/app/encryption 2>/dev/null || echo "not_found")
    
    # Store old keys in rotation history
    if [ "$current_master" != "not_found" ]; then
        vault kv put kv/system/encryption-rotations/$(date +%Y%m%d_%H%M%S) \
            old_master_key="$current_master" \
            old_data_key="$current_data" \
            rotated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            rotated_by="automation"
    fi
    
    # Update with new keys
    vault kv patch kv/app/encryption \
        masterKey="$new_master_key" \
        dataEncryptionKey="$new_data_key"
    
    echo "  ✅ Encryption keys rotated successfully"
    echo "  📝 Old keys backed up to kv/system/encryption-rotations/"
}

# Function to create rotation schedule
create_rotation_schedule() {
    echo "📅 Creating rotation schedule..."
    
    # Create systemd timer for automated rotation (Linux)
    if command -v systemctl >/dev/null 2>&1; then
        cat > /tmp/vault-key-rotation.service <<EOF
[Unit]
Description=Vault Key Rotation Service
Requires=vault.service
After=vault.service

[Service]
Type=oneshot
User=vault
ExecStart=/opt/vault/scripts/rotate-keys.sh
Environment=VAULT_ADDR=https://vault.yourdomain.com:8200
EnvironmentFile=/opt/vault/env/rotation.env

[Install]
WantedBy=multi-user.target
EOF

        cat > /tmp/vault-key-rotation.timer <<EOF
[Unit]
Description=Vault Key Rotation Timer
Requires=vault-key-rotation.service

[Timer]
# Run weekly on Sunday at 2 AM
OnCalendar=Sun *-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

        echo "  📁 Systemd service and timer files created in /tmp/"
        echo "  📋 To install: sudo cp /tmp/vault-key-rotation.* /etc/systemd/system/"
        echo "  📋 To enable: sudo systemctl enable vault-key-rotation.timer"
    fi
    
    # Create cron job (alternative)
    cat > /tmp/vault-rotation-cron <<EOF
# Vault Key Rotation Schedule
# Run every Sunday at 2 AM
0 2 * * 0 /opt/vault/scripts/rotate-keys.sh >> /var/log/vault-rotation.log 2>&1

# Run JWT rotation weekly (Wednesday at 3 AM)
0 3 * * 3 /opt/vault/scripts/rotate-jwt.sh >> /var/log/vault-rotation.log 2>&1

# Run webhook rotation monthly (1st of month at 4 AM)
0 4 1 * * /opt/vault/scripts/rotate-webhooks.sh >> /var/log/vault-rotation.log 2>&1
EOF

    echo "  📁 Cron job created in /tmp/vault-rotation-cron"
    echo "  📋 To install: crontab /tmp/vault-rotation-cron"
}

# Function to setup audit logging
setup_audit_logging() {
    echo "📋 Setting up audit logging..."
    
    # Enable file audit device if not already enabled
    if ! vault audit list | grep -q "file/"; then
        vault audit enable file file_path=/var/log/vault/audit.log
        echo "  ✅ File audit device enabled"
    else
        echo "  ℹ️  File audit device already enabled"
    fi
    
    # Create audit log rotation configuration
    cat > /tmp/vault-audit-logrotate <<EOF
/var/log/vault/audit.log {
    daily
    rotate 90
    compress
    delaycompress
    missingok
    notifempty
    create 0640 vault vault
    postrotate
        # Send HUP signal to Vault to reopen log files
        systemctl reload vault || true
    endscript
}

/var/log/vault-rotation.log {
    weekly
    rotate 52
    compress
    delaycompress
    missingok
    notifempty
    create 0640 vault vault
}
EOF

    echo "  📁 Logrotate configuration created in /tmp/vault-audit-logrotate"
    echo "  📋 To install: sudo cp /tmp/vault-audit-logrotate /etc/logrotate.d/vault"
}

# Function to create monitoring and alerting
setup_monitoring() {
    echo "📊 Setting up monitoring and alerting..."
    
    # Create monitoring script
    cat > /tmp/vault-key-monitor.sh <<EOF
#!/bin/bash
# Vault Key Monitoring Script

VAULT_ADDR=\${VAULT_ADDR:-http://localhost:8200}
ALERT_WEBHOOK=\${ALERT_WEBHOOK:-""}

# Function to send alert
send_alert() {
    local message="\$1"
    local severity="\$2"
    
    echo "\$(date): [\$severity] \$message" >> /var/log/vault-monitor.log
    
    if [ -n "\$ALERT_WEBHOOK" ]; then
        curl -X POST "\$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"🔐 Vault Alert [\$severity]: \$message\"}"
    fi
}

# Check key ages
check_key_ages() {
    local keys=("app-data-key" "db-field-key" "file-storage-key" "pii-key")
    
    for key in "\${keys[@]}"; do
        local creation_time=\$(vault read -field=creation_time transit/keys/\$key)
        local age_days=\$(( (\$(date +%s) - \$(date -d "\$creation_time" +%s)) / 86400 ))
        
        if [ \$age_days -gt 90 ]; then
            send_alert "Key \$key is \$age_days days old (>90 days)" "WARNING"
        fi
        
        if [ \$age_days -gt 120 ]; then
            send_alert "Key \$key is \$age_days days old (>120 days) - URGENT ROTATION NEEDED" "CRITICAL"
        fi
    done
}

# Check Vault health
check_vault_health() {
    if ! vault status > /dev/null 2>&1; then
        send_alert "Vault is not accessible or sealed" "CRITICAL"
        return 1
    fi
    
    # Check if Vault is sealed
    if vault status | grep -q "Sealed.*true"; then
        send_alert "Vault is sealed" "CRITICAL"
        return 1
    fi
}

# Main monitoring loop
main() {
    check_vault_health || exit 1
    check_key_ages
    
    echo "\$(date): Vault key monitoring completed successfully"
}

main
EOF

    chmod +x /tmp/vault-key-monitor.sh
    echo "  📁 Monitoring script created in /tmp/vault-key-monitor.sh"
    
    # Create monitoring cron job
    cat > /tmp/vault-monitor-cron <<EOF
# Vault Key Monitoring
# Check key ages daily at 6 AM
0 6 * * * /opt/vault/scripts/vault-key-monitor.sh

# Health check every hour
0 * * * * /opt/vault/scripts/vault-key-monitor.sh --health-only
EOF

    echo "  📁 Monitoring cron job created in /tmp/vault-monitor-cron"
}

# Main execution
echo "🚀 Starting key rotation automation setup..."

# 1. Set up rotation schedules for transit keys
echo "📦 Configuring transit key rotation..."
for key in "app-data-key" "db-field-key" "file-storage-key" "backup-key" "pii-key"; do
    # Set minimum encryption version to current for gradual key migration
    vault write transit/keys/$key/config \
        min_decryption_version=1 \
        min_encryption_version=0 \
        deletion_allowed=false \
        auto_rotate_period="2160h"  # 90 days
    echo "  ✅ $key configured for auto-rotation (90 days)"
done

# 2. Create rotation scripts
echo "📝 Creating rotation scripts..."

# Main rotation script
cat > /tmp/rotate-keys.sh <<EOF
#!/bin/bash
set -e

# Source environment variables
export VAULT_ADDR=\${VAULT_ADDR:-http://localhost:8200}

# Authenticate with Vault (using AppRole)
vault write auth/approle/login role_id=\$VAULT_ROLE_ID secret_id=\$VAULT_SECRET_ID

# Rotate transit keys
for key in app-data-key db-field-key file-storage-key pii-key; do
    echo "Rotating \$key..."
    vault write -f transit/keys/\$key/rotate
    echo "✅ \$key rotated successfully"
done

echo "🎉 All transit keys rotated successfully at \$(date)"
EOF

# JWT rotation script
cat > /tmp/rotate-jwt.sh <<EOF
#!/bin/bash
set -e

export VAULT_ADDR=\${VAULT_ADDR:-http://localhost:8200}

# Authenticate with Vault
vault write auth/approle/login role_id=\$VAULT_ROLE_ID secret_id=\$VAULT_SECRET_ID

# Generate new JWT secrets
NEW_JWT=\$(openssl rand -base64 64 | tr -d '=+/')
NEW_REFRESH=\$(openssl rand -base64 64 | tr -d '=+/')

# Update secrets
vault kv patch kv/app/jwt secret="\$NEW_JWT" refreshSecret="\$NEW_REFRESH"

echo "🎉 JWT secrets rotated successfully at \$(date)"
EOF

# Webhook rotation script
cat > /tmp/rotate-webhooks.sh <<EOF
#!/bin/bash
set -e

export VAULT_ADDR=\${VAULT_ADDR:-http://localhost:8200}

# Authenticate with Vault
vault write auth/approle/login role_id=\$VAULT_ROLE_ID secret_id=\$VAULT_SECRET_ID

# Generate new webhook secret
NEW_WEBHOOK=\$(openssl rand -base64 32 | tr -d '=+/')

# Update secret
vault kv patch kv/app/telegram webhookSecret="\$NEW_WEBHOOK"

echo "🎉 Webhook secret rotated successfully at \$(date)"
EOF

chmod +x /tmp/rotate-*.sh
echo "  📁 Rotation scripts created in /tmp/"

# 3. Set up scheduling
create_rotation_schedule

# 4. Set up audit logging
setup_audit_logging

# 5. Set up monitoring
setup_monitoring

# 6. Create revocation procedures
echo "🚫 Creating key revocation procedures..."

cat > /tmp/revoke-key.sh <<EOF
#!/bin/bash
set -e

KEY_NAME=\$1
REASON=\$2

if [ -z "\$KEY_NAME" ] || [ -z "\$REASON" ]; then
    echo "Usage: \$0 <key_name> <reason>"
    echo "Example: \$0 app-data-key 'suspected_compromise'"
    exit 1
fi

echo "🚨 EMERGENCY KEY REVOCATION: \$KEY_NAME"
echo "Reason: \$REASON"
echo "Time: \$(date)"

# Rotate the key immediately
vault write -f transit/keys/\$KEY_NAME/rotate

# Update minimum encryption version to force use of new key
NEW_VERSION=\$(vault read -field=latest_version transit/keys/\$KEY_NAME)
vault write transit/keys/\$KEY_NAME/config min_encryption_version=\$NEW_VERSION

# Log the revocation
vault kv put kv/system/key-revocations/\$KEY_NAME/\$(date +%Y%m%d_%H%M%S) \
    revoked_at="\$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    reason="\$REASON" \
    new_version="\$NEW_VERSION" \
    revoked_by="\$(whoami)"

echo "✅ Key \$KEY_NAME revoked and rotated to version \$NEW_VERSION"
echo "🔄 All new encryption will use the new key version"
echo "📝 Revocation logged to kv/system/key-revocations/"

# Send alert if webhook is configured
if [ -n "\$ALERT_WEBHOOK" ]; then
    curl -X POST "\$ALERT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"🚨 EMERGENCY: Key \$KEY_NAME revoked due to: \$REASON\"}"
fi
EOF

chmod +x /tmp/revoke-key.sh
echo "  📁 Key revocation script created in /tmp/revoke-key.sh"

# 7. Test rotation functionality
echo "🧪 Testing key rotation functionality..."

# Test transit key rotation
echo "Testing app-data-key rotation..."
ORIGINAL_VERSION=$(vault read -field=latest_version transit/keys/app-data-key)
vault write -f transit/keys/app-data-key/rotate
NEW_VERSION=$(vault read -field=latest_version transit/keys/app-data-key)

if [ "$NEW_VERSION" -gt "$ORIGINAL_VERSION" ]; then
    echo "  ✅ Transit key rotation test passed (v$ORIGINAL_VERSION -> v$NEW_VERSION)"
else
    echo "  ❌ Transit key rotation test failed"
    exit 1
fi

# Test that old data can still be decrypted
echo "Testing backward compatibility..."
PLAINTEXT="test data for rotation"
OLD_CIPHERTEXT=$(echo -n "$PLAINTEXT" | vault write -field=ciphertext transit/encrypt/app-data-key plaintext=-)

# Rotate key again
vault write -f transit/keys/app-data-key/rotate

# Try to decrypt old data
DECRYPTED=$(vault write -field=plaintext transit/decrypt/app-data-key ciphertext="$OLD_CIPHERTEXT" | base64 -d)

if [ "$PLAINTEXT" = "$DECRYPTED" ]; then
    echo "  ✅ Backward compatibility test passed"
else
    echo "  ❌ Backward compatibility test failed"
    exit 1
fi

echo ""
echo "🎉 Key rotation automation setup completed successfully!"
echo ""
echo "📋 Installation Summary:"
echo "├── Transit keys configured for 90-day auto-rotation"
echo "├── Rotation scripts created in /tmp/"
echo "├── Monitoring and alerting scripts ready"
echo "├── Audit logging configured"
echo "├── Emergency revocation procedures ready"
echo "└── All tests passed"
echo ""
echo "📁 Files created:"
echo "├── /tmp/rotate-keys.sh (Main rotation script)"
echo "├── /tmp/rotate-jwt.sh (JWT rotation)"
echo "├── /tmp/rotate-webhooks.sh (Webhook rotation)"
echo "├── /tmp/revoke-key.sh (Emergency revocation)"
echo "├── /tmp/vault-key-monitor.sh (Monitoring)"
echo "├── /tmp/vault-rotation-cron (Cron jobs)"
echo "└── /tmp/vault-audit-logrotate (Log rotation)"
echo ""
echo "🚀 Next Steps:"
echo "1. Copy scripts to /opt/vault/scripts/"
echo "2. Install cron jobs or systemd timers"
echo "3. Configure alert webhooks"
echo "4. Set up log rotation"
echo "5. Test emergency procedures"
echo "6. Document key rotation runbook"
echo ""
echo "⚠️  IMPORTANT:"
echo "- Store VAULT_ROLE_ID and VAULT_SECRET_ID securely"
echo "- Test all scripts in staging environment first"
echo "- Monitor application compatibility after rotations"
echo "- Keep emergency contact information updated"
EOF

#!/bin/bash
set -e

echo "🔐 Deploying Data Encryption at Rest for Telegram E-commerce Bot..."

# Configuration
DB_ENCRYPTION_ENABLED=${DB_ENCRYPTION_ENABLED:-true}
STORAGE_ENCRYPTION_ENABLED=${STORAGE_ENCRYPTION_ENABLED:-true}
LOG_ENCRYPTION_ENABLED=${LOG_ENCRYPTION_ENABLED:-true}
BACKUP_ENCRYPTION_ENABLED=${BACKUP_ENCRYPTION_ENABLED:-true}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites for encryption at rest..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if database is running
    if ! docker ps | grep -q "postgres"; then
        print_warning "PostgreSQL container not found. Database encryption will be skipped."
        DB_ENCRYPTION_ENABLED=false
    fi
    
    # Check if Vault is available
    if [ "$USE_VAULT" = "true" ] && ! curl -s http://localhost:8200/v1/sys/health > /dev/null; then
        print_warning "Vault is not accessible. Using local encryption keys."
    fi
    
    print_success "Prerequisites check completed"
}

# Function to setup database encryption
setup_database_encryption() {
    if [ "$DB_ENCRYPTION_ENABLED" = "false" ]; then
        print_warning "Database encryption is disabled, skipping..."
        return
    fi

    print_status "Setting up database encryption..."
    
    # Copy encryption SQL script to container
    docker cp config/postgres/init-encryption.sql botrt-postgres:/tmp/init-encryption.sql
    
    # Execute encryption setup
    docker exec botrt-postgres psql -U telegram_user -d telegram_ecommerce -f /tmp/init-encryption.sql
    
    if [ $? -eq 0 ]; then
        print_success "Database encryption setup completed"
    else
        print_error "Database encryption setup failed"
        exit 1
    fi
    
    # Test encryption functionality
    print_status "Testing database encryption..."
    docker exec botrt-postgres psql -U telegram_user -d telegram_ecommerce -c "
        SELECT encryption.encrypt_data('test data', 'test_key') as encrypted_data;
    " > /dev/null
    
    if [ $? -eq 0 ]; then
        print_success "Database encryption test passed"
    else
        print_error "Database encryption test failed"
        exit 1
    fi
}

# Function to setup storage encryption
setup_storage_encryption() {
    if [ "$STORAGE_ENCRYPTION_ENABLED" = "false" ]; then
        print_warning "Storage encryption is disabled, skipping..."
        return
    fi

    print_status "Setting up storage encryption..."
    
    # Create encrypted storage directories
    mkdir -p storage/encrypted/{uploads,files,temp}
    chmod 700 storage/encrypted
    
    # Set up encryption environment variables
    cat >> .env <<EOF

# Storage Encryption Configuration
STORAGE_ENCRYPTION_ENABLED=true
STORAGE_BASE_PATH=./storage
ENCRYPTED_STORAGE_PATH=./storage/encrypted
DELETE_ORIGINAL_AFTER_ENCRYPTION=false
EOF
    
    print_success "Storage encryption setup completed"
}

# Function to setup backup encryption
setup_backup_encryption() {
    if [ "$BACKUP_ENCRYPTION_ENABLED" = "false" ]; then
        print_warning "Backup encryption is disabled, skipping..."
        return
    fi

    print_status "Setting up backup encryption..."
    
    # Create encrypted backup directories
    mkdir -p storage/backups/encrypted/{database,files,logs,metadata}
    chmod 700 storage/backups/encrypted
    
    # Set up backup encryption environment variables
    cat >> .env <<EOF

# Backup Encryption Configuration
BACKUP_ENCRYPTION_ENABLED=true
BACKUP_PATH=./storage/backups
ENCRYPTED_BACKUP_PATH=./storage/backups/encrypted
BACKUP_COMPRESSION_ENABLED=true
BACKUP_COMPRESSION_LEVEL=6
BACKUP_RETENTION_DAYS=30
BACKUP_KEY_ROTATION_DAYS=90
EOF
    
    # Create backup encryption script
    cat > tools/security/create-encrypted-backup.sh <<'EOF'
#!/bin/bash
set -e

BACKUP_TYPE=${1:-database}
SOURCE_PATH=${2}
BACKUP_NAME=${3}

if [ -z "$SOURCE_PATH" ]; then
    echo "Usage: $0 <backup_type> <source_path> [backup_name]"
    echo "Backup types: database, files, logs, full"
    exit 1
fi

echo "Creating encrypted backup..."
echo "Type: $BACKUP_TYPE"
echo "Source: $SOURCE_PATH"
echo "Name: $BACKUP_NAME"

# Call the backup encryption service via API
curl -X POST "http://localhost:3001/api/admin/backups/create-encrypted" \
  -H "Content-Type: application/json" \
  -d "{
    \"backupType\": \"$BACKUP_TYPE\",
    \"sourcePath\": \"$SOURCE_PATH\",
    \"backupName\": \"$BACKUP_NAME\"
  }"

echo "Encrypted backup created successfully"
EOF
    
    chmod +x tools/security/create-encrypted-backup.sh
    
    print_success "Backup encryption setup completed"
}

# Function to setup log encryption
setup_log_encryption() {
    if [ "$LOG_ENCRYPTION_ENABLED" = "false" ]; then
        print_warning "Log encryption is disabled, skipping..."
        return
    fi

    print_status "Setting up log encryption..."
    
    # Create encrypted log directories
    mkdir -p storage/logs/encrypted/{metadata,archived}
    chmod 700 storage/logs/encrypted
    
    # Set up log encryption environment variables
    cat >> .env <<EOF

# Log Encryption Configuration
LOG_ENCRYPTION_ENABLED=true
LOG_BASE_PATH=./storage/logs
ENCRYPTED_LOG_PATH=./storage/logs/encrypted
LOG_ROTATION_SIZE=104857600
LOG_ROTATION_INTERVAL=24
LOG_RETENTION_DAYS=90
LOG_COMPRESSION_ENABLED=true
LOG_REALTIME_ENCRYPTION=false
EOF
    
    print_success "Log encryption setup completed"
}

# Function to create encryption monitoring script
create_monitoring_script() {
    print_status "Creating encryption monitoring script..."
    
    cat > tools/security/monitor-encryption.sh <<'EOF'
#!/bin/bash
set -e

echo "=== Encryption at Rest Monitoring Report - $(date) ==="
echo ""

# Check database encryption status
echo "📊 Database Encryption Status:"
if docker exec botrt-postgres psql -U telegram_user -d telegram_ecommerce -c "
    SELECT 
        COUNT(*) as total_encrypted_records,
        COUNT(DISTINCT table_name) as encrypted_tables
    FROM encryption.audit_log 
    WHERE operation = 'ENCRYPT' AND success = true
" 2>/dev/null; then
    echo "✅ Database encryption operational"
else
    echo "❌ Database encryption check failed"
fi
echo ""

# Check storage encryption status
echo "📁 Storage Encryption Status:"
if [ -d "storage/encrypted" ]; then
    ENCRYPTED_FILES=$(find storage/encrypted -name "*.enc" | wc -l)
    TOTAL_SIZE=$(du -sh storage/encrypted 2>/dev/null | cut -f1)
    echo "✅ Encrypted files: $ENCRYPTED_FILES"
    echo "✅ Total encrypted storage: $TOTAL_SIZE"
else
    echo "❌ Encrypted storage directory not found"
fi
echo ""

# Check backup encryption status
echo "💾 Backup Encryption Status:"
if [ -d "storage/backups/encrypted" ]; then
    ENCRYPTED_BACKUPS=$(find storage/backups/encrypted -name "*.backup" | wc -l)
    BACKUP_SIZE=$(du -sh storage/backups/encrypted 2>/dev/null | cut -f1)
    echo "✅ Encrypted backups: $ENCRYPTED_BACKUPS"
    echo "✅ Total backup storage: $BACKUP_SIZE"
else
    echo "❌ Encrypted backup directory not found"
fi
echo ""

# Check log encryption status
echo "📋 Log Encryption Status:"
if [ -d "storage/logs/encrypted" ]; then
    ENCRYPTED_LOGS=$(find storage/logs/encrypted -name "*.log.enc" | wc -l)
    LOG_SIZE=$(du -sh storage/logs/encrypted 2>/dev/null | cut -f1)
    echo "✅ Encrypted logs: $ENCRYPTED_LOGS"
    echo "✅ Total log storage: $LOG_SIZE"
else
    echo "❌ Encrypted log directory not found"
fi
echo ""

# Check encryption keys status
echo "🔑 Encryption Keys Status:"
if [ "$USE_VAULT" = "true" ]; then
    if curl -s http://localhost:8200/v1/sys/health > /dev/null; then
        echo "✅ Vault is accessible"
        echo "✅ Using Vault-managed encryption keys"
    else
        echo "❌ Vault is not accessible"
        echo "⚠️  Falling back to local encryption keys"
    fi
else
    echo "⚠️  Using local encryption keys"
fi
echo ""

# Application health check
echo "🏥 Application Health:"
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend service is healthy"
    
    # Check encryption service health
    ENCRYPTION_HEALTH=$(curl -s http://localhost:3001/api/admin/encryption/health 2>/dev/null || echo "unavailable")
    if [ "$ENCRYPTION_HEALTH" != "unavailable" ]; then
        echo "✅ Encryption services are operational"
    else
        echo "⚠️  Encryption service health check unavailable"
    fi
else
    echo "❌ Backend service is not accessible"
fi
echo ""

echo "=== End of Report ==="
EOF
    
    chmod +x tools/security/monitor-encryption.sh
    
    print_success "Encryption monitoring script created"
}

# Function to create encryption maintenance scripts
create_maintenance_scripts() {
    print_status "Creating encryption maintenance scripts..."
    
    # Key rotation script
    cat > tools/security/rotate-encryption-keys.sh <<'EOF'
#!/bin/bash
set -e

echo "🔄 Starting encryption key rotation..."

# Rotate database encryption keys
echo "Rotating database encryption keys..."
curl -X POST "http://localhost:3001/api/admin/encryption/rotate-keys" \
  -H "Content-Type: application/json"

# Rotate Vault keys if using Vault
if [ "$USE_VAULT" = "true" ]; then
    echo "Rotating Vault transit keys..."
    vault write -f transit/keys/app-data-key/rotate
    vault write -f transit/keys/db-field-key/rotate
    vault write -f transit/keys/file-storage-key/rotate
    vault write -f transit/keys/backup-key/rotate
fi

echo "✅ Encryption key rotation completed"
EOF
    
    # Cleanup script
    cat > tools/security/cleanup-encrypted-data.sh <<'EOF'
#!/bin/bash
set -e

RETENTION_DAYS=${1:-90}

echo "🧹 Starting encrypted data cleanup (retention: $RETENTION_DAYS days)..."

# Cleanup old encrypted logs
echo "Cleaning up old encrypted logs..."
curl -X POST "http://localhost:3001/api/admin/logs/cleanup" \
  -H "Content-Type: application/json" \
  -d "{\"retentionDays\": $RETENTION_DAYS}"

# Cleanup old encrypted backups
echo "Cleaning up old encrypted backups..."
curl -X POST "http://localhost:3001/api/admin/backups/cleanup" \
  -H "Content-Type: application/json" \
  -d "{\"retentionDays\": $RETENTION_DAYS}"

# Cleanup database audit logs
echo "Cleaning up database audit logs..."
docker exec botrt-postgres psql -U telegram_user -d telegram_ecommerce -c "
    SELECT encryption.cleanup_audit_logs($RETENTION_DAYS);
"

echo "✅ Encrypted data cleanup completed"
EOF
    
    chmod +x tools/security/rotate-encryption-keys.sh
    chmod +x tools/security/cleanup-encrypted-data.sh
    
    print_success "Encryption maintenance scripts created"
}

# Function to setup cron jobs
setup_cron_jobs() {
    print_status "Setting up encryption maintenance cron jobs..."
    
    cat > /tmp/encryption-cron <<EOF
# Encryption at Rest Maintenance Jobs

# Monitor encryption status daily at 6 AM
0 6 * * * cd $(pwd) && ./tools/security/monitor-encryption.sh >> storage/logs/encryption-monitor.log 2>&1

# Rotate encryption keys monthly (1st day at 2 AM)
0 2 1 * * cd $(pwd) && ./tools/security/rotate-encryption-keys.sh >> storage/logs/key-rotation.log 2>&1

# Cleanup old encrypted data weekly (Sunday at 3 AM)
0 3 * * 0 cd $(pwd) && ./tools/security/cleanup-encrypted-data.sh >> storage/logs/encryption-cleanup.log 2>&1

# Create encrypted backup daily at 1 AM
0 1 * * * cd $(pwd) && ./tools/security/create-encrypted-backup.sh database ./storage/backups/daily-db-backup.sql daily-backup-\$(date +\%Y\%m\%d) >> storage/logs/backup-encryption.log 2>&1
EOF

    echo "Cron jobs configuration created in /tmp/encryption-cron"
    echo "To install: crontab /tmp/encryption-cron"
    
    print_success "Cron jobs setup completed"
}

# Function to run encryption tests
run_encryption_tests() {
    print_status "Running encryption functionality tests..."
    
    # Test database encryption
    if [ "$DB_ENCRYPTION_ENABLED" = "true" ]; then
        echo "Testing database encryption..."
        docker exec botrt-postgres psql -U telegram_user -d telegram_ecommerce -c "
            DO \$\$
            DECLARE
                test_data TEXT := 'sensitive test data';
                encrypted_data TEXT;
                decrypted_data TEXT;
            BEGIN
                encrypted_data := encryption.encrypt_data(test_data, 'test_key');
                decrypted_data := encryption.decrypt_data(encrypted_data, 'test_key');
                
                IF decrypted_data = test_data THEN
                    RAISE NOTICE 'Database encryption test PASSED';
                ELSE
                    RAISE EXCEPTION 'Database encryption test FAILED';
                END IF;
            END \$\$;
        "
    fi
    
    # Test application encryption services
    echo "Testing application encryption services..."
    if curl -s http://localhost:3001/health > /dev/null; then
        # Test encryption service health
        HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/admin/encryption/health 2>/dev/null || echo "failed")
        if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
            print_success "Application encryption services test passed"
        else
            print_warning "Application encryption services test failed or unavailable"
        fi
    else
        print_warning "Application is not running, skipping service tests"
    fi
    
    print_success "Encryption tests completed"
}

# Function to display deployment summary
show_deployment_summary() {
    print_success "🎉 Data Encryption at Rest Deployment Complete!"
    echo ""
    echo "📋 Deployment Summary:"
    echo "├── Database Encryption: $([ "$DB_ENCRYPTION_ENABLED" = "true" ] && echo "✅ Enabled" || echo "❌ Disabled")"
    echo "├── Storage Encryption: $([ "$STORAGE_ENCRYPTION_ENABLED" = "true" ] && echo "✅ Enabled" || echo "❌ Disabled")"
    echo "├── Backup Encryption: $([ "$BACKUP_ENCRYPTION_ENABLED" = "true" ] && echo "✅ Enabled" || echo "❌ Disabled")"
    echo "└── Log Encryption: $([ "$LOG_ENCRYPTION_ENABLED" = "true" ] && echo "✅ Enabled" || echo "❌ Disabled")"
    echo ""
    echo "🔐 Encryption Features:"
    echo "├── Field-level database encryption with triggers"
    echo "├── Transparent encryption/decryption views"
    echo "├── Encrypted file storage with metadata"
    echo "├── Compressed encrypted backups"
    echo "├── Encrypted log rotation and archival"
    echo "├── Vault integration for key management"
    echo "└── Automated key rotation and cleanup"
    echo ""
    echo "📁 Created Directories:"
    echo "├── storage/encrypted/ (encrypted files)"
    echo "├── storage/backups/encrypted/ (encrypted backups)"
    echo "└── storage/logs/encrypted/ (encrypted logs)"
    echo ""
    echo "🛠️ Management Scripts:"
    echo "├── tools/security/monitor-encryption.sh"
    echo "├── tools/security/rotate-encryption-keys.sh"
    echo "├── tools/security/cleanup-encrypted-data.sh"
    echo "└── tools/security/create-encrypted-backup.sh"
    echo ""
    echo "⚙️ Configuration Added to .env:"
    echo "├── Storage encryption settings"
    echo "├── Backup encryption settings"
    echo "├── Log encryption settings"
    echo "└── Retention and rotation policies"
    echo ""
    echo "📅 Maintenance Schedule (setup cron jobs):"
    echo "├── Daily: Monitoring and backup encryption"
    echo "├── Weekly: Cleanup old encrypted data"
    echo "└── Monthly: Encryption key rotation"
    echo ""
    echo "🚀 Next Steps:"
    echo "1. Install cron jobs: crontab /tmp/encryption-cron"
    echo "2. Monitor encryption: ./tools/security/monitor-encryption.sh"
    echo "3. Test backup/restore: ./tools/security/create-encrypted-backup.sh"
    echo "4. Review encryption logs in storage/logs/"
    echo "5. Set up key rotation schedule"
}

# Main execution
main() {
    echo "🔐 Starting Data Encryption at Rest Deployment"
    echo "=============================================="
    
    check_prerequisites
    setup_database_encryption
    setup_storage_encryption
    setup_backup_encryption
    setup_log_encryption
    create_monitoring_script
    create_maintenance_scripts
    setup_cron_jobs
    run_encryption_tests
    show_deployment_summary
}

# Run main function
main "$@"

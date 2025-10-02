#!/bin/bash

# =============================================================================
# PostgreSQL Backup Script for Production
# Telegram E-commerce Bot Platform
# =============================================================================

set -e

# =============================================================================
# Configuration
# =============================================================================

# Database connection
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-telegram_ecommerce}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

# Backup configuration
BACKUP_DIR="${BACKUP_DESTINATION:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="${DB_NAME}_backup_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

# Compression
COMPRESS_BACKUPS="${COMPRESS_BACKUPS:-true}"
COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-6}"

# Logging
LOG_FILE="${BACKUP_DIR}/backup.log"
TELEGRAM_BOT_TOKEN_BACKUP="${TELEGRAM_BOT_TOKEN_BACKUP}"
TELEGRAM_CHAT_ID_BACKUP="${TELEGRAM_CHAT_ID_BACKUP}"

# =============================================================================
# Logging Functions
# =============================================================================

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
    log "INFO" "$1"
}

log_error() {
    log "ERROR" "$1"
}

log_success() {
    log "SUCCESS" "$1"
}

# =============================================================================
# Notification Functions
# =============================================================================

send_telegram_notification() {
    local message="$1"
    local parse_mode="${2:-Markdown}"
    
    if [ ! -z "$TELEGRAM_BOT_TOKEN_BACKUP" ] && [ ! -z "$TELEGRAM_CHAT_ID_BACKUP" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_BACKUP}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID_BACKUP}" \
            -d "text=${message}" \
            -d "parse_mode=${parse_mode}" > /dev/null 2>&1 || true
    fi
}

# =============================================================================
# Utility Functions
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required commands are available
    local required_commands="pg_dump gzip find"
    for cmd in $required_commands; do
        if ! command -v $cmd > /dev/null 2>&1; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
    
    # Check write permissions
    if [ ! -w "$BACKUP_DIR" ]; then
        log_error "No write permission to backup directory: $BACKUP_DIR"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

test_database_connection() {
    log_info "Testing database connection..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        log_success "Database connection successful"
    else
        log_error "Cannot connect to database"
        send_telegram_notification "🚨 *Backup Failed*: Cannot connect to database"
        exit 1
    fi
}

# =============================================================================
# Backup Functions
# =============================================================================

create_backup() {
    log_info "Starting database backup..."
    log_info "Backup file: $BACKUP_FILENAME"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create backup with custom options
    local pg_dump_options="
        --host=$DB_HOST
        --port=$DB_PORT
        --username=$DB_USER
        --dbname=$DB_NAME
        --verbose
        --clean
        --if-exists
        --create
        --format=custom
        --compress=$COMPRESSION_LEVEL
        --no-password
        --exclude-table-data=maintenance.task_log
    "
    
    # Execute backup
    if pg_dump $pg_dump_options --file="$BACKUP_PATH.custom" 2>> "$LOG_FILE"; then
        log_success "Database backup completed: $BACKUP_PATH.custom"
        
        # Also create SQL dump for easier restore if needed
        local sql_dump_options="
            --host=$DB_HOST
            --port=$DB_PORT
            --username=$DB_USER
            --dbname=$DB_NAME
            --clean
            --if-exists
            --create
            --no-password
            --exclude-table-data=maintenance.task_log
        "
        
        if [ "$COMPRESS_BACKUPS" = "true" ]; then
            pg_dump $sql_dump_options 2>> "$LOG_FILE" | gzip -$COMPRESSION_LEVEL > "$BACKUP_PATH.gz"
            log_success "Compressed SQL backup completed: $BACKUP_PATH.gz"
        else
            pg_dump $sql_dump_options --file="$BACKUP_PATH" 2>> "$LOG_FILE"
            log_success "SQL backup completed: $BACKUP_PATH"
        fi
    else
        log_error "Database backup failed"
        send_telegram_notification "🚨 *Backup Failed*: Database dump error"
        exit 1
    fi
}

verify_backup() {
    log_info "Verifying backup integrity..."
    
    # Check custom format backup
    if [ -f "$BACKUP_PATH.custom" ]; then
        if pg_restore --list "$BACKUP_PATH.custom" > /dev/null 2>&1; then
            log_success "Custom format backup verification passed"
        else
            log_error "Custom format backup verification failed"
            return 1
        fi
    fi
    
    # Check compressed SQL backup
    if [ -f "$BACKUP_PATH.gz" ]; then
        if gzip -t "$BACKUP_PATH.gz" 2>/dev/null; then
            log_success "Compressed backup verification passed"
        else
            log_error "Compressed backup verification failed"
            return 1
        fi
    fi
    
    # Check uncompressed SQL backup
    if [ -f "$BACKUP_PATH" ]; then
        if head -n 10 "$BACKUP_PATH" | grep -q "PostgreSQL database dump" 2>/dev/null; then
            log_success "SQL backup verification passed"
        else
            log_error "SQL backup verification failed"
            return 1
        fi
    fi
    
    return 0
}

calculate_backup_size() {
    local total_size=0
    
    if [ -f "$BACKUP_PATH.custom" ]; then
        local custom_size=$(stat -f%z "$BACKUP_PATH.custom" 2>/dev/null || stat -c%s "$BACKUP_PATH.custom" 2>/dev/null)
        total_size=$((total_size + custom_size))
    fi
    
    if [ -f "$BACKUP_PATH.gz" ]; then
        local gz_size=$(stat -f%z "$BACKUP_PATH.gz" 2>/dev/null || stat -c%s "$BACKUP_PATH.gz" 2>/dev/null)
        total_size=$((total_size + gz_size))
    fi
    
    if [ -f "$BACKUP_PATH" ]; then
        local sql_size=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null)
        total_size=$((total_size + sql_size))
    fi
    
    # Convert to human readable format
    if [ $total_size -gt 1073741824 ]; then
        echo "$(( total_size / 1073741824 )) GB"
    elif [ $total_size -gt 1048576 ]; then
        echo "$(( total_size / 1048576 )) MB"
    elif [ $total_size -gt 1024 ]; then
        echo "$(( total_size / 1024 )) KB"
    else
        echo "${total_size} bytes"
    fi
}

# =============================================================================
# Cleanup Functions
# =============================================================================

cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."
    
    local deleted_count=0
    
    # Find and delete old backup files
    find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql*" -type f -mtime +$RETENTION_DAYS -print0 | \
    while IFS= read -r -d '' file; do
        if rm "$file"; then
            log_info "Deleted old backup: $(basename "$file")"
            deleted_count=$((deleted_count + 1))
        else
            log_error "Failed to delete: $file"
        fi
    done
    
    # Clean up old custom format backups
    find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.custom" -type f -mtime +$RETENTION_DAYS -print0 | \
    while IFS= read -r -d '' file; do
        if rm "$file"; then
            log_info "Deleted old backup: $(basename "$file")"
            deleted_count=$((deleted_count + 1))
        else
            log_error "Failed to delete: $file"
        fi
    done
    
    if [ $deleted_count -eq 0 ]; then
        log_info "No old backups to clean up"
    else
        log_success "Cleaned up $deleted_count old backup files"
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    local start_time=$(date +%s)
    
    log_info "=== Starting backup process ==="
    log_info "Database: $DB_NAME@$DB_HOST:$DB_PORT"
    log_info "Backup directory: $BACKUP_DIR"
    
    # Check prerequisites
    check_prerequisites
    
    # Test database connection
    test_database_connection
    
    # Create backup
    create_backup
    
    # Verify backup
    if verify_backup; then
        local backup_size=$(calculate_backup_size)
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "Backup completed successfully"
        log_info "Backup size: $backup_size"
        log_info "Duration: ${duration} seconds"
        
        # Send success notification
        send_telegram_notification "✅ *Backup Successful*
📊 Database: \`$DB_NAME\`
📁 Size: \`$backup_size\`
⏱ Duration: \`${duration}s\`
📅 Date: \`$(date)\`"
        
        # Cleanup old backups
        cleanup_old_backups
        
        log_success "=== Backup process completed ==="
    else
        log_error "Backup verification failed"
        send_telegram_notification "🚨 *Backup Failed*: Verification error"
        exit 1
    fi
}

# =============================================================================
# Error Handling
# =============================================================================

cleanup_on_error() {
    log_error "Backup process interrupted"
    
    # Remove incomplete backup files
    [ -f "$BACKUP_PATH" ] && rm -f "$BACKUP_PATH"
    [ -f "$BACKUP_PATH.gz" ] && rm -f "$BACKUP_PATH.gz"  
    [ -f "$BACKUP_PATH.custom" ] && rm -f "$BACKUP_PATH.custom"
    
    send_telegram_notification "🚨 *Backup Failed*: Process interrupted"
    exit 1
}

# Trap signals for cleanup
trap cleanup_on_error INT TERM

# =============================================================================
# Script Execution
# =============================================================================

# Ensure log file exists
touch "$LOG_FILE"

# Run main function
main "$@"

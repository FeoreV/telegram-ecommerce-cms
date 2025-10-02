#!/bin/bash

# =============================================================================
# Security Secrets Generator for Production Deployment
# Generates strong passwords and secrets for secure production setup
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SECRETS_FILE=".env.production"
BACKUP_FILE=".env.production.backup.$(date +%Y%m%d_%H%M%S)"

# =============================================================================
# Utility Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Generate secure random string
generate_secret() {
    local length=${1:-64}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Generate secure password with special characters
generate_password() {
    local length=${1:-32}
    local chars="A-Za-z0-9!@#$%^&*()_+-=[]{}|;:,.<>?"
    LC_ALL=C tr -dc "$chars" < /dev/urandom | head -c $length
}

# Generate alphanumeric password (for services that don't support special chars)
generate_alphanumeric() {
    local length=${1:-32}
    LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c $length
}

# Generate UUID
generate_uuid() {
    if command -v uuidgen > /dev/null 2>&1; then
        uuidgen
    else
        python3 -c "import uuid; print(uuid.uuid4())"
    fi
}

# =============================================================================
# Security Configuration Generation
# =============================================================================

generate_jwt_secrets() {
    log_info "Generating JWT secrets..."
    
    JWT_SECRET=$(generate_secret 128)
    JWT_REFRESH_SECRET=$(generate_secret 128)
    
    echo "# JWT Configuration"
    echo "JWT_SECRET=$JWT_SECRET"
    echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
    echo "JWT_ACCESS_TOKEN_EXPIRES_IN=15m"
    echo "JWT_REFRESH_TOKEN_EXPIRES_IN=7d"
    echo ""
}

generate_database_secrets() {
    log_info "Generating database credentials..."
    
    POSTGRES_PASSWORD=$(generate_password 32)
    REDIS_PASSWORD=$(generate_alphanumeric 32)
    
    echo "# Database Configuration"
    echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
    echo "DATABASE_URL=postgresql://postgres:$POSTGRES_PASSWORD@postgres:5432/telegram_ecommerce"
    echo ""
    echo "# Redis Configuration"  
    echo "REDIS_PASSWORD=$REDIS_PASSWORD"
    echo "REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379"
    echo ""
}

generate_session_secrets() {
    log_info "Generating session secrets..."
    
    SESSION_SECRET=$(generate_secret 64)
    COOKIE_SECRET=$(generate_secret 64)
    
    echo "# Session Configuration"
    echo "SESSION_SECRET=$SESSION_SECRET"
    echo "COOKIE_SECRET=$COOKIE_SECRET"
    echo ""
}

generate_encryption_secrets() {
    log_info "Generating encryption keys..."
    
    ENCRYPTION_KEY=$(generate_secret 32)
    BACKUP_ENCRYPTION_KEY=$(generate_secret 32)
    WEBHOOK_SECRET=$(generate_alphanumeric 32)
    
    echo "# Encryption Configuration"
    echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
    echo "BACKUP_ENCRYPTION_KEY=$BACKUP_ENCRYPTION_KEY"
    echo "WEBHOOK_SECRET=$WEBHOOK_SECRET"
    echo ""
}

generate_monitoring_secrets() {
    log_info "Generating monitoring credentials..."
    
    GRAFANA_ADMIN_PASSWORD=$(generate_password 20)
    PROMETHEUS_PASSWORD=$(generate_password 20)
    ELASTIC_PASSWORD=$(generate_password 20)
    
    echo "# Monitoring Configuration"
    echo "GRAFANA_ADMIN_PASSWORD=$GRAFANA_ADMIN_PASSWORD"
    echo "PROMETHEUS_PASSWORD=$PROMETHEUS_PASSWORD"
    echo "ELASTIC_PASSWORD=$ELASTIC_PASSWORD"
    echo ""
}

generate_api_keys() {
    log_info "Generating API keys..."
    
    ADMIN_API_KEY=$(generate_uuid)
    WEBHOOK_ADMIN_TOKEN=$(generate_secret 48)
    METRICS_API_KEY=$(generate_alphanumeric 32)
    
    echo "# API Keys Configuration"
    echo "ADMIN_API_KEY=$ADMIN_API_KEY"
    echo "WEBHOOK_ADMIN_TOKEN=$WEBHOOK_ADMIN_TOKEN" 
    echo "METRICS_API_KEY=$METRICS_API_KEY"
    echo ""
}

generate_security_tokens() {
    log_info "Generating security tokens..."
    
    CSRF_TOKEN=$(generate_secret 32)
    RATE_LIMIT_SECRET=$(generate_secret 32)
    
    echo "# Security Tokens"
    echo "CSRF_TOKEN=$CSRF_TOKEN"
    echo "RATE_LIMIT_SECRET=$RATE_LIMIT_SECRET"
    echo ""
}

# =============================================================================
# Main Generation Function
# =============================================================================

generate_all_secrets() {
    log_info "=== GENERATING PRODUCTION SECRETS ==="
    
    # Create temporary file with all secrets
    local temp_file=$(mktemp)
    
    {
        echo "# ============================================================================="
        echo "# PRODUCTION ENVIRONMENT CONFIGURATION"
        echo "# Generated on: $(date)"
        echo "# WARNING: Keep this file secure and never commit to version control!"
        echo "# ============================================================================="
        echo ""
        
        generate_jwt_secrets
        generate_database_secrets
        generate_session_secrets
        generate_encryption_secrets
        generate_monitoring_secrets
        generate_api_keys
        generate_security_tokens
        
        echo "# ============================================================================="
        echo "# STATIC CONFIGURATION (manually configure these)"
        echo "# ============================================================================="
        echo ""
        echo "# Node Environment"
        echo "NODE_ENV=production"
        echo ""
        echo "# Domain Configuration"
        echo "FRONTEND_URL=https://yourdomain.com"
        echo "API_URL=https://yourdomain.com/api"
        echo "WEBHOOK_BASE_URL=https://bot-webhook.yourdomain.com"
        echo ""
        echo "# Telegram Bot (get from @BotFather)"
        echo "TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather"
        echo ""
        echo "# CORS Configuration"
        echo "CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com"
        echo "CORS_CREDENTIALS=true"
        echo ""
        echo "# SSL Configuration"
        echo "USE_HTTPS=true"
        echo "SSL_CERT_PATH=/etc/nginx/ssl/certificate.crt"
        echo "SSL_KEY_PATH=/etc/nginx/ssl/private.key"
        echo ""
        echo "# Email Configuration (configure for notifications)"
        echo "SMTP_HOST=smtp.gmail.com"
        echo "SMTP_PORT=587"
        echo "SMTP_SECURE=true"
        echo "SMTP_USER=notifications@yourdomain.com"
        echo "SMTP_PASS=your_email_app_password"
        echo "EMAIL_FROM=notifications@yourdomain.com"
        echo ""
        echo "# Feature Flags"
        echo "ENABLE_ADMINJS=false"
        echo "ENABLE_WEBHOOK_MODE=true"
        echo "ENABLE_RATE_LIMITING=true"
        echo "ENABLE_AUDIT_LOGGING=true"
        echo "ENABLE_PERFORMANCE_MONITORING=true"
        echo ""
        echo "# Logging Configuration"
        echo "LOG_LEVEL=info"
        echo "ENABLE_JSON_LOGS=true"
        echo "LOG_REQUESTS=true"
        echo "LOG_ERRORS=true"
        echo ""
        echo "# Backup Configuration"
        echo "BACKUP_SCHEDULE=\"0 2 * * *\""
        echo "BACKUP_RETENTION_DAYS=30"
        
    } > "$temp_file"
    
    return 0
}

# =============================================================================
# Password Validation
# =============================================================================

validate_password_strength() {
    local password="$1"
    local min_length=12
    local issues=()
    
    # Check length
    if [ ${#password} -lt $min_length ]; then
        issues+=("Password too short (minimum $min_length characters)")
    fi
    
    # Check for uppercase
    if [[ ! "$password" =~ [A-Z] ]]; then
        issues+=("Missing uppercase letters")
    fi
    
    # Check for lowercase  
    if [[ ! "$password" =~ [a-z] ]]; then
        issues+=("Missing lowercase letters")
    fi
    
    # Check for numbers
    if [[ ! "$password" =~ [0-9] ]]; then
        issues+=("Missing numbers")
    fi
    
    # Check for special characters
    if [[ ! "$password" =~ [^A-Za-z0-9] ]]; then
        issues+=("Missing special characters")
    fi
    
    if [ ${#issues[@]} -eq 0 ]; then
        return 0
    else
        for issue in "${issues[@]}"; do
            log_warning "$issue"
        done
        return 1
    fi
}

# =============================================================================
# Security Recommendations
# =============================================================================

show_security_recommendations() {
    log_info "=== SECURITY RECOMMENDATIONS ==="
    echo ""
    log_warning "CRITICAL SECURITY STEPS:"
    echo "1. 🔐 Keep the generated .env.production file secure"
    echo "2. 🚫 Never commit secrets to version control"  
    echo "3. 🔄 Rotate secrets regularly (every 90 days)"
    echo "4. 👥 Limit access to production secrets"
    echo "5. 📝 Use proper secret management in production"
    echo ""
    log_info "Additional Security Measures:"
    echo "• Enable firewall (UFW/iptables)"
    echo "• Configure fail2ban for intrusion prevention"
    echo "• Use SSH keys instead of passwords"
    echo "• Enable 2FA for all admin accounts"
    echo "• Regular security updates"
    echo "• Monitor access logs"
    echo "• Backup encryption keys separately"
    echo ""
}

create_htpasswd_file() {
    log_info "Generating HTTP Basic Auth file for admin access..."
    
    local username="admin"
    local password=$(generate_password 16)
    local htpasswd_file="config/nginx/.htpasswd"
    
    # Create directory if it doesn't exist
    mkdir -p "$(dirname "$htpasswd_file")"
    
    # Generate htpasswd entry (requires htpasswd or openssl)
    if command -v htpasswd > /dev/null 2>&1; then
        echo "$password" | htpasswd -i -c "$htpasswd_file" "$username"
    else
        # Fallback using openssl
        local encrypted=$(openssl passwd -apr1 "$password")
        echo "$username:$encrypted" > "$htpasswd_file"
    fi
    
    chmod 600 "$htpasswd_file"
    
    echo ""
    log_success "HTTP Basic Auth credentials generated:"
    echo "Username: $username"
    echo "Password: $password"
    echo "File: $htpasswd_file"
    echo ""
    log_warning "Save these credentials securely!"
    
    # Add to secrets file
    echo "# HTTP Basic Auth" >> "$temp_file"
    echo "BASIC_AUTH_USERNAME=$username" >> "$temp_file"
    echo "BASIC_AUTH_PASSWORD=$password" >> "$temp_file"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    log_info "Production Security Secrets Generator"
    log_info "===================================="
    echo ""
    
    # Check prerequisites
    if ! command -v openssl > /dev/null 2>&1; then
        log_error "OpenSSL is required but not installed"
        exit 1
    fi
    
    # Backup existing file if it exists
    if [ -f "$SECRETS_FILE" ]; then
        log_warning "Backing up existing secrets file..."
        cp "$SECRETS_FILE" "$BACKUP_FILE"
        log_success "Backup created: $BACKUP_FILE"
    fi
    
    # Generate all secrets
    local temp_file
    temp_file=$(mktemp)
    
    # Generate secrets to temp file
    generate_all_secrets > "$temp_file"
    
    # Create HTTP basic auth
    create_htpasswd_file
    
    # Move temp file to final location
    mv "$temp_file" "$SECRETS_FILE"
    chmod 600 "$SECRETS_FILE"
    
    log_success "Production secrets generated successfully!"
    log_success "Secrets file: $SECRETS_FILE"
    echo ""
    
    # Show file preview
    log_info "Generated secrets preview (first 10 lines):"
    head -n 10 "$SECRETS_FILE"
    echo "..."
    echo ""
    
    # Show security recommendations
    show_security_recommendations
    
    # Final instructions
    log_info "NEXT STEPS:"
    echo "1. Review and customize the generated $SECRETS_FILE"
    echo "2. Set your Telegram bot token from @BotFather"
    echo "3. Update domain names to your actual domains"
    echo "4. Configure SMTP settings for email notifications"
    echo "5. Run deployment: ./scripts/deploy-production.sh"
    echo ""
    log_success "Setup completed successfully!"
}

# =============================================================================
# Script Arguments
# =============================================================================

# Check for help argument
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Generate secure secrets for production deployment"
    echo ""
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo "  --output FILE Set output file (default: .env.production)"
    echo ""
    echo "Example:"
    echo "  $0"
    echo "  $0 --output .env.staging"
    exit 0
fi

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output)
            SECRETS_FILE="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main

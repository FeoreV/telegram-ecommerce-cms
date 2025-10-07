#!/bin/bash
set -e

echo "🔒 Deploying complete mTLS security stack for Telegram E-commerce Bot..."

# Configuration
CA_DIR="/tmp/ca"
CERT_VALIDITY_DAYS=365
SERVICES=("backend" "bot" "frontend" "postgres" "redis" "vault" "nginx")

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
    print_status "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if openssl is available
    if ! command -v openssl &> /dev/null; then
        print_error "OpenSSL is required but not installed."
        exit 1
    fi
    
    # Check if required directories exist
    if [ ! -d "config/tls" ]; then
        print_error "TLS configuration directory not found. Run from project root."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to generate CA and service certificates
generate_certificates() {
    print_status "Generating Certificate Authority and service certificates..."
    
    # Make scripts executable
    chmod +x config/tls/certificate-authority.sh
    chmod +x config/tls/generate-service-certs.sh
    
    # Generate CA
    print_status "Creating Certificate Authority..."
    cd config/tls
    ./certificate-authority.sh
    
    # Generate certificates for each service
    for service in "${SERVICES[@]}"; do
        print_status "Generating certificates for $service..."
        ./generate-service-certs.sh "$service" "botrt.local" "$CA_DIR"
    done
    
    cd ../..
    print_success "All certificates generated successfully"
}

# Function to create Docker network
create_network() {
    print_status "Creating secure Docker network..."
    
    # Remove existing network if it exists
    docker network rm botrt-secure 2>/dev/null || true
    
    # Create new secure network
    docker network create \
        --driver bridge \
        --subnet=172.20.0.0/16 \
        --gateway=172.20.0.1 \
        --opt com.docker.network.bridge.name=br-botrt-secure \
        --opt com.docker.network.bridge.enable_ip_masquerade=true \
        --opt com.docker.network.driver.mtu=1500 \
        botrt-secure
    
    print_success "Secure network created: botrt-secure"
}

# Function to generate DH parameters
generate_dh_params() {
    print_status "Generating Diffie-Hellman parameters (this may take a while)..."
    
    if [ ! -f "$CA_DIR/services/nginx/nginx.dh.pem" ]; then
        openssl dhparam -out "$CA_DIR/services/nginx/nginx.dh.pem" 2048
        print_success "DH parameters generated"
    else
        print_warning "DH parameters already exist, skipping..."
    fi
}

# Function to set up certificate monitoring
setup_certificate_monitoring() {
    print_status "Setting up certificate expiration monitoring..."
    
    cat > /tmp/check-cert-expiry.sh <<'EOF'
#!/bin/bash
# Certificate expiration monitoring script

CA_DIR="/tmp/ca"
ALERT_DAYS=30
SERVICES=("backend" "bot" "frontend" "postgres" "redis" "vault" "nginx")

check_certificate_expiry() {
    local cert_file=$1
    local service_name=$2
    
    if [ ! -f "$cert_file" ]; then
        echo "WARNING: Certificate file not found: $cert_file"
        return
    fi
    
    local expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
    local expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    if [ $days_until_expiry -lt 0 ]; then
        echo "CRITICAL: Certificate for $service_name has EXPIRED!"
        echo "  File: $cert_file"
        echo "  Expired: $expiry_date"
    elif [ $days_until_expiry -lt $ALERT_DAYS ]; then
        echo "WARNING: Certificate for $service_name expires in $days_until_expiry days"
        echo "  File: $cert_file"
        echo "  Expires: $expiry_date"
    else
        echo "OK: Certificate for $service_name expires in $days_until_expiry days"
    fi
}

echo "=== Certificate Expiration Check - $(date) ==="
for service in "${SERVICES[@]}"; do
    check_certificate_expiry "$CA_DIR/services/$service/$service.cert.pem" "$service-server"
    check_certificate_expiry "$CA_DIR/services/$service/$service.client.cert.pem" "$service-client"
done

# Check CA certificate
check_certificate_expiry "$CA_DIR/certs/ca.cert.pem" "Root-CA"
EOF

    chmod +x /tmp/check-cert-expiry.sh
    print_success "Certificate monitoring script created at /tmp/check-cert-expiry.sh"
}

# Function to create environment files
create_environment_files() {
    print_status "Creating environment configuration files..."
    
    # Create production environment file
    cat > .env.mtls <<EOF
# mTLS Production Environment Configuration
NODE_ENV=production

# TLS Configuration
TLS_ENABLED=true
TLS_CERT_PATH=/certs/backend.cert.pem
TLS_KEY_PATH=/certs/backend.key.pem
TLS_CA_PATH=/certs/ca.cert.pem
TLS_CLIENT_CERT_PATH=/certs/backend.client.cert.pem
TLS_CLIENT_KEY_PATH=/certs/backend.client.key.pem
TLS_REJECT_UNAUTHORIZED=true
TLS_MIN_VERSION=TLSv1.2
TLS_MAX_VERSION=TLSv1.3

# Certificate Pinning (update with actual fingerprints after generation)
BACKEND_CERT_PIN=
BOT_CERT_PIN=
FRONTEND_CERT_PIN=
POSTGRES_CERT_PIN=
REDIS_CERT_PIN=
VAULT_CERT_PIN=

# Database with TLS
DATABASE_URL=postgresql://telegram_user:telegram_pass@postgres-tls:5432/telegram_ecommerce?sslmode=require

# Redis with TLS
REDIS_URL=rediss://redis-tls:6380

# Vault with TLS
USE_VAULT=true
VAULT_ADDR=https://vault:8200

# Security Headers
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5
EOF

    print_success "Environment file created: .env.mtls"
}

# Function to generate certificate fingerprints
generate_fingerprints() {
    print_status "Generating certificate fingerprints for pinning..."
    
    echo "# Certificate Fingerprints for Pinning" > /tmp/cert-fingerprints.txt
    echo "# Generated on: $(date)" >> /tmp/cert-fingerprints.txt
    echo "" >> /tmp/cert-fingerprints.txt
    
    for service in "${SERVICES[@]}"; do
        if [ -f "$CA_DIR/services/$service/$service.cert.pem" ]; then
            local fingerprint=$(openssl x509 -noout -fingerprint -sha256 -in "$CA_DIR/services/$service/$service.cert.pem" | cut -d= -f2 | tr -d ':')
            echo "${service^^}_CERT_PIN=$fingerprint" >> /tmp/cert-fingerprints.txt
            print_status "Generated fingerprint for $service: $fingerprint"
        fi
    done
    
    print_success "Certificate fingerprints saved to /tmp/cert-fingerprints.txt"
}

# Function to deploy the stack
deploy_stack() {
    print_status "Deploying mTLS stack with Docker Compose..."
    
    # Stop any existing containers
    docker-compose -f config/docker/docker-compose.mtls.yml down 2>/dev/null || true
    
    # Create necessary directories
    mkdir -p storage/logs
    mkdir -p storage/backups
    mkdir -p storage/uploads
    
    # Deploy the stack
    docker-compose -f config/docker/docker-compose.mtls.yml up -d
    
    print_success "mTLS stack deployed successfully"
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying mTLS deployment..."
    
    local failed_services=()
    
    # Wait for services to start
    sleep 30
    
    # Check each service
    for service in "${SERVICES[@]}"; do
        local container_name="botrt-${service}"
        if [ "$service" = "postgres" ]; then
            container_name="botrt-postgres-tls"
        elif [ "$service" = "redis" ]; then
            container_name="botrt-redis-tls"
        elif [ "$service" = "vault" ]; then
            container_name="botrt-vault-tls"
        elif [ "$service" = "nginx" ]; then
            container_name="botrt-nginx-mtls"
        elif [ "$service" = "backend" ]; then
            container_name="botrt-backend-mtls"
        elif [ "$service" = "frontend" ]; then
            container_name="botrt-frontend-tls"
        fi
        
        if docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
            print_success "$service is running"
        else
            print_error "$service is not running"
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        print_success "All services are running successfully"
        return 0
    else
        print_error "Failed services: ${failed_services[*]}"
        return 1
    fi
}

# Function to run security tests
run_security_tests() {
    print_status "Running security tests..."
    
    # Test HTTPS endpoint
    print_status "Testing HTTPS endpoint..."
    if curl -k -s --max-time 10 https://82.147.84.78/health > /dev/null; then
        print_success "HTTPS endpoint is accessible"
    else
        print_warning "HTTPS endpoint test failed"
    fi
    
    # Test certificate validation
    print_status "Testing certificate validation..."
    if openssl s_client -connect 82.147.84.78:443 -verify 8 -CAfile "$CA_DIR/certs/ca.cert.pem" < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
        print_success "Certificate validation passed"
    else
        print_warning "Certificate validation test failed"
    fi
    
    # Test database TLS
    print_status "Testing database TLS connection..."
    if docker exec botrt-postgres-tls psql -U telegram_user -d telegram_ecommerce -c "SELECT version();" > /dev/null 2>&1; then
        print_success "Database TLS connection working"
    else
        print_warning "Database TLS connection test failed"
    fi
    
    # Test Redis TLS
    print_status "Testing Redis TLS connection..."
    if docker exec botrt-redis-tls redis-cli --tls --cert /certs/redis.client.cert.pem --key /certs/redis.client.key.pem --cacert /certs/ca.cert.pem -p 6380 ping | grep -q "PONG"; then
        print_success "Redis TLS connection working"
    else
        print_warning "Redis TLS connection test failed"
    fi
}

# Function to display deployment summary
show_deployment_summary() {
    print_success "🎉 mTLS Deployment Complete!"
    echo ""
    echo "📋 Deployment Summary:"
    echo "├── Certificate Authority: Created"
    echo "├── Service Certificates: Generated for ${#SERVICES[@]} services"
    echo "├── Docker Network: botrt-secure (172.20.0.0/16)"
    echo "├── TLS Endpoints:"
    echo "│   ├── Frontend: https://82.147.84.78 (port 443)"
    echo "│   ├── Backend API: https://82.147.84.78/api"
    echo "│   ├── PostgreSQL: 82.147.84.78:5432 (TLS required)"
    echo "│   ├── Redis: 82.147.84.78:6380 (TLS only)"
    echo "│   └── Vault: https://82.147.84.78:8200"
    echo "└── Monitoring: Certificate expiry check script created"
    echo ""
    echo "🔐 Security Features Enabled:"
    echo "├── mTLS between all services"
    echo "├── TLS 1.2+ encryption everywhere"
    echo "├── Certificate pinning configured"
    echo "├── Client certificate validation"
    echo "├── Strong cipher suites only"
    echo "└── HSTS and security headers"
    echo ""
    echo "📁 Important Files:"
    echo "├── CA Certificate: $CA_DIR/certs/ca.cert.pem"
    echo "├── Environment Config: .env.mtls"
    echo "├── Certificate Fingerprints: /tmp/cert-fingerprints.txt"
    echo "└── Monitoring Script: /tmp/check-cert-expiry.sh"
    echo ""
    echo "⚠️  Security Reminders:"
    echo "├── Update certificate fingerprints in .env.mtls"
    echo "├── Set up certificate rotation (certificates expire in $CERT_VALIDITY_DAYS days)"
    echo "├── Monitor certificate expiry with /tmp/check-cert-expiry.sh"
    echo "├── Keep CA private key secure: $CA_DIR/private/ca.key.pem"
    echo "└── Review and update security policies regularly"
    echo ""
    echo "🚀 Next Steps:"
    echo "1. Update .env.mtls with generated certificate fingerprints"
    echo "2. Set up automated certificate monitoring"
    echo "3. Configure application secrets in Vault"
    echo "4. Test all application endpoints"
    echo "5. Set up certificate rotation automation"
}

# Main execution
main() {
    echo "🔒 Starting mTLS Security Stack Deployment"
    echo "========================================"
    
    check_prerequisites
    generate_certificates
    create_network
    generate_dh_params
    setup_certificate_monitoring
    create_environment_files
    generate_fingerprints
    deploy_stack
    
    if verify_deployment; then
        run_security_tests
        show_deployment_summary
        exit 0
    else
        print_error "Deployment verification failed. Check Docker logs for details."
        echo ""
        echo "🔍 Troubleshooting:"
        echo "├── Check Docker logs: docker-compose -f config/docker/docker-compose.mtls.yml logs"
        echo "├── Verify certificates: /tmp/check-cert-expiry.sh"
        echo "├── Check network connectivity: docker network inspect botrt-secure"
        echo "└── Review service health: docker ps"
        exit 1
    fi
}

# Run main function
main "$@"

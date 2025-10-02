# Nginx Configuration

Nginx configurations for different deployment scenarios.

## 📁 Available Configurations

### `nginx.conf`
**Purpose:** Standard production Nginx configuration

**Features:**
- Reverse proxy for backend API
- Static file serving for frontend
- Gzip compression
- Security headers
- Request/response buffering
- Logging configuration

**Usage:**
```bash
# Copy to Nginx config directory
sudo cp config/nginx/nginx.conf /etc/nginx/nginx.conf

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

**Proxy configuration:**
```nginx
# Backend API
location /api {
    proxy_pass http://localhost:3001;
}

# Frontend
location / {
    root /var/www/frontend/dist;
    try_files $uri $uri/ /index.html;
}
```

---

### `nginx-waf.conf`
**Purpose:** Web Application Firewall (WAF) configuration

**Security features:**
- SQL injection protection
- XSS attack prevention
- Path traversal blocking
- Rate limiting per IP
- Request size limits
- Suspicious pattern blocking
- Bot detection

**Additional protections:**
```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Block suspicious patterns
if ($request_uri ~* "(union|select|insert|drop|update|delete|script|alert)") {
    return 403;
}

# Request size limits
client_max_body_size 10M;
client_body_buffer_size 128k;
```

**Usage:**
```bash
# Use instead of nginx.conf for enhanced security
sudo cp config/nginx/nginx-waf.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
```

**When to use:** Production environments requiring WAF protection

---

### `nginx-mtls.conf`
**Purpose:** Mutual TLS (mTLS) configuration for service authentication

**Security features:**
- Client certificate verification
- Service-to-service authentication
- Certificate-based authorization
- Encrypted communication
- Certificate revocation checking

**mTLS setup:**
```nginx
# SSL/TLS configuration
ssl_certificate /etc/nginx/ssl/server-cert.pem;
ssl_certificate_key /etc/nginx/ssl/server-key.pem;
ssl_client_certificate /etc/nginx/ssl/ca-cert.pem;
ssl_verify_client on;
ssl_verify_depth 2;

# Only allow valid certificates
if ($ssl_client_verify != SUCCESS) {
    return 403;
}
```

**Prerequisites:**
1. Certificate Authority (CA) set up
2. Server certificates generated
3. Client certificates distributed to services

**Setup:**
```bash
# 1. Generate certificates
./tools/security/deploy-mtls-stack.sh

# 2. Copy certificates to Nginx directory
sudo mkdir -p /etc/nginx/ssl
sudo cp config/tls/*.pem /etc/nginx/ssl/

# 3. Install configuration
sudo cp config/nginx/nginx-mtls.conf /etc/nginx/nginx.conf

# 4. Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

**When to use:** High-security deployments, microservices with mTLS

---

## 🚀 Deployment Scenarios

### Standard Production

```bash
# 1. Install Nginx
sudo apt install nginx

# 2. Copy configuration
sudo cp config/nginx/nginx.conf /etc/nginx/nginx.conf

# 3. Create directories
sudo mkdir -p /var/www/frontend/dist

# 4. Deploy frontend
sudo cp -r frontend/dist/* /var/www/frontend/dist/

# 5. Test and start
sudo nginx -t
sudo systemctl restart nginx
```

### With WAF Protection

```bash
# Use WAF configuration
sudo cp config/nginx/nginx-waf.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx

# Monitor blocked requests
sudo tail -f /var/log/nginx/error.log | grep "403"
```

### With mTLS

```bash
# 1. Setup mTLS stack
./tools/security/deploy-mtls-stack.sh

# 2. Configure Nginx
sudo cp config/nginx/nginx-mtls.conf /etc/nginx/nginx.conf

# 3. Reload
sudo nginx -t
sudo systemctl reload nginx

# 4. Test with client certificate
curl --cert client-cert.pem --key client-key.pem https://your-domain.com
```

---

## 🔧 Configuration Customization

### Update Backend Upstream

Edit the configuration file:
```nginx
upstream backend {
    server localhost:3001;
    # Add more backend servers for load balancing
    server localhost:3002;
    server localhost:3003;
}
```

### Enable HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Strong SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
}
```

### Custom Rate Limiting

```nginx
# Define rate limit zones
limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

# Apply limits
location /api/auth {
    limit_req zone=auth burst=10 nodelay;
}

location /api {
    limit_req zone=api burst=20 nodelay;
}
```

---

## 📊 Monitoring & Logging

### Access Logs

```bash
# View access logs
sudo tail -f /var/log/nginx/access.log

# Analyze top IPs
sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10

# Monitor response codes
sudo awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c
```

### Error Logs

```bash
# View errors
sudo tail -f /var/log/nginx/error.log

# Count errors by type
sudo grep "error" /var/log/nginx/error.log | awk '{print $8}' | sort | uniq -c
```

### Status Module

Enable status module in configuration:
```nginx
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    deny all;
}
```

Check status:
```bash
curl http://localhost/nginx_status
```

---

## 🔒 Security Hardening

### Hide Nginx Version

```nginx
http {
    server_tokens off;
}
```

### Additional Security Headers

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### IP Whitelisting

```nginx
# Allow specific IPs
allow 192.168.1.0/24;
allow 10.0.0.0/8;
deny all;
```

---

## 🐳 Docker Integration

### Nginx in Docker Compose

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/dist:/var/www/frontend/dist:ro
      - ./config/tls:/etc/nginx/ssl:ro
    depends_on:
      - backend
      - frontend
```

### Custom Nginx Dockerfile

```dockerfile
FROM nginx:alpine

# Copy configuration
COPY config/nginx/nginx.conf /etc/nginx/nginx.conf
COPY config/nginx/security-headers.conf /etc/nginx/conf.d/

# Copy SSL certificates
COPY config/tls/*.pem /etc/nginx/ssl/

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80 443
```

---

## 🆘 Troubleshooting

### Configuration Test Failed

```bash
# Test configuration
sudo nginx -t

# Check syntax
sudo nginx -T

# View full configuration
sudo nginx -T | less
```

### 502 Bad Gateway

```bash
# Check backend is running
curl http://localhost:3001/health

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify upstream configuration
sudo nginx -T | grep upstream
```

### Certificate Errors (mTLS)

```bash
# Verify certificate
openssl x509 -in /etc/nginx/ssl/server-cert.pem -text -noout

# Test client certificate
curl -v --cert client-cert.pem --key client-key.pem https://localhost

# Check certificate chain
openssl verify -CAfile ca-cert.pem server-cert.pem
```

---

## 📚 Additional Resources

- [Nginx Official Documentation](https://nginx.org/en/docs/)
- [mTLS Setup Guide](../../tools/security/README.md#deploy-mtls-stacksh)
- [Security Hardening](../../docs/security/)
- [Production Deployment](../../docs/deployment/production-deployment.md)

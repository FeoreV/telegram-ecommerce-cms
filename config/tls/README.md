# TLS/SSL Certificate Management

Scripts for generating and managing TLS certificates for secure communication.

## 📁 Scripts

### `certificate-authority.sh`
**Purpose:** Create Certificate Authority (CA) for internal PKI

**What it does:**
- Generates CA root certificate and private key
- Creates certificate signing infrastructure
- Sets up certificate revocation list (CRL)
- Configures certificate policies

**Usage:**
```bash
chmod +x config/tls/certificate-authority.sh
./config/tls/certificate-authority.sh
```

**Output:**
- `ca-cert.pem` - CA certificate (distribute to clients)
- `ca-key.pem` - CA private key (keep secure!)
- `ca-crl.pem` - Certificate revocation list

**⚠️ Security:** Store CA private key securely! This is the root of trust for your PKI.

---

### `generate-service-certs.sh`
**Purpose:** Generate TLS certificates for services

**Creates certificates for:**
- Backend API server
- Frontend server  
- Bot service
- Database connections
- Redis connections
- Internal service mesh

**Usage:**
```bash
# Generate all service certificates
./config/tls/generate-service-certs.sh

# Generate for specific service
./config/tls/generate-service-certs.sh backend
```

**Output per service:**
```
backend/
  ├── cert.pem         # Public certificate
  ├── key.pem          # Private key
  └── fullchain.pem    # Certificate + CA chain
```

---

## 🚀 Complete Setup

### 1. Create Certificate Authority

```bash
./config/tls/certificate-authority.sh
```

### 2. Generate Service Certificates

```bash
./config/tls/generate-service-certs.sh
```

### 3. Deploy Certificates

```bash
# Backend
cp config/tls/backend/*.pem backend/certs/

# Frontend  
cp config/tls/frontend/*.pem frontend/certs/

# Nginx
cp config/tls/nginx/*.pem /etc/nginx/ssl/
```

### 4. Configure Services

**Backend (Express.js):**
```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('certs/key.pem'),
  cert: fs.readFileSync('certs/cert.pem'),
  ca: fs.readFileSync('certs/ca-cert.pem')
};

https.createServer(options, app).listen(3001);
```

**Nginx:**
```nginx
server {
    listen 443 ssl http2;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_client_certificate /etc/nginx/ssl/ca-cert.pem;
    ssl_verify_client optional;
}
```

---

## 🔐 mTLS (Mutual TLS) Setup

For service-to-service authentication with mTLS:

```bash
# 1. Run complete mTLS deployment
./tools/security/deploy-mtls-stack.sh

# This will:
# - Create CA
# - Generate all service certificates
# - Configure Docker Compose
# - Update service configurations
```

---

## 🔄 Certificate Renewal

### Manual Renewal

```bash
# Generate new certificates
./config/tls/generate-service-certs.sh

# Restart services
docker-compose restart
```

### Automated Renewal

Add to cron:
```bash
# Renew certificates monthly
0 0 1 * * /path/to/config/tls/generate-service-certs.sh && docker-compose restart
```

---

## 🔍 Certificate Verification

```bash
# View certificate details
openssl x509 -in config/tls/backend/cert.pem -text -noout

# Verify certificate chain
openssl verify -CAfile config/tls/ca-cert.pem config/tls/backend/cert.pem

# Check certificate expiration
openssl x509 -in config/tls/backend/cert.pem -noout -enddate

# Test TLS connection
openssl s_client -connect localhost:3001 -CAfile config/tls/ca-cert.pem
```

---

## 🛡️ Security Best Practices

### Certificate Storage
- ✅ Store CA private key in secure vault
- ✅ Limit file permissions (600 for keys)
- ✅ Never commit private keys to git
- ✅ Use different keys for dev/staging/prod

### Key Length
- ✅ Use 4096-bit RSA keys (default in scripts)
- ✅ Or use ECDSA P-384 for performance

### Validity Period
- ✅ Short-lived certificates (90 days) for services
- ✅ Automate renewal process
- ✅ Monitor expiration dates

---

## 📊 Certificate Monitoring

```bash
# Check all certificate expiration dates
for cert in config/tls/*/*.pem; do
  echo "$cert:"
  openssl x509 -in "$cert" -noout -enddate 2>/dev/null || echo "  Not a certificate"
done

# Alert on certificates expiring soon
./tools/security/check-cert-expiration.sh
```

---

## 🆘 Troubleshooting

### Certificate Verification Failed

```bash
# Check certificate chain
openssl verify -verbose -CAfile ca-cert.pem cert.pem

# View certificate details
openssl x509 -in cert.pem -text -noout | grep -A2 "Subject:"
```

### mTLS Connection Issues

```bash
# Test with curl
curl -v \
  --cert config/tls/client/cert.pem \
  --key config/tls/client/key.pem \
  --cacert config/tls/ca-cert.pem \
  https://localhost:3001

# Check Nginx logs
docker-compose logs nginx | grep SSL
```

---

## 📚 Resources

- [OpenSSL Documentation](https://www.openssl.org/docs/)
- [mTLS Guide](../../tools/security/README.md#deploy-mtls-stacksh)
- [TLS Best Practices](https://wiki.mozilla.org/Security/Server_Side_TLS)
- [Certificate Management](../../docs/security/)

# HashiCorp Vault Configuration

Vault configuration files for secrets management infrastructure.

## 📁 Files

### `vault-config.hcl`
Main Vault server configuration

**Defines:**
- Storage backend
- Listener configuration
- API settings
- Telemetry
- Audit logging

---

### `vault-tls.hcl`
TLS-specific Vault configuration

**Features:**
- TLS listener setup
- Certificate paths
- mTLS client authentication
- Cipher suite configuration

---

### `vault-init.sh`
Vault initialization script

**What it does:**
- Initializes Vault server
- Generates unseal keys
- Creates root token
- Configures initial policies
- Enables secret engines

---

### `docker-compose.vault.yml`
Docker Compose file for Vault deployment

**Includes:**
- Vault server container
- Consul backend (optional)
- Volume configuration
- Network setup

---

## 🚀 Quick Start

### 1. Start Vault

```bash
# Using Docker Compose
docker-compose -f config/vault/docker-compose.vault.yml up -d

# Or standalone
docker run -d \
  --name vault \
  --cap-add=IPC_LOCK \
  -p 8200:8200 \
  -v $(pwd)/config/vault:/vault/config \
  vault:latest server
```

### 2. Initialize Vault

```bash
# Run initialization script
./config/vault/vault-init.sh

# Or manually
export VAULT_ADDR='http://127.0.0.1:8200'
vault operator init -key-shares=5 -key-threshold=3
```

**⚠️ Save the unseal keys and root token securely!**

### 3. Unseal Vault

```bash
vault operator unseal <key-share-1>
vault operator unseal <key-share-2>
vault operator unseal <key-share-3>
```

### 4. Setup Secrets

```bash
# Use setup script
./tools/vault/setup-vault-secrets.sh

# Or manually configure
vault login <root-token>
vault secrets enable -path=secret kv-v2
vault secrets enable transit
```

---

## 🔧 Configuration Details

### Storage Backend

**File Storage (Development):**
```hcl
storage "file" {
  path = "/vault/data"
}
```

**Consul Storage (Production):**
```hcl
storage "consul" {
  address = "consul:8500"
  path = "vault/"
}
```

### TLS Configuration

```hcl
listener "tcp" {
  address = "0.0.0.0:8200"
  tls_disable = false
  tls_cert_file = "/vault/config/tls/cert.pem"
  tls_key_file = "/vault/config/tls/key.pem"
  tls_client_ca_file = "/vault/config/tls/ca.pem"
}
```

---

## 🔐 Secret Management

### Store Secrets

```bash
# KV secrets
vault kv put secret/application/jwt \
  secret="your-jwt-secret" \
  refresh_secret="your-refresh-secret"

# Database credentials
vault kv put secret/application/database \
  username="dbuser" \
  password="dbpass"
```

### Retrieve Secrets

```bash
# Get secret
vault kv get secret/application/jwt

# Get specific field
vault kv get -field=secret secret/application/jwt
```

### Encrypt Data

```bash
# Encrypt
echo -n "sensitive data" | base64 | \
  vault write transit/encrypt/payment-data plaintext=-

# Decrypt
vault write transit/decrypt/payment-data ciphertext=vault:v1:...
```

---

## 🔄 Operations

### Backup Vault Data

```bash
# Snapshot (Vault Enterprise)
vault operator raft snapshot save backup.snap

# Or backup file storage
tar -czf vault-backup.tar.gz /vault/data
```

### Key Rotation

```bash
# Rotate encryption key
vault write -f transit/keys/payment-data/rotate

# Rotate root credentials
vault token create -policy=root
```

### Audit Logging

```bash
# Enable audit log
vault audit enable file file_path=/var/log/vault/audit.log

# View audit log
tail -f /var/log/vault/audit.log | jq
```

---

## 🐳 Docker Deployment

Full stack with Vault:

```bash
# 1. Start Vault
docker-compose -f config/vault/docker-compose.vault.yml up -d

# 2. Initialize
docker exec -it vault sh
vault operator init

# 3. Unseal
vault operator unseal <key-1>
vault operator unseal <key-2>
vault operator unseal <key-3>

# 4. Configure
./tools/vault/setup-vault-secrets.sh
```

---

## 📊 Monitoring

### Health Check

```bash
# Status
vault status

# Health endpoint
curl http://localhost:8200/v1/sys/health

# Metrics
curl http://localhost:8200/v1/sys/metrics
```

### Integration with Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'vault'
    metrics_path: '/v1/sys/metrics'
    params:
      format: ['prometheus']
    static_configs:
      - targets: ['vault:8200']
```

---

## 🆘 Troubleshooting

### Vault Sealed

```bash
# Check status
vault status

# Unseal
vault operator unseal
```

### Permission Denied

```bash
# Check token capabilities
vault token capabilities <path>

# Review policy
vault policy read <policy-name>
```

### Connection Refused

```bash
# Check Vault is running
docker ps | grep vault

# Check logs
docker logs vault

# Verify VAULT_ADDR
echo $VAULT_ADDR
```

---

## 📚 Additional Resources

- [Vault Documentation](https://www.vaultproject.io/docs)
- [Setup Guide](../../tools/vault/README.md)
- [Best Practices](https://learn.hashicorp.com/tutorials/vault/production-hardening)
- [API Reference](https://www.vaultproject.io/api-docs)

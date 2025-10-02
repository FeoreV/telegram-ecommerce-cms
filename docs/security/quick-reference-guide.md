# Security Quick Reference Guide

## 🚨 Emergency Procedures

### Security Incident Response (24/7)

**Immediate Actions**:
```bash
# 1. Activate incident response team
curl -X POST https://security.botrt.com/api/incidents \
  -H "Authorization: Bearer $INCIDENT_TOKEN" \
  -d '{"type":"security_breach","severity":"high","reporter":"$USER"}'

# 2. Enable maintenance mode
kubectl patch service botrt-frontend -p '{"spec":{"type":"ClusterIP"}}'

# 3. Scale down to minimal services
kubectl scale deployment botrt-backend --replicas=1

# 4. Activate security monitoring
kubectl apply -f k8s/security/incident-response-mode.yaml
```

**Emergency Contacts**:
- **Security Team Lead**: +1-555-SEC-TEAM (24/7)
- **CISO Office**: +1-555-CISO-911 (24/7)
- **Incident Response**: incidents@botrt.local
- **Executive Escalation**: exec-security@botrt.local

### Data Breach Response

1. **Immediate Containment**:
```bash
# Isolate affected systems
kubectl label node $AFFECTED_NODE quarantine=true
kubectl cordon $AFFECTED_NODE

# Enable audit mode
kubectl patch deployment botrt-backend -p '{"spec":{"template":{"metadata":{"labels":{"audit-mode":"enabled"}}}}}'

# Collect forensic evidence
kubectl exec -it $POD_NAME -- tar czf /tmp/evidence-$(date +%s).tar.gz /var/log /tmp
```

2. **Notification Timeline**:
   - **Immediate**: Internal security team
   - **1 hour**: Management and legal team
   - **4 hours**: Affected customers (if applicable)
   - **24 hours**: Regulatory authorities (if required)
   - **72 hours**: Detailed incident report

## 🔐 Authentication Quick Commands

### Admin Access

```bash
# Generate emergency admin access
node scripts/emergency-admin-access.js --user="$ADMIN_USER" --duration=3600

# Verify MFA setup
curl -X POST https://api.botrt.com/api/auth/verify-mfa \
  -H "Content-Type: application/json" \
  -d '{"token":"$MFA_TOKEN","userId":"$USER_ID"}'

# Check active sessions
redis-cli -h redis.botrt.com KEYS "session:*" | wc -l

# Revoke all sessions for user
redis-cli -h redis.botrt.com DEL $(redis-cli KEYS "session:user:$USER_ID:*")
```

### Token Management

```bash
# Generate service account token
vault write auth/kubernetes/role/$ROLE_NAME \
  bound_service_account_names=$SERVICE_ACCOUNT \
  bound_service_account_namespaces=$NAMESPACE \
  policies=$POLICY_NAME \
  ttl=24h

# Refresh JWT token
curl -X POST https://api.botrt.com/api/auth/refresh \
  -H "Authorization: Bearer $REFRESH_TOKEN"

# Check token expiration
echo $JWT_TOKEN | jwt decode -

# Revoke specific token
curl -X POST https://api.botrt.com/api/auth/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"tokenId":"$TOKEN_ID"}'
```

## 🛡️ Security Monitoring Commands

### WAF Status Check

```bash
# Check WAF protection status
curl -s https://api.botrt.com/api/security/waf/status | jq '.'

# View blocked IPs (last 24h)
curl -s "https://api.botrt.com/api/security/waf/blocked?hours=24" | jq '.blockedIPs[]'

# Check rate limiting status
curl -s https://api.botrt.com/api/security/rate-limits | jq '.activeLimits'

# View security events
tail -f /var/log/nginx/security.log | grep "BLOCKED"
```

### Vulnerability Scanning

```bash
# Run immediate vulnerability scan
trivy image --severity HIGH,CRITICAL botrt-backend:latest

# Check SBOM for vulnerabilities
syft botrt-backend:latest -o cyclonedx-json | grype

# Scan running containers
docker ps --format "table {{.Image}}\t{{.Status}}" | xargs -I {} trivy image {}

# Generate security report
npm run security:report -- --format=json --output=security-report.json
```

### Log Analysis

```bash
# Search security logs for anomalies
grep -E "(BREACH|ATTACK|MALICIOUS)" /var/log/security/*.log | tail -100

# Check authentication failures
journalctl -u botrt-backend | grep "authentication_failed" | tail -50

# Monitor failed payment attempts
kubectl logs -l app=botrt-backend | grep "payment_fraud_detected" | tail -20

# Real-time security monitoring
kubectl logs -f -l app=botrt-backend | grep -E "(SECURITY|ALERT|BREACH)"
```

## 🔧 Configuration Commands

### Vault Operations

```bash
# Check Vault status
vault status

# Unseal Vault (emergency)
vault operator unseal $UNSEAL_KEY_1
vault operator unseal $UNSEAL_KEY_2
vault operator unseal $UNSEAL_KEY_3

# Rotate encryption key
vault write sys/rotate

# Generate new secret
vault kv put secret/botrt/api-key value=$(openssl rand -base64 32)

# Check secret access logs
vault audit-log | grep "secret/botrt" | tail -20
```

### Database Security

```bash
# Check RLS policies
psql -d telegram_ecommerce -c "\d+ orders" | grep "Row security"

# Verify encryption at rest
psql -d telegram_ecommerce -c "SELECT pg_is_in_recovery(), current_setting('ssl');"

# Check active connections
psql -d telegram_ecommerce -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Force SSL connections only
psql -d telegram_ecommerce -c "ALTER SYSTEM SET ssl = on; SELECT pg_reload_conf();"
```

### Container Security

```bash
# Verify image signatures
cosign verify --key cosign.pub ghcr.io/botrt/backend:latest

# Check container security policies
kubectl get networkpolicies -n botrt-production

# Scan for running containers with vulnerabilities
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}' | tr ' ' '\n' | xargs -I {} trivy image {}

# Check security contexts
kubectl get pods -o jsonpath='{.items[*].spec.securityContext}' | jq '.'
```

## 📊 Security Metrics Commands

### Performance Metrics

```bash
# Security overhead analysis
curl -s https://api.botrt.com/api/metrics/security | jq '.performance'

# Authentication latency
curl -w "@curl-format.txt" -o /dev/null -s https://api.botrt.com/api/auth/login

# Encryption performance
time openssl speed -evp aes-256-gcm

# Network latency with security
mtr --report --report-cycles 10 api.botrt.com
```

### Compliance Metrics

```bash
# Generate compliance report
curl -s https://api.botrt.com/api/compliance/report | jq '.'

# Check PCI DSS status
curl -s https://api.botrt.com/api/compliance/pci-dss | jq '.score'

# GDPR compliance check
curl -s https://api.botrt.com/api/compliance/gdpr | jq '.requirements'

# SOC 2 control status
curl -s https://api.botrt.com/api/compliance/soc2 | jq '.controls'
```

## 🔄 Backup & Recovery Commands

### Emergency Backup

```bash
# Immediate database backup
pg_dump -h postgres.botrt.com -U backup_user telegram_ecommerce | \
  gpg --symmetric --cipher-algo AES256 > backup-$(date +%s).sql.gpg

# Vault backup
vault operator raft snapshot save vault-backup-$(date +%s).snap

# Configuration backup
kubectl get configmaps,secrets -o yaml > k8s-config-backup-$(date +%s).yaml

# Certificate backup
cp -r /etc/ssl/certs/botrt/ ~/cert-backup-$(date +%s)/
```

### Recovery Operations

```bash
# Restore from backup
gpg --decrypt backup-$TIMESTAMP.sql.gpg | \
  psql -h postgres.botrt.com -U restore_user telegram_ecommerce

# Vault recovery
vault operator raft snapshot restore vault-backup-$TIMESTAMP.snap

# Certificate restoration
kubectl create secret tls botrt-tls-cert --cert=server.crt --key=server.key

# Configuration restore
kubectl apply -f k8s-config-backup-$TIMESTAMP.yaml
```

## 🔍 Troubleshooting Guide

### Common Security Issues

**Issue**: Authentication failures spike
```bash
# Check Redis connectivity
redis-cli -h redis.botrt.com ping

# Verify JWT secret
vault kv get secret/botrt/jwt

# Check rate limiting
curl -I https://api.botrt.com/api/auth/login
```

**Issue**: WAF blocking legitimate traffic
```bash
# Review WAF logs
tail -f /var/log/nginx/waf.log | grep "BLOCKED"

# Whitelist IP temporarily
echo "$IP_ADDRESS" >> /etc/nginx/whitelist.conf && nginx -s reload

# Check bot detection accuracy
curl -s https://api.botrt.com/api/security/waf/stats | jq '.botDetection'
```

**Issue**: High encryption latency
```bash
# Check CPU usage
top -p $(pgrep -f "botrt-backend")

# Verify hardware crypto acceleration
lscpu | grep -i aes

# Monitor encryption performance
perf record -g node backend/dist/index.js
```

**Issue**: Database connection failures
```bash
# Check SSL certificate validity
openssl s_client -connect postgres.botrt.com:5432 -starttls postgres

# Verify client certificates
psql "sslmode=require sslcert=client.crt sslkey=client.key sslrootcert=ca.crt host=postgres.botrt.com dbname=telegram_ecommerce"

# Check connection pool
psql -c "SELECT * FROM pg_stat_activity;" | wc -l
```

## 📱 Mobile Security Commands

### API Security Testing

```bash
# Test API authentication
curl -X POST https://api.botrt.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test","mfaToken":"123456"}'

# Check rate limiting
for i in {1..10}; do
  curl -w "%{http_code}\n" -o /dev/null -s https://api.botrt.com/api/products
done

# Test CORS policy
curl -H "Origin: http://malicious.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS https://api.botrt.com/api/orders
```

### Mobile App Security

```bash
# Check SSL pinning
openssl s_client -connect api.botrt.com:443 -servername api.botrt.com

# Verify certificate transparency
curl -s "https://crt.sh/?q=api.botrt.com&output=json" | jq '.[0]'

# Test API versioning
curl -H "Accept: application/vnd.api+json;version=1" https://api.botrt.com/api/status
```

## 🎯 Security Testing Commands

### Penetration Testing

```bash
# Network scanning
nmap -sS -sV -O target.botrt.com

# Web application scanning
nikto -h https://api.botrt.com

# SSL/TLS testing
sslscan api.botrt.com

# SQL injection testing
sqlmap -u "https://api.botrt.com/api/products?id=1" --batch --level=3
```

### Security Validation

```bash
# Validate security headers
curl -I https://api.botrt.com | grep -E "(Security|Policy|Protection)"

# Check for information disclosure
curl -s https://api.botrt.com/api/debug || echo "Debug endpoint properly disabled"

# Test file upload security
curl -X POST -F "file=@test.txt" https://api.botrt.com/api/upload

# Verify input validation
curl -X POST -H "Content-Type: application/json" \
  -d '{"test":"<script>alert(1)</script>"}' \
  https://api.botrt.com/api/test-input
```

## 📞 Support Information

### Security Team Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Security Team Lead | security-lead@botrt.local | 24/7 |
| DevSecOps Engineer | devsecops@botrt.local | Business hours |
| Compliance Manager | compliance@botrt.local | Business hours |
| Incident Response | incidents@botrt.local | 24/7 |

### External Resources

- **OWASP Security Guide**: https://owasp.org/www-project-web-security-testing-guide/
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **CIS Controls**: https://www.cisecurity.org/controls/
- **SANS Security Resources**: https://www.sans.org/security-resources/

### Internal Tools & Dashboards

- **Security Dashboard**: https://security.botrt.com/dashboard
- **Compliance Portal**: https://compliance.botrt.com
- **Incident Management**: https://incidents.botrt.com
- **Vulnerability Management**: https://vulns.botrt.com

---

**Document Version**: 1.0  
**Last Updated**: 2024-04-13  
**Quick Reference ID**: QRG-SEC-001  
**Emergency Use**: ✅ Approved for incident response

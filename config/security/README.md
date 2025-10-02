# Security Configuration Files

Linux security profiles and headers for hardened deployments.

## 📁 Files

### `apparmor-profile`
**Purpose:** AppArmor security profile for containerized applications

**Features:**
- Restricts file system access
- Limits network capabilities
- Controls process execution
- Prevents privilege escalation

**Usage:**
```bash
# Load profile
sudo apparmor_parser -r config/security/apparmor-profile

# Enable for Docker container
docker run --security-opt apparmor=docker-botrt ...
```

---

### `seccomp-profile.json`
**Purpose:** Seccomp (Secure Computing Mode) profile

**Features:**
- Restricts system calls
- Blocks dangerous operations
- Reduces attack surface
- Docker/Kubernetes compatible

**Usage in Docker Compose:**
```yaml
services:
  backend:
    security_opt:
      - seccomp:config/security/seccomp-profile.json
```

---

### `security-headers.conf`
**Purpose:** HTTP security headers configuration (for Nginx/Apache)

**Headers included:**
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)
- `Referrer-Policy`
- `Permissions-Policy`

**Usage with Nginx:**
```nginx
http {
    include /path/to/config/security/security-headers.conf;
}
```

## 🛡️ Security Stack

### Full Stack Setup
```bash
# 1. Deploy AppArmor profile
sudo apparmor_parser -r config/security/apparmor-profile

# 2. Use in Docker
docker-compose -f config/docker/docker-compose.secure-infrastructure.yml up -d

# 3. Verify
sudo aa-status | grep botrt
```

### Docker Security
```yaml
services:
  backend:
    security_opt:
      - apparmor=docker-botrt
      - seccomp=config/security/seccomp-profile.json
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    read_only: true
```

## 📚 Resources
- [AppArmor Documentation](https://gitlab.com/apparmor/apparmor/-/wikis/home)
- [Seccomp Guide](https://docs.docker.com/engine/security/seccomp/)
- [Security Headers](https://securityheaders.com/)

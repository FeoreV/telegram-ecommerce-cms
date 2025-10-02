# Kubernetes Configuration

Kubernetes manifests for advanced deployments and security policies.

## 📁 Files

### `security-contexts.yaml`
**Purpose:** Pod and container security contexts

**Defines:**
- Security policies for pods
- User/group IDs
- Capabilities
- Read-only root filesystems
- Privilege escalation prevention

**Apply:**
```bash
kubectl apply -f config/kubernetes/security-contexts.yaml
```

**Example:**
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  capabilities:
    drop:
      - ALL
    add:
      - NET_BIND_SERVICE
  readOnlyRootFilesystem: true
```

---

### `backup-network-isolation.yaml`
**Purpose:** Network policies for backup isolation

**Features:**
- Isolates backup processes
- Restricts network access
- Defines ingress/egress rules
- Protects sensitive backup data

**Apply:**
```bash
kubectl apply -f config/kubernetes/backup-network-isolation.yaml
```

---

## 🚀 Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (1.24+)
- kubectl configured
- Helm (optional)

### Deploy Application

```bash
# Create namespace
kubectl create namespace telegram-ecommerce

# Apply configurations
kubectl apply -f config/kubernetes/ -n telegram-ecommerce

# Check status
kubectl get pods -n telegram-ecommerce
kubectl get services -n telegram-ecommerce
```

### Full Stack Deployment

```bash
# 1. Apply security policies
kubectl apply -f config/kubernetes/security-contexts.yaml

# 2. Apply network policies
kubectl apply -f config/kubernetes/backup-network-isolation.yaml

# 3. Deploy application
helm install botrt ./helm-chart -n telegram-ecommerce

# 4. Verify
kubectl get all -n telegram-ecommerce
```

---

## 🔐 Security Best Practices

- ✅ Use non-root containers
- ✅ Read-only root filesystems
- ✅ Drop all capabilities
- ✅ Network policies enabled
- ✅ Pod security standards
- ✅ Resource limits defined

---

## 📚 Resources
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)

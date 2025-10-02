## Overview

This repository powers a multi‑store Telegram e‑commerce platform with a backend API, React admin, and Telegram bot. Use this page as your entry point to key capabilities and documentation.

### Core components
- Backend API (Express + Prisma)
- Frontend Admin (React + Vite)
- Telegram Bot (Node.js)
- Monitoring (Prometheus + Grafana)
- Database (PostgreSQL/MySQL/SQLite), Redis (optional)

### Key features
- Multi‑store architecture with hierarchical RBAC (OWNER > ADMIN > VENDOR > CUSTOMER)
- Manual payment verification with payment proofs
- Order processing engine with custom state machine
- Real‑time notifications and analytics
- Built‑in monitoring stack

### Start here
- Development quick start: docs/development/quick-start-docker.md
- Environment setup: docs/development/environment-setup.md
- Project structure: docs/architecture/project-structure.md

### Consolidated guides
- Monitoring: docs/deployment/monitoring.md
- Payments and balance: docs/development/payment-setup.md
- User management: docs/development/user-management.md
- Docker troubleshooting: docs/deployment/docker-troubleshooting.md

### Security
See docs/security/security-architecture-overview.md for security model and policies.

### Health endpoints
- Backend health: /health
- Backend metrics: /metrics (Prometheus)



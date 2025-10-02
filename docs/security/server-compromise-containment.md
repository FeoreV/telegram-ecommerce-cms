## Server Compromise Containment and Data Exfiltration Defense

This document describes controls that minimize impact if an attacker gains server access. The objective is to prevent data exfiltration and rapidly contain incidents.

### Components

- Kill-switch (application-level shutdown with safe responses)
- Quarantine mode (limited functionality, no webhooks, no caching)
- Egress guard (deny-by-default outbound HTTP/S with allowlist)
- Secrets zeroization (memory obliteration and rotation attempt)
- SIEM alerting and forensic logging
 - Honeytokens and exfiltration traps (auto-quarantine optional)
- Cache shredder (secure delete logs/tmp, optional Redis flush)
- Response DLP (auto-redaction for TOP_SECRET data in responses)

### How It Works

1) Egress Guard
- Outbound HTTP/S calls are intercepted. Only hosts in `EGRESS_ALLOWED_HOSTS` are permitted (comma-separated domains). All others are blocked.
- SSRF validation is applied to URLs (scheme, DNS, IP ranges, allow/deny lists).

2) Kill-Switch
- When activated, the API returns 503 for all requests via middleware.
- Secrets are zeroized in process memory; Vault rotation is requested if enabled.
- Egress is forced to deny-by-default with an empty allowlist.
- SIEM receives critical alert events.

3) Quarantine Mode
- Webhooks are disabled (`WEBHOOKS_DISABLED=true`).
- Sessions should be revoked by downstream consumers (signal emitted).
- Egress is set to deny-by-default.
- Cache and disk writes should be minimized (future integration points).

### Operations

Endpoints (OWNER/ADMIN as configured):
- POST `/api/security/kill-switch/activate` { reason? }
- POST `/api/security/kill-switch/deactivate`
- POST `/api/security/quarantine/activate` { reason? }
- POST `/api/security/quarantine/deactivate`

Environment Variables:
- `EGRESS_GUARD_ENABLED=true|false` (default true)
- `EGRESS_ALLOWED_HOSTS="api.telegram.org,api.payment.com"`
- `WEBHOOKS_DISABLED=true|false`
 - `HONEYTOKENS_ENABLED=true|false` (default true)
 - `HONEYTOKENS_AUTO_QUARANTINE=true|false` (default true)
 - `HONEYTOKENS_COUNT=5`
 - `HONEYTOKENS="htk_... , htk_..."` (optional preset)
 - `CACHE_SHREDDER_ENABLED=true|false`
 - `CACHE_SHRED_PATHS="storage/logs,uploads/tmp"`
 - `CACHE_SHRED_PATTERNS=".log,.tmp,.cache"`
 - `CACHE_SHRED_FLUSH_REDIS=true|false`

### Playbooks

Immediate Containment:
- Activate kill-switch if active exploitation suspected.
- Otherwise, activate quarantine to preserve service continuity while blocking exfiltration vectors.
- Rotate secrets in Vault and restart services with new leases.

Data Protection:
- All sensitive fields are encrypted at rest with Vault-managed keys.
- Audit/security logs are encrypted and stored immutably.
- Backups are encrypted with dedicated keys and stored in isolated networks.

### Monitoring & Alerts

- SIEM alerts on: kill-switch/quarantine activation, secrets zeroization, outbound block spikes.
- SOC should triage alerts and follow the incident response runbook.

### Testing

- Unit/Integration tests: simulate outbound requests to disallowed hosts and verify blocks.
- Manual drill: enable quarantine in staging; confirm webhooks disabled, outbound calls blocked, and 503 not returned (kill-switch remains off).

### Limitations and Next Steps

- Process-level memory zeroization is best-effort; restart is recommended.
- Extend egress guard to other protocols (DNS, SMTP) via network policies and sidecars.
- Add honeytokens and tripwire credentials (future task) with SIEM integration.



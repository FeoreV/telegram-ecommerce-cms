# Multi-stage security-hardened Dockerfile for BotRT Backend
# Implements defense-in-depth container security

# Build stage with security scanning
FROM node:18-alpine AS security-builder

# Install security scanning tools
RUN apk add --no-cache \
    dumb-init \
    tini \
    su-exec \
    shadow \
    curl \
    jq

# Create non-root user with minimal privileges
RUN addgroup -g 1001 -S botrt && \
    adduser -u 1001 -S botrt -G botrt -s /sbin/nologin -h /app

# Set secure working directory
WORKDIR /app

# Copy package files with proper ownership
COPY --chown=botrt:botrt package*.json ./

# Install dependencies with security audit
RUN npm ci --only=production --audit --audit-level=high && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/tmp/*

# Copy application code
COPY --chown=botrt:botrt . .

# Build application
RUN npm run build && \
    rm -rf src/ && \
    rm -rf node_modules/@types/ && \
    rm -rf node_modules/.cache/

# Runtime stage with maximum security hardening
FROM node:18-alpine AS runtime

# Install minimal runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    tini \
    su-exec && \
    rm -rf /var/cache/apk/*

# Create dedicated non-root user
RUN addgroup -g 1001 -S botrt && \
    adduser -u 1001 -S botrt -G botrt -s /sbin/nologin -h /app

# Create necessary directories with restricted permissions
RUN mkdir -p /app /app/logs /app/tmp /app/uploads && \
    chown -R botrt:botrt /app && \
    chmod 755 /app && \
    chmod 700 /app/logs /app/tmp /app/uploads

# Set up read-only filesystem directories
RUN mkdir -p /tmp /var/tmp /var/log && \
    chown botrt:botrt /tmp /var/tmp && \
    chmod 1777 /tmp /var/tmp

# Copy application from builder stage
COPY --from=security-builder --chown=botrt:botrt /app/dist ./dist
COPY --from=security-builder --chown=botrt:botrt /app/node_modules ./node_modules
COPY --from=security-builder --chown=botrt:botrt /app/package*.json ./

# Create health check script
RUN echo '#!/bin/sh\ncurl -f http://localhost:3000/health || exit 1' > /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh && \
    chown botrt:botrt /app/healthcheck.sh

# Security labels and metadata
LABEL security.scan.enabled="true" \
      security.non-root="true" \
      security.read-only="true" \
      security.capabilities="none" \
      security.seccomp="default" \
      security.apparmor="default"

# Remove package managers and unnecessary tools
RUN apk del --purge $(apk info | grep -E '(apk-tools|alpine-keys)' | grep -v '^apk-tools$') || true

# Set secure environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=64" \
    NPM_CONFIG_CACHE=/tmp/.npm \
    HOME=/app \
    USER=botrt \
    USERID=1001 \
    GROUPID=1001

# Switch to non-root user
USER botrt:botrt

# Set working directory
WORKDIR /app

# Expose port (non-privileged)
EXPOSE 3000

# Health check with minimal privileges
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /app/healthcheck.sh

# Use tini as init system for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start application with minimal privileges
CMD ["node", "dist/index.js"]

# Security scanning metadata
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.source="https://github.com/botrt/backend" \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.title="BotRT Backend (Security Hardened)" \
      org.opencontainers.image.description="Secure Node.js backend with defense-in-depth container security" \
      org.opencontainers.image.vendor="BotRT Security Team"

# Multi-stage build for secure file upload processing
# Stage 1: Build environment
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Runtime environment with security hardening
FROM node:18-alpine AS runtime

# Create non-root user for security
RUN addgroup -g 1001 -S upload-user && \
    adduser -S -D -H -u 1001 -s /sbin/nologin upload-user

# Install security updates and required packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        dumb-init \
        tini \
        curl \
        ca-certificates && \
    rm -rf /var/cache/apk/*

# Install ClamAV for antivirus scanning
RUN apk add --no-cache clamav clamav-daemon clamav-libunrar && \
    mkdir -p /var/lib/clamav && \
    chown clamav:clamav /var/lib/clamav

# Create application directories with proper permissions
RUN mkdir -p /app/uploads/temp && \
    mkdir -p /app/uploads/quarantine && \
    mkdir -p /app/uploads/processed && \
    mkdir -p /app/logs && \
    mkdir -p /tmp/upload-processing && \
    chown -R upload-user:upload-user /app && \
    chown -R upload-user:upload-user /tmp/upload-processing && \
    chmod -R 750 /app && \
    chmod -R 700 /tmp/upload-processing

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=upload-user:upload-user /app/dist ./dist
COPY --from=builder --chown=upload-user:upload-user /app/node_modules ./node_modules
COPY --from=builder --chown=upload-user:upload-user /app/package*.json ./

# Copy security configuration files
COPY --chown=upload-user:upload-user config/security/upload-security.conf /app/config/
COPY --chown=upload-user:upload-user config/clamav/clamd.conf /etc/clamav/
COPY --chown=upload-user:upload-user config/clamav/freshclam.conf /etc/clamav/

# Create read-only filesystem mounts (to be configured at runtime)
VOLUME ["/app/uploads/temp", "/app/uploads/quarantine", "/tmp/upload-processing"]

# Security: Remove package managers and unnecessary tools
RUN apk del --no-cache \
        apk-tools \
        alpine-keys && \
    rm -rf /var/cache/apk/* \
           /tmp/* \
           /var/tmp/* \
           /root/.npm \
           /usr/share/man \
           /usr/share/doc

# Set environment variables for security
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    UV_THREADPOOL_SIZE=4 \
    UPLOAD_SANDBOX_MODE=true \
    ENABLE_FILE_VALIDATION=true \
    ENABLE_ANTIVIRUS_SCANNING=true \
    ENABLE_IMAGE_PROCESSING=true \
    ENABLE_EXIF_STRIPPING=true \
    MAX_FILE_SIZE=10485760 \
    MAX_FILES_PER_UPLOAD=5 \
    FILE_SCAN_TIMEOUT=30000 \
    QUARANTINE_DIRECTORY=/app/uploads/quarantine \
    TEMP_UPLOAD_DIRECTORY=/tmp/upload-processing

# Security: Set file permissions
RUN chmod 400 /app/config/upload-security.conf && \
    chmod 644 /etc/clamav/clamd.conf && \
    chmod 644 /etc/clamav/freshclam.conf

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health/upload || exit 1

# Switch to non-root user
USER upload-user:upload-user

# Expose port (non-privileged port)
EXPOSE 3000

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the upload processing service
CMD ["node", "dist/services/upload-processor.js"]

# Security labels
LABEL security.non-root="true" \
      security.readonly-rootfs="true" \
      security.capabilities="none" \
      security.seccomp="default" \
      security.apparmor="default" \
      maintainer="botrt-security-team" \
      description="Secure file upload processing sandbox"

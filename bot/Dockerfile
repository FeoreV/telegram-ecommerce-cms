FROM node:20-alpine

WORKDIR /app

# Install security updates and essential tools
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init tini && \
    rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev deps for building)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies and clean cache
RUN npm ci --only=production && \
    npm cache clean --force

# Create non-root user with home directory
RUN addgroup -g 1001 -S botgroup && \
    adduser -S botuser -u 1001 -G botgroup -h /home/botuser -s /bin/sh

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/temp && \
    chown -R botuser:botgroup /app

# Switch to non-root user
USER botuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: process.env.WEBHOOK_PORT || 8443, path: '/health', timeout: 3000 }; \
    http.get(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }) \
    .on('error', () => process.exit(1));"

# Security labels
LABEL security.non-root=true \
      security.no-new-privileges=true \
      maintainer="telegram-bot" \
      version="1.0.0" \
      description="Secure Telegram Bot with anti-spam and rate limiting"

# Expose port for webhook
EXPOSE 8443

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["npm", "start"]

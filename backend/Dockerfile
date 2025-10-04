FROM node:20-alpine

# Install OpenSSL and other dependencies for Prisma compatibility
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application - fix AdminJS issues in Docker
ENV ADMIN_JS_SKIP_BUNDLE=true
ENV ENABLE_ADMINJS=false
ENV NODE_ENV=production
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads

# Create logs directory
RUN mkdir -p logs

EXPOSE 3001

CMD ["npm", "start"]

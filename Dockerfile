# ==============================================================================
# Multi-Stage Production Dockerfile for StackStorm Backend Service
# Dickwella Fashion Corner - Enterprise E-Commerce Platform
#
# Stage 1: Build & Dependency Resolution (Builder)
# Stage 2: Hardened, Lean Alpine Production Runtime (< 150MB, Non-Root USER)
# ==============================================================================

# Stage 1: Dependencies & Build Stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build tools for native compilation if required
RUN apk add --no-cache python3 make g++

# Copy package manifests first for optimal layer caching
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Stage 2: Hardened Production Runner Stage
FROM node:20-alpine AS runner

# Add dumb-init for PID 1 signal forwarding and zombie process reaping
RUN apk add --no-cache dumb-init

# Set production environment variables
ENV NODE_ENV=production \
    PORT=5000

WORKDIR /usr/src/app

# Copy production node_modules from builder stage
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules

# Copy application source code
COPY --chown=node:node . .

# Remove unnecessary test and development files from production image
RUN rm -rf tests/ .git/ .github/ .vscode/ coverage/ docs/

# Enforce non-root execution (Least Privilege Security Principle)
USER node

# Expose internal application port
EXPOSE 5000

# Healthcheck probe using built-in node fetch
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/api/v1/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Execute application via dumb-init to ensure graceful SIGTERM handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]

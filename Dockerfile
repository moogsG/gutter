# Multi-stage Dockerfile for Gutter
# Uses bun for deps, build, and runtime

# Stage 1: Install dependencies
FROM oven/bun:1 AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Stage 2: Build application
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js app
RUN bun run build

# Stage 3: Production image
FROM oven/bun:1-slim AS runner
WORKDIR /app

# Set runtime environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs

# Copy necessary files
# If standalone is generated, use that; otherwise copy .next and node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Create directories for volumes with proper permissions
RUN mkdir -p /app/data /app/backups && \
    chown -R nextjs:nodejs /app/data /app/backups

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun --eval "fetch('http://localhost:3000').then(() => process.exit(0)).catch(() => process.exit(1))"

# Start application
CMD ["bun", "run", "start"]

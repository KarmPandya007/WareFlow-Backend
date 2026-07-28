# ─────────────────────────────────────────────
# WareFlow Backend — Node.js / Express
# ─────────────────────────────────────────────

# ── Stage 1: Dependencies ─────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Build tools required for native addons (bcrypt, odbc)
RUN apk add --no-cache python3 make g++ unixodbc-dev

# Copy only package files first (layer-cache friendly)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# ── Stage 2: Production image ─────────────────
FROM node:20-alpine AS runner

# dumb-init for proper PID-1 signal handling
# unixodbc is the runtime lib required by the `odbc` native module
RUN apk add --no-cache dumb-init unixodbc

WORKDIR /app

# Create non-root user before any COPY so --chown works
RUN addgroup -S wareflow && adduser -S wareflow -G wareflow

# Copy deps + source directly with correct ownership in one step each
# (avoids a separate chown layer which doubles the file data in the image)
COPY --from=deps --chown=wareflow:wareflow /app/node_modules ./node_modules
COPY --chown=wareflow:wareflow . .

# Switch to non-root user
USER wareflow

# Expose application port
EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

# Health-check using the /api/health endpoint already defined in server.js
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

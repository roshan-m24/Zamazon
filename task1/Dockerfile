# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install *all* deps (incl. devDependencies) so native modules like
# better-sqlite3 get built correctly for this platform.
RUN npm ci

COPY . .

# ---- Production stage ----
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Only production dependencies in the final image.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/src ./src
COPY --from=builder /app/index.js ./index.js

# Run as a non-root user.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]

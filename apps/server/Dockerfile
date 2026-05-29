# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace config first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json apps/shared/package.json packages/shared/package.json ./

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
RUN pnpm fetch --offline 2>/dev/null || pnpm install --frozen-lockfile

# Copy source
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared
COPY open_teamsuzie ./open_teamsuzie

# Build
RUN pnpm --filter @laiw/server build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built app
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/open_teamsuzie/packages ./open_teamsuzie/packages

# Install production deps only
RUN corepack enable && pnpm install --prod --frozen-lockfile 2>/dev/null || true

EXPOSE 3001

CMD ["node", "dist/index.js"]

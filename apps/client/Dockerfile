FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY apps/client/package.json packages/shared/package.json ./
RUN pnpm install --frozen-lockfile
COPY apps/client ./apps/client
COPY packages/shared ./packages/shared
RUN pnpm --filter @laiw/client build

FROM nginx:alpine
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

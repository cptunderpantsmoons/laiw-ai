#!/usr/bin/env bash
#
# dev.sh — One-command dev environment startup for Laiw LegalOS.
#
# Usage:  ./scripts/dev.sh
#
# What it does:
#   1. Starts PostgreSQL, Redis, and markitdown-agent via Docker Compose.
#   2. Installs workspace dependencies with pnpm.
#   3. Generates the Prisma client.
#   4. Runs database migrations.
#
# Prerequisites:
#   - Docker / Docker Compose installed and running
#   - pnpm installed (corepack enable or npm i -g pnpm)
#   - .env file present at project root (copy from .env.example)

set -euo pipefail
cd "$(dirname "$0")/.."

# ── Colors ──────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info()  { printf "${GREEN}[dev]${NC}  %s\n" "$*"; }
warn()  { printf "${YELLOW}[dev]${NC}  %s\n" "$*"; }
error() { printf "${RED}[dev]${NC}  %s\n" "$*"; }

# ── 0. Check prerequisites ─────────────────────────────────────
for cmd in docker pnpm; do
  if ! command -v "$cmd" &>/dev/null; then
    error "$cmd is not installed or not on PATH"
    exit 1
  fi
done

# ── 1. Start Docker services ───────────────────────────────────
info "Starting Docker services (postgres, redis, markitdown-agent)..."
if docker compose ps --format json 2>/dev/null | grep -q '"State":"running"'; then
  warn "Some containers are already running. Restarting..."
  docker compose down --remove-orphans 2>/dev/null || true
fi

docker compose up -d
info "Waiting for services to become healthy..."

# Poll until all services are healthy (max 90s)
for i in $(seq 1 30); do
  all_healthy=$(docker compose ps --format json 2>/dev/null \
    | grep -c '"Health":"healthy"' \
    || echo 0)
  # We expect 3 services to be healthy
  running_and_healthy=$(docker compose ps --format json 2>/dev/null \
    | grep -c '"State":"running"\|"Health":"healthy"' \
    || echo 0)
  running_count=$(docker compose ps --format json 2>/dev/null \
    | grep -c '"State":"running"' \
    || echo 0)

  if [ "$running_count" -eq 3 ] 2>/dev/null; then
    info "All 3 services are running."
    break
  fi
  sleep 3
done

# Verify each service responds
for service in postgres redis markitdown-agent; do
  info "Checking $service..."
  docker compose ps "$service" | grep -q "healthy\|running" || warn "  $service may not be healthy yet — restarting..."
  docker compose restart "$service" 2>/dev/null || true
  sleep 2
done

# ── 2. Install workspace dependencies ──────────────────────────
info "Installing workspace dependencies..."
pnpm install

# ── 3. Generate Prisma client ──────────────────────────────────
info "Generating Prisma client..."
pnpm db:generate

# ── 4. Run migrations ─────────────────────────────────────────
info "Running database migrations..."
pnpm db:migrate

# ── 5. Summary ────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  Laiw LegalOS dev environment ready!"
echo "=============================================="
echo ""
echo "  Frontend  : http://localhost:3000"
echo "  Backend   : http://localhost:3001"
echo "  Database  : localhost:5432 (db=laiw, user=laiw)"
echo "  Redis     : localhost:6379"
echo "  Markitdown: localhost:3013"
echo ""
echo "  To start dev servers:"
echo "    cd apps/client && pnpm dev      # frontend"
echo "    cd apps/server && pnpm dev       # backend"
echo ""
echo "  To tear down:"
echo "    docker compose down -v"
echo "=============================================="
echo ""

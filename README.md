# Laiw — Legal Operating System

A unified legal workspace replacing LawVu, combining AI-powered assistance with robust legal management tools. Laiw brings together Suzie Law AI and Iuris-Soft management into a single platform for in-house legal teams and law firms.

## What it does

- **Matter Management** — Create, track, and organize legal matters with status, types, custom fields, and team assignments.
- **Contract Lifecycle** — Full contract management with version control, redline tracking, AI-assisted review, and approval workflows.
- **Spend Analytics** — Budget management, transaction tracking, per-matter spend dashboards, and cross-matter reporting.
- **Knowledge Base** — Document repository with AI-powered search, RAG indexing, and auto-tagging.
- **AI Assistant** — 12 practice-area personas, 160+ prompt workflows, multi-jurisdiction legal research, and document Q&A with DOCX export.
- **Intake Automation** — Self-service intake portal with configurable form builder, AI triage, and auto matter creation.
- **Task Management** — Assign, triage, and track tasks linked to matters.
- **Cross-Matter Reporting** — Matter aging, spend by type, contract expiry calendar, and task burden charts.
- **Billing & Contacts** — Client billing, time tracking, retainers, and contact management.
- **Audit & Compliance** — Activity logging, document version chains, and approval workflows.

## Tech Stack

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Frontend    | React 18, TypeScript, Tailwind CSS  |
| Routing     | React Router v6                     |
| Backend     | Express, TypeScript, ESM            |
| Database    | PostgreSQL 17 (Prisma ORM)          |
| Cache/Queue | Redis 7                             |
| Agents      | Docker containers (markitdown-agent)|
| Build       | pnpm workspaces, Vite (client)      |
| Dev Infra   | Docker Compose                      |

## Project Structure

```
laiw/
├── apps/
│   ├── client/          # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── pages/           # 21 pages (Login, Dashboard, Matters, MatterDetail, ContractDetail, etc.)
│   │   │   ├── components/      # Layout, shared UI
│   │   │   ├── api.ts           # Typed fetch wrapper with auth token
│   │   │   └── types.ts         # Shared TypeScript types
│   │   └── dist/                # Production build
│   └── server/            # Express backend
│       └── src/
│           ├── index.ts           # Express app, middleware, route wiring
│           ├── config.ts          # Environment-aware configuration
│           ├── routes/            # 21 route files (auth, matters, contracts, spend, etc.)
│           ├── models/            # 8 Prisma model files
│           ├── services/          # 20 service modules (AI, billing, KB, etc.)
│           ├── scripts/seed.ts    # Demo dataset generator
│           └── auth/password.ts   # Scrypt password hashing
├── packages/
│   └── shared/
│       └── schema.prisma      # Prisma schema (PostgreSQL)
├── open_teamsuzie/            # Sibling repo (agents, UI components)
├── docker-compose.yml         # Dev services (postgres, redis, markitdown-agent)
├── scripts/dev.sh             # One-command dev startup
├── .env.example               # Environment variables template
├── package.json               # Root workspace config
└── pnpm-workspace.yaml
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- pnpm (corepack enable or npm i -g pnpm)

### One-command setup

```bash
cd /home/moonbuggy/Documents/Laiw/laiw
cp .env.example .env
./scripts/dev.sh
```

This starts PostgreSQL, Redis, and the markitdown-agent via Docker Compose, then installs dependencies, generates the Prisma client, and runs database migrations.

### Individual steps

```bash
# 1. Copy and configure environment
cp .env.example .env

# 2. Start infrastructure services
docker compose up -d

# 3. Install dependencies
pnpm install

# 4. Generate Prisma client
pnpm db:generate

# 5. Run database migrations
pnpm db:migrate

# 6. Seed demo data
pnpm db:seed

# 7. Start dev servers in separate terminals
cd apps/client && pnpm dev      # http://localhost:3000
cd apps/server && pnpm dev       # http://localhost:3001
```

### Tear down

```bash
docker compose down -v
```

## API Endpoints

All endpoints are under `/api/`. Most require a `Bearer` token from login.

| Method | Endpoint                        | Description                    |
| ------ | ------------------------------- | ------------------------------ |
| POST   | `/api/register`                 | Create new user account        |
| POST   | `/api/login`                    | Authenticate, return token     |
| GET    | `/api/health`                   | Server health check            |
| GET    | `/api/matters`                  | List user's matters            |
| POST   | `/api/matters`                  | Create a new matter            |
| GET    | `/api/matters/:id`              | Get matter details             |
| PATCH  | `/api/matters/:id`              | Update matter                  |
| POST   | `/api/matters/:id/archive`      | Archive a matter               |
| GET    | `/api/matters/:id/tasks`        | List tasks for a matter        |
| POST   | `/api/matters/:id/tasks`        | Create a task                  |
| GET    | `/api/contracts`                | List contracts (with matterId) |
| POST   | `/api/contracts`                | Create a contract              |
| GET    | `/api/contracts/:id`            | Get contract details           |
| PATCH  | `/api/contracts/:id`            | Update contract                |
| POST   | `/api/contracts/:id/versions`   | Create contract version        |
| GET    | `/api/contracts/:id/versions`   | List contract versions         |
| GET    | `/api/contracts/:id/redlines`   | List redline changes           |
| GET    | `/api/spend/budgets`            | List budgets                   |
| POST   | `/api/spend/budgets`            | Create budget                  |
| PATCH  | `/api/spend/budgets/:id`        | Update budget                  |
| GET    | `/api/spend/transactions`       | List transactions              |
| POST   | `/api/spend/transactions`       | Create transaction             |
| PATCH  | `/api/spend/transactions/:id/status` | Update transaction status |
| GET    | `/api/spend/summary/:matterId`  | Spend summary for a matter     |
| GET    | `/api/kb/entries`               | List knowledge base entries    |
| POST   | `/api/kb/entries`               | Create a knowledge base entry  |
| GET    | `/api/kb/entries/:id`           | Get entry details              |
| PATCH  | `/api/kb/entries/:id`           | Update entry                   |
| DELETE | `/api/kb/entries/:id`           | Delete entry                   |
| GET    | `/api/intake/forms`             | List intake forms              |
| POST   | `/api/intake/forms`             | Create intake form             |
| GET    | `/api/intake/forms/:id`         | Get form with submissions      |
| POST   | `/api/intake/:formId/submit`    | Submit a form                  |
| GET    | `/api/intake/submissions`       | List submissions               |
| GET    | `/api/intake/submissions/:id`   | Get submission details         |
| GET    | `/api/insights/dashboard`       | Dashboard KPIs & activity      |
| GET    | `/api/contacts`                 | List contacts                  |
| POST   | `/api/contacts`                 | Create a contact               |
| GET    | `/api/contacts/:id`             | Get contact details            |
| PATCH  | `/api/contacts/:id`             | Update contact                 |
| DELETE | `/api/contacts/:id`             | Delete contact                 |
| GET    | `/api/custom-fields`            | List custom matter fields      |
| POST   | `/api/custom-fields`            | Create custom field            |
| PATCH  | `/api/custom-fields/:id`        | Update custom field            |
| DELETE | `/api/custom-fields/:id`        | Delete custom field            |
| GET    | `/api/matter-types`             | List matter types              |
| POST   | `/api/matter-types`             | Create matter type             |
| PATCH  | `/api/matter-types/:id`         | Update matter type             |
| DELETE | `/api/matter-types/:id`         | Delete matter type             |
| POST   | `/api/intake/forms`             | Create intake form (admin)     |
| DELETE | `/api/intake/forms/:id`         | Delete intake form             |
| GET    | `/api/intake/submissions`       | List submissions (admin view)  |
| POST   | `/api/matter-auto/triage-and-create` | AI triage + auto matter creation |
| POST   | `/api/matter-auto/index-context`     | Auto-index matter documents to KB |
| GET    | `/api/ai/personas`              | List available AI personas     |
| POST   | `/api/ai/personas`              | Create custom persona          |
| DELETE | `/api/ai/personas/:id`          | Delete persona                 |
| POST   | `/api/ai/workflows`             | Create AI workflow             |
| GET    | `/api/ai/workflows`             | List workflows                 |
| POST   | `/api/ai/review`                | AI contract review             |
| GET    | `/api/ai-documents/summary`     | AI document summary            |
| GET    | `/api/audit-log`                | Get audit activity log         |
| GET    | `/api/documents`                | List documents                 |
| POST   | `/api/documents`                | Upload a document (multipart)  |
| GET    | `/api/documents/:id`            | Get document details           |

## Demo Credentials

After running `pnpm db:seed`, these accounts are available:

| Email                | Role       | Password  |
| -------------------- | ---------- | --------- |
| admin@acme.law       | ADMIN      | demo123   |
| lawyer@acme.law      | ATTORNEY   | demo123   |
| paralegal@acme.law   | PARALEGAL  | demo123   |

## Development

- **Frontend**: `cd apps/client && pnpm dev` — Vite dev server at http://localhost:3000
- **Backend**: `cd apps/server && pnpm dev` — Express server at http://localhost:3001
- **Full stack**: `pnpm dev` — starts both concurrently
- **Database Studio**: `pnpm db:studio` — Prisma Studio GUI at http://localhost:5555
- **Type check**: `pnpm typecheck`
- **Lint**: `pnpm lint`

## Environments

Set the `.env` file at the project root. The `.env.example` template includes all required variables:

- `DATABASE_URL` — PostgreSQL connection (use `postgres` hostname in Docker)
- `REDIS_URL` — Redis connection (use `redis` hostname in Docker)
- `SESSION_SECRET` — Express session secret (generate a random string)
- `MARKITDOWN_AGENT_BASE_URL` — URL of the markitdown agent service
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe integration (optional)

## License

Internal project — Suzie Law AI.

## Project Statistics

| Category        | Count |
| --------------- | ----- |
| Server routes   | 21    |
| Server services | 20    |
| Client pages    | 21    |
| Prisma models   | 28    |
| TS/TSX files    | ~1,000+ |
| Tests passing   | 62+   |

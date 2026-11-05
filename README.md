# GPON Network Management

Web platform to **design, document and monitor GPON / XGS-PON outside plant**, built for fiber operators in Ecuador.

It combines a GIS map editor for the passive network (OLT → splitter → NAP), an optical budget calculator tuned for tropical conditions, and live ONT telemetry collected over SNMP.

> Developer and agent documentation (architecture, database, roles, conventions) lives in [`CLAUDE.md`](CLAUDE.md). This README is the entry point.

---

## What it does today

**Network editor** (`/networks/[id]`)
- View / Design / Edit modes on a Mapbox map, with undo/redo (50 steps)
- OLTs, splitters, NAPs, closures (mufas), fiber routes and route points (crossings, reserves, splices)
- Logical single-line diagram with per-path accumulated optical loss
- Optical budget semaphore per route (fiber + splitters + connectors + splices + safety margin)
- NAP capacity tracking (used / reserved / available, warnings at 70% / 90%)
- Data quality per element (unknown → approximate → drawn → GPS captured → verified)
- Topology templates: Star 1:16, Tree 1:32, Cascade 1:64
- Operative codes by zone (`PIC-UIO-Z05-NAP-128`)

**Field capture** (`/networks/[id]/capture`) — closures and internal splitters.

**Monitoring** (`/monitoring`)
- Standalone SNMP collector (`apps/collector`) polling Huawei OLTs (or a mock with 16 synthetic ONTs)
- ONT status, RX power, temperature and distance, pushed live via Supabase Realtime
- Filtered history: only status changes, degradations (> 1.5 dB) and periodic samples (~94% less volume), with tiered retention (samples 30 days, events 1 year)

**Administration** (`/admin`) — user and role management, network archiving, and an audit log that records every network/infrastructure change via database triggers.

**Not yet:** live map markers, fault localization along routes, distance measuring tool, customers / services / drops (Phase 4). See *Pendiente* in [`CLAUDE.md`](CLAUDE.md).

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| Map | Mapbox GL JS 3, mapbox-gl-draw, Turf.js |
| State | Zustand + Zundo, TanStack Query |
| Backend | Supabase: Auth, PostgreSQL + PostGIS, Realtime, RLS |
| Collector | Node.js + net-snmp (SNMP v2c) |
| Tooling | pnpm, Biome, TypeScript |

---

## Repository layout

```
apps/
├── web/           # Next.js app
└── collector/     # SNMP → Supabase poller (see apps/collector/README.md)
database/
└── migrations/    # 001-029 SQL migrations (schema, RLS, RPCs, seeds)
docs/              # Domain research, UX specs, ADRs — index in CLAUDE.md
```

There is no root workspace: each app installs its own dependencies.

---

## Getting started

**Prerequisites:** Node.js ≥ 20.9, pnpm 10, a Supabase project with PostGIS, a Mapbox token. Upstash Redis is optional but recommended.

### Web app

```bash
cd apps/web
pnpm install
cp .env.local.example .env.local
pnpm dev
```

Fill `.env.local`:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 2025 key format (replaces the anon key) |
| `SUPABASE_SECRET_KEY` | Server only — user admin and audit |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | |
| `NEXT_PUBLIC_SITE_URL` | Used in password reset emails |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Rate limiting for login and password reset. **If missing, those endpoints run unprotected.** |

There is no public sign-up: an admin invites users by email from `/admin/users`. The role is stored in `auth.users.app_metadata.role`.

### Collector

```bash
cd apps/collector
pnpm install
cp .env.example .env
pnpm dev
```

`MOCK_MODE=true` (the default) generates synthetic ONTs without hardware. For a real OLT, set `MOCK_MODE=false`, `OLT_HOST`, `OLT_COMMUNITY`, `SUPABASE_SERVICE_KEY` and `NETWORK_ID`. Details in [`apps/collector/README.md`](apps/collector/README.md).

### Database

> ⚠️ The migrations in `database/migrations` **cannot yet rebuild the database from scratch**: the `networks` table and the `create_network` RPC were applied directly in Supabase and are not versioned. Use the existing Supabase project until a baseline migration is added.

### Checks

```bash
cd apps/web
pnpm check
```

```bash
cd apps/web
pnpm build
```

---

## Roles

| Role | Scope |
|---|---|
| `admin` | Everything, including deletes, users and archiving |
| `network_engineer` | Design and edit infrastructure |
| `outside_plant` | Field review and data quality (no direct infrastructure writes) |
| `installer`, `support` | Reserved for Phase 4 |

Authorization is enforced by Postgres RLS. The full matrix is in [`CLAUDE.md`](CLAUDE.md#roles-y-permisos).

---

## Documentation

Most documentation is in Spanish.

- [`CLAUDE.md`](CLAUDE.md): current state, architecture, database, roles, conventions, and an index of `docs/` with each document's status
- [`docs/GPON_FTTH_ECUADOR_RESEARCH.md`](docs/GPON_FTTH_ECUADOR_RESEARCH.md): canonical technical reference (optical budgets, materials, practices)
- [`docs/TOPOLOGIES.md`](docs/TOPOLOGIES.md): Star / Tree / Cascade / Bus and XGS-PON readiness
- [`docs/adr/`](docs/adr/): architecture decision records
- [`docs/DOCS_AUDIT.md`](docs/DOCS_AUDIT.md): latest documentation audit and known inconsistencies

# GPON Network Management System

## Stack
- **Next.js 16** (App Router) — `apps/web/`
- **Supabase** — Auth + PostgreSQL + PostGIS + Realtime
- **Mapbox GL JS v3** — mapa interactivo
- **Tailwind CSS v4** + **shadcn/ui**
- **Biome** — linting y formatting (no ESLint, no Prettier)
- **pnpm** — gestor de paquetes

## Next.js 16 — reglas críticas
- `cookies()`, `headers()`, `params` → siempre `await` (sync access eliminado en v16)
- Auth guard en `proxy.ts` (NO `middleware.ts` — renombrado en v16)
- Route handlers, layouts y pages usan `async` para acceder a request APIs

## Comandos
```bash
cd apps/web
pnpm dev          # servidor de desarrollo
pnpm check        # lint + format check
pnpm check:fix    # lint + format auto-fix
pnpm build        # build de producción
```

## Estructura
```
apps/web/
├── app/
│   ├── (auth)/login/       # Página de login
│   ├── (auth)/register/    # Página de registro
│   └── (dashboard)/map/    # Mapa principal GPON
├── components/
│   ├── map/                # Componentes Mapbox GL JS
│   └── network/            # Cards OLT, Splitter, NAP, ONT
├── lib/
│   ├── types/gpon.ts       # Tipos TypeScript de la red
│   ├── supabase/client.ts  # Cliente browser
│   ├── supabase/server.ts  # Cliente server (async cookies)
│   └── mapbox/config.ts    # Token + centro mapa (Quito)
└── proxy.ts                # Auth guard (Next.js 16)

database/migrations/
├── 001_initial_schema.sql  # Tablas + PostGIS + índices espaciales
├── 002_rls_policies.sql    # Row Level Security
└── 003_seed_ecuador.sql    # Datos simulados en Quito
```

## Modelo de datos GPON
```
OLT → Splitter → NAP → ONT
```
Todas las tablas tienen columna `geography(Point/LineString, 4326)` para PostGIS.

## Variables de entorno
Copiar `apps/web/.env.local.example` → `apps/web/.env.local` y completar con credenciales de Supabase y Mapbox.

## Roles de usuario
- `technician` — lectura + crear/actualizar incidentes
- `administrator` — acceso completo (CRUD de red)
Rol almacenado en `auth.users.raw_user_meta_data.role`

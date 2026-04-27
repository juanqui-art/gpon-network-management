# GPON Network Management System

## Stack
- **Next.js 16.2.4** (App Router) — `apps/web/`
- **React 19.2.4**
- **Supabase** — Auth + PostgreSQL + PostGIS + Realtime (`ybijrwyenlfemjjueopo`)
- **Mapbox GL JS v3.22** — mapa interactivo
- **Tailwind CSS v4** + **shadcn/ui** (pendiente instalar)
- **Biome 2.4** — linting y formatting (no ESLint, no Prettier)
- **pnpm** — gestor de paquetes

## Next.js 16 — reglas críticas
- `cookies()`, `headers()`, `params` → siempre `await` (sync access eliminado en v16)
- Auth guard en `proxy.ts` (NO `middleware.ts` — renombrado en v16)
- Route handlers, layouts y pages usan `async` para acceder a request APIs
- Leer `node_modules/next/dist/docs/` antes de escribir código Next.js

## Comandos
```bash
cd apps/web
pnpm dev          # servidor de desarrollo
pnpm check        # lint + format check
pnpm check:fix    # lint + format auto-fix
pnpm build        # build de producción
```

## Estructura actual (lo que existe)
```
apps/web/
├── app/
│   ├── globals.css
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Redirige a /map
│   ├── (auth)/
│   │   ├── layout.tsx                # Contenedor centrado dark
│   │   ├── login/page.tsx            # Login email/password
│   │   └── register/page.tsx         # Registro (rol inicial: a definir)
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Header con botón salir
│   │   └── map/page.tsx              # Server component — carga datos vía RPCs
│   └── actions/auth.ts               # signIn, signUp, signOut (server actions)
├── components/map/
│   ├── map-view.tsx                  # Visor + editor Mapbox (3000+ líneas)
│   ├── equipment-panel.tsx           # Panel detalle equipo (ONT enriquecido)
│   └── types.ts                      # Tipos de mapa (EquipmentMapItem, etc.)
├── lib/
│   ├── env.ts                        # requireEnv() — falla rápido si falta variable
│   ├── types/gpon.ts                 # Tipos TS del MVP (3 tablas + ENUMs + helpers)
│   ├── map/palette.ts                # Colores del mapa (TYPE_COLOR, STATUS_COLOR…)
│   ├── supabase/client.ts            # Cliente browser
│   ├── supabase/server.ts            # Cliente server (async cookies)
│   └── mapbox/config.ts              # Token + centro mapa (Quito)
├── proxy.ts                          # Auth guard (Next.js 16)
├── biome.json
└── package.json

database/migrations/                  # ✅ 001-006 APLICADAS en Supabase
├── 001_initial_schema.sql            # 3 tablas + 13 ENUMs + indices + trigger
├── 002_rls_policies.sql              # RLS para 5 roles + get_user_role()
├── 003_seed_dev.sql                  # Red mínima Quito (8 elementos, 7 rutas, 3 puntos)
├── 004_map_rpcs.sql                  # RPCs lectura: *_for_map()
├── 005_editor_mutations.sql          # RPCs escritura: create_infrastructure_element_draft, create_fiber_route_draft
└── 006_route_point_and_delete_rpcs.sql # create_route_point_draft + delete_*

docs/
├── MVP_SCOPE.md                  # Alcance autoritativo del MVP
├── INFRASTRUCTURE_EDITOR_PLAN.md # Vision de producto
├── OPERATIONAL_ROLES.md          # Definicion de los 5 roles
├── EDITOR_UI_UX_SPEC.md          # Spec de UI/UX por modo
├── GPON_SYMBOLOGY.md             # Iconografia tecnica
└── adr/
    ├── 0001-single-tenant-mvp.md
    ├── 0002-no-port-tracking.md
    └── 0003-operational-tables-phase-4.md
```

## Estado del editor (map-view.tsx)
- ✅ Visor modo `view`: markers SVG, rutas coloreadas, route points, leyenda, filtros
- ✅ Editor modo `edit`: toolbar 11 herramientas (V/H/O/S/N/F/C/R/E/M + Del), shortcuts
- ✅ Crear OLT/splitter/NAP por click → draft → guardar vía RPC
- ✅ Dibujar fibra (feeder/distribution) origen→vértices→destino → guardar vía RPC
- ✅ Marcar cruce/reserva/empalme sobre ruta seleccionada → guardar vía RPC
- ✅ Panel de propiedades: lectura de elementos/rutas/route points; edición de drafts
- ❌ Editar elementos/rutas existentes (faltan RPCs update_* y UI de edición)
- ❌ Herramienta delete (RPC existe, falta conectar handler)
- ❌ Herramienta measure (sin implementar)
- ⚠️ map-view.tsx tiene 3100+ líneas — candidato a partir en subcomponentes

## Pendiente de construir
- Conectar herramienta delete (RPCs delete_* ya existen en migración 006)
- RPCs update_infrastructure_element / update_fiber_route + UI de edición
- Herramienta measure
- Registro: definir rol inicial y flujo de asignación
- Instalar shadcn/ui (cuando haya pantallas de admin/inventario)

## Base de datos (Supabase)
- **Proyecto:** `ybijrwyenlfemjjueopo` — migraciones aplicadas
- **Tablas MVP (3):** `infrastructure_elements`, `fiber_routes`, `route_points`
- **ENUMs (13):** `user_role`, `element_type`, `element_status`, `data_quality`, `pon_standard`, `split_ratio`, `route_type`, `route_status`, `installation_type`, `fiber_type`, `route_point_type`, `crossing_type`, `risk_level`
- **Seed dev:** 1 OLT, 2 splitters, 5 NAPs, 7 rutas (2 feeder + 5 distribution), 3 puntos (1 cruce, 1 reserva, 1 empalme)

## Modelo de datos GPON (MVP)
```
infrastructure_elements (OLT, Splitter, NAP)
fiber_routes            (feeder, distribution, other)   — con from/to a elementos
route_points            (crossing, reserve, splice)     — siempre asociados a una ruta
```
- Conectividad plana: `fiber_routes.from_element_id` / `to_element_id` directo (no grafo logico)
- Calidad de dato: ENUM `data_quality` unificado en `location_quality` y `route_quality`
- Geometria con `geography(Point/LineString, 4326)` (PostGIS)
- Capacidad por contadores: `total_pon_ports`, `total_ports` (sin tabla de puertos — ver ADR 0002)
- Distribucion (clientes, ONTs, drops) y operacion (incidentes, signal, audit) → Fase 4 (ADR 0003)
- Single-tenant en MVP (ADR 0001)

## Variables de entorno
Copiar `apps/web/.env.local.example` → `apps/web/.env.local` y completar:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   # nueva nomenclatura Supabase 2025 (reemplaza anon key)
SUPABASE_SECRET_KEY
NEXT_PUBLIC_MAPBOX_TOKEN
```

## Roles de usuario (5 base, 3 activos en MVP)
- `admin` — gobierno, todo CRUD, unico que puede borrar
- `network_engineer` — diseno, validacion, CRUD infraestructura
- `outside_plant` — campo, CRUD infraestructura, marcar puntos
- `installer` — Fase 4 (instalaciones de cliente)
- `support` — Fase 4 (incidentes y consulta)

Rol almacenado en `auth.users.raw_user_meta_data.role`, leido via `get_user_role()` en RLS.
Detalle de permisos por rol en `docs/OPERATIONAL_ROLES.md`.

Matriz de RLS en MVP:
- `read`   → cualquier autenticado
- `insert` → admin, network_engineer, outside_plant
- `update` → admin, network_engineer, outside_plant
- `delete` → admin

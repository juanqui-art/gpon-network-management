# GPON Network Management System

Sistema web para diseñar, documentar y monitorear planta externa GPON/XGS-PON (Ecuador).
Monorepo: `apps/web` (Next.js) + `apps/collector` (colector SNMP) + `database/migrations` (Supabase).

> Este archivo describe el estado **real** del código. Si algo aquí contradice al código, el código manda y este archivo se corrige.
> Última revisión contra el código: 2026-11-04 (ver `docs/DOCS_AUDIT.md`).

## Stack
- **Next.js 16.2.4** (App Router) + **React 19.2.4** — `apps/web/`
- **Supabase** — Auth + PostgreSQL + PostGIS + Realtime (proyecto `ybijrwyenlfemjjueopo`)
- **Mapbox GL JS 3.22** + **@mapbox/mapbox-gl-draw** — mapa y dibujo de rutas
- **Zustand 5 + Zundo 2** — store del editor con undo/redo (50 pasos)
- **@tanstack/react-query 5** — data fetching en editor y captura
- **Turf.js** — cálculos geoespaciales
- **@xyflow/react** — diagrama lógico · **lightweight-charts** — series RX
- **Tailwind CSS v4** + **shadcn/ui** (instalado, `components/ui/`) + **radix-ui**, **cmdk**, **vaul**, **motion**
- **Upstash Redis** — rate limiting de login y reset de contraseña
- **Biome 2.4** — lint + format (no ESLint, no Prettier)
- **pnpm 10**, Node **>= 20.9**

## Next.js 16 — reglas críticas
- `cookies()`, `headers()`, `params` → siempre `await` (acceso síncrono eliminado en v16)
- Auth guard en `apps/web/proxy.ts` (**NO** `middleware.ts` — renombrado en v16)
- Route handlers, layouts y pages son `async` para acceder a request APIs
- Leer `apps/web/node_modules/next/dist/docs/` antes de escribir código Next.js (ver `apps/web/AGENTS.md`)

## Comandos
```bash
cd apps/web
pnpm dev          # servidor de desarrollo
pnpm check        # lint + format check (correr antes de commitear)
pnpm check:fix    # lint + format auto-fix
pnpm build        # build de producción
```
```bash
cd apps/collector
pnpm dev          # colector (MOCK_MODE=true por defecto en .env.example)
```

## Rutas de la aplicación
```
/                              → redirige a /dashboard
/login                         → auth (público)
/forgot-password               → solicitar reset (público, rate limited)
/reset-password                → nuevo password desde email
/auth/callback                 → callback de Supabase Auth
/dashboard                     → resumen general
/networks                      → lista de redes, crear, archivar
/networks/[id]                 → editor de red (NetworkEditorShell + NetworkEditorMap)
/networks/[id]/capture         → captura de campo (closures/mufas, splitters internos)
/map                           → mapa de consulta read-only (ReadonlyMapViewer)
/monitoring                    → estado de OLTs/ONTs (telemetría)
/monitoring/olt/[host]         → detalle de OLT con Realtime (use-ont-realtime)
/admin/users                   → gestión de usuarios y roles (solo admin)
/admin/audit                   → visor de audit_logs
/admin/settings                → ajustes
```
No hay registro público: los usuarios se crean desde `/admin/users`.
`proxy.ts`: sin sesión → `/login`; rutas `/api/*` sin sesión → 401.

## Estructura (por responsabilidad)
```
apps/web/
├── proxy.ts                      # Auth guard
├── app/
│   ├── (auth)/                   # login, forgot-password, reset-password
│   ├── (dashboard)/              # layout + dashboard-nav; dashboard, networks, map, monitoring, admin
│   ├── actions/                  # auth.ts, users.ts (server actions)
│   └── auth/callback/route.ts
├── components/
│   ├── map/                      # editor y viewer Mapbox, inspector, capas, paneles
│   │   ├── network-editor-map.tsx
│   │   ├── readonly-map-viewer.tsx
│   │   ├── map-inspector-{shell,primitives}.tsx
│   │   ├── equipment-layers.ts   # GeoJSON + capas Mapbox centralizadas
│   │   ├── optical-budget-panel.tsx, nap-capacity.tsx, olt-technical-editor.tsx …
│   │   └── logical-diagram/      # unifilar: tree-builder, layout-engine, budget-alerts, chart
│   ├── monitoring/               # KPIs, health, badges ONT, RX sparkline, live indicator
│   ├── command/                  # command palette, atajos globales, overlay de atajos
│   ├── topology/                 # selector Star/Tree/Cascade
│   └── ui/                       # shadcn (button, card, dialog, badge, app-drawer)
└── lib/
    ├── gpon/                     # optical-budget, operative-code, topology-templates,
    │                             # olt-catalog, olt-properties, nap-config, symbology
    ├── map/                      # palette, route-geometry-editor
    ├── store/network-editor.ts   # Zustand + Zundo
    ├── hooks/                    # use-ont-realtime, atajos editor/navegación/historial
    ├── auth/                     # roles, permissions, rate-limit, supabase-errors
    ├── audit/log.ts              # escritura de audit_logs
    ├── supabase/                 # client, server, admin (service role — solo server)
    ├── types/                    # gpon.ts (tablas, ENUMs, helpers de permisos), network.ts
    └── providers/query-provider.tsx

apps/collector/                   # Node SNMP → Supabase (ver apps/collector/README.md)
└── src/{config,index}.ts, snmp/, parser/, decide/, persist/

database/migrations/              # 001-027 (ver advertencia abajo)
docs/                             # ver "Mapa de documentación"
```

## Estado funcional

### Editor de red (`/networks/[id]`)
- ✅ Modos `view` / `design` / `edit` (atajos `v` / `d` / `e`; `edit` solo con permiso de escritura)
- ✅ Inspector derecho compartido, overlays (stats, leyenda, controles)
- ✅ Mover elementos, ajustar vértices de rutas, snap y validación geométrica
- ✅ Diagrama unifilar con presupuesto óptico acumulado y alertas
- ✅ Calidad de dato, capacidad NAP (umbrales 70% / 90%), códigos operativos, undo/redo
- ✅ Templates de topología: Star (1:16), Tree (1:32), Cascade (1:64), Blank
- ⚠️ Flujo de creación en `design`: funcional, en consolidación
- ❌ Herramienta `measure`: existe el tipo en el store y el label, **sin implementación**

### Monitoreo (Fase 2)
- ✅ Colector `apps/collector` (mock y SNMP v2c real, Huawei)
- ✅ Tablas `ont_current_state` + `ont_signal_history`, publicadas en Realtime
- ✅ `/monitoring` y `/monitoring/olt/[host]` con suscripción Realtime (`lib/hooks/use-ont-realtime.ts`)
- ✅ Telemetría ONT en `equipment-panel.tsx`
- ❌ Marcadores del mapa actualizados en vivo (el mapa no se suscribe a Realtime)
- ❌ `locate_fault_along_route()` — no existe en BD
- ❌ Despliegue del colector en RPi (systemd, logs) — `docs/COLLECTOR_DEPLOYMENT.md` pendiente

### Administración
- ✅ Gestión de usuarios/roles (admin), cierre de sesiones vía `auth.sessions`
- ✅ Audit log + visor
- ✅ Archivado lógico de redes (`archived_at`, solo admin, RPC `SECURITY DEFINER`)
- ✅ Rate limiting de auth (si faltan las vars de Upstash: **fail-open** con warning)

## Pendiente (priorizado)
1. 🔴 **Versionar schema faltante** — ver advertencia de BD
2. 🔴 **Unificar regla del semáforo óptico** — ver sección calculadora
3. 🟡 Marcadores del mapa en vivo + diagnóstico `locate_fault_along_route()`
4. 🟡 Herramienta `measure` (`@turf/length` instalado)
5. 🟡 Consolidar flujo de creación y formularios del inspector
6. 🟢 Splitters desbalanceados (10/90, 20/80…)
7. 🟢 Flujo de propuesta/verificación para `outside_plant` (hoy no puede escribir infraestructura)
8. 🔵 Fase 4: clientes, servicios, drops, incidentes (ADR 0003)

## Base de datos (Supabase)

> ⚠️ **Las migraciones del repo NO reconstruyen la BD.** La tabla `networks`, las columnas
> `network_id` de infraestructura y el RPC `create_network` se aplicaron directamente en Supabase
> y no están en ninguna migración. `010_network_zones.sql` referencia `networks(id)`, por lo que
> aplicar 001→027 sobre una BD vacía falla. No asumir que el repo es la fuente de verdad del schema
> hasta resolverlo (dump + migración baseline).

**Tablas:**
| Tabla | Propósito |
|---|---|
| `networks` | raíz; nombre, topología, `created_by`, `archived_at/by` (027) — *no versionada* |
| `infrastructure_elements` | OLT, splitter, NAP, closure (mufa); `management_ip` para OLT (022) |
| `fiber_routes` | feeder / distribution; `from/to_element_id`; `reservation_m` (020) |
| `route_points` | crossing, reserve, splice, mufa |
| `network_zones` | zonas por red → `{ZONA}` del código operativo (010) |
| `audit_logs` | trazabilidad de cambios (012) |
| `ont_current_state` | último estado por ONT (UPSERT del colector) (021) |
| `ont_signal_history` | historial filtrado (change / degradation / sample) (021) |

**ENUMs:** 13 originales (001) + valores añadidos en 018 (`element_type.closure`, `route_point_type.mufa`) y ENUMs de 021 para monitoreo.
**Geometría:** `geography(Point/LineString, 4326)`. Longitud de rutas desde geometría GIS (017).
**RPCs de lectura:** `infrastructure_elements_for_map`, `fiber_routes_for_map`, `route_points_for_map` (variante con `p_network_id` desde 022), `list_networks` (027), `network_zones_for_network` (011).
**RPCs de escritura:** `create_*_draft`, `update_*`, `delete_*` (005-008, 015-016), captura closure/mufa (019). Son `SECURITY INVOKER` → aplica RLS.

**Migraciones:** 001-027. Notables desde 017:
- 018-019 closures/mufas y splitters dentro de closure/NAP
- 020 `reservation_m` (slack óptico)
- 021 tablas de monitoreo ONT · 022 `management_ip` · 023 seed telemetría Cuenca · 024 índices + Realtime delete
- 025 **restringe escritura de infraestructura a admin/network_engineer**
- 026 `WITH CHECK` en update de `networks` · 027 archivado de redes

**Seeds:** 003 (Quito: 8 elementos, 7 rutas, 3 puntos), 014 (Cuenca, Star 1:16), 023 (16 ONTs mock).

## Roles y permisos
Rol en `auth.users.app_metadata.role` (no `raw_user_meta_data`: el usuario puede editarlo). Leído por `get_user_role()` en RLS y por `lib/auth/roles.ts` en la app.

| Rol | Uso |
|---|---|
| `admin` | todo, único que borra, gestiona usuarios, archiva redes |
| `network_engineer` | diseño y edición de infraestructura |
| `outside_plant` | campo: revisión, calidad geográfica, observaciones — **sin escritura directa** de infraestructura desde 025 |
| `installer` | Fase 4 |
| `support` | Fase 4 (lectura operativa) |

**Matriz RLS actual** (tras 025/026):
| Tabla | read | insert / update | delete |
|---|---|---|---|
| `infrastructure_elements`, `fiber_routes`, `route_points` | autenticado | admin, network_engineer | admin |
| `networks` | autenticado | admin, network_engineer, outside_plant | admin (archivado vía RPC) |
| `ont_current_state`, `ont_signal_history` | autenticado | admin, network_engineer (el colector usa service key) | admin |

Detalle conceptual de roles: `docs/OPERATIONAL_ROLES.md` (tiene secciones previas a 025; la matriz de esta tabla manda).

## Calculadora óptica (`lib/gpon/optical-budget.ts`)
```
Pérdida total = fibra (longitud GIS + reservation_m) × atenuación
              + splitters + conectores + empalmes + margen de seguridad
```
Valores en código: atenuación 1490 nm 0.3 dB/km (default downstream), conector 0.5 dB (2 por defecto),
empalme 0.1 dB, **margen de seguridad 3.0 dB** (`SAFETY_MARGIN_DB`).

**Semáforo en código:** verde margen > 4 dB · amarillo 2–4 dB · rojo < 2 dB · gris sin clase óptica del OLT.

> ⚠️ **Inconsistencia abierta:** la documentación histórica usa otros valores
> (README y TOPOLOGIES: margen 4.0 dB; `GPON_FTTH_ECUADOR_RESEARCH.md`: verde > 3 / ámbar 1–3).
> Hasta decidir la regla, **el código es la referencia**. Al cambiarla, actualizar código + research en el mismo commit.

## Códigos operativos (`lib/gpon/operative-code.ts`)
```
Patrón: {PROV}-{CIUDAD}-{ZONA}-{TIPO}-{SEQ}
Draft:  PIC-UIO-DRF-NAP-001
Campo:  PIC-UIO-Z05-NAP-128
```
`zone` es parámetro; `Z05` es solo el default. Zonas por red en `network_zones`.

## Colector (`apps/collector`)
- `MOCK_MODE=true` → 16 ONTs sintéticas · `MOCK_MODE=false` + `OLT_HOST` → SNMP v2c UDP 161
- Siempre UPSERT en `ont_current_state`; INSERT en `ont_signal_history` solo si:
  `change` (cambió status), `degradation` (|Δrx| > 1.5 dB), `sample` (cada 10 polls) → ~94% menos volumen
- Usa `SUPABASE_SERVICE_KEY` (bypass RLS): solo como secret, nunca en el frontend

## Variables de entorno
`apps/web/.env.local` (desde `.env.local.example`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   # claves Supabase 2025 (reemplaza anon key)
SUPABASE_SECRET_KEY                    # solo server (lib/supabase/admin.ts)
NEXT_PUBLIC_MAPBOX_TOKEN
NEXT_PUBLIC_SITE_URL                   # enlaces de email
UPSTASH_REDIS_REST_URL                 # rate limit; sin ellas → fail-open
UPSTASH_REDIS_REST_TOKEN
```
`apps/collector/.env` (desde `.env.example`): `MOCK_MODE`, `OLT_*`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NETWORK_ID`, `POLL_INTERVAL_MS`, `DEGRADATION_THRESHOLD_DB`, `SAMPLE_EVERY_N_POLLS`.

## Mapa de documentación (`docs/`)
| Estado | Documentos |
|---|---|
| **Canónico** | `GPON_FTTH_ECUADOR_RESEARCH.md` (referencia técnica), `TOPOLOGIES.md`, `GPON_SPLIT_RATIO_GUIDELINES.md`, `GPON_SYMBOLOGY.md`, `NAP_CAPACITY.md`, `FIBER_ROUTE_THREAD_MODEL.md`, `UNIFILAR_EJEMPLO_REAL.md` |
| **Decisiones** | `adr/0001-single-tenant-mvp.md`, `adr/0002-no-port-tracking.md`, `adr/0003-operational-tables-phase-4.md` (*parcialmente superado*: `audit_logs` y monitoreo ONT ya existen) |
| **Producto / UX** | `MVP_SCOPE.md`, `EDITOR_UI_UX_SPEC.md`, `NETWORK_MAP_UX_FLOW.md`, `WORKFLOW_ANALYSIS.md`, `OPERATIONAL_ROLES.md` |
| **OLT / monitoreo** | `REALTIME_MONITORING_RESEARCH.md` (base del colector), `OLT_REFERENCE.md`, `OLT_OPERATIONS.md`, `OLT_DEPLOYMENT.md`, `OLT_INTEGRATION_GUIDE.md` (*su arquitectura de colector dentro de Next.js fue descartada*) |
| **Planes / investigación** | `PREMIUM_UI_UX_RESEARCH.md` (propuesta; cita archivos no creados), `INFRASTRUCTURE_EDITOR_PLAN.md` (previo a ADR 0001), `OPERATIONAL_ROLE_RESEARCH.md`, `research-sources/ANALISIS_TECNICO.md` |
| **Desactualizados** | `MVP_TASKS.md`, `CREATION_FLOW_TEST.md` — no usar como estado actual |
| **Auditoría** | `DOCS_AUDIT.md` |

## Convenciones para mantener este archivo
- Al añadir una migración: actualizar la sección BD (y la matriz RLS si toca políticas).
- Al añadir una ruta en `app/`: actualizar "Rutas".
- Valores numéricos de la calculadora: solo aquí y en `optical-budget.ts`; los demás docs enlazan.

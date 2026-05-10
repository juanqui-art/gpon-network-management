# GPON Network Management System

## Stack
- **Next.js 16.2.4** (App Router) — `apps/web/`
- **React 19.2.4**
- **Supabase** — Auth + PostgreSQL + PostGIS + Realtime (`ybijrwyenlfemjjueopo`)
- **Mapbox GL JS v3.22** — mapa interactivo
- **@mapbox/mapbox-gl-draw** — herramienta de dibujo de rutas en el mapa
- **Zustand v5 + Zundo v2** — state management del editor con undo/redo (50 steps)
- **Turf.js** — cálculos geoespaciales (distance, length, nearest-point)
- **@tanstack/react-query v5** — data fetching (provider instalado, pendiente uso)
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

## Rutas de la aplicación
```
/                   → redirige a /networks
/login              → auth
/register           → auth
/networks           → lista de redes + crear nueva
/networks/[id]      → editor de red (NetworkEditorShell + NetworkEditorMap)
/map                → mapa de consulta/read-only (ReadonlyMapViewer)
```

## Estructura actual
```
apps/web/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                          # Redirige a /networks
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Header nav (Redes, Salir)
│   │   ├── map/page.tsx                  # Mapa de consulta/read-only
│   │   └── networks/
│   │       ├── page.tsx                  # Lista redes (server, llama list_networks RPC)
│   │       ├── networks-client.tsx       # UI crear/listar redes
│   │       └── [id]/
│   │           ├── page.tsx              # Editor de red (server)
│   │           └── network-editor-shell.tsx  # Shell con Zustand store + NetworkEditorMap
│   └── actions/auth.ts
├── components/
│   ├── map/
│   │   ├── network-editor-map.tsx        # Contenedor del mapa en el editor
│   │   ├── readonly-map-viewer.tsx       # Viewer read-only para /map
│   │   ├── map-inspector-shell.tsx       # Marco compartido del inspector derecho
│   │   ├── map-inspector-primitives.tsx  # Filas/secciones compartidas del inspector
│   │   ├── map-overlay-components.tsx    # Stats, leyenda y controles compartidos
│   │   ├── equipment-layers.ts           # GeoJSON + gestión de capas Mapbox centralizadas
│   │   ├── mapbox-shared-style.ts        # Constantes de estilo compartidas (colores fibra, labels)
│   │   ├── context-menu.tsx              # Menú contextual del diagrama
│   │   ├── olt-model-selector.tsx        # Selector de modelo OLT (clase óptica)
│   │   ├── olt-technical-editor.tsx      # Inventario/cabecera OLT compartido
│   │   ├── data-quality-badge.tsx        # Badge de calidad de datos
│   │   ├── nap-capacity.tsx              # Barra de capacidad NAP
│   │   ├── optical-budget-panel.tsx      # Calculadora óptica con semáforo
│   │   ├── equipment-panel.tsx           # Panel detalle equipo (ONT enriquecido)
│   │   ├── types.ts                      # Tipos de mapa
│   │   └── logical-diagram/              # Diagrama lógico unifilar
│   │       ├── index.tsx                 # Entry point + panel colapsable
│   │       ├── diagram.tsx               # Canvas SVG del diagrama
│   │       ├── nodes.tsx                 # Nodos OLT/Splitter/NAP
│   │       ├── edges.tsx                 # Aristas con pérdidas ópticas
│   │       ├── layout-engine.ts          # Algoritmo de posicionamiento
│   │       ├── tree-builder.ts           # Construcción del árbol jerárquico
│   │       ├── path-utils.ts             # Utilidades de rutas SVG
│   │       └── types.ts                  # Tipos del diagrama
│   └── topology/
│       └── topology-picker.tsx           # Selector de topología (Star/Tree/Cascade)
├── lib/
│   ├── env.ts
│   ├── types/
│   │   ├── gpon.ts                       # Tipos TS MVP (tablas + ENUMs + helpers)
│   │   └── network.ts                    # Tipos Network, NetworkSummary, topologías
│   ├── map/
│   │   ├── palette.ts                    # Colores (TYPE_COLOR, STATUS_COLOR, DATA_QUALITY_COLOR…)
│   │   └── route-geometry-editor.ts      # Dibujo de rutas, snap de vértices, validación geométrica
│   ├── gpon/
│   │   ├── optical-budget.ts             # Calculadora presupuesto óptico GPON/XGS-PON
│   │   ├── operative-code.ts             # Generador códigos operativos (PIC-UIO-Z05-NAP-128)
│   │   └── topology-templates.ts         # Generador topologías pre-configuradas
│   ├── store/
│   │   └── network-editor.ts             # Zustand store con undo/redo para el editor
│   ├── providers/
│   │   └── query-provider.tsx            # React Query provider
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   └── mapbox/config.ts
├── proxy.ts
├── biome.json
└── package.json

database/migrations/                      # ✅ 001-021 APLICADAS en Supabase
├── 001_initial_schema.sql                # 3 tablas + 13 ENUMs + indices + trigger
├── 002_rls_policies.sql                  # RLS para 5 roles + get_user_role()
├── 003_seed_dev.sql                      # Red mínima Quito (8 elementos, 7 rutas, 3 puntos)
├── 004_map_rpcs.sql                      # RPCs lectura: *_for_map() (con/sin p_network_id)
├── 005_editor_mutations.sql              # create_infrastructure_element_draft, create_fiber_route_draft
├── 006_route_point_and_delete_rpcs.sql   # create_route_point_draft + delete_*
├── 007_fix_role_app_metadata.sql         # Rol en app_metadata
├── 008_update_rpcs.sql                   # update_infrastructure_element + update_fiber_route
├── 009_nap_internal_splitter.sql         # NAP con splitter PLC interno (split_ratio + insertion_loss_db)
├── 009_restrict_infrastructure_write_roles.sql  # outside_plant → solo verificación, no write directo
├── 010_network_zones.sql                 # Zonas geográficas por red ({ZONA} en códigos operativos)
├── 011_network_zones_rpc.sql             # RPC: network_zones_for_network()
├── 012_audit_logs.sql                    # Tabla audit_logs para trazabilidad
├── 013_nap_properties.sql                # Propiedades NAP: nap_mode (terminal/with_splitter/prepared)
├── 014_seed_cuenca.sql                   # Red Cuenca — Star 1:16, El Ejido/San Sebastián
├── 015_fix_update_infrastructure_element_ambiguous_id.sql  # Fix columna id ambigua en RPC
├── 016_fix_update_fiber_route_ambiguous_id.sql             # Fix columna id ambigua en RPC
├── 017_use_geometry_length_for_fiber_routes.sql            # Longitud desde geometría GIS
├── 018_closure_mufa_capture_persistence.sql                # ENUMs closure y mufa
├── 019_capture_closure_mufa_rpcs.sql                       # RPCs captura de closure/mufa
├── 020_fiber_route_reservation.sql                         # fiber_routes.reservation_m (slack óptico)
└── 021_ont_monitoring_tables.sql                           # ont_current_state + ont_signal_history (telemetría tiempo real)

docs/
├── MVP_SCOPE.md                          # Alcance y criterios de cierre del MVP
├── MVP_TASKS.md                          # Checklist de tareas (puede estar desactualizado)
├── INFRASTRUCTURE_EDITOR_PLAN.md         # Plan del editor (precede ADR 0001; ver conflicto org_id)
├── OPERATIONAL_ROLES.md                  # Roles y permisos (admin/engineer/outside_plant/…)
├── OPERATIONAL_ROLE_RESEARCH.md          # Fuente de investigación de roles (solapado con anterior)
├── EDITOR_UI_UX_SPEC.md                  # Especificación UX del editor por modo/zoom/herramienta
├── NETWORK_MAP_UX_FLOW.md                # Flujo UX del mapa: vista/edición/zoom
├── WORKFLOW_ANALYSIS.md                  # Flujo operador: entrar → ver → buscar → editar → guardar
├── CREATION_FLOW_TEST.md                 # Plan de prueba del flujo de creación (puede estar desactualizado)
├── GPON_SYMBOLOGY.md                     # Colores e iconos por tipo/estado/calidad
├── TOPOLOGIES.md                         # Guía topologías Star/Tree/Cascade/Bus Ecuador + XGS-PON
├── NAP_CAPACITY.md                       # Gestión de capacidad NAP (contadores + umbrales)
├── GPON_FTTH_ECUADOR_RESEARCH.md         # Investigación técnica consolidada — referencia canónica
├── UNIFILAR_EJEMPLO_REAL.md              # Ejemplo real de diagrama unifilar con presupuesto óptico
├── OLT_REFERENCE.md                      # Specs técnicas OLT: Huawei MA5800, ZTE Titan, Nokia
├── OLT_OPERATIONS.md                     # Guía operación OLT — Fase 4
├── OLT_INTEGRATION_GUIDE.md              # Integración SNMP/telemetría OLT — Fase 4
├── OLT_DEPLOYMENT.md                     # Runbook despliegue OLT — Fase 4
├── REALTIME_MONITORING_RESEARCH.md       # Investigación monitoreo tiempo real (OIDs Huawei verificados, Supabase Realtime, colector RPi)
├── adr/
│   ├── 0001-single-tenant-mvp.md
│   ├── 0002-no-port-tracking.md
│   └── 0003-operational-tables-phase-4.md
└── research-sources/
    └── ANALISIS_TECNICO.md               # Whitepaper original GPON Ecuador (fuente de GPON_FTTH_ECUADOR_RESEARCH.md)
```

## Estado del editor de red (network-editor-map.tsx)

### Modos implementados
- ✅ **Modo `view`**: inspección de elementos/rutas/puntos con inspector compartido
- ✅ **Modo `design`**: prepara herramientas de creación de infraestructura
- ✅ **Modo `edit`**: seleccionar elementos/rutas → editar propiedades inline → guardar vía store + RPC. Mover elementos y ajustar vértices de rutas

### Paneles y componentes compartidos
- ✅ **Inspector derecho**: `MapInspectorShell` + primitivas compartidas
- ✅ **Overlays**: `MapStatChip`, `MapLegend`, `MapControls`
- ✅ **OLT técnica**: inventario/cabecera OLT compartidos entre `/map` y `/networks/[id]`
- ✅ **Diagrama unifilar**: presupuesto óptico acumulado con splitter/NAP/cabecera

### Features transversales
- ✅ Calidad de datos: ring punteado en mapa + badge en panel (unknown/approximate/drawn/gps_captured/verified)
- ✅ Capacidad NAP: barra usada/reservada/disponible + advertencias (70%/90% umbral)
- ✅ Calculadora óptica: semáforo por ruta/unifilar basado en fibra + splitters + conectores + empalmes + cabecera
- ✅ Códigos operativos: patrón PIC-UIO-DRF-{TIPO}-{SEQ} para drafts
- ✅ Undo/redo: Zundo con 50 steps para elementos/rutas/puntos
- ✅ Templates de topología: Star (1:16), Tree (1:32), Cascade (1:64), Blank

### Pendiente en el editor
- ❌ **Herramienta `measure`**: medir distancia sobre el mapa (Turf.js ya instalado)
- ⚠️ **Creación de elementos/rutas en NetworkEditorMap**: continuar consolidando flujo de diseño

## Pendiente de construir (priorizado)

### Alta prioridad
1. Completar flujo de creación en `NetworkEditorMap`
2. Herramienta measure (Turf.js `@turf/length` ya instalado)
3. Consolidar formularios compartidos del inspector

### Media prioridad
5. Zona operativa configurable en el código (Z05 hardcoded → seleccionable)
6. Historial de cambios (quién modificó qué y cuándo)
7. Splitters desbalanceados (ratios 10/90, 20/80, etc.)
8. Vista árbol lógico más completa (con longitudes y pérdidas por tramo)

### Baja prioridad / Fase 4
9. Registro: definir rol inicial y flujo de asignación
10. Instalar shadcn/ui (cuando haya pantallas de admin/inventario)
11. Clientes, ONTs, acometidas (ADR 0003)
12. Monitoreo SNMP, TR-069, APIs de OLT

## Base de datos (Supabase)
- **Proyecto:** `ybijrwyenlfemjjueopo` — migraciones 001-017 aplicadas
- **Tablas MVP (4):** `networks`, `infrastructure_elements`, `fiber_routes`, `route_points`
- **ENUMs (13):** `user_role`, `element_type`, `element_status`, `data_quality`, `pon_standard`, `split_ratio`, `route_type`, `route_status`, `installation_type`, `fiber_type`, `route_point_type`, `crossing_type`, `risk_level`
- **Seed dev:** 1 OLT, 2 splitters, 5 NAPs, 7 rutas (2 feeder + 5 distribution), 3 puntos (1 cruce, 1 reserva, 1 empalme)

## Modelo de datos GPON (MVP)
```
networks                — tabla raíz; cada red tiene nombre, topología, created_by
infrastructure_elements — OLT, Splitter, NAP; con network_id (filtrable)
fiber_routes            — feeder, distribution; con from/to a elementos
route_points            — crossing, reserve, splice; siempre asociados a una ruta
```
- Conectividad plana: `fiber_routes.from_element_id` / `to_element_id` directo (no grafo logico)
- Calidad de dato: ENUM `data_quality` unificado en `location_quality` y `route_quality`
- Geometria con `geography(Point/LineString, 4326)` (PostGIS)
- Capacidad por contadores: `total_pon_ports`, `total_ports`, `ports_used`, `ports_reserved`
- Distribución (clientes, ONTs, drops) y operación (incidentes, signal, audit) → Fase 4 (ADR 0003)
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
- `admin` — gobierno, todo CRUD, único que puede borrar
- `network_engineer` — diseño, validación, CRUD infraestructura
- `outside_plant` — campo, CRUD infraestructura, marcar puntos
- `installer` — Fase 4 (instalaciones de cliente)
- `support` — Fase 4 (incidentes y consulta)

Rol almacenado en `auth.users.app_metadata.role`, leído via `get_user_role()` en RLS.
Detalle de permisos por rol en `docs/OPERATIONAL_ROLES.md`.

Matriz de RLS en MVP:
- `read`   → cualquier autenticado
- `insert` → admin, network_engineer, outside_plant
- `update` → admin, network_engineer, outside_plant
- `delete` → admin

## Calculadora óptica (lib/gpon/optical-budget.ts)
```
Pérdida total =
  pérdida_fibra
  + pérdida_splitters
  + pérdida_conectores
  + pérdida_empalmes
  + margen_seguridad
```
Valores conservadores para Ecuador (UV, humedad, reparaciones frecuentes).
Parámetros activos: longitud_GIS + reservation_m, conector 0.5 dB, empalme 0.1 dB,
margen de seguridad 4.0 dB (tropical Ecuador: UV, humedad, reparaciones), downstream base 1490 nm.
La reserva física (bucles, holgura) se modela explícitamente en `fiber_routes.reservation_m`
y suma a la longitud para calcular la atenuación.
Semáforo: verde (>3dB margen) / ámbar (1-3dB) / rojo (<1dB) / gris (sin clase óptica del OLT).
Referencia canónica: `docs/GPON_FTTH_ECUADOR_RESEARCH.md#presupuesto-optico-consolidado`.

## Códigos operativos (lib/gpon/operative-code.ts)
```
Patrón: {PROV}-{CIUDAD}-{ZONA}-{TIPO}-{SEQ}
Draft:  PIC-UIO-DRF-NAP-001
Campo:  PIC-UIO-Z05-NAP-128
```
Documentado en GPON_FTTH_ECUADOR_RESEARCH.md §9.

# Auditoría de documentación — 2026-11-04

Alcance: 34 archivos `.md` (~12.3k líneas) contrastados contra el código en `apps/web`, `apps/collector` y `database/migrations` (HEAD `08ab943`).
Método: verificación cruzada de afirmaciones concretas (rutas, archivos, constantes, políticas RLS, migraciones, RPCs), escaneo de enlaces y rutas de archivo, y fecha del último commit de cada doc.

**Estado de resolución**
| Hallazgo | Estado |
|---|---|
| C2, A1, A2, A3, A6 — CLAUDE.md | ✅ Reescrito (2026-11-04) |
| C4 — `AGENTS.md` raíz | ✅ Reducido a puntero + reglas de seguridad |
| A5 — README raíz | ✅ Reescrito |
| M3 — `apps/web/README.md` | ✅ Reemplazado |
| C1 — schema `networks` sin versionar | ⬜ Pendiente (requiere dump de Supabase) |
| C3 — semáforo óptico | ⬜ Pendiente de decisión; CLAUDE.md documenta el código |
| A4, M1, M2 — ADR 0004, banners, archivar MVP_TASKS | ⬜ Pendiente |

**Conclusión corta:** la documentación de *dominio* (investigación GPON, topologías, OLT) está sólida. La documentación *de proyecto* (CLAUDE.md, AGENTS.md, README.md, MVP_TASKS) tiene deriva seria: contradice al código en seguridad (RLS) y en el cálculo óptico, y describe rutas y fases que ya no existen. Además, el repo **no puede reconstruir la base de datos** desde sus migraciones.

---

## 🔴 Crítico — la doc dice algo falso con consecuencias reales

### C1. Schema no reproducible: falta la tabla `networks` en las migraciones
- Ninguna migración crea `networks`, ni las columnas `network_id` de `infrastructure_elements`/`fiber_routes`/`route_points`, ni el RPC `create_network` (usado en `apps/web`).
- `010_network_zones.sql:7` hace `REFERENCES networks(id)` → una BD nueva aplicando 001→027 **falla en 010**.
- Las versiones `*_for_map(p_network_id)` aparecen recién en `022`; `004` solo define las variantes sin parámetro, pero CLAUDE.md dice "004 … (con/sin p_network_id)".
- Implicación: esas piezas se aplicaron a mano en Supabase y nunca se versionaron. La afirmación "001-021 APLICADAS" oculta que *aplicado ≠ reproducible*.
- Acción: `supabase db dump --schema public` y extraer una migración `00X_networks.sql` (o una baseline), luego verificar con `supabase db reset` en local.

### C2. Matriz RLS documentada contradice la migración 025
- CLAUDE.md (§Roles y §Matriz RLS) y README dicen que `outside_plant` tiene insert/update de infraestructura.
- `025_restrict_infrastructure_write_roles.sql` restringe insert/update de `infrastructure_elements`, `fiber_routes` y `route_points` a `admin` y `network_engineer`.
- CLAUDE.md además cita un archivo inexistente `009_restrict_infrastructure_write_roles.sql` (el real es `025`).
- Riesgo: alguien "arregla" la UI para dar permisos de escritura a campo creyendo que es el diseño intencionado.

### C3. Semáforo óptico: tres versiones distintas
| Fuente | Margen seguridad | Verde | Ámbar | Rojo |
|---|---|---|---|---|
| `lib/gpon/optical-budget.ts:50,167-175` (código) | **3.0 dB** | **> 4 dB** | **2–4 dB** | **< 2 dB** |
| CLAUDE.md, README.md, TOPOLOGIES.md:299 | 4.0 dB | > 3 dB | 1–3 dB | < 1 dB |
| GPON_FTTH_ECUADOR_RESEARCH.md:496,534 ("canónica"), MVP_SCOPE.md:548 | 3.0 dB | > 3 dB | 1–3 dB | — |

Nadie coincide con nadie. El código además usa `"yellow"` mientras la doc dice "ámbar/amber" (cosmético). Hay que decidir **cuál es la regla de ingeniería** y alinear las tres fuentes; hoy un enlace con 2.5 dB de margen es "ámbar" en el código y "ámbar" en la doc por razones distintas, pero uno con 1.5 dB es rojo en código y ámbar en doc.

### C4. `AGENTS.md` (raíz) está obsoleto y es leído por agentes
- Roles `technician`/`administrator` (no existen; son 5 roles distintos).
- Rol en `raw_user_meta_data` — la migración 007 lo movió a `app_metadata` precisamente porque el usuario puede editar `raw_user_meta_data` (vector de escalada de privilegios documentado en OPERATIONAL_ROLE_RESEARCH.md:248).
- `003_seed_ecuador.sql`, `components/network/`, `(auth)/register/` — no existen.
- `apps/web/CLAUDE.md` importa `apps/web/AGENTS.md` (correcto, reglas Next 16), pero el `AGENTS.md` raíz compite con `CLAUDE.md` raíz con información contradictoria.
- Acción: borrarlo o reducirlo a `@CLAUDE.md`.

---

## 🟠 Alto — deriva estructural (la doc describe otra app)

### A1. Rutas de la aplicación (CLAUDE.md §Rutas)
| Documentado | Realidad |
|---|---|
| `/` → `/networks` | `/` → **`/dashboard`** (`app/page.tsx`) |
| `/register` | **No existe.** Hay `/forgot-password`, `/reset-password`, `/auth/callback` |
| — | No documentadas: `/dashboard`, `/monitoring`, `/monitoring/olt/[host]`, `/networks/[id]/capture`, `/admin/users`, `/admin/audit`, `/admin/settings` |

### A2. Estado de fases desactualizado
- "Fase 2b — Realtime frontend (próximo)": ya existe `lib/hooks/use-ont-realtime.ts` (canal `postgres_changes`), `/monitoring` con KPIs, sparkline RX, badges de estado. Está **parcialmente hecho**, no pendiente. Lo que sí falta: marcadores del mapa en vivo (verificar) y `locate_fault_along_route()` (no existe en BD).
- "shadcn/ui (pendiente instalar)" — instalado (`components.json`, `components/ui/*`, dep `shadcn`).
- "React Query provider instalado, pendiente uso" — ya se usa en `network-editor-shell.tsx` y `network-capture-shell.tsx`.
- "Herramienta measure ❌" — correcto: solo existe el label y el tipo `"measure"` en el store, sin implementación.
- "Zona Z05 hardcoded" — parcialmente: `operative-code.ts` acepta `zone`, Z05 es solo default; `network_zones` existe desde 010.

### A3. Base de datos (CLAUDE.md §Base de datos)
- Dice "migraciones 001-017 aplicadas" (§BD) y "001-021" (§Estructura) en el mismo archivo. Existen **001-027**; 022-027 no están documentadas (IP de gestión OLT, seed ONT, hardening realtime, restricción de roles, `WITH CHECK` en networks, archivado de redes).
- "Tablas MVP (4)" — hay 7 tablas relevantes: + `network_zones`, `audit_logs`, `ont_current_state`, `ont_signal_history`.
- "ENUMs (13)" — hay 15 `CREATE TYPE` (018 añadió closure/mufa).

### A4. ADR 0003 superado sin enmienda
ADR 0003 (Aceptado) pospone `signal_history` y `audit_log` a Fase 4. Ambas existen (`012_audit_logs.sql`, `021_ont_monitoring_tables.sql`). Un ADR aceptado que el código contradice pierde su valor; corresponde marcarlo *Superseded (parcial)* o crear ADR 0004 "Monitoreo ONT adelantado a Fase 2" con el porqué.

### A5. README.md (raíz)
- "001-017 SQL migrations (001-013 applied)", "17 migrations", "19 markdown docs" (hay 34), `database/seed/`, `packages/types/`, `geodata/`, `lib/queries/` — inexistentes.
- Node "18+" — `package.json` exige `>=20.9.0`.
- Setup lista `SUPABASE_URL, MAPBOX_TOKEN…` sin prefijo `NEXT_PUBLIC_` y omite `NEXT_PUBLIC_SITE_URL` y `UPSTASH_REDIS_REST_*` (sin estas el rate limit queda fail-open).
- "Phase 2+: OLT telemetry, audit logs" — ya implementados.
- No menciona `apps/collector` en absoluto.

### A6. Árbol de estructura en CLAUDE.md
Faltan: `components/command/` (palette, shortcuts), `components/monitoring/`, `components/ui/`, `lib/hooks/`, `lib/auth/` (permissions, rate-limit, roles), `lib/audit/`, `lib/supabase/admin.ts`, `lib/gpon/{nap-config,olt-catalog,olt-properties,symbology}`, `logical-diagram/{budget-alerts,optical-power-budget-chart}.ts`, `app/actions/users.ts`. Y en `docs/`: `GPON_SPLIT_RATIO_GUIDELINES.md`, `FIBER_ROUTE_THREAD_MODEL.md`, `PREMIUM_UI_UX_RESEARCH.md` no están listados.

---

## 🟡 Medio — referencias rotas y docs huérfanos

### M1. Rutas de archivo inexistentes citadas en docs
- `apps/collector/README.md` → `docs/COLLECTOR_DEPLOYMENT.md` (declarado "pendiente"; OK si se mantiene como TODO explícito).
- `docs/OLT_INTEGRATION_GUIDE.md` → `apps/web/app/api/olt/[id]/metrics/route.ts`, `apps/web/lib/workers/snmp-collector.ts`, `apps/web/components/OltDashboard.tsx`. Describe una arquitectura (colector dentro de Next.js) **que se descartó** en favor de `apps/collector` standalone. Debería llevar un banner "Superado por REALTIME_MONITORING_RESEARCH.md + apps/collector".
- `docs/PREMIUM_UI_UX_RESEARCH.md` → `components/ui/motion-panel.tsx`, `animated-mode-switch.tsx`, `command/registry.ts`, `help/shortcuts-overlay.tsx` (el real está en `command/`), `monitoring/ont-history-chart.tsx`, `nap-density-heatmap.tsx`. Es un plan; conviene separar "propuesto" de "implementado".

### M2. Docs sin tocar desde mayo con código que avanzó
Todos los docs tienen último commit entre 2026-05-05 y 2026-05-12. `MVP_TASKS.md` dice "actualización 2026-04-27" con 54 ✅ / 63 ⬜ — no refleja monitoreo, admin, captura, archivado, atajos de teclado. CLAUDE.md ya lo marca "puede estar desactualizado"; mejor archivarlo o regenerarlo que mantener una advertencia permanente.

### M3. `apps/web/README.md`
Boilerplate de `create-next-app` (`npm run dev`). Contradice "pnpm" y no aporta nada. Reemplazar por 5 líneas que apunten a la raíz.

---

## 🟢 Bajo — duplicación y organización

- **Pares solapados:** `OPERATIONAL_ROLES.md` ↔ `OPERATIONAL_ROLE_RESEARCH.md`; `GPON_FTTH_ECUADOR_RESEARCH.md` ↔ `research-sources/ANALISIS_TECNICO.md`; `EDITOR_UI_UX_SPEC.md` ↔ `NETWORK_MAP_UX_FLOW.md` ↔ `WORKFLOW_ANALYSIS.md`. Funciona si uno es "fuente" y otro "decisión", pero hoy no está explícito cuál manda (excepto la investigación GPON, que sí se declara canónica).
- **Valores numéricos repetidos** (margen, pérdidas splitter, conector 0.5 dB, empalme 0.1 dB) en ≥5 docs. Cada copia es una futura inconsistencia (ver C3). Mejor: un único bloque en la doc canónica con referencia a `optical-budget.ts` y que los demás enlacen.
- **Mezcla de idiomas:** README en inglés, resto en español. Decisión válida, pero hoy el README es el doc más visible y el más desactualizado.
- **Sin frontmatter de estado.** Ningún doc declara `Estado: vigente | plan | superado`. Es lo que más ayudaría a que un lector (o agente) sepa en qué confiar.

---

## Lo que está bien
- `GPON_FTTH_ECUADOR_RESEARCH.md`, `TOPOLOGIES.md`, `OLT_REFERENCE.md`, `GPON_SPLIT_RATIO_GUIDELINES.md`: contenido técnico rico y consistente entre sí (salvo el margen, C3).
- `apps/collector/README.md`: alineado con `config.ts` y `.env.example`; política de historial coincide con el código.
- ADR 0001/0002 siguen vigentes.
- CLAUDE.md captura bien las reglas de Next.js 16 (`proxy.ts`, `await cookies()`), y `.env.local.example` está al día.

---

## Plan sugerido (orden por riesgo/esfuerzo)
1. **C1** — versionar `networks` + `create_network` + `network_id` (baseline desde Supabase). Probar `db reset`.
2. **C3** — decidir umbrales del semáforo y margen; una sola fuente.
3. **C2 + A1–A3 + A6** — reescribir secciones de CLAUDE.md (rutas, roles/RLS, BD, fases, árbol).
4. **C4, M3** — eliminar/reducir `AGENTS.md` raíz y `apps/web/README.md`.
5. **A4** — ADR 0004 sobre monitoreo adelantado.
6. **A5** — README raíz: setup real, collector, estado actual.
7. **M1, M2** — banners de "superado/propuesto"; archivar MVP_TASKS y CREATION_FLOW_TEST.
8. Añadir `Estado:` al inicio de cada doc en `docs/`.

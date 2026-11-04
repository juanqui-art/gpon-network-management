# Auditoría UI/UX — GPON Network Management

> Fecha: 2026-11-04 · Alcance: `apps/web` (todas las rutas del dashboard, auth, mapa, editor, captura, monitoreo, admin).
> Método: revisión estática del código (no se ejecutó la app contra Supabase/Mapbox). Las métricas se obtuvieron con `grep` sobre `app/` y `components/`.

## Resumen ejecutivo

La base visual es sólida: tema oscuro coherente con el mapa, tokens GPON bien pensados en `globals.css`, simbología consistente, command palette y atajos. El problema no es estético, es **estructural**: el sistema de diseño existe pero casi nadie lo usa, el flujo de campo no funciona en móvil, y hay rutas para perder trabajo sin aviso.

| Severidad | # | Tema dominante |
|---|---|---|
| 🔴 Crítico | 5 | Pérdida de datos, captura inutilizable en móvil, inspector modal sobre el mapa |
| 🟠 Alto | 8 | Sin estados de carga/error, contraste AA, datos crudos en inspector, nav por rol |
| 🟡 Medio | 9 | Deriva del design system, duplicación de UI, microcopy, densidad tipográfica |
| 🔵 Bajo | 5 | Pulido, coherencia de idioma, señales decorativas |

**Métricas clave**

| Métrica | Valor | Comentario |
|---|---|---|
| Literales de color (`#xxxxxx` / `rgba(`) en TSX | **1 109** | Los tokens de `globals.css` se puentean casi siempre |
| `style={{…}}` inline | 98 | |
| Tamaños `text-[8–11px]` | 234 (31 de 8–9px) | Densidad excesiva para tablet en campo |
| `<button>` nativos vs archivos que usan `ui/button` | 81 vs 5 | |
| `<input>` nativos vs archivos con `ui/input` | 28 vs 3 | |
| `ui/toast`, `ui/tooltip`, `ui/dialog` usados | **0 / 0 / 0** | Instalados y sin uso |
| `loading.tsx` / `error.tsx` / `not-found.tsx` | **0** | |
| Referencias a `isLoading` / `isPending` / "Cargando" en UI | **0** | |
| `beforeunload` / guard de navegación | **0** | |

---

## 🔴 Crítico

### C1. Se pueden perder cambios sin guardar de varias formas
- No hay `beforeunload` ni guard de navegación en el editor (`network-editor-shell.tsx`) ni en captura.
- **Conflicto de atajos:** `useNavigationShortcuts` (global, `g → d` = `/dashboard`) y `useEditorShortcuts` (`d` = modo diseño) escuchan ambos en `window`. Pulsar `g` y luego `d` en el editor cambia el modo **y** navega al dashboard, descartando el estado del store. `g → s`, `g → m`, `g → n` también navegan fuera con cambios pendientes.
- "Descartar" (`network-editor-shell.tsx`, botón `discard`) borra todo sin confirmación, pegado visualmente a "Guardar" y sin diferenciación de peligro.
- **Recomendación:** hook `useUnsavedChangesGuard(isDirty)` (beforeunload + interceptar `router.push` de los atajos/links), desactivar chords `g →` cuando `isDirty`, confirmación (o toast con "Deshacer") en Descartar.

### C2. La captura rápida (flujo de campo) no es usable en móvil/tablet vertical
`networks/[id]/capture/network-capture-shell.tsx:691` usa `grid-cols-[minmax(360px,420px)_1fr]` fijo y el archivo tiene **0 breakpoints**. En un teléfono de 390 px la columna de formulario ocupa todo y el mapa queda en ~0 px. Es precisamente el flujo que usa `outside_plant` en calle.
- **Recomendación:** en `<md` mapa a pantalla completa + formulario como bottom sheet (ya existe `AppDrawer` con dirección responsive), botón grande "Marcar aquí / usar GPS", targets ≥44 px.

### C3. El editor en móvil no tiene panel de herramientas
`network-editor-map.tsx:1247` envuelve `EditorLeftPanel` en `hidden md:block` sin alternativa móvil (el viewer `/map` sí tiene botón + drawer). En móvil el usuario ve el mapa pero no tiene herramientas, filtros ni alertas.

### C4. Los inspectores son modales con overlay encima del mapa
`MapInspectorShell` (editor) y `RightPanel` del viewer (`readonly-map-viewer.tsx:2166`) usan `AppDrawer` con los defaults `modal = true`, `showOverlay = true`. Consecuencias:
- No se puede hacer clic en otro elemento del mapa sin cerrar antes el inspector (cada inspección = 2 clics extra).
- En modo `edit` no se puede arrastrar/ajustar mientras se ven las propiedades.
- En el viewer el panel es `size="lg"` (hasta 38 rem): tapa gran parte del mapa en laptops de 1366 px.
- **Recomendación:** en desktop `modal={false} showOverlay={false}` (como ya hace el panel izquierdo), selección intercambiable con un clic; ancho `md` (~20–24 rem).

### C5. El editor arranca directamente en modo `edit`
`network-editor-shell.tsx` → `setMode(canEdit ? "edit" : "view")`. Abrir una red para consultarla ya habilita mover elementos y vértices: un arrastre accidental cambia geometría GIS. Combinado con C1 el riesgo se multiplica.
- **Recomendación:** arrancar en `view`; entrar a edición explícitamente (botón o `e`), con banner de modo claro.

---

## 🟠 Alto

### A1. Sin estados de carga ni de error
- Ningún `loading.tsx`/`error.tsx`/`not-found.tsx`; ninguna UI usa `isLoading`. El editor monta el mapa vacío mientras `useQuery` carga: parece una red sin elementos.
- El error de carga es un texto (`"No se pudo cargar la red."`) sin acción de reintento.
- `requireAdmin()` devuelve `notFound()` → 404 genérico de Next sin estilo ni salida.
- **Recomendación:** skeletons por ruta, `error.tsx` con "Reintentar", `not-found.tsx` con vuelta a `/networks`; overlay "Cargando red…" sobre el mapa.

### A2. Contraste por debajo de WCAG AA en el texto secundario principal
| Par | Ratio | AA texto normal (4.5) |
|---|---|---|
| `--text-muted` `#777879` sobre `#1b1c1d` | 3.86 | ❌ |
| `#777879` sobre `--surface-panel` `#222324` | 3.56 | ❌ |
| `#777879` sobre `--surface-card` `#282929` | 3.30 | ❌ |
| `#5c5d5f` ("Guardado", placeholders) sobre `#1e1f20` | 2.50 | ❌ |
| Blanco sobre `--accent-brand` `#0ea5e9` (CTA "+ Nueva red") | 2.77 | ❌ |

`--muted-foreground` = `#777879`, y se usa mayoritariamente en 10–11 px, donde el problema es peor. Además los paneles "glass" (`rgba(…,0.72)` + blur) hacen que el contraste dependa del mapa de fondo (zonas satélite claras).
- **Recomendación:** subir `--text-muted` a ~`#8f9093` (≈4.6:1 sobre panel), CTA con texto oscuro `#0b1220` o azul más profundo (`#0284c7` + blanco ≈ 4.1 → usar `#0369a1`), opacidad de paneles ≥0.9 cuando contienen texto.

### A3. El inspector del editor muestra valores crudos
`network-editor-map.tsx:2217` (`RoutePointInspectorDetails`): muestra `point.type`, `point.status`, `point.location_quality` sin traducir y `fiber_route_id` (UUID) como "Ruta". Ya existen `EQUIPMENT_STATUS_LABEL`, `DATA_QUALITY_LABEL` en `lib/`. El viewer sí traduce el tipo pero no estado/calidad.
- **Recomendación:** un único formateador `formatRoutePoint/formatElement` en `lib/gpon/` usado por ambos inspectores; la ruta se muestra por código operativo y es clicable.

### A4. Navegación ignora el rol
`dashboard-nav.tsx` muestra Usuarios / Auditoría / Settings a todos. Un `network_engineer` que entra ahí recibe un 404 (ver A1). Además `/` redirige a `/dashboard`, cuyo título es "Dashboard administrador".
- **Recomendación:** filtrar `NAV_LINKS` por rol (el rol ya se lee en server), agrupar admin bajo un menú "Administración"; landing por rol (`outside_plant` → `/networks` o captura).

### A5. Indicador "en vivo" no distingue conectando de caído ni muestra frescura
`live-indicator.tsx` muestra "Conectando…" tanto al iniciar como tras `CHANNEL_ERROR`/`CLOSED` (`use-ont-realtime.ts:68`), indefinidamente. `TIMED_OUT` no se maneja. No hay "última actualización hace X". En un NOC, dato viejo presentado como vivo es el peor fallo posible.
- **Recomendación:** estados `connecting | live | stale (>N s sin evento) | error` con reintento visible y timestamp relativo.

### A6. Errores técnicos expuestos al usuario
`networks-client.tsx` muestra `err.message` del RPC tal cual (mensajes de Postgres/PostgREST). `lib/auth/supabase-errors.ts` existe para auth pero no se aplica a mutaciones.
- **Recomendación:** mapear códigos (`23505`, `42501` RLS, etc.) a mensajes accionables en español.

### A7. Feedback de guardado débil
`ui/toast` existe y tiene 0 usos. Guardar/archivar/crear no producen confirmación; el estado vive en un `<span>` gris de 2.5:1 ("Guardado"). Las advertencias de validación se truncan a `max-w-52` con el detalle solo en `title` (inaccesible en táctil).
- **Recomendación:** toasts para mutaciones; lista de advertencias en popover clicable que enfoque el elemento en el mapa.

### A8. Topbar del editor no escala
`network-editor-shell.tsx`: en `h-11` conviven breadcrumb, chip de modo, Captura rápida, advertencias, toggle unifilar, texto "Cambios sin guardar · Ctrl+Z revierte", chip de historial, Descartar y Guardar, sin ningún breakpoint. Desborda por debajo de ~1280 px.
- Además: el chip "Edición de inventario" usa ámbar (= mantenimiento/advertencia en la simbología) para un estado normal; "Ctrl+Z revierte" sugiere que revierte todo (solo deshace un paso); se mezclan los literales "Deshacer disponible · Rehacer" como si fueran botones pero no lo son.
- **Recomendación:** botones reales Deshacer/Rehacer con icono, overflow menu en `<lg`, color de modo neutro/azul.

---

## 🟡 Medio

### M1. El design system está definido pero no adoptado
1 109 literales de color, 81 `<button>` nativos, 28 `<input>` nativos. Ejemplo: `networks-client.tsx` repite la misma cadena de clases de input 5 veces y define **dos estilos distintos** de botón primario en la misma pantalla ("+ Nueva red" sólido vs "Crear red" translúcido). Hay deriva de paleta: `#38d8ff`/`#8bdff4` (captura, unifilar) vs token `--gpon-olt #38bdf8`; fondos `#1e1f20`, `#151617`, `#111213` que no son tokens.
- Además `--primary` = `#d7d7d7` (gris) mientras el "primario" real de la marca es `--accent-brand`: shadcn y el código custom no coinciden en qué es "primary".
- **Recomendación:** variantes `Button` (`primary`, `secondary`, `danger`, `ghost`) e `Input` como única vía; regla Biome/grep en CI que limite hex en TSX; ampliar tokens (`--surface-sunken`, `--text-faint`).

### M2. Dos UIs de mapa casi paralelas
`readonly-map-viewer.tsx` y `network-editor-map.tsx` (~3 260 líneas cada uno) reimplementan inspectores (`ElementDetails` vs `ElementInspectorDetails`, `RouteDetails` vs `RouteInspectorDetails`, `RoutePointDetails` vs `RoutePointInspectorDetails`), `StatRow`, builders GeoJSON y labels (`TYPE_LABEL`, `STATUS_LABEL`, `DATA_QUALITY_LABEL` locales en el viewer, aunque existen en `lib/`). Resultado visible: el mismo elemento se describe distinto según la ruta (campos, orden, formatos de coordenada `toFixed(5)` vs `formatCoordinate`).
- **Recomendación:** componentes de inspector compartidos parametrizados por `readOnly`.

### M3. Densidad tipográfica
234 usos de 8–11 px, 31 de 8–9 px. Para operación en campo (tablet, sol directo) el mínimo razonable es 12 px para datos y 11 px para metadatos.

### M4. Ortografía inconsistente
El viewer tiene ~27 textos sin tildes: "Codigo", "Posicion", "Perdida insercion", "Ubicacion", "Atenuacion", "Direccion", "Distribucion hacia NAP" (`readonly-map-viewer.tsx:2262…3126`, `optical-power-budget-chart.tsx:52`). El editor sí usa tildes → misma app, dos voces.

### M5. Filas de lista con objetivos duplicados y pequeños
`networks-client.tsx`: cada red tiene dos botones que hacen lo mismo (zona principal y "→" de ~12 px, color `#5c5d5f` a 2.5:1). "Archivar" está en la fila con el mismo peso visual que la navegación. Faltan: búsqueda/filtro, orden, fecha de modificación, estado de la red.
- **Recomendación:** fila = un `<Link>` (permite abrir en pestaña nueva, ahora imposible con `router.push`), acciones secundarias en menú "⋯".

### M6. Navegación con `router.push` en lugar de `<Link>`
Filas de redes y otras navegaciones usan `onClick → router.push`: sin cmd/ctrl-clic, sin prefetch, sin semántica de enlace para lectores de pantalla.

### M7. Iconos tipográficos como íconos de topología
`TOPOLOGY_ICON = { "○", "✦", "⑂", "≡" }` en `networks-client.tsx`: renderizan distinto por fuente/OS y no comunican nada a lectores de pantalla. Ya está `lucide-react` y `topology-picker.tsx` existe (¿por qué no se reutiliza aquí?).

### M8. Selector de topología sin semántica de radio
Botones con `style` inline y sin `aria-pressed`/`role="radiogroup"`; el estado seleccionado solo se comunica por color.

### M9. `isEditableTarget` duplicado y atajos de una tecla sin descubribilidad en contexto
Duplicado en `use-editor-shortcuts.ts` y `use-navigation-shortcuts.ts`. Las teclas `v/d/e` no aparecen junto a los controles de modo (solo en el overlay `?`).

---

## 🔵 Bajo

- **B1.** "Settings" en inglés en la nav; resto en español.
- **B2.** `⌘K` mostrado siempre; en Windows/Linux debería ser `Ctrl K`.
- **B3.** Login: el chip "NOC activo" con punto verde pulsante es decorativo y no refleja estado real — señal falsa en un producto de monitoreo. Igual para las tarjetas "Monitoreo · Tiempo real" / "Roles · Controlados" (marketing en pantalla de acceso de herramienta interna).
- **B4.** Error de login con color `#ffb3c1` hardcodeado fuera de tokens.
- **B5.** `prefers-reduced-motion`: existe `useReducedMotion` en `lib/motion/config.ts`, pero `animate-ping` del LiveIndicator y transiciones CSS no lo respetan.

---

## Accesibilidad (resumen WCAG 2.1 AA)

| Criterio | Estado | Evidencia |
|---|---|---|
| 1.4.3 Contraste | ❌ | A2 |
| 1.4.1 Uso del color | ⚠️ | Estado de topología, semáforo óptico y status en mapa dependen del color (el ring punteado de calidad es un buen contraejemplo a replicar) |
| 2.1.1 Teclado | ⚠️ | Mapa sin alternativa en el editor; el viewer tiene `NetworkTree` (bien) |
| 2.4.3 Orden de foco | ⚠️ | Drawers modales sobre el mapa atrapan foco al seleccionar (C4) |
| 2.5.5 Tamaño de objetivo | ❌ | Botones `px-2.5 py-1 text-xs` (~24 px de alto) en todo el editor |
| 3.3.1 Identificación de errores | ⚠️ | A6 |
| 4.1.2 Nombre/rol/valor | ⚠️ | M7, M8; `aria-*` solo 125 usos en todo el proyecto |

---

## Plan sugerido

**Sprint 1 — no perder trabajo ni datos (C1, C5, A1, A7)**
Guard de cambios, atajos desactivados con `isDirty`, modo `view` por defecto, `loading/error/not-found`, toasts.

**Sprint 2 — campo y móvil (C2, C3, C4, M3)**
Captura responsive con bottom sheet, panel de herramientas móvil, inspectores no modales, escala tipográfica mínima.

**Sprint 3 — sistema de diseño (A2, M1, M2, M4)**
Ajuste de tokens de contraste, variantes `Button`/`Input`, inspectores compartidos, pasada de microcopy (tildes, labels, idioma).

**Sprint 4 — confianza operativa (A4, A5, A6, B3)**
Nav por rol, indicador realtime con frescura, mapeo de errores, eliminar señales decorativas de estado.

## Preguntas abiertas para producto

1. ¿El dispositivo principal de `outside_plant` es teléfono o tablet? Cambia cuánto invertir en C2 vs C3.
2. ¿El modo `edit` por defecto fue una decisión deliberada para acelerar a ingenieros? Si sí, ¿basta con un guard de arrastre (mantener pulsado) en vez de cambiar el default?
3. ¿`/dashboard` debe existir para no-admins o cada rol necesita su propia landing?

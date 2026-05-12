# Premium UI/UX Research — GPON Network Management

> Investigación consolidada para elevar la app a calidad premium (nivel Linear / Vercel / Mapbox Studio).
> Fecha de la investigación: 2026-05-11. Audit interno + research web 2026.

---

## 1. Auditoría del estado actual

### Stack UI presente
- **Framework**: Next.js 16.2.4 (App Router) + React 19.2.4
- **Styling**: Tailwind CSS v4 + `@tailwindcss/postcss`
- **Componentes**: shadcn (11 primitivas: `button`, `card`, `dialog`, `tabs`, `toast`, `tooltip`, `badge`, `input`, `label`, `scroll-area`, `separator`)
- **Primitivas headless**: `radix-ui` v1.4.3
- **Variantes**: `class-variance-authority` + `clsx` + `tailwind-merge`
- **Iconos**: `lucide-react@1.14` ⚠️ (versión vieja, current ≈ `0.4xx`)
- **Animation utilities**: `tw-animate-css@1.4` instalado pero sin uso visible
- **Tipografía**: Roboto + Roboto Mono (Google Fonts via `next/font/google`)
- **Charts**: `lightweight-charts@5.2` instalado (Fase 2b lo usará)
- **Diagramas**: `@xyflow/react@12.10`

### Tokens de diseño (`app/globals.css`)
**Fortalezas:**
- Sistema dark coherente con el mapa: `--surface-bg #1b1c1d`, `--surface-panel #222324`, `--surface-card #282929`, `--surface-elevated #303133`
- Tokens domain-specific por elemento GPON: `--gpon-olt`, `--gpon-splitter`, `--gpon-nap`, `--gpon-ont`, `--gpon-amplifier`, `--gpon-wdm`
- Tokens por estado: `--status-online/alarm/offline/maint`
- Tokens por severidad de incidente: `--severity-critical/high/medium/low`
- Tokens de señal óptica: `--signal-good/warning/critical/unknown`
- Mapeo correcto a variables shadcn (`--background`, `--card`, `--popover`, `--primary`...)
- Glassmorphism ya aplicado en Mapbox controls (`globals.css:155-185`)

**Gaps:**
- ❌ No existe `--surface-overlay` (alpha para glass panels sobre mapa)
- ❌ No existe `--accent-brand` (azul GPON saturado para CTAs primarios)
- ❌ Sin tokens de elevation/shadow (premium dashboards los usan)
- ❌ `--font-sans` apunta a Roboto (genérica, sin personalidad)

### Componentes presentes
```
components/
├── ui/                  # 11 primitivas shadcn básicas
├── map/                 # 18 componentes (editor + inspector + diagrama)
├── monitoring/          # 4 componentes (rx-power-cell, ont-status-badge…)
├── topology/            # 1 componente (topology-picker)
└── network/             # vacío
```

**Lo que falta para sentirse premium:**
- ❌ Sin `command palette` (`cmdk`)
- ❌ Sin skeleton loaders
- ❌ Sin empty states ilustrados (texto plano cuando no hay datos)
- ❌ Sin sistema de keyboard shortcuts ni overlay de ayuda
- ❌ Sin micro-interacciones de motion en panel/inspector/mode-switch
- ❌ Sin live indicators (pulse dot) para Realtime
- ❌ Sin sparklines inline ni heatmaps
- ❌ Sin `prefers-reduced-motion` handling global

---

## 2. Investigación web 2026 — qué define "premium" hoy

### Linear / Vercel / Stripe — el patrón ganador developer-grade

**"Minimalismo estratégico"** (≠ minimalismo decorativo de 2010s)
Cada elemento debe ganarse su lugar. Vercel: *"the right data, zero noise"*. Linear: filtros y power features ocultos hasta que se necesitan.

**Layout estándar 2026**
- Sidebar **240-280px**
- KPI strip de **4-6 métricas** en top
- Grid flexible con CSS Grid `auto-fill`
- Escala de 5 a 50 features sin restructurar

**Progressive disclosure como arte**
Secuenciar cuándo el usuario encuentra cada feature, no esconderlas. Headline numbers primero, drill-down opcional.

**Brand language para dev tools**
Fondos oscuros + monoespaciada + estética terminal son señales deliberadas de posicionamiento. Tu app ya está en este carril.

### Network monitoring tools premium (Zabbix 8, Nagios XI 2026, Auvik)

- **Auto-discovery + topología viva**: el mapa se actualiza solo cuando la red cambia (SNMP/LLDP/CDP). Tu colector (apps/collector) ya hace esto a nivel datos — falta exponerlo en UI.
- **Smart Dashboards**: treemaps + heatmaps + gauges como ciudadanos de primera, no solo tablas.
- **Drill-down con progressive disclosure**: reduce carga cognitiva.
- **AI conversacional**: el insight surge solo, no requiere que el operador interprete gráficos.

### Command palette ⌘K — ya es baseline en 2026

Linear, Figma, Notion, Vercel, Raycast: todos lo tienen. **Su ausencia se nota más que su presencia diferencia.**

Linear permite tomar cada acción de **4 formas**: botón, atajo, menú contextual, command line. Esto construye muscle memory.

Atajos críticos en Linear: `C` crear, `⌘K` palette, `/` filtrar, `E` editar, `Esc` retroceder.

### Glassmorphism funcional (vuelve en 2026 con propósito)

- Ya no decorativo: **separación funcional** de elementos sobre fondos complejos (mapas, gradients).
- Blur entre **10-30px**; backgrounds más busy requieren más blur.
- Especialmente efectivo en dark UIs.
- Modern GPUs lo manejan smooth en dashboards live.

### shadcn ecosystem 2026

- **Aceternity UI**: bloques shadcn-compatibles con Motion built-in (`https://ui.aceternity.com/shadcn-blocks`)
- **shadcn Studio**: kit Figma + Motion variants + theme generator + MCP integration (`https://shadcnstudio.com`)
- **Animate UI**: template Next.js de referencia para motion-first apps
- **Motion** (sucesor moderno de framer-motion): la dependencia que falta en tu stack

---

## 3. Mapeo a la app GPON

| Tendencia 2026 | Estado actual | Acción premium |
|---|---|---|
| Tipografía como signal | Roboto (genérica) | **Geist Sans + Geist Mono** vía paquete `geist`. Geist Mono protagonista para códigos `PIC-UIO-Z05-NAP-128` |
| Glassmorphism funcional | Solo en attribution Mapbox | Inspector derecho con `backdrop-filter: blur(16px)` + `bg-card/72` sobre mapa |
| Layout sidebar+KPI strip | Header simple en `(dashboard)/layout.tsx` | KPI strip en `/networks`: total redes / clientes activos / NAPs / incidentes abiertos |
| Command palette ⌘K | Ausente | `cmdk` + shadcn: jump-to-network, change-mode, create-NAP, search por código operativo |
| Keyboard shortcuts | Solo undo/redo (zundo) | `v/d/e` modos, `g n / g m` navegación, `?` overlay help |
| Live indicators | Ausente | Dot pulsante cuando Realtime emite evento ONT (sinérgico con Fase 2b) |
| Smart dashboards | Tabla plana en `/monitoring` | Sparklines inline rx_power 24h + heatmap densidad NAPs |
| Empty states | Texto plano | SVG ilustrado + CTA primario ("Crea tu primera red", "Sin ONTs detectadas") |
| Skeleton loaders | Ausente | Shimmer por contexto: network-card, map-loading, inspector |
| Motion + spring physics | `tw-animate-css` instalado sin uso | `motion`: inspector slide+fade, toast spring, mode crossfade, pulse en selección |
| Progressive disclosure | Inspector siempre con todo | Tabs/secciones colapsables: General / Óptico / Capacidad / Histórico |
| `prefers-reduced-motion` | Sin manejar | Wrapper global en motion config |
| Iconografía | `lucide-react@1.14` viejo | Upgrade a `lucide-react@0.4xx`, stroke 1.5, sizes 14/16 consistentes |

---

## 4. Plan en 4 capas (ordenadas por ROI)

### Capa 1 — Identidad visual (1-2 días, máximo impacto inicial)
**Por qué primero**: cambia la primera impresión sin tocar lógica. Mínimo riesgo.

**Archivos a tocar:**
- `app/layout.tsx`: reemplazar `next/font/google` Roboto → paquete `geist` oficial Vercel
- `app/globals.css`: añadir `--surface-overlay`, `--accent-brand`, escala de elevation
- `package.json`: añadir `geist`, upgrade `lucide-react`
- Tokens fluidos con `clamp()` para tipografía, `text-balance` en H1/H2

**Entregables:**
- Geist Sans en UI, Geist Mono protagonista en códigos operativos
- Paleta extendida con overlay glass + accent brand
- Iconos consistentes stroke 1.5, sizes 14px (chips) / 16px (UI)

### Capa 2 — Motion y micro-interacciones (2-3 días)
**Por qué segundo**: amplifica la nueva identidad sin necesidad de features nuevas.

**Archivos nuevos:**
- `lib/motion/config.ts`: configuración global + `prefers-reduced-motion`
- `components/ui/motion-panel.tsx`: wrapper de slide+fade para inspector
- `components/ui/animated-mode-switch.tsx`: crossfade entre view/design/edit

**Cambios en existentes:**
- Inspector entra/sale con spring
- Selección de elemento: pulse ring sincronizado con `--gpon-{tipo}`
- Toast con spring + stagger
- View Transitions API entre `/networks` ↔ `/networks/[id]` (Next 16 nativo)
- Hover lift 1px + shadow sutil en cards (NO en sidebar)

**Dependencia nueva**: `motion` (no `framer-motion`, es el sucesor moderno)

### Capa 3 — Productividad ⌘K y atajos (3-5 días)
**Por qué tercero**: requiere las dos capas anteriores para sentirse pulido.

**Archivos nuevos:**
- `components/command/palette.tsx`: command palette global
- `components/command/registry.ts`: API `registerAction({ id, label, keywords, run })`
- `components/help/shortcuts-overlay.tsx`: overlay con `?`
- `components/empty-states/`: 4-5 estados ilustrados (no redes, no ONTs, no incidentes, no resultados)
- `components/skeletons/`: variantes por contexto

**Dependencias nuevas**: `cmdk`, `tinykeys` (o `react-hotkeys-hook`)

**Comandos a registrar inicial:**
- `Ir a red...` (fuzzy search de networks)
- `Buscar código operativo` (PIC-UIO-Z05-NAP-128)
- `Crear NAP / Splitter / Ruta`
- `Cambiar modo: View / Design / Edit`
- `Mostrar diagrama unifilar`
- `Ir a /monitoring`, `/map`, `/networks`

**Atajos globales:**
- `⌘K` → palette
- `?` → shortcuts overlay
- `g n` → networks, `g m` → map, `g s` → monitoring
- `v / d / e` → modos del editor
- `⌘z / ⌘⇧z` → undo/redo (ya hay zundo)

### Capa 4 — Dashboard premium (3-4 días, sinérgico con Fase 2b)
**Por qué último**: depende de la infraestructura Realtime que estás construyendo ahora.

**Archivos a tocar:**
- `app/(dashboard)/monitoring/page.tsx`: añadir KPI strip
- `components/monitoring/rx-power-cell.tsx`: añadir sparkline inline
- `components/monitoring/live-indicator.tsx` (nuevo): dot pulsante CSS
- `components/monitoring/ont-history-chart.tsx` (nuevo): chart rx_power 24h con `lightweight-charts`
- `components/monitoring/nap-density-heatmap.tsx` (nuevo): heatmap de NAPs con problemas

**Features:**
- KPI strip: total ONTs / online / alarm / sin señal (con drill-down)
- Sparkline inline en tabla (últimas 24h rx_power)
- Live dot pulsante cuando llega evento Realtime
- `aria-live="polite"` para anomaly badges
- Inspector ONT con tab "Histórico" + chart de potencia óptica + last-disconnect timeline

---

## 5. Anti-patterns a evitar

1. **Glassmorphism sin medir GPU sobre Mapbox**: en zoom muy alto puede generar jank. Usar `will-change: backdrop-filter` y probar en hardware modesto (RPi del colector).
2. **Motion en todo**: Linear solo anima lo que comunica cambio de estado. Animar el sidebar entero distrae del trabajo.
3. **Más colores en la paleta**: ya es densa. La marca debe vivir en **tipografía + spacing + motion**, no en agregar acentos.
4. **shadcn-blocks plug-and-play sin curaduría**: muchos bloques (Aceternity, Animate UI) son marketing-oriented y desencajan en una app data-heavy. Tomar inspiración, no copiar.
5. **Iconografía mixta**: si entra Geist, no mezclar con otros iconos. Solo `lucide-react` (o `@phosphor-icons/react` si se decide migrar — uno o el otro).

---

## 6. Decisiones pendientes

Para ejecutar este plan necesito alineación en:

1. **Capa prioritaria**: ¿identidad (1-2d), motion (2-3d), command palette (3-5d), o dashboard premium (3-4d)?
2. **Referencia estética dominante**: ¿Linear (denso + atajos), Vercel (tipografía + sobriedad), Mapbox Studio (map-first + glass), o Datadog/Cloudflare (data-dense)?
3. **Hito o restricción**: ¿hay demo, presentación a operador, o ventana específica que ancle el alcance?
4. **Modo claro**: ¿solo dark (actual) o se necesita light mode en algún momento? Decisión afecta paleta.
5. **Multi-idioma**: ¿solo español (actual) o se prevé inglés? Decisión afecta layout (longitud de strings).

---

## 7. Fuentes consultadas

### SaaS / Dashboard trends 2026
- [7 SaaS UI Design Trends in 2026 — SaaSUI Blog](https://www.saasui.design/blog/7-saas-ui-design-trends-2026)
- [Smart SaaS Dashboard Design Guide 2026 — F1Studioz](https://f1studioz.com/blog/smart-saas-dashboard-design/)
- [Dashboard Design Patterns for Modern Web Apps 2026 — Art of Styleframe](https://artofstyleframe.com/blog/dashboard-design-patterns-web-apps/)
- [Enterprise UX Design Guide 2026 — Fuselab Creative](https://fuselabcreative.com/enterprise-ux-design-guide-2026-best-practices/)
- [50 Best Dashboard Design Examples for 2026 — Muzli](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)

### Network management UI
- [How to Build an Effective Network Monitoring Dashboard — Obkio](https://obkio.com/blog/network-monitoring-dashboard/)
- [Top 10 Network Management Software 2026 — Domotz](https://blog.domotz.com/all/top-10-network-management-software/)
- [Best Open Source Network Monitoring Tools 2026 — Uptrace](https://uptrace.dev/tools/network-monitoring-tools)
- [Top Network Management Tools 2026 — DarkBlue Tech](https://darkbluetech.com/it-management/top-network-management-tools-features-benefits-selection/)

### Linear / Command Palette / Keyboard UX
- [Linear's Delightful Design Patterns You Should Copy — Gunpowder Labs](https://gunpowderlabs.com/2024/12/22/linear-delightful-patterns)
- [How we redesigned the Linear UI (part II) — Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Command Palette Pattern — UX Patterns for Developers](https://uxpatterns.dev/patterns/advanced/command-palette)
- [The UX of Keyboard Shortcuts — Medium / Design Bootcamp](https://medium.com/design-bootcamp/the-art-of-keyboard-shortcuts-designing-for-speed-and-efficiency-9afd717fc7ed)
- [Concepts — Linear Docs](https://linear.app/docs/conceptual-model)

### Glassmorphism / Visual
- [Glassmorphism: What It Is and How to Use It in 2026 — Inverness Design](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026)
- [Glassmorphism CSS Tutorial 2026 — StudioLimb](https://www.studiolimb.com/guides/glassmorphism-css-tutorial.html)
- [12 Glassmorphism UI Features, Best Practices — UXPilot](https://uxpilot.ai/blogs/glassmorphism-ui)

### shadcn ecosystem
- [Top 5 Shadcn UI Block Libraries 2026 — DEV Community](https://dev.to/ausrobdev/top-5-shadcn-ui-block-libraries-2026-in-depth-review-4inb)
- [Aceternity UI — Shadcn-compatible blocks with Motion](https://ui.aceternity.com/shadcn-blocks)
- [Shadcn Studio Figma Design System](https://shadcnstudio.com/figma)
- [shadcn/ui — The Foundation for your Design System](https://ui.shadcn.com/)

### Referencias canónicas internas
- [GPON Symbology](./GPON_SYMBOLOGY.md) — colores e iconos por tipo/estado/calidad (input para Capa 1)
- [Editor UI/UX Spec](./EDITOR_UI_UX_SPEC.md) — especificación UX del editor por modo/zoom (input para Capa 2)
- [Network Map UX Flow](./NETWORK_MAP_UX_FLOW.md) — flujos vista/edición/zoom (input para Capa 3)
- [Realtime Monitoring Research](./REALTIME_MONITORING_RESEARCH.md) — base para Capa 4

# Análisis de Flujos de Trabajo por Rol
Fecha: 2026-04-29

## Marco de análisis

El sistema tiene 3 modos de editor (Vista, Crear, Editar) y 5 roles. El MVP enfatiza:
- `network_engineer` — diseña infraestructura
- `admin` — valida y gobierna
- `outside_plant` — verifica en campo (MVP: lectura solamente)

Las **zonas** (Z01, Z05, Z10) recién implementadas añaden un contexto geográfico a cada elemento y su código operativo.

---

## 1. MODO VISTA — "Explorar la red"

### network_engineer
**Objetivo:** Entender la topología, revisar calidad de datos, validar antes de pasar a producción.

**Flujo:**
1. Entra a `/networks/[id]` → Ve mapa en MODO VISTA
2. Zonas cargan automáticas (Z01, Z05, Z10 visible en filtros)
3. Selecciona una zona → Filtra elementos de esa zona
4. Panel izquierdo muestra:
   - Capas por tipo (OLT, SPL, NAP, rutas)
   - Stats de red (OLTs: 1, SPL: 2, NAP: 12, Km: 45)
   - Árbol topológico (OLT → SPL → NAP) por zona
   - Alertas (NAP saturada, SPL sin ratio, ruta sin endpoints)
5. Clickea un NAP → Panel derecho muestra:
   - Código: PIC-UIO-Z05-NAP-128
   - Puertos: 8/16 usados
   - Calidad: verified (ring verde)
   - Capacidad: barra 50%
6. Usa herramienta measure (futuro) → mide distancia a OLT

**Requisitos técnicos:**
- ✅ Zonas cargadas en NetworkEditorMap
- ✅ Filtros por zona funcionan
- ✅ Árbol topológico con stats
- ✅ Alertas en tiempo real
- ❌ Herramienta measure (pending)

---

### admin
**Objetivo:** Vigilar calidad general, aprobar cambios, auditar.

**Flujo:** Igual a network_engineer + acciones de administración
- Puede ver RLS policies, historial de cambios (futuro)
- Puede cambiar zona si ve inconsistencias (futuro: diálogo crítico)

**Requisitos técnicos:**
- Todo lo de network_engineer
- ❌ Historial de cambios (pending)
- ❌ Auditoría de quién cambió qué (pending)

---

### outside_plant
**Objetivo:** Verificar que lo registrado coincide con la realidad física.

**Flujo:**
1. Entra en MODO VISTA
2. Abre lista de zonas asignadas (Z05, Z10 por ejemplo)
3. Ve NAPs, splitters, rutas de su zona
4. Selecciona un NAP → Ve estado registrado
5. (MVP) No puede editar directo; propone cambios (futuro)

**Requisitos técnicos:**
- ✅ Vista por zona
- ❌ Panel de propuestas (pending - fase 4)
- ❌ Flujo de validación de campo (pending - fase 4)

---

## 2. MODO CREAR — "Construir infraestructura"

**Principio:** Dibujo primero, pedir pocos datos, advertir sin bloquear.

### network_engineer
**Objetivo:** Diseñar una red nueva desde cero, plantilla o importación.

**Flujo A: Crear elemento aislado**
1. Click toolbar [Crear] → Herramienta: NAP
2. Click en mapa → Draft NAP abre con:
   - Zona: [Z05 ▼] (selector, primera zona por defecto)
   - Código: PIC-UIO-Z05-NAP-001 (regenera al cambiar zona)
   - Nombre: (editable, opcional)
   - Puertos: 8 (default, editable)
   - [Guardar] [Cancelar]
3. Cambia zona → [Z10 ▼] → Código regenera automático: PIC-UIO-Z10-NAP-001
4. Clickea [Guardar] → Elemento aparece en mapa, store se marca isDirty
5. Repite para más NAPs o pasa a dibujar rutas

**Flujo B: Crear topología (futuro - decision #5)**
1. Toolbar [Crear] → [Generar topología]
2. Dialog abre:
   - Red: Quito Z05
   - Tipo: [Star ▼] (Star/Tree/Cascade)
   - OLT central: Click en mapa o buscar existente
   - Splitters a crear: 2
   - NAPs a crear: 8
   - [Vista previa] → Muestra schema
   - [Generar]
3. Sistema crea batch:
   - 1 OLT (si es nueva)
   - 2 splitters con código Z05-SPL-001, SPL-002
   - 8 NAPs con código Z05-NAP-001 a NAP-008
   - Rutas feeder OLT→SPL, rutas distribution SPL→NAP
4. Todas aparecen en mapa, store isDirty
5. Engineer revisa, ajusta ubicaciones, guarda

**Flujo C: Importación (futuro - fase 3)**
1. Click [Importar]
2. Sube CSV/Excel con estructura esperada
3. Sistema mapea columnas
4. Previsualiza elementos y rutas
5. Valida códigos (únicos por red), coordenadas, relaciones
6. Muestra errores/advertencias
7. Confirma importación → elementos quedan como drafts hasta validar

**Requisitos técnicos:**
- ✅ Sistema de zonas con selector
- ✅ Regeneración de código al cambiar zona
- ❌ Topologías predefinidas (pending - decision #5)
- ❌ Importación (pending - fase 3)

---

### admin
**Objetivo:** Igual a network_engineer (puede crear todo).

**Más:** Puede crear nuevas zonas (futuro UI).

**Requisitos técnicos:**
- Todo lo de network_engineer
- ❌ UI de administración de zonas (pending)

---

### outside_plant
**Objetivo:** En MVP se mantiene en VISTA solamente.

**Futuro (fase 4):** Capturar correcciones de campo como propuestas.
- Propone ubicación corregida
- Propone ruta diferente observada
- Marca reserva/empalme encontrado
- Flujo: captura → guardar propuesta → reviewer aprueba → aplicar a BD

**Requisitos técnicos (futuro):**
- ❌ Panel de propuestas
- ❌ Flujo de aprobación

---

## 3. MODO EDITAR — "Corregir infraestructura"

**Principio:** Cambios críticos requieren confirmación.

### network_engineer
**Objetivo:** Corregir errores de diseño, actualizar propiedades, mover ubicaciones.

**Flujo A: Editar propiedades**
1. Selecciona un elemento (NAP-128 en Z05)
2. Panel derecho abre en readonly, [Editar] activa inline fields:
   - Código: PIC-UIO-Z05-NAP-128 (no debe cambiar de zona sin cuidado)
   - Nombre: cambiar
   - Puertos: cambiar
   - Estado: [online ▼]
   - Calidad: [verified ▼]
   - Notas: agregar
3. [Guardar] → Update RPC → store isDirty

**Flujo B: Mover elemento (cambio crítico)**
1. Selecciona NAP → Drag en mapa → Nueva ubicación
2. Panel derecho muestra:
   - ⚠️ Ubicación cambió
   - Código: ¿Cambiar zona? [Z05 → Z10?] (dialog crítico)
   - Advertencia: "Cambiar zona regenerará código"
   - [Aceptar zona Z10] [Mantener Z05] [Cancelar move]
3. Si acepta zona nueva → código regenera pero con nueva secuencia
4. [Guardar] → Update con nueva ubicación, código, zona

**Flujo C: Eliminar elemento**
1. Selecciona → [⋮ Más] → [Eliminar]
2. Confirmación: "¿Eliminar PIC-UIO-Z05-NAP-128? Revisar dependencias:"
3. Si hay rutas conectadas → "⚠️ 3 rutas conectadas serán desconectadas"
4. [Eliminar] o [Cancelar]

**Cambios críticos que requieren confirmación:**
- ✅ Mover OLT, SPL, NAP (cambio de ubicación)
- ✅ Cambiar zona (regenera código)
- ✅ Cambiar conectividad origen/destino de ruta
- ✅ Cambiar código operativo
- ✅ Eliminar elemento con dependencias

**Requisitos técnicos:**
- ✅ Selector de modo edit
- ✅ Inline editing panel
- ✅ Drag to move
- ❌ Dialog crítico para zone change (pending)
- ❌ Validación de dependencias antes de eliminar (pending)

---

### admin
**Objetivo:** Igual a network_engineer + gestión de zonas.

**Futuro:**
- Crear nuevas zonas
- Renombrar zonas
- Reasignar elementos entre zonas (batch operation)

**Requisitos técnicos:**
- Todo lo de network_engineer
- ❌ UI de gestión de zonas

---

### outside_plant
**Objetivo:** En MVP se mantiene en VISTA.

**Futuro (fase 4):** Proponer correcciones de campo (no edición directa).
- Flujo: seleccionar elemento → [Proponer corrección] → dialog de captura
- Guarda propuesta (no modifica BD)
- network_engineer revisa y aprueba

**Requisitos técnicos (futuro):**
- ❌ UI de propuestas

---

## 4. PERSISTENCE & VALIDACIÓN

### Validaciones en tiempo real (todos modos)
- Nombres únicos por red para el código operativo
- Coordenadas válidas (dentro de Ecuador)
- Relaciones válidas (OLT debe existir, SPL debe conectar OLT→NAP)

### Advertencias (no bloqueantes)
- ✅ NAP saturada (0 puertos disponibles)
- ✅ NAP casi llena (>90% utilización)
- ✅ Splitter sin ratio
- ✅ OLT sin nombre
- ✅ Ruta sin origen/destino
- ✅ Ubicación aproximada (data quality)

### Guardar flujo
1. user clickea [Guardar] en toolbar
2. validate() → devuelve errores
3. Si errores bloqueantes: cancelar, mostrar en panel
4. Si solo advertencias: mostrar badge, permitir guardar (con confirmación)
5. Upsert en BD vía RPC
6. Limpiar isDirty, clear undo history

**Requisitos técnicos:**
- ✅ validate() implementation
- ✅ Advertencias en panel
- ❌ Errores bloqueantes (pending - decidir cuáles son realmente bloqueantes)

---

## 5. MATRIZ DE REQUISITOS POR ROL

| Característica | network_engineer | admin | outside_plant | installer | support |
|---|---|---|---|---|---|
| **VISTA** | | | | | |
| Ver elementos por zona | ✅ | ✅ | ✅ MVP | — | — |
| Ver árbol topológico | ✅ | ✅ | ✅ MVP | — | — |
| Ver alertas | ✅ | ✅ | ✅ MVP | — | — |
| Medir distancia | ❌ pending | ❌ pending | ❌ pending | — | — |
| **CREAR** | | | | | |
| Crear elementos aislados | ✅ | ✅ | ❌ MVP lectura | — | — |
| Generar topología template | ❌ decision #5 | ✅ | ❌ | — | — |
| Importar desde archivo | ❌ fase 3 | ✅ | ❌ | — | — |
| Selector de zona | ✅ | ✅ | N/A | — | — |
| Código regenera automático | ✅ | ✅ | N/A | — | — |
| **EDITAR** | | | | | |
| Editar propiedades | ✅ | ✅ | ❌ MVP lectura | — | — |
| Mover ubicación | ✅ | ✅ | ❌ MVP lectura | — | — |
| Cambiar zona (crítico) | ❌ pending dialog | ✅ | N/A | — | — |
| Eliminar elementos | ✅ | ✅ | ❌ | — | — |
| **ADMINISTRACIÓN** | | | | | |
| Crear zonas | ❌ | ❌ pending | N/A | — | — |
| Renombrar zonas | ❌ | ❌ pending | N/A | — | — |
| Ver historial cambios | ❌ pending | ✅ pending | N/A | — | — |

---

## 6. DECISIONES OPERACIONALES

### ¿Debería outside_plant poder editar en MVP?

**Opción A: MVP = lectura solamente (ACTUAL)**
- ✅ Menos riesgo de error
- ✅ Cumple con "planta externa propone, ingeniero aprueba"
- ❌ Menos productivo en campo (esperar aprobación es lento)

**Opción B: outside_plant edita con restricciones**
- ✅ Más productivo en campo
- ❌ Mayor riesgo de inconsistencias
- ❌ Requiere UI más compleja

**Recomendación:** Mantener Opción A en MVP. Fase 4 introduce sistema de propuestas.

---

### ¿Qué cambios son "críticos" y requieren confirmación?

**Cambios simples (sin confirmación):**
- Cambiar nombre
- Cambiar notas
- Cambiar estado operativo
- Cambiar calidad de dato

**Cambios críticos (confirmación en dialog):**
- Mover ubicación (riesgo: coordenadas erróneas)
- Cambiar zona (riesgo: código operativo se regenera)
- Cambiar extremos de ruta (riesgo: conectividad incorrecta)
- Eliminar elemento (riesgo: dependencias rotas)

---

### ¿Cuándo se regenera el código?

1. **En CREAR:** Al cambiar zona en el selector → código regenera automático
2. **En EDITAR:** Al mover ubicación si cambia zona → dialog pregunta qué hacer
3. **Nunca:** No se debe regenerar sin usuario consciente (es el identificador de trabajo)

---

## 7. PRIORIDADES PARA DESBLOQUEAR FLUJOS

**Flujo 1: network_engineer crea red mínima (MVP hoy)**
- ✅ Zonas predefinidas
- ✅ Crear elementos aislados con selector de zona
- ✅ Guardar en BD
- ✅ Ver en mapa
- ❌ *Bloqueador:* Validación de código único por red
- ❌ *Bloqueador:* Errores vs advertencias claros

**Flujo 2: network_engineer edita y valida (MVP próximo)**
- ✅ Editar propiedades
- ✅ Mover elementos
- ❌ *Bloqueador:* Dialog crítico para zone change
- ❌ *Bloqueador:* Validación de dependencias

**Flujo 3: network_engineer genera topología desde template (decision #5)**
- ❌ *Bloqueador:* Implementar generador de topologías
- ❌ *Bloqueador:* Batch creation de elementos relacionados

**Flujo 4: Importación desde archivo (fase 3)**
- ❌ *Bloqueador:* Parser CSV/Excel
- ❌ *Bloqueador:* Mapeo de columnas
- ❌ *Bloqueador:* Validación de datos

---

## 8. RECOMENDACIÓN DE SIGUIENTE PASO

**Opción A: Completar flujo MVP de CREAR/EDITAR**
- [ ] Validación de código único por red (bloqueador crítico)
- [ ] Diálogo crítico para cambio de zona en EDITAR
- [ ] Validación de dependencias antes de eliminar
- **Impacto:** network_engineer puede crear y editar redes pequeñas sin riesgo

**Opción B: Topologías predefinidas (decision #5)**
- [ ] Star/Tree/Cascade generator
- [ ] Batch element creation
- [ ] Auto-positioning de NAPs
- **Impacto:** Acelera creación de redes medianas (~30 elementos en minutos)

**Opción C: Herramienta measure (pequeña)**
- [ ] Integrar @turf/length en NetworkEditorMap
- [ ] UI para activar herramienta
- [ ] Mostrar distancia en tiempo real
- **Impacto:** Ayuda a validar longitudes de rutas

**Opción D: Clase óptica del OLT**
- [ ] Agregar campo optical_class a BD
- [ ] Panel editable en OLT
- [ ] Usar en calculadora óptica (hoy gris)
- **Impacto:** Calculadora óptica finalmente productiva

**Recomendación:** Opción A (completar MVP) → Opción B (topologías) → Opción D (clase óptica) → Opción C (measure)

El flujo de creación debe ser robusto antes de agregar atajos de generación batch.

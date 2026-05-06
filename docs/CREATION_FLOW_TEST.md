# Flujo Completo de Creación de Red — Prueba Funcional
Fecha: 2026-04-29

## Objetivo
Entender y probar el flujo **completo** de crear una red nueva desde cero hasta tener infraestructura guardada.

---

## PASO 1: Entrar a `/networks`
**Qué debería suceder:**
- Listar redes existentes
- Botón [+ Nueva red] para crear

**Código:** `apps/web/app/(dashboard)/networks/page.tsx` (server) + `networks-client.tsx` (client)

**Elementos renderizados:**
```
Encabezado: "Redes GPON"
Contador: "X redes configuradas"
Si hay redes:
  Tabla/lista de redes
  Botón [+ Nueva red]
Si no hay redes:
  Form "Crear nueva red" visible por defecto
```

**Form campos:**
- [ ] Nombre (required) — Ej. "Quito Z05"
- [ ] Descripción (optional) — Ej. "Sector norte"
- [ ] Topología (selector) — blank / star / tree / cascade
- [ ] Botón [Crear] 
- [ ] Error handling visible si falla

---

## PASO 2: Crear nueva red
**Qué debería suceder:**
1. User completa form: nombre="Quito Z05", topología="blank"
2. Click [Crear] → RPC `create_network(p_name, p_description, p_topology)`
3. RPC retorna network_id
4. Router redirige a `/networks/[id]`

**RPC esperado:** `create_network`
**Ubicación:** `database/migrations/` (verificar si existe)

**Comportamiento esperado del RPC:**
- Crea registro en tabla `networks`
- Auto-seed de 3 zonas (Z01, Z05, Z10) — verificar
- Retorna `network_id`
- RLS: solo user autenticado puede crear

**Campos esperados en networks:**
```sql
networks (
  id uuid primary key,
  name text,
  description text,
  topology text (blank/star/tree/cascade),
  created_by uuid,
  created_at timestamp,
  updated_at timestamp
)
```

**❓ Preguntas sin responder:**
- ¿RPC `create_network` existe?
- ¿Crea zonas automáticamente?
- ¿Retorna network_id correcto?

---

## PASO 3: Entrar al editor `/networks/[id]`
**Qué debería suceder:**

1. Server: `page.tsx` obtiene `network` y `userRole`
2. Renderiza `NetworkEditorShell` con props:
   ```tsx
   <NetworkEditorShell
     network={network}
     networkId={networkId}
     userRole={userRole}
   />
   ```

3. Shell renderiza:
   ```
   ┌─────────────────────────────────────────────────┐
   │ ← Redes / Quito Z05   [Vista][Crear][Editar]  │
   │                                    ● Sin guardar│
   └─────────────────────────────────────────────────┘
   │                                                   │
   │  NetworkEditorMap                                │
   │  (mapa vacío, ningún elemento creado aún)       │
   │                                                   │
   └─────────────────────────────────────────────────┘
   ```

**Queries ejecutadas en Shell:**
- `useQuery(networkEditorKeys.detail(networkId))` → `fetchNetworkEditorData()`
  - Llama RPCs: `infrastructure_elements_for_map()`, `fiber_routes_for_map()`, `route_points_for_map()`
  - Retorna: `{ elements: [], routes: [], routePoints: [] }` (vacíos)
  
- `useQuery(networkEditorKeys.zones(networkId))` → `fetchNetworkZones()`
  - Llama RPC: `network_zones_for_network(p_network_id)`
  - Retorna: `[{ zone_code: "Z01", zone_name: "Zona 1" }, ...]`

**Store Zustand:**
- `hydrateNetwork(networkId, { elements: [], routes: [], routePoints: [] })`
  - Carga datos en store
  - isDirty = false
  - validationErrors = []

**❓ Preguntas sin responder:**
- ¿Se cargan las zonas correctamente?
- ¿NetworkEditorMap recibe `zones` prop?
- ¿El modo inicial es "view"?

---

## PASO 4: Cambiar modo a "Crear"
**Qué debería suceder:**

1. User ve topbar con pills [Vista] [Crear] [Editar]
2. Click [Crear] → `setMode("design")`
3. NetworkEditorMap entra en modo design:
   ```
   - Toolbar visible con herramientas: NAP, OLT, SPL, Fibra, etc.
   - Panel izquierdo con capas/filtros
   - Panel derecho vacío (sin selección)
   - Mapa limpio, listo para dibujar
   ```

**Status message actualizado:**
- "Modo infraestructura listo." → algo como "Herramienta NAP lista"

**❓ Preguntas sin responder:**
- ¿Toolbar de herramientas visible en modo design?
- ¿Herramientas funcionan (click en NAP)?
- ¿Status message actualiza?

---

## PASO 5: Crear primer elemento (NAP)
**Qué debería suceder:**

1. Toolbar: User ve [Crear] → dropdown/buttons: OLT, SPL, NAP, Fibra, Cruce, Reserva, Empalme
2. Click [NAP] → herramienta activada
3. Cursor cambia a crosshair
4. User click en mapa → ubica NAP en coordenada {lng, lat}
5. Draft panel abre en panel derecho:
   ```
   ┌──────────────────────┐
   │ Crear NAP            │
   │                      │
   │ Zona: [Z01 ▼]        │
   │ Código: PIC-UIO-Z01-NAP-001
   │ Nombre: [_______]    │
   │ Puertos: [8]         │
   │                      │
   │ [Guardar] [Cancelar] │
   └──────────────────────┘
   ```

**Selector de zona:**
- Options: Z01, Z05, Z10 (cargadas del RPC)
- Default: Z01 (primera zona)
- onChange:
  - Calcula `nextSequence([elementos con tipo=NAP AND zona=Z05])`
  - Regenera código: `PIC-UIO-Z05-NAP-001`
  - Panel actualiza en tiempo real

**Store actualiza:**
- `activeDraft = { kind: "element", elementType: "nap", code: "PIC-UIO-Z01-NAP-001", selectedZone: "Z01" }`
- isDirty = false (draft aún no guardado)

**❓ Preguntas sin responder:**
- ¿Draft panel abre al click?
- ¿Selector de zona funciona?
- ¿Código regenera al cambiar zona?
- ¿Se ve NAP marcador en mapa?

---

## PASO 6: Cambiar zona en draft
**Qué debería suceder:**

1. Draft panel abierto con Zona: [Z01 ▼]
2. User click selector → dropdown: Z01, Z05, Z10
3. User selecciona Z05
4. onChange handler:
   - Calcula `nextSequence(elementos NAP con zona=Z05)`
   - Genera código: `generateDraftCode("nap", 1, "Z05")` → "PIC-UIO-Z05-NAP-001"
   - Actualiza draft en store
   - Panel actualiza código visible

```
Zona: [Z05 ▼]  ← cambió
Código: PIC-UIO-Z05-NAP-001  ← regeneró automático
```

**Store:**
- `activeDraft.selectedZone = "Z05"`
- `activeDraft.code = "PIC-UIO-Z05-NAP-001"`

**❓ Preguntas sin responder:**
- ¿onChange handler existe?
- ¿Código regenera correctamente?
- ¿nextSequence calcula bien?

---

## PASO 7: Guardar elemento
**Qué debería suceder:**

1. Draft panel con datos:
   - Zona: Z05
   - Código: PIC-UIO-Z05-NAP-001
   - Nombre: "NAP Centro" (user lo escribió)
   - Puertos: 8

2. User click [Guardar]
3. Handler: `createInfrastructureElement(input)`
   ```typescript
   input = {
     type: "nap",
     code: "PIC-UIO-Z05-NAP-001",
     name: "NAP Centro",
     lng: -78.5049,
     lat: -0.2298,
     status: "installed",
     location_quality: "drawn",
     total_ports: 8,
     ...
   }
   ```

4. RPC: `create_infrastructure_element_draft(p_type, p_code, p_name, ...)`
   - Inserta en `infrastructure_elements` con `code = "PIC-UIO-Z05-NAP-001"`
   - Retorna elemento con `id` asignado

5. Store:
   - `addElement(element)`
   - `clearActiveDraft()`
   - `isDirty = true` ← NUEVO elemento aún no guardado a BD

6. NetworkEditorMap:
   - NAP aparece en mapa con marcador
   - Panel derecho se cierra

**❓ Preguntas sin responder:**
- ¿RPC `create_infrastructure_element_draft` existe?
- ¿Inserta correctamente con código único?
- ¿Retorna elemento completo?
- ¿NAP aparece en mapa?
- ¿isDirty se marca?

---

## PASO 8: Crear segundo elemento (OLT)
**Qué debería suceder:**

1. Toolbar [Crear] → [OLT]
2. Click en mapa → Draft abre:
   ```
   Zona: [Z01 ▼]
   Código: PIC-UIO-Z01-OLT-001
   Nombre: [_______]
   PON Ports: [4]
   ```

3. User cambia nombre a "OLT Principal"
4. Click [Guardar]
5. NetworkEditorMap:
   - OLT aparece en mapa
   - Ahora hay 2 elementos: NAP + OLT

**Store:**
- `elements = { "nap-uuid": {...}, "olt-uuid": {...} }`
- `isDirty = true`

**❓ Preguntas sin responder:**
- ¿Funciona igual para OLT?
- ¿Se pueden ver ambos elementos en mapa?

---

## PASO 9: Dibujar ruta de fibra
**Qué debería suceder:**

1. Toolbar [Crear] → [Fibra]
2. Instrucción: "Clickea origen (OLT/SPL) y destino (SPL/NAP). ESC para cancelar."
3. User click OLT → primer punto
4. User click NAP → segundo punto
5. Draft abre:
   ```
   Tipo: [feeder ▼]
   Código: [_______] (optional)
   Fibra: [SMF ▼]
   Cantidad: [1]
   Longitud: [32.5 km] (calculada con Turf.js)
   ```

6. User confirma [Guardar]
7. RPC: `create_fiber_route_draft(...)`
8. NetworkEditorMap:
   - Línea aparece entre OLT y NAP

**Store:**
- `routes = { "route-uuid": {...} }`
- `isDirty = true`

**❓ Preguntas sin responder:**
- ¿Herramienta fibra funciona?
- ¿Snap automático a elementos?
- ¿Turf.js calcula longitud?
- ¿Ruta aparece en mapa?

---

## PASO 10: Guardar cambios a BD (Persist)
**Qué debería suceder:**

1. Topbar muestra: "● Cambios sin guardar" + botones [Descartar] [Guardar]
2. User click [Guardar]
3. Handler: `save()`
   ```
   validate() → [NAP sin nombre, ...]
   Si errores bloqueantes: STOP, mostrar en panel
   Si solo advertencias: permitir guardar
   ```

4. Para cada elemento en store:
   ```
   upsert via RPC create_infrastructure_element_draft(...)
   ```

5. Para cada ruta:
   ```
   upsert via RPC create_fiber_route_draft(...)
   ```

6. Después de guardar:
   - `isDirty = false`
   - Topbar: "Guardado" (sin botón guardar)
   - Clear undo/redo history

**❓ Preguntas sin responder:**
- ¿validate() funciona?
- ¿Errores bloqueantes detienen guardado?
- ¿RPC upsert (create o update) es correcta?
- ¿isDirty se resetea?

---

## PASO 11: Salir y volver a VISTA
**Qué debería suceder:**

1. Topbar: click [Vista]
2. NetworkEditorMap entra en modo view:
   - Toolbar desaparece
   - Panel izquierdo: filtros, búsqueda, árbol, alertas
   - Panel derecho: aparece al seleccionar elemento
   - Mapa: OLT + NAP + ruta visibles

3. User clickea NAP → Panel derecho muestra:
   ```
   Código: PIC-UIO-Z05-NAP-001
   Puertos: 8/8 usados
   Calidad: drawn
   Capacidad: barra 100%
   ```

4. Filtro por zona:
   - Panel izquierdo: [Zona] dropdown → [Z05]
   - Mapa filtra: solo elementos en Z05

**❓ Preguntas sin responder:**
- ¿Vista recarga datos?
- ¿Elementos aparecen en mapa?
- ¿Filtro por zona funciona?
- ¿Almacenamiento persistió?

---

## RESUMEN: ¿Qué falta verificar?

### Crítico (bloquea flujo):
- [ ] RPC `create_network` existe y crea zonas
- [ ] RPC `network_zones_for_network` retorna zonas
- [ ] RPC `create_infrastructure_element_draft` existe
- [ ] RPC `create_fiber_route_draft` existe
- [ ] Toolbar de herramientas visible en modo design
- [ ] Draft panel abre al crear elemento
- [ ] Zona selector funciona + regenera código
- [ ] Elementos aparecen en mapa
- [ ] Guardado persiste en BD

### Importante:
- [ ] Validación de código único por red
- [ ] Errores vs advertencias diferenciados
- [ ] Turf.js calcula longitudes
- [ ] Filtro por zona funciona

### Nice-to-have:
- [ ] Undo/redo funciona (Zundo)
- [ ] Herramientas de cruce/reserva/empalme funcionan
- [ ] Calculadora óptica muestra valores

---

## Propuesta de prueba:
1. Login con user `network_engineer` o `admin`
2. Ir a `/networks`
3. Crear red "Test Z05" con topología blank
4. En editor: cambiar a [Crear]
5. Crear NAP, cambiar zona a Z05, guardar
6. Crear OLT, guardar
7. Dibujar ruta OLT→NAP
8. Click [Guardar] en topbar
9. Cambiar a [Vista], verificar elementos visibles
10. Seleccionar NAP, verificar panel derecho

¿Haces esta prueba para identificar qué funciona y qué está roto?

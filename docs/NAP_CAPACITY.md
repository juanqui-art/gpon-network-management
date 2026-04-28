# Gestión de Capacidad NAP

## Propósito

Visualizar y validar la capacidad de cada NAP (Network Access Point) para:
- **Factibilidad comercial**: ¿Puedo instalar más clientes en esta NAP?
- **Planificación de expansión**: ¿Cuándo necesito agregar otra NAP?
- **Alertas operativas**: Detectar NAPs saturadas antes de que fallen

---

## Campos de capacidad

Cada NAP ahora tiene:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `total_ports` | number | Puertos totales (ej: 8, 16, 24) |
| `ports_used` | number \| null | Puertos ocupados (clientes activos) |
| `ports_reserved` | number \| null | Puertos reservados (no disponibles) |
| `ports_available` | computed | `total - (used + reserved)` |

### Ejemplo
```json
{
  "type": "nap",
  "code": "PIC-UIO-Z05-NAP-128",
  "total_ports": 8,
  "ports_used": 7,
  "ports_reserved": 0,
  "ports_available": 1
}
```

---

## Visualización en UI

### En el mapa
Ring de **data quality** sigue visible para indicar confiabilidad geográfica.

### En equipment panel
Barra visual de capacidad que muestra:

```
Capacidad
                                    7/8 puertos
┌─────────────────────────────────────────────┐
│███████████████ Usados ░ Reservados         │  Amarillo (70-90%)
└─────────────────────────────────────────────┘
Usados: 7  |  Disponible: 1 puerto

⚠ Capacidad limitada
```

**Colores:**
- 🟢 **Verde**: <70% usado — "Disponible"
- 🟡 **Amarillo**: 70-90% usado — "Capacidad limitada"
- 🔴 **Rojo**: 90%+ usado — "Saturada"

---

## Validaciones automáticas

El sistema valida automáticamente y genera advertencias:

### Nivel CRÍTICO (rojo)
```
NAP SATURADA — sin puertos disponibles
→ No se puede instalar más clientes
```

### Nivel ADVERTENCIA (amarillo)
```
PIC-UIO-Z05-NAP-128: NAP casi llena (1 puerto disponible)
→ Planificar expansión próximamente
```

---

## Cómo usar

### Crear una NAP con capacidad

```typescript
import { generateTopology } from "@/lib/gpon/topology-templates";

const topology = generateTopology("star");
// Genera 16 NAPs con:
// - total_ports: 8 (por defecto)
// - ports_used: null (sin clientes aún)
// - ports_reserved: 0

// Editar una NAP:
store.updateElement("nap-id-123", {
  ports_used: 3,      // 3 clientes ya instalados
  ports_reserved: 1,  // 1 puerto para expansión futura
});
// → ports_available = 8 - (3 + 1) = 4 puertos libres
```

### Visualizar capacidad

En `equipment-panel.tsx`, el componente `<NapCapacity />` renderiza automáticamente la barra:

```jsx
{eq.type === "nap" && eq.total_ports != null && (
  <div className="mb-3">
    <NapCapacity element={eq} size="md" />
  </div>
)}
```

### Validar red antes de guardar

```typescript
const errors = store.validate();
// Retorna advertencias:
// [
//   { id: "nap-123", field: "capacity", message: "NAP casi llena (1 puerto disponible)" },
//   { id: "nap-456", field: "capacity", message: "NAP SATURADA — sin puertos disponibles" }
// ]
```

---

## Decisiones de diseño

### ¿Por qué "no bloqueante"?

Las advertencias **guían pero no impiden** el workflow:
- Puedes guardar una NAP saturada (campo `ports_used >= total_ports`)
- Pero el sistema la marca en la validación
- El usuario ve la alerta y decide si expandir o no

**Razón**: En campo, el técnico podría descubrir NAPs saturadas que no estaban en el plan. No deberíamos frenar su documentación.

### ¿Por qué tres estados?

- **Disponible**: Sin preocupación inmediata
- **Limitada**: Planificar expansión en próximas semanas
- **Saturada**: Acción urgente

### ¿Por qué tanto `ports_used` como `ports_reserved`?

- `ports_used`: Puertos con clientes activos (facturables)
- `ports_reserved`: Puertos bloqueados para:
  - Mantenimiento futuro
  - ONTs de respaldo
  - Expansión planeada
  - Fallas (redundancia)

Esto permite planificación real: una NAP puede estar libre de clientes pero tener puertos reservados.

---

## Casos de uso

### Caso 1: ISP nuevo, sin clientes

```
NAP-001: 8 puertos | 0 usados | 0 reservados → 8 disponibles
→ Verde "Disponible" — listo para instalar
```

### Caso 2: NAP con crecimiento

```
Mes 1:  0 usados → Verde
Mes 3:  3 usados → Verde (37%)
Mes 6:  6 usados → Amarillo (75%) — generar alerta a ingeniería
Mes 8:  8 usados → Rojo "Saturada" — de emergencia: expandir NAP
```

### Caso 3: NAP con reservas estratégicas

```
NAP-005: 8 puertos | 5 usados | 2 reservados → 1 disponible
→ Amarillo "Capacidad limitada"
→ El ISP planificó mantener 2 puertos para redundancia/mantenimiento
```

---

## Extensiones futuras

### Predictivo (Fase 2)
- Proyectar saturación basada en tasa de crecimiento histórica
- "Esta NAP se saturará en 3 meses si sigue la tendencia"

### Integración comercial (Fase 3)
- "¿Puedo instalar a este cliente?" → Buscar NAP cercana con puertos libres
- Factibilidad automática basada en capacidad

### Optimización (Fase 3+)
- Sugerir rebalanceo de clientes entre NAPs
- Calcular impacto óptico de agregar clientes a una NAP saturada

---

## Referencias técnicas

**Archivo**: `components/map/nap-capacity.tsx`
- Barra visual con estado coloreado
- Muestra used, reserved, available
- Renderiza mensaje de advertencia

**Store**: `lib/store/network-editor.ts`
- Validaciones en `validate()` que revisan capacity
- Genera advertencias no bloqueantes

**Types**: `components/map/types.ts`
- `ports_used: number | null`
- `ports_reserved: number | null`

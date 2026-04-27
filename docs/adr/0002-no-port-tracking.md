# ADR 0002 — Sin tracking de puertos individuales en MVP

**Fecha:** 2026-04-27
**Estado:** Aceptado
**Contexto del MVP:** `docs/MVP_SCOPE.md`

## Decision

El MVP **no incluye una tabla `equipment_ports`** ni FKs a puertos individuales en `fiber_routes`. La capacidad de los elementos se modela con columnas-contador (`total_pon_ports`, `total_ports`) y el calculo de puertos disponibles se hace al vuelo via JOIN cuando llegue Fase 4.

## Razon

Para los casos de uso del MVP el puerto especifico es irrelevante:

| Pregunta operativa | Necesita puerto especifico? | Como se resuelve sin tabla |
|---|---|---|
| Cuantos puertos libres tiene NAP-005? | No | `COUNT(services WHERE nap_id = X)` (Fase 4) |
| Presupuesto optico de un cliente | No | Pertdida de splitter es igual en cualquier salida |
| Cliente Juan en que puerto esta? | Solo como referencia | String `port_label` en `services` (Fase 4) |
| Puerto roto en NAP | Raro | Decrementar `total_ports` o columna `unusable_ports` |

Las salidas de un splitter son fisicamente identicas. Los puertos PON de un OLT industrial salen del mismo Tx con el mismo nivel. La UI del editor pierde 50% de su complejidad si no tiene que asignar puertos en cada conexion.

## Cuando revisar

Reabrir esta decision si:

- Se necesita medir `signal_strength_dbm` por puerto fisico individual del OLT.
- Se requiere alarma SNMP por puerto especifico.
- Se necesita historico de "que puerto fisico uso este cliente a lo largo del tiempo".
- Se incorporan equipos donde los puertos no son fungibles (poco comun en GPON).

## Plan de activacion

```sql
CREATE TABLE equipment_ports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id    uuid NOT NULL REFERENCES infrastructure_elements(id) ON DELETE CASCADE,
  port_number   int  NOT NULL,
  port_type     text NOT NULL,
  status        port_status NOT NULL DEFAULT 'available',
  signal_dbm    numeric(5,2),
  last_checked  timestamptz,
  UNIQUE (element_id, port_number)
);
```

Mas un trigger que auto-genere las filas al crear un elemento, y migracion de `fiber_routes` para agregar `from_port_id` / `to_port_id` (nullable).

## Consecuencias

- Capacidad disponible se calcula al vuelo, no se mantiene precomputada.
- Si un puerto fisico falla, el operador decrementa `total_ports` manualmente.
- El campo `port_label` opcional en `services` (Fase 4) sirve como referencia de campo, no como FK.

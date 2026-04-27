# ADR 0003 — Tablas operativas en Fase 4

**Fecha:** 2026-04-27
**Estado:** Aceptado
**Contexto del MVP:** `docs/MVP_SCOPE.md`

## Decision

El MVP **no incluye** tablas de distribucion ni operacion. Solo se construyen las 3 tablas de infraestructura:

- `infrastructure_elements` (OLT, splitter, NAP)
- `fiber_routes` (feeder, distribution, other)
- `route_points` (cruce, reserva, empalme)

Las siguientes tablas se postponen a **Fase 4**:

```
customers
service_plans
services
drop_routes
incidents
signal_history
audit_log
```

## Razon

El criterio de cierre del MVP (ver `docs/MVP_SCOPE.md`) es que `network_engineer` y `outside_plant` puedan documentar la planta externa sobre el mapa. Para eso no hace falta clientes, ONTs, drops, incidentes, auditoria ni telemetria.

Incluir esas tablas desde ahora:

- Triplica el volumen de SQL inicial.
- Obliga a discutir validacion de cedula/RUC, planes comerciales, retencion de telemetria, etc.
- Retrasa el primer mapa funcional sin agregar valor al editor de planta.

## Cuando revisar

Cuando se cierre Fase 1-4 del MVP:

```
Fase 1 - Base de datos              ← este ADR
Fase 2 - Tipos y RPCs
Fase 3 - Mapa como visor
Fase 4 - Editor MVP (toolbar, dibujo)
```

Despues entra el bloque de distribucion (clientes + ONTs + drops + factibilidad) y el bloque de operacion (incidentes + telemetria + auditoria).

## Plan de activacion

Cuando se cierre el editor MVP, escribir las migraciones:

```
004_distribution_schema.sql      -- customers, service_plans, services, drop_routes
005_operations_schema.sql        -- incidents, signal_history, audit_log
006_distribution_rls.sql
007_signal_history_partitioning.sql  (si aplica por volumen)
```

Notas de diseno para Fase 4:

- `drop_routes` se modela en **tabla aparte** de `fiber_routes` (separa red de distribucion conceptualmente). Comparte columnas relevantes (`length_meters`, `attenuation_db_per_km`, `splice_loss_db`, `connector_loss_db`) para permitir `UNION ALL` en el calculo end-to-end del presupuesto optico.
- `services.nap_port_label` es texto libre, no FK (ver ADR 0002).
- `signal_history` arranca con retencion de 90 dias y vista `ont_latest_signal` materializada. Particionar solo si supera 50M filas.
- `audit_log` se llena via trigger SECURITY DEFINER en tablas operativas.

## Consecuencias

- El esquema MVP es minimo (3 tablas + ENUMs).
- RLS del MVP solo cubre las 3 tablas; los roles `installer` y `support` quedan en el ENUM pero sin policies asignadas hasta Fase 4.
- El editor del MVP no muestra clientes ni incidentes — son features de fases siguientes.
- Calculo de presupuesto optico end-to-end se completa cuando exista `drop_routes`.

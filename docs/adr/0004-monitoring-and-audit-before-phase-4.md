# ADR 0004 — Monitoreo ONT y audit log adelantados a Fase 2

**Fecha:** 2026-11-04 (registra decisiones implementadas en mayo 2026)
**Estado:** Aceptado
**Supera parcialmente:** `docs/adr/0003-operational-tables-phase-4.md` (solo `signal_history` y `audit_log`)

> Este ADR se escribió después de implementar, para que el registro de decisiones refleje el código.
> La sección "Razón" se reconstruye a partir de `docs/REALTIME_MONITORING_RESEARCH.md` y los commits; si el motivo real fue otro, corregirlo aquí.

## Decisión

Dos piezas que ADR 0003 dejaba para Fase 4 se construyeron antes:

1. **Telemetría ONT** — `021_ont_monitoring_tables.sql` crea `ont_current_state` (último estado, UPSERT) y `ont_signal_history` (historial filtrado), publicadas en Supabase Realtime. Las alimenta el colector standalone `apps/collector` (SNMP v2c → Supabase con service key). Completado por 022 (`management_ip`), 023 (seed mock) y 024 (índices + Realtime delete).
2. **Audit log** — `012_audit_logs.sql` crea `audit_logs`, escrita desde server actions vía `lib/audit/log.ts`.

El resto de ADR 0003 sigue vigente: `customers`, `service_plans`, `services`, `drop_routes` e `incidents` permanecen en Fase 4.

## Razón

- El monitoreo es independiente del modelo de clientes: una ONT se identifica por `olt_host` + id lógico del puerto PON, sin necesitar `customers` ni `services`. Adelantarlo no arrastra las discusiones que ADR 0003 quería evitar (cédula/RUC, planes comerciales).
- La arquitectura elegida (polling SNMP cada 60 s → Supabase → WebSocket) no requiere servidor propio; el costo incremental fue bajo.
- La gestión de usuarios (`/admin/users`) necesitaba trazabilidad desde el primer día.

## Diferencias con lo que planeaba ADR 0003

| ADR 0003 planeaba | Implementado | Consecuencia |
|---|---|---|
| `signal_history` con retención de 90 días + vista `ont_latest_signal` | Tabla `ont_current_state` separada (reemplaza la vista); **sin retención automática** | El volumen crece sin límite; la política de historial del colector (change / degradation / sample) lo reduce ~94%, pero no lo acota |
| `audit_log` llenado por trigger `SECURITY DEFINER` en tablas operativas | Inserción desde la app con service key para acciones de usuarios + **triggers `SECURITY DEFINER` desde 028** para redes e infraestructura | Resuelto en 028: toda escritura de red queda auditada, incluido SQL directo |
| Migraciones `004_distribution_schema` / `005_operations_schema` | Numeración real 012 y 021 | Solo nominal |

## Consecuencias

- Hay datos operativos (telemetría) antes de que exista el modelo de clientes: las ONTs no se pueden asociar todavía a un servicio ni a un `drop_route`. El presupuesto óptico end-to-end sigue incompleto.
- Pendientes derivados de esta decisión:
  - Política de retención para `ont_signal_history` (job `pg_cron` o partición por mes).
  - `locate_fault_along_route()`: correlacionar distancia ONT con la topología.
- Lectura de `audit_logs` restringida a `admin` (policy en 012).

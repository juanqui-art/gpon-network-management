# GPON ONT Collector

Colector standalone Node.js que lee telemetría de OLTs Huawei vía SNMP y
persiste en Supabase. Pensado para correr en una Raspberry Pi dentro de la
red del ISP, con conexión directa al OLT.

## Arquitectura

```
OLT Huawei (SNMP v2c, UDP 161)
  │
  ▼
Colector (poll loop cada 60s)
  ├─ snmp/session.ts        → walks paralelos por OID
  ├─ parser/ont-parser.ts   → conversión rx_power, status mapping
  ├─ decide/history-trigger → ¿guardar historial?
  └─ persist/supabase.ts    → UPSERT estado + INSERT historial
  │
  ▼
Supabase (ont_current_state + ont_signal_history)
  │
  ▼ (Realtime via WebSocket)
Frontend Next.js (mapa actualiza marcadores en vivo)
```

## Instalación

```bash
cd apps/collector
pnpm install
cp .env.example .env
# editar .env con SUPABASE_SERVICE_KEY y NETWORK_ID
```

## Comandos

```bash
pnpm dev      # tsx watch — reload automático
pnpm start    # ejecutar con tsx (sin watch)
pnpm build    # compilar TypeScript a dist/
pnpm check    # biome lint + format
```

## Modo mock vs real

**Mock** (`MOCK_MODE=true`): genera 16 ONTs sintéticas con telemetría variable
y 5% probabilidad de cambio de status por poll. Útil para:
- Iterar UI Realtime sin acceso a OLT
- Validar políticas RLS y publication
- Pruebas de integración del pipeline

**Real** (`MOCK_MODE=false`): conecta vía SNMP v2c al OLT. Requiere:
- IP de gestión accesible desde la RPi
- Community string SNMP
- OIDs verificados (Huawei MA5600T por defecto)

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `MOCK_MODE` | `false` | Si `true`, ignora OLT y genera datos sintéticos |
| `OLT_HOST` | — | IP del OLT (requerido si !mock) |
| `OLT_COMMUNITY` | — | Community string v2c |
| `OLT_SNMP_PORT` | `161` | Puerto SNMP UDP |
| `OLT_SNMP_TIMEOUT_MS` | `5000` | Timeout por request |
| `OLT_SNMP_RETRIES` | `1` | Reintentos por request |
| `SUPABASE_URL` | — | URL del proyecto |
| `SUPABASE_SERVICE_KEY` | — | service_role key (NO publishable) |
| `NETWORK_ID` | — | UUID de la red en `networks` |
| `POLL_INTERVAL_MS` | `60000` | Cadencia del poll |
| `DEGRADATION_THRESHOLD_DB` | `1.5` | Cambio de rx_power que dispara historial |
| `SAMPLE_EVERY_N_POLLS` | `10` | Muestra periódica forzada |
| `STATE_CHANGE_DELTA_DB` | `0.5` | Variación de rx/tx que reescribe `ont_current_state` |
| `STATE_CHANGE_DELTA_TEMPERATURE_C` | `2` | Variación de temperatura que reescribe `ont_current_state` |

## Política de historial

Solo se inserta en `ont_signal_history` cuando:

1. **change** — cambio de status (online ↔ offline ↔ los/lof)
2. **degradation** — `|rx_power_actual − rx_power_anterior| ≥ DEGRADATION_THRESHOLD_DB`
3. **sample** — cada N polls aunque no cambie nada (baseline)

Con una ONT estable se guarda 1 de cada `SAMPLE_EVERY_N_POLLS` polls, así que
la reducción máxima es `1 − 1/N` (90% con N=10). Los cambios y degradaciones
suman filas por encima de ese piso.

## Política de estado actual

`ont_current_state` **no** se reescribe completo en cada poll. Una ONT se
upserta solo si:

1. es la primera vez que se ve (o tras reiniciar el colector),
2. cambió status, motivo de desconexión, distancia, serial, descripción o puerto,
3. rx/tx variaron ≥ `STATE_CHANGE_DELTA_DB` o la temperatura ≥
   `STATE_CHANGE_DELTA_TEMPERATURE_C` respecto al último valor **escrito**, o
4. el HistoryDecider emitió un trigger (incluye la muestra periódica, que
   funciona como heartbeat: `last_seen_at` se refresca al menos cada N polls).

Motivo: cada UPSERT genera un evento de Supabase Realtime evaluado contra RLS
por suscriptor. Con miles de ONTs, reescribir todo en cada poll satura el canal
aunque nada haya cambiado.

## Despliegue en Raspberry Pi

Documento pendiente: `docs/COLLECTOR_DEPLOYMENT.md` cubrirá systemd unit,
logs, monitoreo del propio colector.

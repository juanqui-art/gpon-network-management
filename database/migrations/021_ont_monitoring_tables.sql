-- Tablas para el módulo de monitoreo en tiempo real de ONTs.
-- Diseñado para colector externo (RPi + Node.js) que lee datos SNMP de OLTs
-- Huawei (familia MA5800/MA5600T) y los persiste en Supabase.
--
-- Arquitectura de persistencia:
--   ont_current_state    → 1 fila por ONT, UPSERT en cada poll (no crece)
--   ont_signal_history   → INSERT solo cuando hay cambio/degradación/muestra
--                          (control de volumen ~94% vs guardar todo)
--
-- Realtime: ambas tablas se agregan a la publication supabase_realtime
-- al final para que el mapa reciba cambios via WebSocket.
--
-- Referencia: docs/REALTIME_MONITORING_RESEARCH.md

-- ─── 1. ENUMs ────────────────────────────────────────────────────────────────

CREATE TYPE ont_status AS ENUM (
  'online',     -- ONT respondiendo, señal nominal
  'offline',    -- ONT no responde
  'los',        -- Loss of Signal (sin luz óptica)
  'lof',        -- Loss of Frame (luz pero sin sincronización)
  'unknown'     -- estado inicial o no determinado
);

CREATE TYPE ont_history_trigger AS ENUM (
  'change',       -- el status cambió (online ↔ offline ↔ los/lof)
  'degradation',  -- rx_power varió más del umbral configurado
  'sample'        -- muestra periódica (cada N minutos)
);

-- ─── 2. ont_current_state (estado vivo) ──────────────────────────────────────

CREATE TABLE ont_current_state (
  id                       uuid                            PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id               uuid                            NOT NULL REFERENCES networks(id) ON DELETE CASCADE,

  -- Identidad
  ont_serial               text,                           -- número de serie Huawei (ej: HWTC12345678)
  ont_logical_id           text                            NOT NULL,  -- "<olt_port>.<ont_id>" para mapear a SNMP
  ont_description          text,                           -- nombre cliente/ubicación (configurado en OLT)

  -- Origen físico
  olt_host                 text                            NOT NULL,  -- IP del OLT origen
  pon_port                 text,                           -- "F/S/P" legible (ej: "0/2/1")

  -- Telemetría óptica
  rx_power_dbm             numeric(5,2),                   -- null cuando offline
  tx_power_dbm             numeric(5,2),
  temperature_c            numeric(4,1),

  -- Estado y posición
  status                   ont_status                      NOT NULL DEFAULT 'unknown',
  distance_m               integer,
  last_disconnect_reason   text,                           -- código de Huawei: 'los', 'power-off', etc.

  -- Timestamps
  last_seen_at             timestamptz,                    -- última vez que el OLT confirmó conexión
  created_at               timestamptz                     NOT NULL DEFAULT now(),
  updated_at               timestamptz                     NOT NULL DEFAULT now(),

  CONSTRAINT ont_current_state_unique
    UNIQUE (network_id, ont_logical_id)
);

CREATE INDEX ont_current_state_network_idx       ON ont_current_state (network_id);
CREATE INDEX ont_current_state_status_idx        ON ont_current_state (network_id, status);
CREATE INDEX ont_current_state_serial_idx        ON ont_current_state (ont_serial) WHERE ont_serial IS NOT NULL;
CREATE INDEX ont_current_state_last_seen_idx     ON ont_current_state (last_seen_at DESC NULLS LAST);

CREATE TRIGGER trg_ont_current_state_updated_at
  BEFORE UPDATE ON ont_current_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE ont_current_state IS
  'Estado actual de cada ONT monitoreada. Se sobreescribe en cada poll del colector — no crece.';
COMMENT ON COLUMN ont_current_state.ont_logical_id IS
  'Identificador SNMP compuesto "<olt_port>.<ont_id>" usado para mapear lecturas SNMP a esta fila.';
COMMENT ON COLUMN ont_current_state.rx_power_dbm IS
  'Potencia óptica recibida en dBm (ya convertida — el SNMP de Huawei devuelve INTEGER que se divide entre 100).';

-- ─── 3. ont_signal_history (historial inteligente) ───────────────────────────

CREATE TABLE ont_signal_history (
  id                  uuid                            PRIMARY KEY DEFAULT gen_random_uuid(),
  ont_current_state_id uuid                           NOT NULL REFERENCES ont_current_state(id) ON DELETE CASCADE,

  -- Denormalizados para queries directas sin JOIN (filtros, RLS, retención)
  network_id          uuid                            NOT NULL,
  ont_logical_id      text                            NOT NULL,

  -- Telemetría capturada en el evento
  rx_power_dbm        numeric(5,2),
  tx_power_dbm        numeric(5,2),
  status              ont_status                      NOT NULL,

  -- Razón por la que se guardó este registro
  trigger             ont_history_trigger             NOT NULL,

  -- Timestamps
  recorded_at         timestamptz                     NOT NULL DEFAULT now()
);

CREATE INDEX ont_signal_history_state_idx       ON ont_signal_history (ont_current_state_id, recorded_at DESC);
CREATE INDEX ont_signal_history_logical_idx     ON ont_signal_history (network_id, ont_logical_id, recorded_at DESC);
CREATE INDEX ont_signal_history_recorded_idx    ON ont_signal_history (recorded_at);
CREATE INDEX ont_signal_history_trigger_idx     ON ont_signal_history (trigger, recorded_at DESC);

COMMENT ON TABLE ont_signal_history IS
  'Historial de telemetría: solo se inserta cuando hay cambio de estado, degradación o muestra periódica. Ahorra ~94% espacio vs guardar cada poll.';

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE ont_current_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE ont_signal_history ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado (necesario para que Realtime entregue eventos)
CREATE POLICY "read ont_current_state"
  ON ont_current_state FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "read ont_signal_history"
  ON ont_signal_history FOR SELECT
  USING (auth.role() = 'authenticated');

-- Escritura: el colector usa service_role (bypassa RLS automáticamente).
-- Adicionalmente permitimos escritura manual a admin/network_engineer
-- por si se necesita corregir datos desde la UI en el futuro.

CREATE POLICY "field write ont_current_state"
  ON ont_current_state FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

CREATE POLICY "field update ont_current_state"
  ON ont_current_state FOR UPDATE
  USING (get_user_role() IN ('admin', 'network_engineer'))
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

CREATE POLICY "field write ont_signal_history"
  ON ont_signal_history FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

-- Borrado: solo admin (consistente con resto del esquema)
CREATE POLICY "admin delete ont_current_state"
  ON ont_current_state FOR DELETE
  USING (get_user_role() = 'admin');

CREATE POLICY "admin delete ont_signal_history"
  ON ont_signal_history FOR DELETE
  USING (get_user_role() = 'admin');

-- ─── 5. Habilitar Realtime ───────────────────────────────────────────────────

-- Estas sentencias agregan las tablas a la publication que el servidor
-- Realtime de Supabase escucha. Sin esto, los cambios NO se transmiten
-- por WebSocket al browser.
--
-- IMPORTANTE: Realtime respeta RLS. Solo se enviarán eventos al browser
-- si el usuario tiene permiso de SELECT sobre la fila modificada.

ALTER PUBLICATION supabase_realtime ADD TABLE public.ont_current_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ont_signal_history;

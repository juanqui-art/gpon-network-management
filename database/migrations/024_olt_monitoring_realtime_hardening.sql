-- Hardens /monitoring/olt/[host] queries and Realtime delete handling.
--
-- The detail page and Realtime recovery path filter ont_current_state by
-- olt_host, so keep that lookup indexed as telemetry volume grows.
CREATE INDEX IF NOT EXISTS ont_current_state_olt_host_logical_idx
  ON ont_current_state (olt_host, ont_logical_id);

-- Filtered DELETE events need the previous row values to evaluate olt_host
-- and to let the browser remove the deleted ONT from its local state.
ALTER TABLE ont_current_state REPLICA IDENTITY FULL;

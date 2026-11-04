-- Audit trail for network/infrastructure edits, enforced at the database level.
--
-- Until now audit_logs was only written by server actions (user management)
-- and archive_network(). Edits made through the editor RPCs, the capture flow
-- or direct SQL left no trace. A row-level trigger covers every write path,
-- including service-role and SQL console changes (actor = NULL in that case).
--
-- Event shape:
--   action       '<target_type>.created' | '.updated' | '.deleted'
--   target_type  passed as trigger argument (infrastructure_element, ...)
--   target_label code → name → zone_code
--   metadata     network_id, source (JWT role or DB session user) and
--                created: key fields · updated: {changes: {col: {old,new}}}
--                deleted: {snapshot: full row} for recovery
--
-- Design choices:
--   * Updates that only touch bookkeeping columns are skipped (no-op events).
--   * Geometry columns (location, geometry) are logged as changed without
--     values on update, to keep rows small; the delete snapshot keeps them
--     (EWKB hex, restorable with ST_GeomFromEWKB).
--   * networks: the archived_at NULL → value transition is skipped because
--     archive_network() already writes a richer 'network.archived' event.
--   * The insert runs in the same transaction: if auditing fails, the write
--     fails. No unaudited edits.

CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_type text := TG_ARGV[0];
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_metadata jsonb;
  v_key text;
  v_ignored text[] := ARRAY['updated_at', 'updated_by', 'created_at', 'created_by'];
  v_geometry text[] := ARRAY['location', 'geometry'];
  v_action text;
  v_network_id text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := to_jsonb(OLD);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := to_jsonb(NEW);
  END IF;
  v_row := COALESCE(v_new, v_old);

  IF TG_OP = 'UPDATE' THEN
    -- archive_network() logs its own event.
    IF TG_TABLE_NAME = 'networks'
       AND v_old->>'archived_at' IS NULL
       AND v_new->>'archived_at' IS NOT NULL THEN
      RETURN NULL;
    END IF;

    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      CONTINUE WHEN v_key = ANY (v_ignored);
      CONTINUE WHEN (v_old->v_key) IS NOT DISTINCT FROM (v_new->v_key);

      IF v_key = ANY (v_geometry) THEN
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('changed', true));
      ELSE
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key)
        );
      END IF;
    END LOOP;

    IF v_changes = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  END IF;

  v_action := v_target_type || CASE TG_OP
    WHEN 'INSERT' THEN '.created'
    WHEN 'UPDATE' THEN '.updated'
    ELSE '.deleted'
  END;

  IF TG_TABLE_NAME = 'networks' THEN
    v_network_id := v_row->>'id';
  ELSE
    v_network_id := v_row->>'network_id';
  END IF;

  -- route_points may not carry network_id: resolve through the parent route.
  -- (NULL when the parent route was deleted in the same cascade.)
  IF v_network_id IS NULL AND v_row ? 'fiber_route_id' THEN
    SELECT fr.network_id::text INTO v_network_id
    FROM fiber_routes fr
    WHERE fr.id = (v_row->>'fiber_route_id')::uuid;
  END IF;

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'network_id', v_network_id,
    'source', COALESCE(auth.jwt()->>'role', session_user::text)
  ));

  IF TG_OP = 'INSERT' THEN
    v_metadata := v_metadata || jsonb_strip_nulls(jsonb_build_object(
      'type', v_new->>'type',
      'status', v_new->>'status'
    ));
  ELSIF TG_OP = 'UPDATE' THEN
    v_metadata := v_metadata || jsonb_build_object('changes', v_changes);
  ELSE
    v_metadata := v_metadata || jsonb_build_object('snapshot', v_old);
  END IF;

  INSERT INTO audit_logs (
    actor_user_id,
    actor_email,
    action,
    target_type,
    target_id,
    target_label,
    metadata
  )
  VALUES (
    auth.uid(),
    auth.jwt()->>'email',
    v_action,
    v_target_type,
    v_row->>'id',
    COALESCE(v_row->>'code', v_row->>'name', v_row->>'zone_code'),
    v_metadata
  );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION audit_row_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_audit_infrastructure_elements ON infrastructure_elements;
CREATE TRIGGER trg_audit_infrastructure_elements
  AFTER INSERT OR UPDATE OR DELETE ON infrastructure_elements
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('infrastructure_element');

DROP TRIGGER IF EXISTS trg_audit_fiber_routes ON fiber_routes;
CREATE TRIGGER trg_audit_fiber_routes
  AFTER INSERT OR UPDATE OR DELETE ON fiber_routes
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('fiber_route');

DROP TRIGGER IF EXISTS trg_audit_route_points ON route_points;
CREATE TRIGGER trg_audit_route_points
  AFTER INSERT OR UPDATE OR DELETE ON route_points
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('route_point');

DROP TRIGGER IF EXISTS trg_audit_networks ON networks;
CREATE TRIGGER trg_audit_networks
  AFTER INSERT OR UPDATE OR DELETE ON networks
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('network');

DROP TRIGGER IF EXISTS trg_audit_network_zones ON network_zones;
CREATE TRIGGER trg_audit_network_zones
  AFTER INSERT OR UPDATE OR DELETE ON network_zones
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('network_zone');

-- Per-network history lookups (editor "who changed what" view).
CREATE INDEX IF NOT EXISTS audit_logs_network_idx
  ON audit_logs ((metadata->>'network_id'), created_at DESC);

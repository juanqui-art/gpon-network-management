-- Safe logical deletion for networks.
-- Archived networks are hidden from the main list but remain recoverable.

ALTER TABLE networks
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE INDEX IF NOT EXISTS networks_archived_at_idx ON networks (archived_at);

DROP FUNCTION IF EXISTS list_networks();

CREATE OR REPLACE FUNCTION list_networks()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  topology text,
  element_count bigint,
  route_count bigint,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
  SELECT
    n.id,
    n.name,
    n.description,
    n.topology::text,
    COUNT(DISTINCT ie.id) AS element_count,
    COUNT(DISTINCT fr.id) AS route_count,
    n.created_at,
    n.updated_at
  FROM networks n
  LEFT JOIN infrastructure_elements ie ON ie.network_id = n.id
  LEFT JOIN fiber_routes fr ON fr.network_id = n.id
  WHERE n.archived_at IS NULL
  GROUP BY n.id, n.name, n.description, n.topology, n.created_at, n.updated_at
  ORDER BY n.updated_at DESC;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION archive_network(
  p_network_id uuid,
  p_confirm_name text,
  p_reason text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_network networks%ROWTYPE;
  v_actor_email text;
BEGIN
  IF get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can archive networks';
  END IF;

  SELECT * INTO v_network
  FROM networks
  WHERE id = p_network_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Network not found';
  END IF;

  IF v_network.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Network is already archived';
  END IF;

  IF p_confirm_name IS NULL OR btrim(p_confirm_name) <> v_network.name THEN
    RAISE EXCEPTION 'Network name confirmation does not match';
  END IF;

  UPDATE networks
  SET
    archived_at = now(),
    archived_by = auth.uid(),
    archive_reason = NULLIF(btrim(p_reason), ''),
    updated_at = now()
  WHERE id = p_network_id;

  SELECT email INTO v_actor_email
  FROM auth.users
  WHERE id = auth.uid();

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
    v_actor_email,
    'network.archived',
    'network',
    p_network_id::text,
    v_network.name,
    jsonb_build_object(
      'reason', NULLIF(btrim(p_reason), ''),
      'element_count', (SELECT COUNT(*) FROM infrastructure_elements WHERE network_id = p_network_id),
      'route_count', (SELECT COUNT(*) FROM fiber_routes WHERE network_id = p_network_id)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION archive_network(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_network(uuid, text, text) TO authenticated;

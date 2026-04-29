-- RPC: Get all zones for a network
CREATE OR REPLACE FUNCTION network_zones_for_network(p_network_id uuid)
RETURNS TABLE (
  id uuid,
  network_id uuid,
  zone_code varchar,
  zone_name varchar,
  description text,
  created_by uuid,
  created_at timestamp,
  updated_at timestamp
) AS $$
  SELECT
    nz.id,
    nz.network_id,
    nz.zone_code,
    nz.zone_name,
    nz.description,
    nz.created_by,
    nz.created_at,
    nz.updated_at
  FROM network_zones nz
  WHERE nz.network_id = p_network_id
  ORDER BY nz.zone_code ASC;
$$ LANGUAGE SQL STABLE;

-- RPC: Get a single zone by code
CREATE OR REPLACE FUNCTION network_zone_by_code(p_network_id uuid, p_zone_code varchar)
RETURNS TABLE (
  id uuid,
  network_id uuid,
  zone_code varchar,
  zone_name varchar,
  description text,
  created_by uuid,
  created_at timestamp,
  updated_at timestamp
) AS $$
  SELECT
    nz.id,
    nz.network_id,
    nz.zone_code,
    nz.zone_name,
    nz.description,
    nz.created_by,
    nz.created_at,
    nz.updated_at
  FROM network_zones nz
  WHERE nz.network_id = p_network_id AND nz.zone_code = p_zone_code
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- RPC: Create a new zone for a network
CREATE OR REPLACE FUNCTION create_network_zone(
  p_network_id uuid,
  p_zone_code varchar,
  p_zone_name varchar,
  p_description text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  network_id uuid,
  zone_code varchar,
  zone_name varchar,
  description text,
  created_by uuid,
  created_at timestamp,
  updated_at timestamp
) AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  -- Check permission
  IF get_user_role() NOT IN ('admin', 'network_engineer') THEN
    RAISE EXCEPTION 'Only admin and network_engineer can create zones';
  END IF;

  -- Check if zone already exists
  IF EXISTS (
    SELECT 1 FROM network_zones
    WHERE network_id = p_network_id AND zone_code = p_zone_code
  ) THEN
    RAISE EXCEPTION 'Zone % already exists in this network', p_zone_code;
  END IF;

  INSERT INTO network_zones (network_id, zone_code, zone_name, description, created_by)
  VALUES (p_network_id, p_zone_code, p_zone_name, p_description, v_user_id)
  RETURNING
    network_zones.id,
    network_zones.network_id,
    network_zones.zone_code,
    network_zones.zone_name,
    network_zones.description,
    network_zones.created_by,
    network_zones.created_at,
    network_zones.updated_at;
END;
$$ LANGUAGE plpgsql STRICT;

-- Update RPCs for the Infrastructure Editor — mode "edit"
-- Allows patching existing elements and routes in-place.
-- SECURITY INVOKER keeps RLS as the enforcement layer.
-- Roles permitted to update: admin, network_engineer (see 002_rls_policies.sql)

-- ── update_infrastructure_element ────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.update_infrastructure_element(
  uuid, text, text, element_status, data_quality,
  double precision, double precision,
  pon_standard, int, split_ratio, numeric, int, text, text
);

CREATE FUNCTION public.update_infrastructure_element(
  p_id                 uuid,
  p_code               text               DEFAULT NULL,
  p_name               text               DEFAULT NULL,
  p_status             element_status     DEFAULT NULL,
  p_location_quality   data_quality       DEFAULT NULL,
  p_lng                double precision   DEFAULT NULL,
  p_lat                double precision   DEFAULT NULL,
  p_pon_standard       pon_standard       DEFAULT NULL,
  p_total_pon_ports    int                DEFAULT NULL,
  p_split_ratio        split_ratio        DEFAULT NULL,
  p_insertion_loss_db  numeric            DEFAULT NULL,
  p_total_ports        int                DEFAULT NULL,
  p_address_reference  text               DEFAULT NULL,
  p_notes              text               DEFAULT NULL
)
RETURNS TABLE(
  id                 uuid,
  organization_id    uuid,
  type               element_type,
  code               text,
  name               text,
  status             element_status,
  lng                double precision,
  lat                double precision,
  location_quality   data_quality,
  address_reference  text,
  pon_standard       pon_standard,
  total_pon_ports    int,
  split_ratio        split_ratio,
  insertion_loss_db  numeric,
  total_ports        int,
  properties         jsonb,
  notes              text,
  created_by         uuid,
  updated_by         uuid,
  created_at         timestamptz,
  updated_at         timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE infrastructure_elements SET
    code               = COALESCE(p_code, code),
    name               = CASE WHEN p_name IS NOT NULL THEN NULLIF(p_name, '') ELSE name END,
    status             = COALESCE(p_status, status),
    location_quality   = COALESCE(p_location_quality, location_quality),
    location           = CASE
                           WHEN p_lng IS NOT NULL AND p_lat IS NOT NULL
                           THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
                           ELSE location
                         END,
    pon_standard       = CASE WHEN p_pon_standard  IS NOT NULL THEN p_pon_standard  ELSE pon_standard       END,
    total_pon_ports    = CASE WHEN p_total_pon_ports IS NOT NULL THEN p_total_pon_ports ELSE total_pon_ports END,
    split_ratio        = CASE WHEN p_split_ratio    IS NOT NULL THEN p_split_ratio    ELSE split_ratio       END,
    insertion_loss_db  = CASE WHEN p_insertion_loss_db IS NOT NULL THEN p_insertion_loss_db ELSE insertion_loss_db END,
    total_ports        = CASE WHEN p_total_ports    IS NOT NULL THEN p_total_ports    ELSE total_ports       END,
    address_reference  = CASE WHEN p_address_reference IS NOT NULL THEN NULLIF(p_address_reference, '') ELSE address_reference END,
    notes              = CASE WHEN p_notes          IS NOT NULL THEN NULLIF(p_notes, '') ELSE notes         END,
    updated_by         = auth.uid(),
    updated_at         = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Element % not found', p_id;
  END IF;

  RETURN QUERY
  SELECT *
  FROM infrastructure_elements_for_map()
  WHERE infrastructure_elements_for_map.id = p_id;
END;
$$;

-- ── update_fiber_route ────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.update_fiber_route(
  uuid, text, route_type, route_status, data_quality,
  jsonb, installation_type, fiber_type, int, numeric, text
);

CREATE FUNCTION public.update_fiber_route(
  p_id                 uuid,
  p_code               text               DEFAULT NULL,
  p_type               route_type         DEFAULT NULL,
  p_status             route_status       DEFAULT NULL,
  p_route_quality      data_quality       DEFAULT NULL,
  p_geojson_coordinates jsonb             DEFAULT NULL,
  p_installation_type  installation_type  DEFAULT NULL,
  p_fiber_type         fiber_type         DEFAULT NULL,
  p_fiber_count        int                DEFAULT NULL,
  p_length_meters      numeric            DEFAULT NULL,
  p_notes              text               DEFAULT NULL
)
RETURNS TABLE(
  id                   uuid,
  organization_id      uuid,
  code                 text,
  type                 route_type,
  status               route_status,
  from_element_id      uuid,
  to_element_id        uuid,
  from_element_type    element_type,
  to_element_type      element_type,
  geojson_coordinates  jsonb,
  route_quality        data_quality,
  installation_type    installation_type,
  fiber_type           fiber_type,
  fiber_count          int,
  length_meters        numeric,
  attenuation_db_per_km numeric,
  splice_loss_db       numeric,
  connector_loss_db    numeric,
  total_loss_db        numeric,
  properties           jsonb,
  notes                text,
  created_by           uuid,
  updated_by           uuid,
  created_at           timestamptz,
  updated_at           timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE fiber_routes SET
    code               = CASE WHEN p_code IS NOT NULL THEN NULLIF(p_code, '') ELSE code END,
    type               = COALESCE(p_type, type),
    status             = COALESCE(p_status, status),
    route_quality      = COALESCE(p_route_quality, route_quality),
    route              = CASE
                           WHEN p_geojson_coordinates IS NOT NULL
                           THEN ST_SetSRID(ST_GeomFromGeoJSON(p_geojson_coordinates::text), 4326)::geography
                           ELSE route
                         END,
    installation_type  = CASE WHEN p_installation_type IS NOT NULL THEN p_installation_type ELSE installation_type END,
    fiber_type         = CASE WHEN p_fiber_type  IS NOT NULL THEN p_fiber_type  ELSE fiber_type  END,
    fiber_count        = CASE WHEN p_fiber_count IS NOT NULL THEN p_fiber_count ELSE fiber_count END,
    length_meters      = CASE WHEN p_length_meters IS NOT NULL THEN p_length_meters ELSE length_meters END,
    notes              = CASE WHEN p_notes IS NOT NULL THEN NULLIF(p_notes, '') ELSE notes END,
    updated_by         = auth.uid(),
    updated_at         = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route % not found', p_id;
  END IF;

  RETURN QUERY
  SELECT *
  FROM fiber_routes_for_map()
  WHERE fiber_routes_for_map.id = p_id;
END;
$$;

DROP FUNCTION IF EXISTS public.update_fiber_route(
  uuid, text, route_type, route_status, data_quality,
  jsonb, installation_type, fiber_type, int, numeric, text
);

CREATE FUNCTION public.update_fiber_route(
  p_id                  uuid,
  p_code                text               DEFAULT NULL,
  p_type                route_type         DEFAULT NULL,
  p_status              route_status       DEFAULT NULL,
  p_route_quality       data_quality       DEFAULT NULL,
  p_geojson_coordinates jsonb              DEFAULT NULL,
  p_installation_type   installation_type  DEFAULT NULL,
  p_fiber_type          fiber_type         DEFAULT NULL,
  p_fiber_count         int                DEFAULT NULL,
  p_length_meters       numeric            DEFAULT NULL,
  p_notes               text               DEFAULT NULL
)
RETURNS TABLE(
  id                    uuid,
  organization_id       uuid,
  code                  text,
  type                  route_type,
  status                route_status,
  from_element_id       uuid,
  to_element_id         uuid,
  from_element_type     element_type,
  to_element_type       element_type,
  geojson_coordinates   jsonb,
  route_quality         data_quality,
  installation_type     installation_type,
  fiber_type            fiber_type,
  fiber_count           int,
  length_meters         numeric,
  attenuation_db_per_km numeric,
  splice_loss_db        numeric,
  connector_loss_db     numeric,
  total_loss_db         numeric,
  properties            jsonb,
  notes                 text,
  created_by            uuid,
  updated_by            uuid,
  created_at            timestamptz,
  updated_at            timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.fiber_routes AS fr SET
    code               = CASE WHEN p_code IS NOT NULL THEN NULLIF(p_code, '') ELSE fr.code END,
    type               = COALESCE(p_type, fr.type),
    status             = COALESCE(p_status, fr.status),
    route_quality      = COALESCE(p_route_quality, fr.route_quality),
    geometry           = CASE
                           WHEN p_geojson_coordinates IS NOT NULL
                           THEN ST_SetSRID(ST_GeomFromGeoJSON(p_geojson_coordinates::text), 4326)::geography
                           ELSE fr.geometry
                         END,
    installation_type  = CASE WHEN p_installation_type IS NOT NULL THEN p_installation_type ELSE fr.installation_type END,
    fiber_type         = CASE WHEN p_fiber_type IS NOT NULL THEN p_fiber_type ELSE fr.fiber_type END,
    fiber_count        = CASE WHEN p_fiber_count IS NOT NULL THEN p_fiber_count ELSE fr.fiber_count END,
    length_meters      = CASE WHEN p_length_meters IS NOT NULL THEN p_length_meters ELSE fr.length_meters END,
    notes              = CASE WHEN p_notes IS NOT NULL THEN NULLIF(p_notes, '') ELSE fr.notes END,
    updated_by         = auth.uid(),
    updated_at         = now()
  WHERE fr.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route % not found', p_id;
  END IF;

  RETURN QUERY
  SELECT route_row.*
  FROM public.fiber_routes_for_map() AS route_row
  WHERE route_row.id = p_id;
END;
$$;

-- Route point creation + element/route deletion RPCs for the MVP editor.
-- SECURITY INVOKER keeps RLS as the enforcement layer.

CREATE FUNCTION public.create_route_point_draft(
  p_fiber_route_id    uuid,
  p_type              route_point_type,
  p_lng               double precision,
  p_lat               double precision,
  p_code              text DEFAULT NULL,
  p_location_quality  data_quality DEFAULT 'approximate',
  p_crossing_type     crossing_type DEFAULT NULL,
  p_risk_level        risk_level DEFAULT NULL,
  p_reserve_length_m  numeric DEFAULT NULL,
  p_splice_loss_db    numeric DEFAULT NULL,
  p_reference_text    text DEFAULT NULL,
  p_notes             text DEFAULT NULL
)
RETURNS TABLE(
  id                   uuid,
  organization_id      uuid,
  fiber_route_id       uuid,
  type                 route_point_type,
  code                 text,
  status               text,
  lng                  double precision,
  lat                  double precision,
  location_quality     data_quality,
  position_on_route_m  numeric,
  reserve_length_m     numeric,
  splice_loss_db       numeric,
  crossing_type        crossing_type,
  risk_level           risk_level,
  reference_text       text,
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
DECLARE
  inserted_id uuid;
BEGIN
  INSERT INTO route_points (
    fiber_route_id,
    type,
    code,
    location,
    location_quality,
    crossing_type,
    risk_level,
    reserve_length_m,
    splice_loss_db,
    reference_text,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_fiber_route_id,
    p_type,
    NULLIF(p_code, ''),
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_location_quality,
    CASE WHEN p_type = 'crossing' THEN p_crossing_type ELSE NULL END,
    CASE WHEN p_type = 'crossing' THEN p_risk_level ELSE NULL END,
    CASE WHEN p_type = 'reserve' THEN p_reserve_length_m ELSE NULL END,
    CASE WHEN p_type = 'splice' THEN p_splice_loss_db ELSE NULL END,
    NULLIF(p_reference_text, ''),
    NULLIF(p_notes, ''),
    auth.uid(),
    auth.uid()
  )
  RETURNING route_points.id INTO inserted_id;

  RETURN QUERY
  SELECT *
  FROM route_points_for_map()
  WHERE route_points_for_map.id = inserted_id;
END;
$$;

CREATE FUNCTION public.delete_infrastructure_element(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM infrastructure_elements WHERE id = p_id;
END;
$$;

CREATE FUNCTION public.delete_fiber_route(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM fiber_routes WHERE id = p_id;
END;
$$;

CREATE FUNCTION public.delete_route_point(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM route_points WHERE id = p_id;
END;
$$;

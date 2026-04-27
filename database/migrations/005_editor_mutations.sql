-- Editor mutation RPCs for the Infrastructure Editor MVP.
-- SECURITY INVOKER keeps RLS as the enforcement layer.

DROP FUNCTION IF EXISTS public.create_infrastructure_element_draft(
  element_type,
  text,
  text,
  double precision,
  double precision,
  element_status,
  data_quality,
  pon_standard,
  int,
  split_ratio,
  numeric,
  int,
  text,
  text
);

CREATE FUNCTION public.create_infrastructure_element_draft(
  p_type               element_type,
  p_code               text,
  p_name               text,
  p_lng                double precision,
  p_lat                double precision,
  p_status             element_status DEFAULT 'planned',
  p_location_quality   data_quality DEFAULT 'approximate',
  p_pon_standard       pon_standard DEFAULT NULL,
  p_total_pon_ports    int DEFAULT NULL,
  p_split_ratio        split_ratio DEFAULT NULL,
  p_insertion_loss_db  numeric DEFAULT NULL,
  p_total_ports        int DEFAULT NULL,
  p_address_reference  text DEFAULT NULL,
  p_notes              text DEFAULT NULL
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
DECLARE
  inserted_id uuid;
BEGIN
  INSERT INTO infrastructure_elements (
    type,
    code,
    name,
    status,
    location,
    location_quality,
    pon_standard,
    total_pon_ports,
    split_ratio,
    insertion_loss_db,
    total_ports,
    address_reference,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_type,
    p_code,
    NULLIF(p_name, ''),
    p_status,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_location_quality,
    CASE WHEN p_type = 'olt' THEN p_pon_standard ELSE NULL END,
    CASE WHEN p_type = 'olt' THEN p_total_pon_ports ELSE NULL END,
    CASE WHEN p_type = 'splitter' THEN p_split_ratio ELSE NULL END,
    CASE WHEN p_type = 'splitter' THEN p_insertion_loss_db ELSE NULL END,
    CASE WHEN p_type IN ('splitter', 'nap') THEN p_total_ports ELSE NULL END,
    NULLIF(p_address_reference, ''),
    NULLIF(p_notes, ''),
    auth.uid(),
    auth.uid()
  )
  RETURNING infrastructure_elements.id INTO inserted_id;

  RETURN QUERY
  SELECT *
  FROM infrastructure_elements_for_map()
  WHERE infrastructure_elements_for_map.id = inserted_id;
END;
$$;

DROP FUNCTION IF EXISTS public.create_fiber_route_draft(
  text,
  route_type,
  route_status,
  uuid,
  uuid,
  jsonb,
  data_quality,
  installation_type,
  fiber_type,
  int,
  numeric,
  numeric,
  numeric,
  numeric,
  text
);

CREATE FUNCTION public.create_fiber_route_draft(
  p_code                   text,
  p_type                   route_type,
  p_status                 route_status,
  p_from_element_id        uuid,
  p_to_element_id          uuid,
  p_geojson_coordinates    jsonb,
  p_route_quality          data_quality DEFAULT 'approximate',
  p_installation_type      installation_type DEFAULT NULL,
  p_fiber_type             fiber_type DEFAULT NULL,
  p_fiber_count            int DEFAULT NULL,
  p_length_meters          numeric DEFAULT NULL,
  p_attenuation_db_per_km  numeric DEFAULT NULL,
  p_splice_loss_db         numeric DEFAULT NULL,
  p_connector_loss_db      numeric DEFAULT NULL,
  p_notes                  text DEFAULT NULL
)
RETURNS TABLE(
  id                       uuid,
  organization_id          uuid,
  code                     text,
  type                     route_type,
  status                   route_status,
  from_element_id          uuid,
  to_element_id            uuid,
  from_element_type        element_type,
  to_element_type          element_type,
  geojson_coordinates      jsonb,
  route_quality            data_quality,
  installation_type        installation_type,
  fiber_type               fiber_type,
  fiber_count              int,
  length_meters            numeric,
  attenuation_db_per_km    numeric,
  splice_loss_db           numeric,
  connector_loss_db        numeric,
  total_loss_db            numeric,
  properties               jsonb,
  notes                    text,
  created_by               uuid,
  updated_by               uuid,
  created_at               timestamptz,
  updated_at               timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  inserted_id uuid;
  route_geometry geometry(LineString, 4326);
BEGIN
  SELECT ST_SetSRID(ST_MakeLine(point_geom ORDER BY ordinality), 4326)
  INTO route_geometry
  FROM (
    SELECT
      ordinality,
      ST_MakePoint(
        (coord ->> 0)::double precision,
        (coord ->> 1)::double precision
      ) AS point_geom
    FROM jsonb_array_elements(p_geojson_coordinates) WITH ORDINALITY AS coords(coord, ordinality)
  ) ordered_points;

  IF route_geometry IS NULL OR ST_NPoints(route_geometry) < 2 THEN
    RAISE EXCEPTION 'A fiber route requires at least two coordinates';
  END IF;

  INSERT INTO fiber_routes (
    code,
    type,
    status,
    from_element_id,
    to_element_id,
    geometry,
    route_quality,
    installation_type,
    fiber_type,
    fiber_count,
    length_meters,
    attenuation_db_per_km,
    splice_loss_db,
    connector_loss_db,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    NULLIF(p_code, ''),
    p_type,
    p_status,
    p_from_element_id,
    p_to_element_id,
    route_geometry::geography,
    p_route_quality,
    p_installation_type,
    p_fiber_type,
    p_fiber_count,
    p_length_meters,
    p_attenuation_db_per_km,
    p_splice_loss_db,
    p_connector_loss_db,
    NULLIF(p_notes, ''),
    auth.uid(),
    auth.uid()
  )
  RETURNING fiber_routes.id INTO inserted_id;

  RETURN QUERY
  SELECT *
  FROM fiber_routes_for_map()
  WHERE fiber_routes_for_map.id = inserted_id;
END;
$$;

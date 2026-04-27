-- Map RPCs for the Infrastructure Editor MVP.
-- These functions flatten PostGIS geography into lng/lat and GeoJSON coordinate
-- arrays expected by the Next.js Mapbox client.

DROP FUNCTION IF EXISTS public.infrastructure_elements_for_map();

CREATE FUNCTION public.infrastructure_elements_for_map()
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
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    ie.id,
    NULL::uuid AS organization_id,
    ie.type,
    ie.code,
    ie.name,
    ie.status,
    ST_X(ie.location::geometry) AS lng,
    ST_Y(ie.location::geometry) AS lat,
    ie.location_quality,
    ie.address_reference,
    ie.pon_standard,
    ie.total_pon_ports,
    ie.split_ratio,
    ie.insertion_loss_db,
    ie.total_ports,
    ie.properties,
    ie.notes,
    ie.created_by,
    ie.updated_by,
    ie.created_at,
    ie.updated_at
  FROM infrastructure_elements ie
  ORDER BY ie.type, ie.code;
$$;

DROP FUNCTION IF EXISTS public.fiber_routes_for_map();

CREATE FUNCTION public.fiber_routes_for_map()
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
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    fr.id,
    NULL::uuid AS organization_id,
    fr.code,
    fr.type,
    fr.status,
    fr.from_element_id,
    fr.to_element_id,
    from_ie.type AS from_element_type,
    to_ie.type   AS to_element_type,
    (ST_AsGeoJSON(fr.geometry::geometry)::jsonb) -> 'coordinates'
      AS geojson_coordinates,
    fr.route_quality,
    fr.installation_type,
    fr.fiber_type,
    fr.fiber_count,
    fr.length_meters,
    fr.attenuation_db_per_km,
    fr.splice_loss_db,
    fr.connector_loss_db,
    fr.total_loss_db,
    fr.properties,
    fr.notes,
    fr.created_by,
    fr.updated_by,
    fr.created_at,
    fr.updated_at
  FROM fiber_routes fr
  LEFT JOIN infrastructure_elements from_ie ON from_ie.id = fr.from_element_id
  LEFT JOIN infrastructure_elements to_ie   ON to_ie.id   = fr.to_element_id
  ORDER BY fr.type, fr.code NULLS LAST, fr.created_at;
$$;

DROP FUNCTION IF EXISTS public.route_points_for_map();

CREATE FUNCTION public.route_points_for_map()
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
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    rp.id,
    NULL::uuid AS organization_id,
    rp.fiber_route_id,
    rp.type,
    rp.code,
    rp.status,
    ST_X(rp.location::geometry) AS lng,
    ST_Y(rp.location::geometry) AS lat,
    rp.location_quality,
    rp.position_on_route_m,
    rp.reserve_length_m,
    rp.splice_loss_db,
    rp.crossing_type,
    rp.risk_level,
    rp.reference_text,
    rp.properties,
    rp.notes,
    rp.created_by,
    rp.updated_by,
    rp.created_at,
    rp.updated_at
  FROM route_points rp
  ORDER BY rp.type, rp.code NULLS LAST, rp.created_at;
$$;

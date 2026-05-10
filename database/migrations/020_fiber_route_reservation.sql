-- Reserva física de fibra a nivel de tramo.
-- Representa el slack distribuido (bucles, holgura) que se tiende encima de la
-- longitud GIS para absorber roturas y reparaciones en clima tropical.
--
-- Importante: contribuye al presupuesto óptico porque la luz recorre ese cable
-- adicional. Reemplaza el factor hardcoded de 1.02 que existía en el cálculo.
--
-- Conceptos relacionados:
--   - fiber_routes.reservation_m       → total planificado para el tramo (este).
--   - route_points.reserve_length_m    → bucle físico documentado en un punto GPS.

-- ─── 1. Columna nueva ────────────────────────────────────────────────────────

ALTER TABLE public.fiber_routes
  ADD COLUMN IF NOT EXISTS reservation_m numeric(8,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.fiber_routes.reservation_m IS
  'Metros de cable de reserva tendidos sobre la longitud GIS (bucles físicos). Suma al presupuesto óptico.';

-- Backfill: aplica el 2% histórico a rutas existentes para preservar el cálculo
-- óptico previo (antes existía como factor hardcoded en código).
UPDATE public.fiber_routes
SET reservation_m = ROUND((length_meters * 0.02)::numeric, 2)
WHERE length_meters IS NOT NULL
  AND reservation_m = 0;

-- ─── 2. fiber_routes_for_map() — exponer reservation_m ───────────────────────

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
  reservation_m            numeric,
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
    ROUND(ST_Length(fr.geometry)::numeric, 2) AS length_meters,
    fr.reservation_m,
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
  FROM public.fiber_routes fr
  LEFT JOIN public.infrastructure_elements from_ie ON from_ie.id = fr.from_element_id
  LEFT JOIN public.infrastructure_elements to_ie   ON to_ie.id   = fr.to_element_id
  ORDER BY fr.type, fr.code NULLS LAST, fr.created_at;
$$;

-- ─── 3. create_fiber_route_draft — aceptar p_reservation_m ───────────────────

DROP FUNCTION IF EXISTS public.create_fiber_route_draft(
  text, route_type, route_status, uuid, uuid, jsonb,
  data_quality, installation_type, fiber_type, int,
  numeric, numeric, numeric, numeric, text
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
  p_notes                  text DEFAULT NULL,
  p_reservation_m          numeric DEFAULT 0
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
  reservation_m            numeric,
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
    reservation_m,
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
    COALESCE(p_reservation_m, 0),
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

-- ─── 4. update_fiber_route — aceptar p_reservation_m ─────────────────────────

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
  p_notes               text               DEFAULT NULL,
  p_reservation_m       numeric            DEFAULT NULL
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
  reservation_m         numeric,
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
DECLARE
  next_geometry geography(LineString, 4326);
BEGIN
  IF p_geojson_coordinates IS NOT NULL THEN
    next_geometry := ST_SetSRID(ST_GeomFromGeoJSON(p_geojson_coordinates::text), 4326)::geography;
  END IF;

  UPDATE public.fiber_routes AS fr SET
    code               = CASE WHEN p_code IS NOT NULL THEN NULLIF(p_code, '') ELSE fr.code END,
    type               = COALESCE(p_type, fr.type),
    status             = COALESCE(p_status, fr.status),
    route_quality      = COALESCE(p_route_quality, fr.route_quality),
    geometry           = COALESCE(next_geometry, fr.geometry),
    installation_type  = CASE WHEN p_installation_type IS NOT NULL THEN p_installation_type ELSE fr.installation_type END,
    fiber_type         = CASE WHEN p_fiber_type IS NOT NULL THEN p_fiber_type ELSE fr.fiber_type END,
    fiber_count        = CASE WHEN p_fiber_count IS NOT NULL THEN p_fiber_count ELSE fr.fiber_count END,
    length_meters      = CASE
                           WHEN next_geometry IS NOT NULL THEN ROUND(ST_Length(next_geometry)::numeric, 2)
                           WHEN p_length_meters IS NOT NULL THEN p_length_meters
                           ELSE fr.length_meters
                         END,
    reservation_m      = COALESCE(p_reservation_m, fr.reservation_m),
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

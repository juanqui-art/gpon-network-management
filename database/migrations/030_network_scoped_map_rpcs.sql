-- ⚠️ APPROXIMATE — part of the reconstructed baseline (see 009b_networks_baseline.sql).
--
-- 1. fiber_routes_for_map(p_network_id) and route_points_for_map(p_network_id)
--    are called by apps/web/lib/queries/network-editor.ts but were never
--    versioned (022 only versions the element variant). Reconstructed with the
--    same shape as the no-argument versions (020 and 004), filtered by network.
--    Route points have no network_id: they inherit it from their route.
--    Created only if missing, so production definitions are never overwritten.
--
-- 2. Assigns the Cuenca seed (014, runs after 009b) to its network
--    10000000-…-0002, the id that 023 already uses. Touches only rows with
--    NULL network_id and a '-CUE-' code; on production that should be zero rows.
--
-- If the no-argument versions change shape, update these too.

-- ─── 1. Network-scoped map RPCs ──────────────────────────────────────────────
DO $rpcs$
BEGIN
  IF to_regprocedure('public.fiber_routes_for_map(uuid)') IS NULL THEN
    CREATE FUNCTION public.fiber_routes_for_map(p_network_id uuid)
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
    AS $fn$
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
      WHERE fr.network_id = p_network_id
      ORDER BY fr.type, fr.code NULLS LAST, fr.created_at;
    $fn$;
  END IF;

  IF to_regprocedure('public.route_points_for_map(uuid)') IS NULL THEN
    CREATE FUNCTION public.route_points_for_map(p_network_id uuid)
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
    AS $fn$
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
      FROM public.route_points rp
      JOIN public.fiber_routes fr ON fr.id = rp.fiber_route_id
      WHERE fr.network_id = p_network_id
      ORDER BY rp.type, rp.code NULLS LAST, rp.created_at;
    $fn$;
  END IF;
END;
$rpcs$;

-- ─── 2. Cuenca seed → its network ────────────────────────────────────────────
UPDATE public.infrastructure_elements
SET network_id = '10000000-0000-0000-0000-000000000002'
WHERE network_id IS NULL
  AND code LIKE '%-CUE-%'
  AND EXISTS (SELECT 1 FROM public.networks WHERE id = '10000000-0000-0000-0000-000000000002');

UPDATE public.fiber_routes
SET network_id = '10000000-0000-0000-0000-000000000002'
WHERE network_id IS NULL
  AND code LIKE '%-CUE-%'
  AND EXISTS (SELECT 1 FROM public.networks WHERE id = '10000000-0000-0000-0000-000000000002');

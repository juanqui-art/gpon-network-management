-- Capture persistence for physical closures (mufas) and mufa route points.
-- This keeps splitters as legacy standalone elements while allowing the field
-- capture flow to model splitters inside closures/NAPs.

ALTER TABLE public.infrastructure_elements
  DROP CONSTRAINT IF EXISTS splitter_fields_only_for_splitter_or_nap;

ALTER TABLE public.infrastructure_elements
  DROP CONSTRAINT IF EXISTS splitter_fields_only_for_splitter_nap_or_closure;

ALTER TABLE public.infrastructure_elements
  ADD CONSTRAINT splitter_fields_only_for_splitter_nap_or_closure CHECK (
    type IN ('splitter', 'nap', 'closure')
    OR (split_ratio IS NULL AND insertion_loss_db IS NULL)
  );

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
  text,
  text,
  jsonb
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
  p_notes              text DEFAULT NULL,
  p_optical_class      text DEFAULT NULL,
  p_properties         jsonb DEFAULT '{}'::jsonb
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
  optical_class      text,
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
  INSERT INTO public.infrastructure_elements (
    type,
    code,
    name,
    status,
    location,
    location_quality,
    pon_standard,
    total_pon_ports,
    optical_class,
    split_ratio,
    insertion_loss_db,
    total_ports,
    properties,
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
    CASE WHEN p_type = 'olt' THEN NULLIF(p_optical_class, '') ELSE NULL END,
    CASE
      WHEN p_type = 'nap' AND COALESCE(p_properties->>'nap_mode', 'with_splitter') <> 'with_splitter' THEN NULL
      WHEN p_type = 'closure' AND COALESCE((p_properties->>'has_splitter')::boolean, false) = false THEN NULL
      WHEN p_type IN ('splitter', 'nap', 'closure') THEN p_split_ratio
      ELSE NULL
    END,
    CASE
      WHEN p_type = 'nap' AND COALESCE(p_properties->>'nap_mode', 'with_splitter') <> 'with_splitter' THEN NULL
      WHEN p_type = 'closure' AND COALESCE((p_properties->>'has_splitter')::boolean, false) = false THEN NULL
      WHEN p_type IN ('splitter', 'nap', 'closure') THEN p_insertion_loss_db
      ELSE NULL
    END,
    CASE WHEN p_type IN ('splitter', 'nap', 'closure') THEN p_total_ports ELSE NULL END,
    COALESCE(p_properties, '{}'::jsonb),
    NULLIF(p_address_reference, ''),
    NULLIF(p_notes, ''),
    auth.uid(),
    auth.uid()
  )
  RETURNING infrastructure_elements.id INTO inserted_id;

  RETURN QUERY
  SELECT map_row.*
  FROM public.infrastructure_elements_for_map() AS map_row
  WHERE map_row.id = inserted_id;
END;
$$;

DROP FUNCTION IF EXISTS public.create_route_point_draft(
  uuid,
  route_point_type,
  double precision,
  double precision,
  text,
  data_quality,
  crossing_type,
  risk_level,
  numeric,
  numeric,
  text,
  text
);

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
  p_notes             text DEFAULT NULL,
  p_status            text DEFAULT NULL,
  p_properties        jsonb DEFAULT '{}'::jsonb
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
  INSERT INTO public.route_points (
    fiber_route_id,
    type,
    code,
    status,
    location,
    location_quality,
    crossing_type,
    risk_level,
    reserve_length_m,
    splice_loss_db,
    reference_text,
    properties,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_fiber_route_id,
    p_type,
    NULLIF(p_code, ''),
    NULLIF(p_status, ''),
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_location_quality,
    CASE WHEN p_type = 'crossing' THEN p_crossing_type ELSE NULL END,
    CASE WHEN p_type = 'crossing' THEN p_risk_level ELSE NULL END,
    CASE WHEN p_type = 'reserve' THEN p_reserve_length_m ELSE NULL END,
    CASE WHEN p_type = 'splice' THEN p_splice_loss_db ELSE NULL END,
    NULLIF(p_reference_text, ''),
    COALESCE(p_properties, '{}'::jsonb),
    NULLIF(p_notes, ''),
    auth.uid(),
    auth.uid()
  )
  RETURNING route_points.id INTO inserted_id;

  RETURN QUERY
  SELECT point_row.*
  FROM public.route_points_for_map() AS point_row
  WHERE point_row.id = inserted_id;
END;
$$;

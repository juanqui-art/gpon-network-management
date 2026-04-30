-- Persist equipment-specific properties used by the map editor.
-- NAP physical configuration lives in properties:
--   nap_mode: terminal | with_splitter | prepared
--   connector_type: SC/APC | SC/UPC | Mini SC/APC
--   protection_rating: IP65 | IP68

ALTER TABLE public.infrastructure_elements
  ADD COLUMN IF NOT EXISTS optical_class text;

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
  optical_class      text,
  properties         jsonb,
  notes              text,
  created_by         uuid,
  updated_by         uuid,
  created_at         timestamptz,
  updated_at         timestamptz
)
LANGUAGE sql
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
    ie.optical_class,
    ie.properties,
    ie.notes,
    ie.created_by,
    ie.updated_by,
    ie.created_at,
    ie.updated_at
  FROM infrastructure_elements ie;
$$;

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
  INSERT INTO infrastructure_elements (
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
      WHEN p_type IN ('splitter', 'nap') THEN p_split_ratio
      ELSE NULL
    END,
    CASE
      WHEN p_type = 'nap' AND COALESCE(p_properties->>'nap_mode', 'with_splitter') <> 'with_splitter' THEN NULL
      WHEN p_type IN ('splitter', 'nap') THEN p_insertion_loss_db
      ELSE NULL
    END,
    CASE WHEN p_type IN ('splitter', 'nap') THEN p_total_ports ELSE NULL END,
    COALESCE(p_properties, '{}'::jsonb),
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

DROP FUNCTION IF EXISTS public.update_infrastructure_element(
  uuid, text, text, element_status, data_quality,
  double precision, double precision,
  pon_standard, int, split_ratio, numeric, int, text, text
);

DROP FUNCTION IF EXISTS public.update_infrastructure_element(
  uuid, text, text, element_status, data_quality,
  double precision, double precision,
  pon_standard, int, split_ratio, numeric, int, text, text, text
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
  p_notes              text               DEFAULT NULL,
  p_optical_class      text               DEFAULT NULL,
  p_properties         jsonb              DEFAULT NULL
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
    optical_class      = CASE WHEN p_optical_class IS NOT NULL THEN NULLIF(p_optical_class, '') ELSE optical_class END,
    split_ratio        = CASE
                           WHEN type = 'nap' AND p_properties->>'nap_mode' IN ('terminal', 'prepared') THEN NULL
                           WHEN p_split_ratio IS NOT NULL THEN p_split_ratio
                           ELSE split_ratio
                         END,
    insertion_loss_db  = CASE
                           WHEN type = 'nap' AND p_properties->>'nap_mode' IN ('terminal', 'prepared') THEN NULL
                           WHEN p_insertion_loss_db IS NOT NULL THEN p_insertion_loss_db
                           ELSE insertion_loss_db
                         END,
    total_ports        = CASE WHEN p_total_ports    IS NOT NULL THEN p_total_ports    ELSE total_ports       END,
    properties         = CASE WHEN p_properties IS NOT NULL THEN p_properties ELSE properties END,
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

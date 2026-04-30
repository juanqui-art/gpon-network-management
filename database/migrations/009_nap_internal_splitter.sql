-- Model field NAPs that include an internal PLC splitter.
-- NAPs can keep total_ports as before, and may now carry split_ratio plus
-- insertion_loss_db when the enclosure contains the customer splitter.

ALTER TABLE public.infrastructure_elements
  DROP CONSTRAINT IF EXISTS splitter_columns_only_for_splitter;

ALTER TABLE public.infrastructure_elements
  ADD CONSTRAINT splitter_fields_only_for_splitter_or_nap CHECK (
    type IN ('splitter', 'nap')
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
    CASE WHEN p_type IN ('splitter', 'nap') THEN p_split_ratio ELSE NULL END,
    CASE WHEN p_type IN ('splitter', 'nap') THEN p_insertion_loss_db ELSE NULL END,
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

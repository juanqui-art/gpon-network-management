DROP FUNCTION IF EXISTS public.update_infrastructure_element(
  uuid, text, text, element_status, data_quality,
  double precision, double precision,
  pon_standard, int, split_ratio, numeric, int, text, text, jsonb, text
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
  UPDATE public.infrastructure_elements AS ie SET
    code               = COALESCE(p_code, ie.code),
    name               = CASE WHEN p_name IS NOT NULL THEN NULLIF(p_name, '') ELSE ie.name END,
    status             = COALESCE(p_status, ie.status),
    location_quality   = COALESCE(p_location_quality, ie.location_quality),
    location           = CASE
                           WHEN p_lng IS NOT NULL AND p_lat IS NOT NULL
                           THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
                           ELSE ie.location
                         END,
    pon_standard       = CASE WHEN p_pon_standard IS NOT NULL THEN p_pon_standard ELSE ie.pon_standard END,
    total_pon_ports    = CASE WHEN p_total_pon_ports IS NOT NULL THEN p_total_pon_ports ELSE ie.total_pon_ports END,
    optical_class      = CASE WHEN p_optical_class IS NOT NULL THEN NULLIF(p_optical_class, '') ELSE ie.optical_class END,
    split_ratio        = CASE
                           WHEN ie.type = 'nap' AND COALESCE(p_properties, ie.properties)->>'nap_mode' IN ('terminal', 'prepared') THEN NULL
                           WHEN p_split_ratio IS NOT NULL THEN p_split_ratio
                           ELSE ie.split_ratio
                         END,
    insertion_loss_db  = CASE
                           WHEN ie.type = 'nap' AND COALESCE(p_properties, ie.properties)->>'nap_mode' IN ('terminal', 'prepared') THEN NULL
                           WHEN p_insertion_loss_db IS NOT NULL THEN p_insertion_loss_db
                           ELSE ie.insertion_loss_db
                         END,
    total_ports        = CASE WHEN p_total_ports IS NOT NULL THEN p_total_ports ELSE ie.total_ports END,
    properties         = CASE WHEN p_properties IS NOT NULL THEN p_properties ELSE ie.properties END,
    address_reference  = CASE WHEN p_address_reference IS NOT NULL THEN NULLIF(p_address_reference, '') ELSE ie.address_reference END,
    notes              = CASE WHEN p_notes IS NOT NULL THEN NULLIF(p_notes, '') ELSE ie.notes END,
    updated_by         = auth.uid(),
    updated_at         = now()
  WHERE ie.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Element % not found', p_id;
  END IF;

  RETURN QUERY
  SELECT map_row.*
  FROM public.infrastructure_elements_for_map() AS map_row
  WHERE map_row.id = p_id;
END;
$$;

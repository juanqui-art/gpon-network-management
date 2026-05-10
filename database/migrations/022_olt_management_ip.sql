-- Adds management_ip to infrastructure_elements for SNMP/CLI access.
-- Habilita el JOIN ont_current_state.olt_host → infrastructure_elements
-- usado por la sección /monitoring para mostrar el nombre del equipo
-- en lugar de solo la IP cruda.

ALTER TABLE infrastructure_elements
  ADD COLUMN IF NOT EXISTS management_ip text;

COMMENT ON COLUMN infrastructure_elements.management_ip IS
  'Dirección de gestión SNMP/CLI del equipo (típicamente IPv4). Solo aplica a OLTs en MVP. '
  'Se enlaza con ont_current_state.olt_host para mostrar el nombre del equipo en /monitoring.';

-- Index parcial — solo indexa filas con valor (mayoría de elementos no son OLT)
CREATE INDEX IF NOT EXISTS idx_infrastructure_elements_management_ip
  ON infrastructure_elements (management_ip)
  WHERE management_ip IS NOT NULL;

-- ─── infrastructure_elements_for_map() — sin args, preserva shape existente ──
-- Postgres no permite cambiar el shape con CREATE OR REPLACE; hay que dropear primero.
DROP FUNCTION IF EXISTS public.infrastructure_elements_for_map();
DROP FUNCTION IF EXISTS public.infrastructure_elements_for_map(uuid);

CREATE FUNCTION public.infrastructure_elements_for_map()
RETURNS TABLE(
  id                  uuid,
  organization_id     uuid,
  type                element_type,
  code                text,
  name                text,
  status              element_status,
  lng                 double precision,
  lat                 double precision,
  location_quality    data_quality,
  address_reference   text,
  pon_standard        pon_standard,
  total_pon_ports     integer,
  split_ratio         split_ratio,
  insertion_loss_db   numeric,
  total_ports         integer,
  optical_class       text,
  management_ip       text,
  properties          jsonb,
  notes               text,
  created_by          uuid,
  updated_by          uuid,
  created_at          timestamptz,
  updated_at          timestamptz
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
    ie.management_ip,
    ie.properties,
    ie.notes,
    ie.created_by,
    ie.updated_by,
    ie.created_at,
    ie.updated_at
  FROM infrastructure_elements ie;
$$;

-- ─── infrastructure_elements_for_map(p_network_id) — preserva shape ──────────

CREATE FUNCTION public.infrastructure_elements_for_map(p_network_id uuid)
RETURNS TABLE(
  id                 uuid,
  type               element_type,
  code               text,
  name               text,
  status             element_status,
  lng                double precision,
  lat                double precision,
  location_quality   data_quality,
  address_reference  text,
  pon_standard       pon_standard,
  total_pon_ports    integer,
  split_ratio        split_ratio,
  insertion_loss_db  numeric,
  total_ports        integer,
  optical_class      text,
  management_ip      text,
  notes              text,
  network_id         uuid,
  created_at         timestamptz,
  updated_at         timestamptz
)
LANGUAGE sql
AS $$
  SELECT
    e.id, e.type, e.code, e.name, e.status,
    ST_X(e.location::geometry), ST_Y(e.location::geometry),
    e.location_quality, e.address_reference,
    e.pon_standard, e.total_pon_ports, e.split_ratio,
    e.insertion_loss_db, e.total_ports, e.optical_class,
    e.management_ip,
    e.notes, e.network_id, e.created_at, e.updated_at
  FROM infrastructure_elements e
  WHERE e.network_id = p_network_id;
$$;

-- ─── update_infrastructure_element — añade p_management_ip ───────────────────
-- Preserva el resto: p_optical_class, p_properties, lógica NAP, etc.

DROP FUNCTION IF EXISTS public.update_infrastructure_element(
  uuid, text, text, element_status, data_quality,
  double precision, double precision,
  pon_standard, integer, split_ratio, numeric, integer,
  text, text, text, jsonb
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
  p_total_pon_ports    integer            DEFAULT NULL,
  p_split_ratio        split_ratio        DEFAULT NULL,
  p_insertion_loss_db  numeric            DEFAULT NULL,
  p_total_ports        integer            DEFAULT NULL,
  p_address_reference  text               DEFAULT NULL,
  p_notes              text               DEFAULT NULL,
  p_optical_class      text               DEFAULT NULL,
  p_properties         jsonb              DEFAULT NULL,
  p_management_ip      text               DEFAULT NULL
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
  total_pon_ports    integer,
  split_ratio        split_ratio,
  insertion_loss_db  numeric,
  total_ports        integer,
  optical_class      text,
  management_ip      text,
  properties         jsonb,
  notes              text,
  created_by         uuid,
  updated_by         uuid,
  created_at         timestamptz,
  updated_at         timestamptz
)
LANGUAGE plpgsql
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
    management_ip      = CASE WHEN p_management_ip IS NOT NULL THEN NULLIF(p_management_ip, '') ELSE ie.management_ip END,
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

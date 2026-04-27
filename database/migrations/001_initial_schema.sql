-- GPON Network Management System — Initial Schema (MVP)
-- Decisions:
--   ADR 0001: single-tenant (no organizations)
--   ADR 0002: no equipment_ports table; counters on element columns
--   ADR 0003: only infrastructure tables in MVP (operational tables in Fase 4)
-- Source of truth: docs/MVP_SCOPE.md, docs/OPERATIONAL_ROLES.md

CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── ENUMs ────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'admin', 'network_engineer', 'outside_plant', 'installer', 'support'
);

CREATE TYPE element_type AS ENUM ('olt', 'splitter', 'nap');

CREATE TYPE element_status AS ENUM (
  'planned', 'active', 'inactive', 'faulty', 'retired'
);

CREATE TYPE data_quality AS ENUM (
  'unknown', 'approximate', 'drawn', 'gps_captured', 'verified'
);

CREATE TYPE pon_standard AS ENUM ('gpon', 'xgs_pon', 'xg_pon', 'epon');

CREATE TYPE split_ratio AS ENUM ('1:2', '1:4', '1:8', '1:16', '1:32', '1:64');

CREATE TYPE route_type AS ENUM ('feeder', 'distribution', 'other');

CREATE TYPE route_status AS ENUM (
  'planned', 'installed', 'active', 'damaged', 'retired'
);

CREATE TYPE installation_type AS ENUM (
  'aerial', 'underground', 'duct', 'facade'
);

CREATE TYPE fiber_type AS ENUM ('g652d', 'g657a1', 'g657a2');

CREATE TYPE route_point_type AS ENUM ('crossing', 'reserve', 'splice');

CREATE TYPE crossing_type AS ENUM (
  'avenue', 'river', 'railway', 'highway', 'other'
);

CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');

-- ─── TRIGGER FUNCTION: updated_at ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── INFRASTRUCTURE ELEMENTS (OLT / Splitter / NAP) ───────────────────────────

CREATE TABLE infrastructure_elements (
  id                 uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  type               element_type           NOT NULL,
  code               text                   NOT NULL UNIQUE,
  name               text,
  status             element_status         NOT NULL DEFAULT 'planned',

  -- spatial
  location           geography(Point, 4326) NOT NULL,
  location_quality   data_quality           NOT NULL DEFAULT 'unknown',
  address_reference  text,

  -- type-specific (nullable; CHECK ensures only the right ones are filled)
  pon_standard       pon_standard,                 -- olt only
  total_pon_ports    int,                          -- olt only
  split_ratio        split_ratio,                  -- splitter only
  insertion_loss_db  numeric(5,2),                 -- splitter only
  total_ports        int,                          -- splitter and nap

  -- meta
  properties         jsonb                  NOT NULL DEFAULT '{}'::jsonb,
  notes              text,
  created_by         uuid,
  updated_by         uuid,
  created_at         timestamptz            NOT NULL DEFAULT now(),
  updated_at         timestamptz            NOT NULL DEFAULT now(),

  CONSTRAINT olt_columns_only_for_olt CHECK (
    type = 'olt'
    OR (pon_standard IS NULL AND total_pon_ports IS NULL)
  ),
  CONSTRAINT splitter_columns_only_for_splitter CHECK (
    type = 'splitter'
    OR (split_ratio IS NULL AND insertion_loss_db IS NULL)
  ),
  CONSTRAINT total_ports_not_for_olt CHECK (
    type <> 'olt' OR total_ports IS NULL
  )
);

CREATE INDEX infra_location_gix ON infrastructure_elements USING GIST (location);
CREATE INDEX infra_type_idx     ON infrastructure_elements (type);
CREATE INDEX infra_status_idx   ON infrastructure_elements (status);

CREATE TRIGGER trg_infra_updated_at
  BEFORE UPDATE ON infrastructure_elements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── FIBER ROUTES (feeder / distribution / other) ─────────────────────────────

CREATE TABLE fiber_routes (
  id                     uuid                            PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   text                            UNIQUE,
  type                   route_type                      NOT NULL DEFAULT 'distribution',
  status                 route_status                    NOT NULL DEFAULT 'planned',

  -- connectivity (nullable to allow approximate / incomplete drafts)
  from_element_id        uuid                            REFERENCES infrastructure_elements(id) ON DELETE SET NULL,
  to_element_id          uuid                            REFERENCES infrastructure_elements(id) ON DELETE SET NULL,

  -- spatial
  geometry               geography(LineString, 4326)     NOT NULL,
  route_quality          data_quality                    NOT NULL DEFAULT 'unknown',

  -- physical
  installation_type      installation_type,
  fiber_type             fiber_type,
  fiber_count            int,
  length_meters          numeric(10,2),

  -- optical budget inputs
  attenuation_db_per_km  numeric(5,3),
  splice_loss_db         numeric(5,2),
  connector_loss_db      numeric(5,2),
  total_loss_db          numeric(6,2),

  -- meta
  properties             jsonb                           NOT NULL DEFAULT '{}'::jsonb,
  notes                  text,
  created_by             uuid,
  updated_by             uuid,
  created_at             timestamptz                     NOT NULL DEFAULT now(),
  updated_at             timestamptz                     NOT NULL DEFAULT now(),

  CONSTRAINT no_self_loop CHECK (
    from_element_id IS NULL
    OR to_element_id IS NULL
    OR from_element_id <> to_element_id
  )
);

CREATE INDEX fiber_geometry_gix ON fiber_routes USING GIST (geometry);
CREATE INDEX fiber_type_idx     ON fiber_routes (type);
CREATE INDEX fiber_status_idx   ON fiber_routes (status);
CREATE INDEX fiber_from_idx     ON fiber_routes (from_element_id);
CREATE INDEX fiber_to_idx       ON fiber_routes (to_element_id);

CREATE TRIGGER trg_fiber_updated_at
  BEFORE UPDATE ON fiber_routes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── ROUTE POINTS (crossing / reserve / splice) ───────────────────────────────

CREATE TABLE route_points (
  id                   uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  fiber_route_id       uuid                   NOT NULL REFERENCES fiber_routes(id) ON DELETE CASCADE,
  type                 route_point_type       NOT NULL,
  code                 text,
  status               text,

  -- spatial
  location             geography(Point, 4326) NOT NULL,
  location_quality     data_quality           NOT NULL DEFAULT 'unknown',
  position_on_route_m  numeric(10,2),

  -- type-specific (nullable; per-type interpretation enforced by app)
  reserve_length_m     numeric(8,2),                       -- reserve only
  splice_loss_db       numeric(5,2),                       -- splice only
  crossing_type        crossing_type,                      -- crossing only
  risk_level           risk_level,                         -- crossing only
  reference_text       text,                               -- crossing only

  -- meta
  properties           jsonb                  NOT NULL DEFAULT '{}'::jsonb,
  notes                text,
  created_by           uuid,
  updated_by           uuid,
  created_at           timestamptz            NOT NULL DEFAULT now(),
  updated_at           timestamptz            NOT NULL DEFAULT now(),

  CONSTRAINT crossing_columns_only_for_crossing CHECK (
    type = 'crossing' OR (crossing_type IS NULL AND risk_level IS NULL)
  ),
  CONSTRAINT reserve_length_only_for_reserve CHECK (
    type = 'reserve' OR reserve_length_m IS NULL
  ),
  CONSTRAINT splice_loss_only_for_splice CHECK (
    type = 'splice' OR splice_loss_db IS NULL
  )
);

CREATE INDEX rp_location_gix    ON route_points USING GIST (location);
CREATE INDEX rp_fiber_route_idx ON route_points (fiber_route_id);
CREATE INDEX rp_type_idx        ON route_points (type);

CREATE TRIGGER trg_rp_updated_at
  BEFORE UPDATE ON route_points
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

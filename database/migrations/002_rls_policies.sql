-- Row Level Security (MVP)
-- Roles in auth.users.raw_user_meta_data.role:
--   admin, network_engineer, outside_plant, installer, support
-- Policy matrix:
--   read       — any authenticated
--   insert     — admin, network_engineer, outside_plant
--   update     — admin, network_engineer, outside_plant
--   delete     — admin only

-- ─── HELPER: get_user_role() ──────────────────────────────────────────────────
-- Default 'support' (most restricted) when role missing in JWT, fail safe.

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', 'support')
$$;

-- ─── ENABLE RLS ───────────────────────────────────────────────────────────────

ALTER TABLE infrastructure_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiber_routes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_points            ENABLE ROW LEVEL SECURITY;

-- ─── INFRASTRUCTURE ELEMENTS ─────────────────────────────────────────────────

CREATE POLICY "read infra"
  ON infrastructure_elements FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "field write infra"
  ON infrastructure_elements FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'));

CREATE POLICY "field update infra"
  ON infrastructure_elements FOR UPDATE
  USING (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'))
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'));

CREATE POLICY "admin delete infra"
  ON infrastructure_elements FOR DELETE
  USING (get_user_role() = 'admin');

-- ─── FIBER ROUTES ────────────────────────────────────────────────────────────

CREATE POLICY "read fiber"
  ON fiber_routes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "field write fiber"
  ON fiber_routes FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'));

CREATE POLICY "field update fiber"
  ON fiber_routes FOR UPDATE
  USING (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'))
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'));

CREATE POLICY "admin delete fiber"
  ON fiber_routes FOR DELETE
  USING (get_user_role() = 'admin');

-- ─── ROUTE POINTS ────────────────────────────────────────────────────────────

CREATE POLICY "read route_points"
  ON route_points FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "field write route_points"
  ON route_points FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'));

CREATE POLICY "field update route_points"
  ON route_points FOR UPDATE
  USING (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'))
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'));

CREATE POLICY "admin delete route_points"
  ON route_points FOR DELETE
  USING (get_user_role() = 'admin');

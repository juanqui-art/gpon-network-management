-- Restrict direct infrastructure writes to admin and network_engineer.
-- outside_plant moves to verification/proposal flows instead of writing the
-- source-of-truth infrastructure tables directly.

DROP POLICY IF EXISTS "field write infra" ON infrastructure_elements;
DROP POLICY IF EXISTS "field update infra" ON infrastructure_elements;
DROP POLICY IF EXISTS "field write fiber" ON fiber_routes;
DROP POLICY IF EXISTS "field update fiber" ON fiber_routes;
DROP POLICY IF EXISTS "field write route_points" ON route_points;
DROP POLICY IF EXISTS "field update route_points" ON route_points;

CREATE POLICY "field write infra"
  ON infrastructure_elements FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

CREATE POLICY "field update infra"
  ON infrastructure_elements FOR UPDATE
  USING (get_user_role() IN ('admin', 'network_engineer'))
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

CREATE POLICY "field write fiber"
  ON fiber_routes FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

CREATE POLICY "field update fiber"
  ON fiber_routes FOR UPDATE
  USING (get_user_role() IN ('admin', 'network_engineer'))
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

CREATE POLICY "field write route_points"
  ON route_points FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

CREATE POLICY "field update route_points"
  ON route_points FOR UPDATE
  USING (get_user_role() IN ('admin', 'network_engineer'))
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

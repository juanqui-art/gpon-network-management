-- Add WITH CHECK to networks UPDATE policy.
-- Previously: USING (role IN admin/ne/op), WITH CHECK NULL — allowed an
-- update to leave a row in a state the user could not have inserted.
-- Symmetric WITH CHECK closes that gap and matches the rest of the schema.

DROP POLICY IF EXISTS "networks_update" ON networks;

CREATE POLICY "networks_update"
  ON networks FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'))
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'));

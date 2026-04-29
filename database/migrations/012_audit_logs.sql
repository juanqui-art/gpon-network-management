-- Audit trail for administrative and operational actions.

CREATE TABLE audit_logs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email       text,
  action            text        NOT NULL,
  target_type       text        NOT NULL,
  target_id         text,
  target_label      text,
  metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx      ON audit_logs (actor_user_id);
CREATE INDEX audit_logs_action_idx     ON audit_logs (action);
CREATE INDEX audit_logs_target_idx     ON audit_logs (target_type, target_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read audit logs"
  ON audit_logs FOR SELECT
  USING (get_user_role() = 'admin');

-- Audit inserts are performed by server-side service_role code.

-- Fix C1: read role from app_metadata (only writable via service_role)
-- Previously read from user_metadata which any authenticated user can self-edit.

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'support')
$$;

-- ⚠️ APPROXIMATE BASELINE — reconstructed from application code, NOT from a dump.
--
-- The `networks` table, the `network_id` columns and `create_network()` were
-- applied directly in Supabase and never versioned. Migration 010 references
-- networks(id), so a fresh database could not be built from this repository.
--
-- This file rebuilds them from what the code and later migrations expect:
--   * columns   → apps/web/lib/types/network.ts, networks/[id]/page.tsx, 027
--   * topology  → enum: 027 casts `n.topology::text`, so it is not text in prod;
--                 values from NetworkTopology ('star','tree','cascade','blank')
--   * RLS       → policy name "networks_update" (026 drops and recreates it);
--                 roles mirrored from 026 for insert, admin-only delete
--   * create_network(p_name, p_description, p_topology) → networks-client.tsx;
--                 returns the new id (the client navigates to /networks/<id>)
--   * seed ids  → 10000000-…-0002 is required by 023 (Cuenca ONTs, FK in 021);
--                 …-0001 for the Quito seed (003) by symmetry
--
-- Unknowns (may differ from production):
--   * enum type name, defaults, ON DELETE behavior of network_id FKs (CASCADE here)
--   * whether create_network() seeds zones (here: no; 010 seeds Z01/Z05/Z10
--     only for networks that exist when it runs)
--   * how production assigns network_id to elements created by
--     create_*_draft (those RPCs take no network_id) — NOT reconstructed
--
-- SAFETY: everything runs only when `networks` does not exist yet, i.e. on a
-- fresh database. On production (where it exists) this migration is a no-op
-- and never overwrites the real definitions.
--
-- Replace with the real DDL once it is extracted (see CLAUDE.md § Base de datos).
-- Ordering: "009b" sorts after "009_…" and before "010_…".

DO $baseline$
BEGIN
  IF to_regclass('public.networks') IS NOT NULL THEN
    RAISE NOTICE '009b: public.networks already exists — approximate baseline skipped';
    RETURN;
  END IF;

  -- ─── Type ──────────────────────────────────────────────────────────────────
  IF to_regtype('public.network_topology') IS NULL THEN
    CREATE TYPE public.network_topology AS ENUM ('star', 'tree', 'cascade', 'blank');
  END IF;

  -- ─── Table ─────────────────────────────────────────────────────────────────
  CREATE TABLE public.networks (
    id           uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    name         text             NOT NULL,
    description  text,
    topology     network_topology NOT NULL DEFAULT 'blank',
    created_by   uuid             REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at   timestamptz      NOT NULL DEFAULT now(),
    updated_at   timestamptz      NOT NULL DEFAULT now()
  );

  CREATE TRIGGER trg_networks_updated_at
    BEFORE UPDATE ON public.networks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

  -- ─── RLS ───────────────────────────────────────────────────────────────────
  ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "networks_select"
    ON public.networks FOR SELECT
    TO authenticated
    USING (true);

  CREATE POLICY "networks_insert"
    ON public.networks FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'));

  -- Replaced by 026 (adds WITH CHECK); kept so 026 has something to drop.
  CREATE POLICY "networks_update"
    ON public.networks FOR UPDATE
    TO authenticated
    USING (get_user_role() IN ('admin', 'network_engineer', 'outside_plant'));

  CREATE POLICY "networks_delete"
    ON public.networks FOR DELETE
    TO authenticated
    USING (get_user_role() = 'admin');

  -- ─── network_id on infrastructure ─────────────────────────────────────────
  -- Nullable: seeds 003/014 insert elements without it and are backfilled.
  ALTER TABLE public.infrastructure_elements
    ADD COLUMN network_id uuid REFERENCES public.networks(id) ON DELETE CASCADE;
  ALTER TABLE public.fiber_routes
    ADD COLUMN network_id uuid REFERENCES public.networks(id) ON DELETE CASCADE;

  CREATE INDEX idx_infrastructure_elements_network_id
    ON public.infrastructure_elements (network_id);
  CREATE INDEX idx_fiber_routes_network_id
    ON public.fiber_routes (network_id);

  -- ─── create_network ────────────────────────────────────────────────────────
  -- SECURITY INVOKER: RLS on networks decides who may create.
  CREATE FUNCTION public.create_network(
    p_name        text,
    p_description text DEFAULT NULL,
    p_topology    network_topology DEFAULT 'blank'
  )
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_id uuid;
  BEGIN
    IF p_name IS NULL OR btrim(p_name) = '' THEN
      RAISE EXCEPTION 'Network name is required';
    END IF;

    INSERT INTO networks (name, description, topology, created_by)
    VALUES (btrim(p_name), NULLIF(btrim(p_description), ''), p_topology, auth.uid())
    RETURNING id INTO v_id;

    RETURN v_id;
  END;
  $fn$;

  -- Supabase grants EXECUTE on new functions to anon by default: revoke explicitly.
  REVOKE ALL ON FUNCTION public.create_network(text, text, network_topology) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.create_network(text, text, network_topology) FROM anon;
  END IF;
  GRANT EXECUTE ON FUNCTION public.create_network(text, text, network_topology) TO authenticated;

  -- ─── Seed networks (dev) ───────────────────────────────────────────────────
  INSERT INTO public.networks (id, name, description, topology) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Quito — Mariscal / La Carolina',
     'Red de desarrollo (seed 003)', 'tree'),
    ('10000000-0000-0000-0000-000000000002', 'Cuenca — El Ejido / San Sebastián',
     'Red de desarrollo (seed 014)', 'star');

  -- Everything that exists at this point comes from the Quito seed (003).
  UPDATE public.infrastructure_elements
    SET network_id = '10000000-0000-0000-0000-000000000001'
    WHERE network_id IS NULL;
  UPDATE public.fiber_routes
    SET network_id = '10000000-0000-0000-0000-000000000001'
    WHERE network_id IS NULL;

  RAISE NOTICE '009b: approximate networks baseline created (fresh database)';
END;
$baseline$;

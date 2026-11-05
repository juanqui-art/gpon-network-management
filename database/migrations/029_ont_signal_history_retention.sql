-- Retention policy for ont_signal_history (see docs/adr/0004).
--
-- Without retention the table grows ~144 rows/ONT/day (one 'sample' every
-- 10 polls at 60 s), i.e. ~14 GB/year at 1,000 ONTs. Rows are not equally
-- valuable, so retention is tiered by the existing `trigger` column:
--
--   sample                → 30 days   baseline for recent curves (UI reads 24 h)
--   change, degradation   → 365 days  fault history and forensic value
--
-- Deletes run in batches with a COMMIT between them (PROCEDURE, not FUNCTION)
-- so a large backlog never holds one long transaction, lock or WAL spike.
-- The (trigger, recorded_at) index from 021 serves both delete predicates.
--
-- Scheduled daily with pg_cron. On Supabase, pg_cron can also be enabled from
-- Dashboard → Integrations → Cron; run history: cron.job_run_details.
--
-- Manual run: `CALL prune_ont_signal_history();` as a top-level statement
-- (psql). It fails with "invalid transaction termination" inside an explicit
-- transaction (BEGIN … COMMIT), which some SQL editors add implicitly.

CREATE OR REPLACE PROCEDURE prune_ont_signal_history(
  p_sample_days integer DEFAULT 30,
  p_event_days  integer DEFAULT 365,
  p_batch_size  integer DEFAULT 10000
)
LANGUAGE plpgsql
-- No `SET search_path` clause: PostgreSQL forbids COMMIT in procedures that
-- have one. Not SECURITY DEFINER either, so tables are schema-qualified instead.
AS $$
DECLARE
  v_sample_cutoff timestamptz;
  v_event_cutoff  timestamptz;
  v_batch         integer;
  v_samples       bigint := 0;
  v_events        bigint := 0;
BEGIN
  IF p_sample_days < 1 OR p_event_days < p_sample_days OR p_batch_size < 1 THEN
    RAISE EXCEPTION 'Invalid retention: sample_days=% event_days=% batch_size=% (need sample_days >= 1, event_days >= sample_days)',
      p_sample_days, p_event_days, p_batch_size;
  END IF;

  -- Fixed cutoffs for the whole run, so batches agree on the boundary.
  v_sample_cutoff := now() - make_interval(days => p_sample_days);
  v_event_cutoff  := now() - make_interval(days => p_event_days);

  LOOP
    DELETE FROM public.ont_signal_history
    WHERE id IN (
      SELECT id FROM public.ont_signal_history
      WHERE trigger = 'sample' AND recorded_at < v_sample_cutoff
      LIMIT p_batch_size
    );
    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_samples := v_samples + v_batch;
    COMMIT;
    EXIT WHEN v_batch < p_batch_size;
  END LOOP;

  LOOP
    DELETE FROM public.ont_signal_history
    WHERE id IN (
      SELECT id FROM public.ont_signal_history
      WHERE trigger IN ('change', 'degradation') AND recorded_at < v_event_cutoff
      LIMIT p_batch_size
    );
    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_events := v_events + v_batch;
    COMMIT;
    EXIT WHEN v_batch < p_batch_size;
  END LOOP;

  RAISE LOG 'prune_ont_signal_history: deleted % samples (< %), % events (< %)',
    v_samples, v_sample_cutoff, v_events, v_event_cutoff;
END;
$$;

-- Maintenance only: not callable through the API. Supabase grants EXECUTE on
-- new routines to anon/authenticated by default, so revoke explicitly.
REVOKE ALL ON PROCEDURE prune_ont_signal_history(integer, integer, integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON PROCEDURE prune_ont_signal_history(integer, integer, integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON PROCEDURE prune_ont_signal_history(integer, integer, integer) FROM authenticated;
  END IF;
END;
$$;

-- ─── Schedule ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 08:17 UTC = 03:17 Ecuador (UTC-5), outside operating hours.
-- cron.schedule upserts by job name, so re-running this migration is safe.
SELECT cron.schedule(
  'prune-ont-signal-history',
  '17 8 * * *',
  $$CALL public.prune_ont_signal_history(30, 365)$$
);

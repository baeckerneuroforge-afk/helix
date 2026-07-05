-- =============================================================================
-- helix — loop autonomy level (Block 4 / Schritt D, plan §4).
--
-- Applied by `prisma migrate deploy` as the database OWNER (DIRECT_DATABASE_URL).
--
-- One org-wide governance knob for how sharply the loop acts on a deviation:
--   'report'     — Default. Flag + notification. The human adjusts. (Schritt A–C.)
--   'suggest'    — Flag additionally carries a correction PROPOSAL (a re-run of
--                  the same skill with the same inputs). The human clicks to
--                  start it; the run still goes through the normal approval gate.
--   'autonomous' — reserved: the loop starts the correction itself (still behind
--                  the approval gate). Not yet WIRED — Schritt E. For now it
--                  behaves exactly like 'suggest' (see src/lib/loop/settings.ts).
--
-- Stored per tenant on org_settings, exactly like approval_notify_email (0017):
-- one row per org (org_id IS the PK). DEFAULT 'report' backfills every existing
-- tenant with the safe, unchanged behaviour — nobody is opted into suggestions.
--
-- `loop_autonomy` is an ENUM, mirroring approval_mode (0004) and skill_run_mode
-- (0019): a small, closed governance dimension, type-safe end to end. Like the
-- other enums it relies on PUBLIC's default USAGE on the type (this codebase
-- never REVOKEs it — see 0001..0004), so no extra GRANT is needed for app_user.
--
-- RLS/GRANTs of org_settings (0012) are unchanged: the table-level
-- SELECT/INSERT/UPDATE grant to app_user already covers the new column.
-- =============================================================================

CREATE TYPE "loop_autonomy" AS ENUM ('report', 'suggest', 'autonomous');

ALTER TABLE "org_settings"
    ADD COLUMN "loop_autonomy" "loop_autonomy" NOT NULL DEFAULT 'report';

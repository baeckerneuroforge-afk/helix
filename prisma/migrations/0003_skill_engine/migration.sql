-- =============================================================================
-- ergane — skill engine (Phase 3): skill_runs, skill_steps, approvals.
--
-- Applied by `prisma migrate deploy` as the database OWNER (DIRECT_DATABASE_URL).
-- Follows the README checklist "adding a new tenant table" for all three tables:
--   org_id UUID NOT NULL + FK → organizations(id), index on org_id,
--   RLS ENABLE + FORCE, tenant policy on current_setting('app.current_org'),
--   least-privilege GRANTs to app_user (SELECT/INSERT/UPDATE — UPDATE is needed
--   for status transitions; no DELETE anywhere).
--
-- Composite FKs (run_id, org_id) → skill_runs(id, org_id) make it structurally
-- impossible for a step or approval to reference another tenant's run — on top
-- of (not instead of) the RLS policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
CREATE TYPE "skill_run_status" AS ENUM
    ('running', 'awaiting_approval', 'approved', 'rejected', 'completed', 'failed');
CREATE TYPE "skill_step_status" AS ENUM ('pending', 'done', 'failed');
CREATE TYPE "approval_status" AS ENUM ('pending', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
CREATE TABLE "skill_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "skill_key" TEXT NOT NULL,
    "status" "skill_run_status" NOT NULL DEFAULT 'running',
    "input" JSONB NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "skill_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "skill_runs_org_id_idx" ON "skill_runs" ("org_id");
-- Target for the composite FKs below.
CREATE UNIQUE INDEX "skill_runs_id_org_id_key" ON "skill_runs" ("id", "org_id");

CREATE TABLE "skill_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "idx" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "skill_step_status" NOT NULL DEFAULT 'pending',
    "detail" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "skill_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "skill_steps_org_id_idx" ON "skill_steps" ("org_id");
CREATE UNIQUE INDEX "skill_steps_run_id_idx_key" ON "skill_steps" ("run_id", "idx");

CREATE TABLE "approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'pending',
    "decided_by" TEXT,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "approvals_org_id_idx" ON "approvals" ("org_id");
CREATE INDEX "approvals_run_id_idx" ON "approvals" ("run_id");

-- -----------------------------------------------------------------------------
-- Foreign keys
-- -----------------------------------------------------------------------------
ALTER TABLE "skill_runs"
    ADD CONSTRAINT "skill_runs_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "skill_steps"
    ADD CONSTRAINT "skill_steps_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "skill_steps"
    ADD CONSTRAINT "skill_steps_run_id_org_id_fkey"
    FOREIGN KEY ("run_id", "org_id") REFERENCES "skill_runs" ("id", "org_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals"
    ADD CONSTRAINT "approvals_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals"
    ADD CONSTRAINT "approvals_run_id_org_id_fkey"
    FOREIGN KEY ("run_id", "org_id") REFERENCES "skill_runs" ("id", "org_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY — same fail-closed predicate as every other tenant table:
--   org_id = NULLIF(current_setting('app.current_org', true), '')::uuid
-- (see 0001_init for the rationale; no tenant context ⇒ zero rows)
-- -----------------------------------------------------------------------------
ALTER TABLE "skill_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "skill_runs_tenant_isolation" ON "skill_runs"
    USING      ("org_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
    WITH CHECK ("org_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "skill_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_steps" FORCE ROW LEVEL SECURITY;
CREATE POLICY "skill_steps_tenant_isolation" ON "skill_steps"
    USING      ("org_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
    WITH CHECK ("org_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approvals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "approvals_tenant_isolation" ON "approvals"
    USING      ("org_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
    WITH CHECK ("org_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

-- -----------------------------------------------------------------------------
-- LEAST-PRIVILEGE GRANTS for app_user.
-- UPDATE is required for status transitions (run/step/approval lifecycle).
-- No DELETE: runs, steps and approvals are never removed by the app.
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON "skill_runs" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "skill_steps" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "approvals" TO app_user;

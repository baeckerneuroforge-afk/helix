// =============================================================================
// SKILL-ENGINE ISOLATION + GUARDRAIL GATE (Phase 3)
//
// Extends — never replaces — the canonical gate. Runs as `app_user`
// (DATABASE_URL) like the app; the owner connection is used ONLY to reset.
// No network calls: beleg_kontieren is fully deterministic.
//
// What it proves for skill_runs / skill_steps / approvals:
//   1. Tenant A can neither SEE nor UPDATE B's runs/steps/approvals, and the
//      composite FK (run_id, org_id) makes referencing B's run structurally
//      impossible even from a valid A context.
//   2. Without a tenant context every query returns 0 rows (fails closed);
//      RLS is ENABLEd AND FORCEd on all three tables (regression guard).
//   3. Guardrail: a run over the limit MUST pause in awaiting_approval and the
//      acting step is NOT executed (no 'verbucht' step/result/audit) while no
//      approval exists.
//   4. approve() → run reaches completed and the acting step ran exactly once;
//      reject() → rejected and the acting step never ran.
//   5. Four-eyes sanity: the decision carries decided_by, and a guarded run
//      cannot reach completed without its approval being approved.
// =============================================================================
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma'; // app_user — the system under test
import { withTenant } from '../src/lib/tenant';
import { approve, reject, startRun } from '../src/lib/skills';
import { GUARDRAIL_REASON } from '../src/lib/skills/catalog/beleg_kontieren';

const ORG_A = '77777777-7777-4777-8777-777777777777';
const ORG_B = '88888888-8888-4888-8888-888888888888';
const NEW_TABLES = ['skill_runs', 'skill_steps', 'approvals'];
const ALL_TABLES = [
  'organizations', 'memberships', 'knowledge_items', 'audit_log',
  'documents', 'chunks', 'chat_messages', ...NEW_TABLES,
];

const admin = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });

const SMALL_INPUT = { beschreibung: 'Bahnticket Kundentermin', betragEur: 240 };
const BIG_INPUT = { beschreibung: 'Softwarelizenz Jahresvertrag', betragEur: 1240 };

async function reset() {
  await admin.$executeRawUnsafe(
    `TRUNCATE ${ALL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

async function seedOrg(orgId: string, clerkOrgId: string, name: string) {
  await withTenant(orgId, async (tx) => {
    await tx.organization.create({ data: { id: orgId, clerkOrgId, name } });
  });
}

/** All rows of a run, read through the tenant boundary. */
async function inspectRun(orgId: string, runId: string) {
  return withTenant(orgId, async (tx) => ({
    run: await tx.skillRun.findUnique({ where: { id: runId } }),
    steps: await tx.skillStep.findMany({ where: { runId }, orderBy: { idx: 'asc' } }),
    approvals: await tx.approval.findMany({ where: { runId } }),
  }));
}

beforeAll(async () => {
  const [role] = await prisma.$queryRaw<
    Array<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>
  >`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  if (role?.current_user !== 'app_user' || role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `Refusing to run: connected as "${role?.current_user}" (super=${role?.rolsuper}, bypassrls=${role?.rolbypassrls}).`,
    );
  }
  await reset();
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
  await admin.$disconnect();
});

beforeEach(async () => {
  await reset();
  await seedOrg(ORG_A, 'org_skill_a', 'Skill Org A');
  await seedOrg(ORG_B, 'org_skill_b', 'Skill Org B');
});

describe('skill-engine tenant isolation (skill_runs, skill_steps, approvals)', () => {
  it('regression guard: RLS is ENABLEd AND FORCEd on all three new tables', async () => {
    const rows = await admin.$queryRaw<
      Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>
    >`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relname = ANY(${NEW_TABLES}) AND relkind = 'r'`;
    expect(rows).toHaveLength(NEW_TABLES.length);
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} must have RLS ENABLEd`).toBe(true);
      expect(row.relforcerowsecurity, `${row.relname} must have RLS FORCEd`).toBe(true);
    }
  });

  it('tenant A cannot SEE B’s runs, steps or approvals', async () => {
    const { runId } = await startRun(ORG_B, 'beleg_kontieren', BIG_INPUT); // pauses with approval

    const fromA = await inspectRun(ORG_A, runId);
    expect(fromA.run).toBeNull();
    expect(fromA.steps).toHaveLength(0);
    expect(fromA.approvals).toHaveLength(0);

    const counts = await withTenant(ORG_A, async (tx) => ({
      runs: await tx.skillRun.count(),
      steps: await tx.skillStep.count(),
      approvals: await tx.approval.count(),
    }));
    expect(counts).toEqual({ runs: 0, steps: 0, approvals: 0 });
  });

  it('tenant A cannot UPDATE B’s runs/approvals — by id or in bulk (0 rows affected)', async () => {
    const { runId } = await startRun(ORG_B, 'beleg_kontieren', BIG_INPUT);

    // Bulk updates from A's context silently affect 0 rows (RLS filters them out).
    const updated = await withTenant(ORG_A, (tx) =>
      tx.skillRun.updateMany({ where: { id: runId }, data: { status: 'completed' } }),
    );
    expect(updated.count).toBe(0);
    const decided = await withTenant(ORG_A, (tx) =>
      tx.approval.updateMany({ where: { runId }, data: { status: 'approved', decidedBy: 'mallory' } }),
    );
    expect(decided.count).toBe(0);

    // approve() through the engine fails: A simply cannot find B's run.
    await expect(approve(ORG_A, runId, 'mallory')).rejects.toThrow();

    // B's run is untouched.
    const fromB = await inspectRun(ORG_B, runId);
    expect(fromB.run?.status).toBe('awaiting_approval');
    expect(fromB.approvals[0]?.status).toBe('pending');
  });

  it('the composite FK rejects steps/approvals that reference another tenant’s run', async () => {
    const { runId } = await startRun(ORG_B, 'beleg_kontieren', SMALL_INPUT);

    // From a VALID A context: referencing B's run cannot work — (run_id, ORG_A)
    // does not exist in skill_runs, so the composite FK fails structurally.
    await expect(
      withTenant(ORG_A, (tx) =>
        tx.skillStep.create({
          data: { orgId: ORG_A, runId, idx: 99, name: 'smuggled', status: 'done' },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(ORG_A, (tx) =>
        tx.approval.create({ data: { orgId: ORG_A, runId, reason: 'smuggled' } }),
      ),
    ).rejects.toThrow();

    // And inserting directly WITH B's org_id from A's context hits WITH CHECK.
    await expect(
      withTenant(ORG_A, (tx) =>
        tx.skillRun.create({
          data: { orgId: ORG_B, skillKey: 'beleg_kontieren', input: {} },
        }),
      ),
    ).rejects.toThrow();
  });

  it('without a tenant context every query returns 0 rows (fails closed)', async () => {
    await startRun(ORG_A, 'beleg_kontieren', BIG_INPUT);

    expect(await prisma.skillRun.findMany()).toHaveLength(0);
    expect(await prisma.skillStep.findMany()).toHaveLength(0);
    expect(await prisma.approval.findMany()).toHaveLength(0);
  });
});

describe('guardrail → human approval → audit', () => {
  it('below the limit: run completes without any approval', async () => {
    const handle = await startRun(ORG_A, 'beleg_kontieren', SMALL_INPUT);
    expect(handle.status).toBe('completed');

    const { run, steps, approvals } = await inspectRun(ORG_A, handle.runId);
    expect(run?.status).toBe('completed');
    expect(steps.map((s) => s.name)).toEqual([
      'beleg_gelesen', 'konto_vorgeschlagen', 'buchung_vorbereitet', 'verbucht',
    ]);
    expect(approvals).toHaveLength(0);
  });

  it('over the limit: run pauses awaiting_approval and the acting step has NOT run', async () => {
    const handle = await startRun(ORG_A, 'beleg_kontieren', BIG_INPUT);
    expect(handle.status).toBe('awaiting_approval');

    const { run, steps, approvals } = await inspectRun(ORG_A, handle.runId);
    expect(run?.status).toBe('awaiting_approval');
    expect(run?.result).toBeNull(); // no result while paused
    expect(steps.some((s) => s.name === 'verbucht')).toBe(false); // nothing acted
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.status).toBe('pending');
    expect(approvals[0]?.reason).toBe(GUARDRAIL_REASON);

    // Audit: guardrail.triggered exists, but NO verbucht step audit and no completion.
    const audit = await withTenant(ORG_A, (tx) => tx.auditLog.findMany());
    expect(audit.some((a) => a.action === 'guardrail.triggered')).toBe(true);
    expect(audit.some((a) => a.action === 'skill.completed')).toBe(false);
    expect(
      audit.some((a) => a.action === 'skill.step_completed' && a.target?.includes('verbucht')),
    ).toBe(false);
  });

  it('approve() resumes the run to completed; the acting step ran exactly once', async () => {
    const handle = await startRun(ORG_A, 'beleg_kontieren', BIG_INPUT);
    const resumed = await approve(ORG_A, handle.runId, 'cfo_alice');
    expect(resumed.status).toBe('completed');

    const { run, steps, approvals } = await inspectRun(ORG_A, handle.runId);
    expect(run?.status).toBe('completed');
    expect(run?.result).not.toBeNull();
    const acted = steps.filter((s) => s.name === 'verbucht' && s.status === 'done');
    expect(acted).toHaveLength(1); // exactly once

    // Four-eyes: the decision carries the human who signed off.
    expect(approvals[0]?.status).toBe('approved');
    expect(approvals[0]?.decidedBy).toBe('cfo_alice');
    expect(approvals[0]?.decidedAt).not.toBeNull();

    const audit = await withTenant(ORG_A, (tx) =>
      tx.auditLog.findMany({ orderBy: { createdAt: 'asc' } }),
    );
    const approvalEntry = audit.find((a) => a.action === 'approval.approved');
    expect(approvalEntry?.actorType).toBe('human');
    expect(approvalEntry?.actorId).toBe('cfo_alice');
    expect(audit.some((a) => a.action === 'skill.completed')).toBe(true);
  });

  it('reject() ends the run as rejected; the acting step never runs', async () => {
    const handle = await startRun(ORG_A, 'beleg_kontieren', BIG_INPUT);
    const denied = await reject(ORG_A, handle.runId, 'cfo_alice');
    expect(denied.status).toBe('rejected');

    const { run, steps, approvals } = await inspectRun(ORG_A, handle.runId);
    expect(run?.status).toBe('rejected');
    expect(run?.result).toBeNull();
    expect(steps.some((s) => s.name === 'verbucht')).toBe(false);
    expect(approvals[0]?.status).toBe('rejected');
    expect(approvals[0]?.decidedBy).toBe('cfo_alice');

    const audit = await withTenant(ORG_A, (tx) => tx.auditLog.findMany());
    expect(audit.some((a) => a.action === 'approval.rejected')).toBe(true);
    expect(audit.some((a) => a.action === 'skill.completed')).toBe(false);
  });

  it('a guarded run cannot be pushed to completed without a decision (engine + sanity)', async () => {
    const handle = await startRun(ORG_A, 'beleg_kontieren', BIG_INPUT);

    // The engine refuses to decide twice / to resume without a pending approval:
    // a second approve after reject must fail.
    await reject(ORG_A, handle.runId, 'cfo_alice');
    await expect(approve(ORG_A, handle.runId, 'cfo_bob')).rejects.toThrow();

    // And the paused/rejected run never gained the acting step or a result.
    const { run, steps } = await inspectRun(ORG_A, handle.runId);
    expect(run?.status).toBe('rejected');
    expect(run?.result).toBeNull();
    expect(steps.some((s) => s.name === 'verbucht')).toBe(false);
  });
});

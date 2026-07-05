// =============================================================================
// LOOP AUTONOMY — Schritt D ("Vorschlagen").
//
// Pins the governance knob and the "suggest" behaviour:
//
//   1. setLoopAutonomy: admin-only (member refused, nothing written), audited
//      'policy.changed' with {old,new}, no-op change writes no audit, RLS-scoped.
//      getLoopAutonomy defaults to 'report'.
//   2. 'suggest' → a criteria flag gains suggestedAction + a machine correction
//      ref; 'report' → neither. toFlagView round-trips the correction ref.
//   3. startCorrectionRun: re-runs the SAME skill with the SAME inputs THROUGH
//      the normal approval gate (ends awaiting_approval, NOT auto-approved),
//      writes 'flag.correction_requested', and is tenant-isolated (a foreign
//      sourceRunId is a bad request, never a cross-tenant replay).
//   4. notifyFlag: best-effort — sends to the notify address, never throws, and
//      a null address is a silent no-op.
//
// Same harness as loop-evaluate / loop-metrics-cron: runs as app_user, owner
// connection only to reset state.
// =============================================================================
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { withTenant } from '../src/lib/tenant';
import { createArtifact } from '../src/lib/artifacts';
import { getFakeBlobProvider } from '../src/lib/storage/blob';
import { getFakeEmailProvider } from '../src/lib/effects';
import { queryAuditLog } from '../src/lib/audit';
import {
  DEFAULT_LOOP_AUTONOMY,
  getLoopAutonomy,
  setLoopAutonomy,
} from '../src/lib/loop/settings';
import { evaluateDeliverableCriteria } from '../src/lib/loop/evaluate';
import { toFlagView } from '../src/lib/loop/flags-view';
import { startCorrectionRun, CorrectionBadRequestError } from '../src/lib/loop/correct';
import { notifyFlag } from '../src/lib/loop/notify';

const ORG = 'ababab00-abab-4bab-8bab-abababab0001';
const OTHER = 'cdcdcd00-cdcd-4dcd-8dcd-cdcdcdcd0002';
const ADMIN = 'la_admin';
const MEMBER = 'la_member';

const ALL_TABLES = [
  'organizations', 'memberships', 'audit_log', 'org_settings', 'artifacts',
  'skill_runs', 'skill_steps', 'approvals', 'approval_policies', 'clients',
  'documents', 'chunks',
];

const admin = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const fakeBlob = getFakeBlobProvider();
const fakeMail = getFakeEmailProvider();

async function reset() {
  await admin.$executeRawUnsafe(
    `TRUNCATE ${ALL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  fakeBlob.reset();
  fakeMail.reset();
}

async function seedOrgs() {
  await withTenant(ORG, async (tx) => {
    await tx.organization.create({ data: { id: ORG, clerkOrgId: 'org_la', name: 'Loop Autonomy Org' } });
    await tx.membership.create({ data: { orgId: ORG, userId: ADMIN, role: 'admin' } });
    await tx.membership.create({ data: { orgId: ORG, userId: MEMBER, role: 'member' } });
  });
  await withTenant(OTHER, async (tx) => {
    await tx.organization.create({ data: { id: OTHER, clerkOrgId: 'org_la_other', name: 'Other Org' } });
    await tx.membership.create({ data: { orgId: OTHER, userId: ADMIN, role: 'admin' } });
  });
}

// A framework that violates criteria (only 1 use case, short) → raises a flag.
const BAD_FRAMEWORK = [
  '## Executive summary',
  'Short summary.',
  '',
  '## Prioritized use cases',
  '1. One use case only',
  '',
  '_Sources: Doc A_',
].join('\n');

async function seedFrameworkRun(orgId: string, clientId: string | null = null): Promise<string> {
  const runId = await withTenant(orgId, async (tx) => {
    const run = await tx.skillRun.create({
      data: { orgId, skillKey: 'transkript_zu_framework', status: 'running', mode: 'live', input: {}, clientId },
    });
    return run.id;
  });
  const bytes = new TextEncoder().encode(BAD_FRAMEWORK);
  await createArtifact({
    orgId,
    title: 'Framework — Test Client',
    type: 'framework',
    bytes,
    contentType: 'text/markdown',
    runId,
    clientId,
  });
  return runId;
}

/** Run the criteria evaluation for a seeded framework run and return its flag. */
async function evaluateAndGetFlag(orgId: string, runId: string) {
  const state = { framework_ausgegeben: { generiert: true, artifactId: null as string | null } };
  // The evaluator finds the artifact by runId via the state's artifactId; look it up.
  const art = await withTenant(orgId, (tx) =>
    tx.artifact.findFirstOrThrow({ where: { runId }, select: { id: true } }),
  );
  state.framework_ausgegeben.artifactId = art.id;
  await evaluateDeliverableCriteria(orgId, 'transkript_zu_framework', runId, state);
  const audit = await queryAuditLog(orgId, { actionPrefixes: ['flag.'] });
  return audit.entries[0] ?? null;
}

beforeAll(async () => {
  delete process.env.RESEND_API_KEY;
  const [role] = await prisma.$queryRaw<Array<{ current_user: string }>>`SELECT current_user`;
  if (role?.current_user !== 'app_user') {
    throw new Error(`Refusing to run: connected as "${role?.current_user}".`);
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
  await seedOrgs();
});

// ---------------------------------------------------------------------------
// 1. setLoopAutonomy / getLoopAutonomy
// ---------------------------------------------------------------------------
describe('setLoopAutonomy / getLoopAutonomy', () => {
  it('defaults to report with no settings row', async () => {
    expect(await getLoopAutonomy(ORG)).toBe('report');
    expect(DEFAULT_LOOP_AUTONOMY).toBe('report');
  });

  it('admin sets the level; audited policy.changed with {old,new}', async () => {
    const saved = await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'suggest' });
    expect(saved).toBe('suggest');
    expect(await getLoopAutonomy(ORG)).toBe('suggest');

    const audit = await withTenant(ORG, (tx) =>
      tx.auditLog.findMany({ where: { action: 'policy.changed' } }),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]!.target).toBe('org_settings:loop_autonomy');
    expect(audit[0]!.actorType).toBe('human');
    expect(audit[0]!.detail).toMatchObject({ old: 'report', new: 'suggest' });
  });

  it('member is refused (admin gate) and nothing is written', async () => {
    await expect(
      setLoopAutonomy({ orgId: ORG, actorUserId: MEMBER, level: 'suggest' }),
    ).rejects.toThrow(/admin required/i);
    expect(await getLoopAutonomy(ORG)).toBe('report');
    const audit = await withTenant(ORG, (tx) =>
      tx.auditLog.findMany({ where: { action: 'policy.changed' } }),
    );
    expect(audit).toHaveLength(0);
  });

  it('a no-op change writes no audit noise', async () => {
    await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'suggest' });
    await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'suggest' }); // same
    const audit = await withTenant(ORG, (tx) =>
      tx.auditLog.findMany({ where: { action: 'policy.changed' } }),
    );
    expect(audit).toHaveLength(1); // only the first change
  });

  it('rejects an invalid level', async () => {
    await expect(
      // @ts-expect-error deliberately invalid
      setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'nonsense' }),
    ).rejects.toThrow(/level must be one of/);
  });

  it('is tenant-isolated: setting ORG does not change OTHER', async () => {
    await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'autonomous' });
    expect(await getLoopAutonomy(OTHER)).toBe('report');
  });
});

// ---------------------------------------------------------------------------
// 2. 'suggest' attaches a proposal to a criteria flag; 'report' does not
// ---------------------------------------------------------------------------
describe("criteria flag under 'suggest' vs 'report'", () => {
  it("report (default): flag has NO suggestedAction and NO correction", async () => {
    const runId = await seedFrameworkRun(ORG);
    const row = await evaluateAndGetFlag(ORG, runId);
    expect(row).not.toBeNull();
    const detail = row!.detail as Record<string, unknown>;
    expect(detail.suggestedAction).toBeUndefined();
    expect(detail.correction).toBeUndefined();
    // And the projection agrees.
    const view = toFlagView(row!);
    expect(view.suggestedAction).toBeNull();
    expect(view.correction).toBeNull();
  });

  it("suggest: flag gains suggestedAction + a correction re-run pointer", async () => {
    await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'suggest' });
    const runId = await seedFrameworkRun(ORG);
    const row = await evaluateAndGetFlag(ORG, runId);
    const detail = row!.detail as Record<string, unknown>;
    expect(typeof detail.suggestedAction).toBe('string');
    expect(detail.correction).toMatchObject({
      skillKey: 'transkript_zu_framework',
      sourceRunId: runId,
    });
  });

  it("autonomous: behaves like suggest for now (proposal present)", async () => {
    await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'autonomous' });
    const runId = await seedFrameworkRun(ORG);
    const row = await evaluateAndGetFlag(ORG, runId);
    const detail = row!.detail as Record<string, unknown>;
    expect(typeof detail.suggestedAction).toBe('string');
    expect(detail.correction).toBeTruthy();
  });

  it("suggest with a client: the suggestion names the client", async () => {
    const clientId = 'eeee0000-eeee-4eee-8eee-eeeeeeee0001';
    await withTenant(ORG, (tx) => tx.client.create({ data: { id: clientId, orgId: ORG, name: 'Nordwind' } }));
    await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'suggest' });
    const runId = await seedFrameworkRun(ORG, clientId);
    const row = await evaluateAndGetFlag(ORG, runId);
    const detail = row!.detail as Record<string, unknown>;
    expect(String(detail.suggestedAction)).toContain('Nordwind');
    expect((detail.correction as { clientId?: string }).clientId).toBe(clientId);
  });
});

// ---------------------------------------------------------------------------
// 3. toFlagView round-trips the correction ref (Schritt B contract)
// ---------------------------------------------------------------------------
describe('toFlagView — correction round-trip', () => {
  it('projects detail.correction into FlagView.correction and drops incomplete refs', async () => {
    await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'suggest' });
    const runId = await seedFrameworkRun(ORG);
    const row = await evaluateAndGetFlag(ORG, runId);
    const view = toFlagView(row!);
    expect(view.correction).toEqual({
      skillKey: 'transkript_zu_framework',
      sourceRunId: runId,
      clientId: null,
    });
    expect(view.suggestedAction).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. startCorrectionRun — re-run through the NORMAL approval gate
// ---------------------------------------------------------------------------
describe('startCorrectionRun', () => {
  /** Seed a completed angebot run (guardrail always triggers → its re-run pauses). */
  async function seedAngebotRun(orgId: string): Promise<string> {
    return withTenant(orgId, async (tx) => {
      const run = await tx.skillRun.create({
        data: {
          orgId,
          skillKey: 'angebot_erstellen',
          status: 'completed',
          mode: 'live',
          // No `email` → the send stays simulated; enough fields for the read steps.
          input: { kunde: 'Hanse Logistik', leistung: 'Projektunterstützung', betragEur: 4800 },
          clientId: null,
        },
      });
      return run.id;
    });
  }

  // Corrections are gated on autonomy: only 'suggest'/'autonomous' may trigger
  // one. Enable it for both tenants so these cases exercise the happy path.
  beforeEach(async () => {
    await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'suggest' });
    await setLoopAutonomy({ orgId: OTHER, actorUserId: ADMIN, level: 'suggest' });
  });

  it('report mode refuses a correction (stale button after revert)', async () => {
    const sourceRunId = await seedAngebotRun(ORG);
    await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'report' }); // revert
    await expect(
      startCorrectionRun({ orgId: ORG, actorUserId: ADMIN, skillKey: 'angebot_erstellen', sourceRunId }),
    ).rejects.toBeInstanceOf(CorrectionBadRequestError);
    // No run started.
    const runs = await withTenant(ORG, (tx) =>
      tx.skillRun.findMany({ where: { skillKey: 'angebot_erstellen', status: 'awaiting_approval' } }),
    );
    expect(runs).toHaveLength(0);
  });

  it('starts a re-run that ends AWAITING approval — never auto-approved', async () => {
    const sourceRunId = await seedAngebotRun(ORG);
    const result = await startCorrectionRun({
      orgId: ORG,
      actorUserId: ADMIN,
      skillKey: 'angebot_erstellen',
      sourceRunId,
    });

    expect(result.awaitingApproval).toBe(true);
    expect(result.status).toBe('awaiting_approval');
    expect(result.runId).not.toBe(sourceRunId); // a NEW run

    // The new run is genuinely paused with a PENDING approval — not approved.
    const { run, approvals } = await withTenant(ORG, async (tx) => ({
      run: await tx.skillRun.findUniqueOrThrow({ where: { id: result.runId } }),
      approvals: await tx.approval.findMany({ where: { runId: result.runId } }),
    }));
    expect(run.status).toBe('awaiting_approval');
    expect(approvals).toHaveLength(1);
    expect(approvals[0]!.status).toBe('pending');

    // The trigger is audited as a human-requested correction.
    const audit = await withTenant(ORG, (tx) =>
      tx.auditLog.findMany({ where: { action: 'flag.correction_requested' } }),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]!.actorType).toBe('human');
    expect(audit[0]!.actorId).toBe(ADMIN);
    expect(audit[0]!.detail).toMatchObject({ sourceRunId });
  });

  it('re-runs with the SAME input as the source run', async () => {
    const sourceRunId = await seedAngebotRun(ORG);
    const result = await startCorrectionRun({
      orgId: ORG, actorUserId: ADMIN, skillKey: 'angebot_erstellen', sourceRunId,
    });
    const [source, replay] = await withTenant(ORG, async (tx) => [
      await tx.skillRun.findUniqueOrThrow({ where: { id: sourceRunId } }),
      await tx.skillRun.findUniqueOrThrow({ where: { id: result.runId } }),
    ]);
    expect(replay.input).toEqual(source.input);
    expect(replay.skillKey).toBe(source.skillKey);
  });

  it('rejects an unknown skill (bad request)', async () => {
    const sourceRunId = await seedAngebotRun(ORG);
    await expect(
      startCorrectionRun({ orgId: ORG, actorUserId: ADMIN, skillKey: 'does_not_exist', sourceRunId }),
    ).rejects.toBeInstanceOf(CorrectionBadRequestError);
  });

  it('is tenant-isolated: OTHER cannot replay ORG\'s run', async () => {
    const sourceRunId = await seedAngebotRun(ORG);
    // Same skill, but the run belongs to ORG — from OTHER it is "not found".
    await expect(
      startCorrectionRun({ orgId: OTHER, actorUserId: ADMIN, skillKey: 'angebot_erstellen', sourceRunId }),
    ).rejects.toBeInstanceOf(CorrectionBadRequestError);
    // And no run was started in OTHER.
    const otherRuns = await withTenant(OTHER, (tx) => tx.skillRun.findMany());
    expect(otherRuns).toHaveLength(0);
  });

  it('rejects a skill that does not match the source run', async () => {
    const sourceRunId = await seedAngebotRun(ORG); // angebot_erstellen
    await expect(
      startCorrectionRun({ orgId: ORG, actorUserId: ADMIN, skillKey: 'transkript_zu_framework', sourceRunId }),
    ).rejects.toBeInstanceOf(CorrectionBadRequestError);
  });
});

// ---------------------------------------------------------------------------
// 5. notifyFlag — best-effort
// ---------------------------------------------------------------------------
describe('notifyFlag', () => {
  it('sends to the configured notify address; never throws', async () => {
    await withTenant(ORG, (tx) =>
      tx.orgSettings.upsert({
        where: { orgId: ORG },
        create: { orgId: ORG, approvalNotifyEmail: 'team@example.com' },
        update: { approvalNotifyEmail: 'team@example.com' },
      }),
    );
    await setLoopAutonomy({ orgId: ORG, actorUserId: ADMIN, level: 'suggest' });
    const runId = await seedFrameworkRun(ORG);
    const row = await evaluateAndGetFlag(ORG, runId);
    // evaluate already notified once (after commit); assert an explicit call too.
    fakeMail.reset();
    const res = await notifyFlag(ORG, toFlagView(row!));
    expect(res.email).toBe(true);
    expect(fakeMail.sent).toHaveLength(1);
    expect(fakeMail.sent[0]!.to).toBe('team@example.com');
    // The suggestion appears in the body.
    expect(fakeMail.sent[0]!.text).toMatch(/transkript|Re-run|erneut/i);
  });

  it('no notify address → silent no-op (no throw, no mail)', async () => {
    const runId = await seedFrameworkRun(ORG);
    const row = await evaluateAndGetFlag(ORG, runId);
    fakeMail.reset();
    const res = await notifyFlag(ORG, toFlagView(row!));
    expect(res.email).toBe(false);
    expect(fakeMail.sent).toHaveLength(0);
  });
});

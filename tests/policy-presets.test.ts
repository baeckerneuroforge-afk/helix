// =============================================================================
// GOVERNANCE PRESETS GATE — presets, export/import, money failsafe.
//
//   1. Preset DATA can never violate the failsafe: no handlesMoney skill is
//      'never' in any preset (static invariant over POLICY_PRESETS).
//   2. Applying a preset writes the expected approval policies + grant matrix,
//      transactionally, idempotently, audited ('policy.changed').
//   3. Export → import roundtrip: org B ends up with org A's governance; the
//      export contains no org ids / members / secrets.
//   4. MONEY FAILSAFE ON IMPORT: a malicious JSON that sets a money skill to
//      'never' is corrected fail-closed to 'always' and audited as
//      'policy.overridden_failsafe'.
//   5. Invalid imports are rejected with readable errors and write NOTHING.
//   6. Admin gate: members are rejected (apply/export/import).
//   7. Tenant isolation: A's preset never touches B.
// =============================================================================
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { withTenant } from '../src/lib/tenant';
import { listSkills } from '../src/lib/skills';
import {
  applyPolicyPreset,
  exportGovernance,
  importGovernance,
  parseGovernanceConfig,
  POLICY_PRESETS,
  GOVERNANCE_FORMAT,
  GOVERNANCE_VERSION,
} from '../src/lib/policies';

const ORG_A = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ORG_B = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const ADMIN_A = 'gp_admin_a';
const MEMBER_A = 'gp_member_a';
const ADMIN_B = 'gp_admin_b';

const ALL_TABLES = [
  'organizations', 'memberships', 'audit_log', 'approval_policies', 'visibility_grants',
];

const admin = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });

async function reset() {
  await admin.$executeRawUnsafe(
    `TRUNCATE ${ALL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

async function seed() {
  await withTenant(ORG_A, async (tx) => {
    await tx.organization.create({ data: { id: ORG_A, clerkOrgId: 'org_gp_a', name: 'Preset A' } });
    await tx.membership.createMany({
      data: [
        { orgId: ORG_A, userId: ADMIN_A, role: 'admin' },
        { orgId: ORG_A, userId: MEMBER_A, role: 'member' },
      ],
    });
  });
  await withTenant(ORG_B, async (tx) => {
    await tx.organization.create({ data: { id: ORG_B, clerkOrgId: 'org_gp_b', name: 'Preset B' } });
    await tx.membership.create({ data: { orgId: ORG_B, userId: ADMIN_B, role: 'admin' } });
  });
}

async function governanceOf(orgId: string) {
  return withTenant(orgId, async (tx) => ({
    policies: (await tx.approvalPolicy.findMany({ orderBy: { skillKey: 'asc' } })).map((p) => ({
      skillKey: p.skillKey,
      mode: p.mode,
      thresholdAmount: p.thresholdAmount?.toNumber() ?? null,
      approverRole: p.approverRole,
    })),
    grants: (await tx.visibilityGrant.findMany({ orderBy: [{ level: 'asc' }, { role: 'asc' }] }))
      .map((g) => `${g.level}:${g.role}`)
      .sort(),
  }));
}

beforeAll(async () => {
  const [role] = await prisma.$queryRaw<
    Array<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>
  >`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  if (role?.current_user !== 'app_user' || role.rolsuper || role.rolbypassrls) {
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
  await seed();
});

// --- 1. static failsafe invariant over the preset DATA -----------------------

describe('preset data', () => {
  it('no preset sets a money skill to "never" (failsafe invariant)', () => {
    const moneySkills = new Set(listSkills().filter((s) => s.handlesMoney).map((s) => s.key));
    expect(moneySkills.size).toBeGreaterThan(0); // the invariant is non-vacuous
    for (const preset of POLICY_PRESETS) {
      for (const p of preset.approvalPolicies) {
        if (moneySkills.has(p.skillKey)) {
          expect(p.mode, `${preset.key}:${p.skillKey}`).not.toBe('never');
        }
      }
    }
  });

  it('presets reference only skills that exist and cover every money skill', () => {
    const known = new Set(listSkills().map((s) => s.key));
    const moneySkills = [...known].filter((k) => listSkills().find((s) => s.key === k)!.handlesMoney);
    for (const preset of POLICY_PRESETS) {
      const covered = new Set(preset.approvalPolicies.map((p) => p.skillKey));
      for (const p of preset.approvalPolicies) expect(known.has(p.skillKey)).toBe(true);
      for (const m of moneySkills) expect(covered.has(m), `${preset.key} covers ${m}`).toBe(true);
    }
  });
});

// --- 2. applying a preset -----------------------------------------------------

describe('applyPolicyPreset', () => {
  it('kanzlei sets the expected policies + grant matrix and audits', async () => {
    const result = await applyPolicyPreset({ orgId: ORG_A, actorUserId: ADMIN_A, presetKey: 'kanzlei' });
    expect(result.failsafeCorrected).toEqual([]);

    const { policies, grants } = await governanceOf(ORG_A);
    expect(policies).toEqual([
      { skillKey: 'angebot_erstellen', mode: 'always', thresholdAmount: null, approverRole: 'lead' },
      { skillKey: 'beleg_kontieren', mode: 'threshold', thresholdAmount: 50, approverRole: 'admin' },
      { skillKey: 'rechnung_erstellen', mode: 'always', thresholdAmount: null, approverRole: 'admin' },
      { skillKey: 'wissen_zusammenfassen', mode: 'never', thresholdAmount: null, approverRole: 'lead' },
    ]);
    expect(grants).toEqual(['confidential:admin', 'restricted:admin', 'restricted:lead']);

    const audit = await withTenant(ORG_A, (tx) =>
      tx.auditLog.findMany({ where: { action: 'policy.changed' } }),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]!.target).toBe('governance:preset:kanzlei');
    expect(audit[0]!.actorId).toBe(ADMIN_A);
  });

  it('is idempotent: applying twice yields the identical state, no duplicates', async () => {
    await applyPolicyPreset({ orgId: ORG_A, actorUserId: ADMIN_A, presetKey: 'handwerk' });
    const first = await governanceOf(ORG_A);
    await applyPolicyPreset({ orgId: ORG_A, actorUserId: ADMIN_A, presetKey: 'handwerk' });
    const second = await governanceOf(ORG_A);
    expect(second).toEqual(first);
  });

  it('switching presets REPLACES the grant matrix declaratively', async () => {
    await applyPolicyPreset({ orgId: ORG_A, actorUserId: ADMIN_A, presetKey: 'handwerk' });
    expect((await governanceOf(ORG_A)).grants).toContain('restricted:member');

    await applyPolicyPreset({ orgId: ORG_A, actorUserId: ADMIN_A, presetKey: 'gesundheitswesen' });
    const { policies, grants } = await governanceOf(ORG_A);
    expect(grants).toEqual(['confidential:admin', 'restricted:admin']); // member grant revoked
    for (const p of policies) {
      expect(p.mode).toBe('always');
      expect(p.approverRole).toBe('admin');
    }
  });

  it('unknown preset key is rejected', async () => {
    await expect(
      applyPolicyPreset({ orgId: ORG_A, actorUserId: ADMIN_A, presetKey: 'startup' }),
    ).rejects.toThrow(/Unknown governance preset/);
  });
});

// --- 3. export / import roundtrip ----------------------------------------------

describe('export / import', () => {
  it('roundtrip: B imports A’s export and ends up with identical governance', async () => {
    await applyPolicyPreset({ orgId: ORG_A, actorUserId: ADMIN_A, presetKey: 'kanzlei' });

    const config = await exportGovernance({ orgId: ORG_A, actorUserId: ADMIN_A });
    expect(config.format).toBe(GOVERNANCE_FORMAT);
    expect(config.version).toBe(GOVERNANCE_VERSION);

    // The export is pure governance: no org ids, no user ids, no secrets.
    const serialized = JSON.stringify(config);
    for (const needle of [ORG_A, ORG_B, ADMIN_A, 'clerkOrgId', 'org_gp_a', 'Preset A']) {
      expect(serialized).not.toContain(needle);
    }

    await importGovernance({ orgId: ORG_B, actorUserId: ADMIN_B, json: serialized });
    expect(await governanceOf(ORG_B)).toEqual(await governanceOf(ORG_A));

    const audit = await withTenant(ORG_B, (tx) =>
      tx.auditLog.findMany({ where: { action: 'policy.changed' } }),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]!.target).toBe('governance:import');
  });

  it('export is audited (policy.exported)', async () => {
    await exportGovernance({ orgId: ORG_A, actorUserId: ADMIN_A });
    const audit = await withTenant(ORG_A, (tx) =>
      tx.auditLog.findMany({ where: { action: 'policy.exported' } }),
    );
    expect(audit).toHaveLength(1);
  });
});

// --- 4. MONEY FAILSAFE on import -------------------------------------------------

describe('money failsafe (import cannot bypass it)', () => {
  it('malicious JSON: money skill "never" is corrected to "always" and audited', async () => {
    const malicious = JSON.stringify({
      format: GOVERNANCE_FORMAT,
      version: GOVERNANCE_VERSION,
      approvalPolicies: [
        { skillKey: 'beleg_kontieren', mode: 'never', thresholdAmount: null, approverRole: 'lead' },
        { skillKey: 'rechnung_erstellen', mode: 'never', thresholdAmount: null, approverRole: 'lead' },
        { skillKey: 'wissen_zusammenfassen', mode: 'never', thresholdAmount: null, approverRole: 'lead' },
      ],
      visibilityGrants: [],
    });

    const result = await importGovernance({ orgId: ORG_A, actorUserId: ADMIN_A, json: malicious });
    expect(result.failsafeCorrected.sort()).toEqual(['beleg_kontieren', 'rechnung_erstellen']);

    const { policies } = await governanceOf(ORG_A);
    const byKey = new Map(policies.map((p) => [p.skillKey, p]));
    // Fail-closed: the money skills end up on 'always', NOT 'never'.
    expect(byKey.get('beleg_kontieren')!.mode).toBe('always');
    expect(byKey.get('rechnung_erstellen')!.mode).toBe('always');
    // The non-money skill keeps its requested 'never' (allowed).
    expect(byKey.get('wissen_zusammenfassen')!.mode).toBe('never');

    // Audited with the SAME action the engine's runtime failsafe uses.
    const audit = await withTenant(ORG_A, (tx) =>
      tx.auditLog.findMany({ where: { action: 'policy.overridden_failsafe' } }),
    );
    expect(audit.map((a) => a.target).sort()).toEqual([
      'governance:beleg_kontieren',
      'governance:rechnung_erstellen',
    ]);
  });

  it('a hand-crafted preset-like config cannot bypass the failsafe either', async () => {
    // applyGovernanceConfig is the shared core — feed it directly via import
    // of a "preset export" to prove there is no preset-only bypass path.
    const config = await exportGovernance({ orgId: ORG_A, actorUserId: ADMIN_A });
    config.approvalPolicies = [
      { skillKey: 'rechnung_erstellen', mode: 'never', thresholdAmount: null, approverRole: 'admin' },
    ];
    const result = await importGovernance({
      orgId: ORG_A,
      actorUserId: ADMIN_A,
      json: JSON.stringify(config),
    });
    expect(result.failsafeCorrected).toEqual(['rechnung_erstellen']);
    const { policies } = await governanceOf(ORG_A);
    expect(policies.find((p) => p.skillKey === 'rechnung_erstellen')!.mode).toBe('always');
  });
});

// --- 5. invalid imports are rejected, nothing written -----------------------------

describe('import validation (fail-closed)', () => {
  const CASES: Array<[string, string, RegExp]> = [
    ['not JSON', 'this is not json', /not valid JSON/],
    ['wrong format', JSON.stringify({ format: 'x', version: 1, approvalPolicies: [], visibilityGrants: [] }), /"format"/],
    ['wrong version', JSON.stringify({ format: GOVERNANCE_FORMAT, version: 99, approvalPolicies: [], visibilityGrants: [] }), /version/],
    ['unknown skill', JSON.stringify({ format: GOVERNANCE_FORMAT, version: 1, approvalPolicies: [{ skillKey: 'evil_skill', mode: 'always', approverRole: 'lead' }], visibilityGrants: [] }), /skillKey is unknown/],
    ['bad mode', JSON.stringify({ format: GOVERNANCE_FORMAT, version: 1, approvalPolicies: [{ skillKey: 'beleg_kontieren', mode: 'sometimes', approverRole: 'lead' }], visibilityGrants: [] }), /mode/],
    ['threshold missing', JSON.stringify({ format: GOVERNANCE_FORMAT, version: 1, approvalPolicies: [{ skillKey: 'beleg_kontieren', mode: 'threshold', approverRole: 'lead' }], visibilityGrants: [] }), /thresholdAmount/],
    ['negative threshold', JSON.stringify({ format: GOVERNANCE_FORMAT, version: 1, approvalPolicies: [{ skillKey: 'beleg_kontieren', mode: 'threshold', thresholdAmount: -5, approverRole: 'lead' }], visibilityGrants: [] }), /thresholdAmount/],
    ['bad approver', JSON.stringify({ format: GOVERNANCE_FORMAT, version: 1, approvalPolicies: [{ skillKey: 'beleg_kontieren', mode: 'always', approverRole: 'member' }], visibilityGrants: [] }), /approverRole/],
    ['bad grant level', JSON.stringify({ format: GOVERNANCE_FORMAT, version: 1, approvalPolicies: [], visibilityGrants: [{ level: 'open', role: 'member' }] }), /level/],
    ['bad grant role', JSON.stringify({ format: GOVERNANCE_FORMAT, version: 1, approvalPolicies: [], visibilityGrants: [{ level: 'restricted', role: 'root' }] }), /role/],
  ];

  it.each(CASES)('%s → rejected, nothing written', async (_name, json, message) => {
    await expect(
      importGovernance({ orgId: ORG_A, actorUserId: ADMIN_A, json }),
    ).rejects.toThrow(message);
    const { policies, grants } = await governanceOf(ORG_A);
    expect(policies).toEqual([]);
    expect(grants).toEqual([]);
  });

  it('parseGovernanceConfig collapses duplicate grants instead of failing', () => {
    const config = parseGovernanceConfig(
      JSON.stringify({
        format: GOVERNANCE_FORMAT,
        version: 1,
        approvalPolicies: [],
        visibilityGrants: [
          { level: 'restricted', role: 'lead' },
          { level: 'restricted', role: 'lead' },
        ],
      }),
    );
    expect(config.visibilityGrants).toEqual([{ level: 'restricted', role: 'lead' }]);
  });
});

// --- 6. admin gate -----------------------------------------------------------------

describe('admin gate', () => {
  it('members are rejected for apply, export and import', async () => {
    await expect(
      applyPolicyPreset({ orgId: ORG_A, actorUserId: MEMBER_A, presetKey: 'kanzlei' }),
    ).rejects.toThrow(/admin required/);
    await expect(
      exportGovernance({ orgId: ORG_A, actorUserId: MEMBER_A }),
    ).rejects.toThrow(/admin required/);
    await expect(
      importGovernance({
        orgId: ORG_A,
        actorUserId: MEMBER_A,
        json: JSON.stringify({
          format: GOVERNANCE_FORMAT, version: 1, approvalPolicies: [], visibilityGrants: [],
        }),
      }),
    ).rejects.toThrow(/admin required/);

    // Nothing was written by any of the attempts.
    const { policies, grants } = await governanceOf(ORG_A);
    expect(policies).toEqual([]);
    expect(grants).toEqual([]);
  });
});

// --- 7. tenant isolation --------------------------------------------------------------

describe('tenant isolation', () => {
  it('applying a preset in A leaves B completely untouched', async () => {
    await applyPolicyPreset({ orgId: ORG_B, actorUserId: ADMIN_B, presetKey: 'handwerk' });
    const bBefore = await governanceOf(ORG_B);

    await applyPolicyPreset({ orgId: ORG_A, actorUserId: ADMIN_A, presetKey: 'gesundheitswesen' });

    expect(await governanceOf(ORG_B)).toEqual(bBefore);
    const bAudit = await withTenant(ORG_B, (tx) =>
      tx.auditLog.findMany({ where: { action: 'policy.changed' } }),
    );
    expect(bAudit).toHaveLength(1); // only B's own preset application
  });
});

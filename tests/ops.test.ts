// =============================================================================
// OPS GATE (Phase 12)
//
//   1. Logger: JSON lines, secrets masked by key AND by value shape; the
//      error reporter hook fires and can never break the caller.
//   2. queryAuditLog: pagination + filters run strictly inside withTenant —
//      no filter can read another tenant's entries; page math correct.
// =============================================================================
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { withTenant } from '../src/lib/tenant';
import { queryAuditLog } from '../src/lib/audit';
import { logError, logInfo, maskSecrets, setErrorReporter } from '../src/lib/log';

const ORG_A = 'adadadad-adad-4dad-8dad-adadadadadad';
const ORG_B = 'aeaeaeae-aeae-4eae-8eae-aeaeaeaeaeae';

const admin = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });

const ALL_TABLES = ['organizations', 'memberships', 'knowledge_items', 'audit_log'];

async function reset() {
  await admin.$executeRawUnsafe(
    `TRUNCATE ${ALL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

beforeAll(async () => {
  await reset();
});

afterAll(async () => {
  setErrorReporter(null);
  await reset();
  await prisma.$disconnect();
  await admin.$disconnect();
});

beforeEach(async () => {
  await reset();
  for (const [orgId, clerk, name] of [
    [ORG_A, 'org_ops_a', 'Ops A'],
    [ORG_B, 'org_ops_b', 'Ops B'],
  ] as const) {
    await withTenant(orgId, (tx) =>
      tx.organization.create({ data: { id: orgId, clerkOrgId: clerk, name } }),
    );
  }
});

// --- 1. logger -------------------------------------------------------------------

describe('structured logger', () => {
  it('masks secrets by key name and by value shape, recursively', () => {
    const masked = maskSecrets({
      botToken: 'xoxb-123',
      nested: { CLERK_WEBHOOK_SECRET: 'whsec_abc', ok: 'sichtbar' },
      list: ['xoxp-999', 'harmlos'],
      authorization: 'Bearer abc',
      count: 3,
    }) as Record<string, unknown>;

    expect(masked.botToken).toBe('[redacted]');
    expect((masked.nested as Record<string, unknown>).CLERK_WEBHOOK_SECRET).toBe('[redacted]');
    expect((masked.nested as Record<string, unknown>).ok).toBe('sichtbar');
    expect((masked.list as unknown[])[0]).toBe('[redacted]'); // xox… by shape
    expect((masked.list as unknown[])[1]).toBe('harmlos');
    expect(masked.authorization).toBe('[redacted]');
    expect(masked.count).toBe(3);
  });

  it('emits one JSON line and never leaks the raw secret', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logInfo('slack message posted', { orgId: ORG_A, token: 'xoxb-super-geheim' });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.msg).toBe('slack message posted');
    expect(line).not.toContain('xoxb-super-geheim');
    spy.mockRestore();
  });

  it('logError forwards to the reporter; a broken reporter never throws', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reported: unknown[] = [];
    setErrorReporter((err) => {
      reported.push(err);
    });
    logError('boom happened', new Error('boom'), { orgId: ORG_A });
    expect(reported).toHaveLength(1);

    setErrorReporter(() => {
      throw new Error('reporter kaputt');
    });
    expect(() => logError('again', new Error('x'))).not.toThrow();
    setErrorReporter(null);
    errSpy.mockRestore();
  });
});

// --- 2. audit query -----------------------------------------------------------------

describe('queryAuditLog (tenant-bound pagination + filters)', () => {
  it('paginates newest-first and filters by prefix and actor — own tenant only', async () => {
    await withTenant(ORG_A, async (tx) => {
      for (let i = 0; i < 5; i++) {
        await tx.auditLog.create({
          data: { orgId: ORG_A, actorId: 'alice', actorType: 'human', action: `skill.step_${i}` },
        });
      }
      await tx.auditLog.create({
        data: { orgId: ORG_A, actorId: 'bob', actorType: 'human', action: 'policy.changed' },
      });
    });
    await withTenant(ORG_B, (tx) =>
      tx.auditLog.create({
        data: { orgId: ORG_B, actorId: 'alice', actorType: 'human', action: 'skill.step_b' },
      }),
    );

    // Prefix filter + pagination.
    const page1 = await queryAuditLog(ORG_A, { actionPrefixes: ['skill.'], page: 1, pageSize: 2 });
    expect(page1.total).toBe(5); // B's skill entry is invisible
    expect(page1.entries).toHaveLength(2);
    const page3 = await queryAuditLog(ORG_A, { actionPrefixes: ['skill.'], page: 3, pageSize: 2 });
    expect(page3.entries).toHaveLength(1);

    // Actor filter stays inside the tenant: 'alice' exists in B too.
    const alice = await queryAuditLog(ORG_A, { actorId: 'alice' });
    expect(alice.total).toBe(5);
    expect(alice.entries.every((e) => e.orgId === ORG_A)).toBe(true);

    // No filters ⇒ everything of A, nothing of B.
    const all = await queryAuditLog(ORG_A);
    expect(all.total).toBe(6);
  });

  it('clamps page and pageSize defensively', async () => {
    const result = await queryAuditLog(ORG_A, { page: -5, pageSize: 100_000 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(200);
  });
});

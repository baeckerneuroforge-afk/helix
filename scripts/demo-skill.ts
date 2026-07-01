// =============================================================================
// `pnpm demo:skill` — die Skill-Engine end-to-end, OHNE Auth/HTTP.
//
// Zeigt den Kern-Mechanismus (Guardrail → menschliche Freigabe → Audit) am
// Skill `beleg_kontieren` in drei Durchläufen:
//   1. 240 €   → läuft glatt durch bis completed (keine Freigabe nötig)
//   2. 1.240 € → pausiert awaiting_approval → approve() → completed
//   3. 1.240 € → pausiert awaiting_approval → reject()  → rejected,
//                der "verbucht"-Schritt passiert NICHT
// Am Ende wird die lückenlose Audit-Kette des Freigabe-Falls ausgegeben.
//
// Wie demo-rag.ts: läuft über withTenant direkt (Seed-Muster, fixe Demo-Org),
// kein Auth-Bypass, Middleware/Session bleiben unberührt.
// =============================================================================
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { withTenant } from '../src/lib/tenant';
import { approve, reject, startRun } from '../src/lib/skills';

const DEMO_ORG = '66666666-6666-4666-8666-666666666666';
const APPROVER = 'demo-cfo';

async function showRun(runId: string, label: string) {
  const { run, steps, approvals } = await withTenant(DEMO_ORG, async (tx) => ({
    run: await tx.skillRun.findUniqueOrThrow({ where: { id: runId } }),
    steps: await tx.skillStep.findMany({ where: { runId }, orderBy: { idx: 'asc' } }),
    approvals: await tx.approval.findMany({ where: { runId }, orderBy: { createdAt: 'asc' } }),
  }));

  console.log(`\n— ${label}`);
  console.log(`   Run ${run.id.slice(0, 8)}… [${run.skillKey}] → status: ${run.status}`);
  for (const s of steps) {
    console.log(`   Step ${s.idx}: ${s.name} (${s.status})`);
  }
  for (const a of approvals) {
    const decided = a.decidedBy ? ` von ${a.decidedBy}` : '';
    console.log(`   Freigabe: ${a.status}${decided} — Grund: ${a.reason}`);
  }
  const verbucht = steps.some((s) => s.name === 'verbucht' && s.status === 'done');
  console.log(`   Verbucht? ${verbucht ? 'JA' : 'NEIN'}`);
}

async function main() {
  // Demo-Org (idempotent, Seed-Muster).
  await withTenant(DEMO_ORG, async (tx) => {
    await tx.organization.upsert({
      where: { id: DEMO_ORG },
      create: { id: DEMO_ORG, clerkOrgId: 'demo_org_skill', name: 'Demo Org Skill' },
      update: {},
    });
  });

  // ── 1) 240 € — unter der Guardrail, läuft glatt durch ──────────────────────
  const smooth = await startRun(DEMO_ORG, 'beleg_kontieren', {
    beschreibung: 'Bahnticket München–Berlin',
    betragEur: 240,
    belegNummer: 'B-2026-0101',
  });
  await showRun(smooth.runId, 'Durchlauf 1: 240 € (keine Freigabe nötig)');

  // ── 2) 1.240 € — Guardrail pausiert, dann Freigabe ─────────────────────────
  const gated = await startRun(DEMO_ORG, 'beleg_kontieren', {
    beschreibung: 'Softwarelizenz Jahresvertrag',
    betragEur: 1240,
    belegNummer: 'B-2026-0102',
  });
  await showRun(gated.runId, 'Durchlauf 2a: 1.240 € — pausiert an der Guardrail');
  if (gated.status !== 'awaiting_approval') {
    throw new Error(`DEMO FAILED: expected awaiting_approval, got ${gated.status}`);
  }

  const resumed = await approve(DEMO_ORG, gated.runId, APPROVER);
  await showRun(gated.runId, `Durchlauf 2b: nach approve() durch ${APPROVER}`);
  if (resumed.status !== 'completed') {
    throw new Error(`DEMO FAILED: expected completed after approve, got ${resumed.status}`);
  }

  // ── 3) 1.240 € — Guardrail pausiert, dann Ablehnung ────────────────────────
  const denied = await startRun(DEMO_ORG, 'beleg_kontieren', {
    beschreibung: 'Bewirtung Team-Offsite',
    betragEur: 1240,
    belegNummer: 'B-2026-0103',
  });
  const rejected = await reject(DEMO_ORG, denied.runId, APPROVER);
  await showRun(denied.runId, `Durchlauf 3: 1.240 € — reject() durch ${APPROVER}`);
  if (rejected.status !== 'rejected') {
    throw new Error(`DEMO FAILED: expected rejected, got ${rejected.status}`);
  }

  // ── Audit-Kette des Freigabe-Falls ─────────────────────────────────────────
  const audit = await withTenant(DEMO_ORG, (tx) =>
    tx.auditLog.findMany({
      where: { target: { contains: gated.runId } },
      orderBy: { createdAt: 'asc' },
    }),
  );
  const stepAudits = await withTenant(DEMO_ORG, (tx) =>
    tx.auditLog.findMany({
      where: { action: 'skill.step_completed' },
      orderBy: { createdAt: 'asc' },
    }),
  );
  console.log('\n🧾  Audit-Kette (Durchlauf 2, append-only):');
  for (const a of audit) {
    console.log(`    ${a.createdAt.toISOString()}  ${a.actorType}/${a.actorId}  ${a.action}`);
  }
  console.log(`    (+ ${stepAudits.length} × skill.step_completed über alle Durchläufe)`);

  console.log(
    '\n✅  Demo erfolgreich: glatter Durchlauf, Guardrail-Pause → approve → completed,' +
      ' reject → rejected ohne Verbuchung.',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

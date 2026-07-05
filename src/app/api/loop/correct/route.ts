// POST /api/loop/correct — start a correction run for a flag's proposal.
//
// PROTECTED route (NOT in the middleware public list): Clerk requires a signed-in
// user with an active org before this handler runs, and requireTenant() re-derives
// the tenant from the VERIFIED session — never from the body. The body only names
// WHICH correction to run (skillKey + sourceRunId, straight from the flag's
// correction ref); it can never widen the tenant.
//
// The actual work — load the original run's input, re-run the same skill through
// the NORMAL approval gate — lives in startCorrectionRun() (src/lib/loop/correct.ts)
// so it is shared with the Slack button and stays unit-testable. The loop can
// START a correction here but NEVER approves it: a gated skill pauses at
// awaiting_approval for a human, exactly like a hand-started run.
import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-context';
import { CorrectionBadRequestError, startCorrectionRun } from '@/lib/loop/correct';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const { orgId, userId } = await requireTenant();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { skillKey, sourceRunId } = (body ?? {}) as {
    skillKey?: unknown;
    sourceRunId?: unknown;
  };
  if (typeof skillKey !== 'string' || !skillKey.trim()) {
    return NextResponse.json({ error: 'skillKey is required.' }, { status: 400 });
  }
  if (typeof sourceRunId !== 'string' || !sourceRunId.trim()) {
    return NextResponse.json({ error: 'sourceRunId is required.' }, { status: 400 });
  }

  try {
    const result = await startCorrectionRun({ orgId, actorUserId: userId, skillKey, sourceRunId });
    // 202: the correction was started. It may be awaiting approval (the normal
    // outcome for a gated skill) — the client shows the run either way.
    return NextResponse.json(
      {
        ok: true,
        runId: result.runId,
        status: result.status,
        awaitingApproval: result.awaitingApproval,
      },
      { status: 202 },
    );
  } catch (err) {
    // A bad client-supplied ref (unknown skill / foreign-or-missing source run)
    // is a 400 with a safe message. Anything else is a 500 — logged, no leak.
    if (err instanceof CorrectionBadRequestError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    logError('loop correction failed', err, { orgId });
    return NextResponse.json({ error: 'Correction failed.' }, { status: 500 });
  }
}

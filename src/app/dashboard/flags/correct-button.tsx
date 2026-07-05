'use client';

// "Start correction" — the /flags-page trigger for a flag's proposal (autonomy
// 'suggest'). It POSTs the flag's correction ref to /api/loop/correct, which
// re-runs the same skill with the same inputs THROUGH the normal approval gate.
// The button never approves anything; on success it navigates to the new run so
// the human lands on the approval (if one is required).
//
// Rendered ONLY when the flag carries a re-runnable correction (see toFlagView /
// FlagView.correction). Under 'report' the flag has no correction and this
// button never appears — the page passes it nothing to render.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDict } from '@/lib/i18n/client';
import type { FlagCorrection } from '@/lib/loop/flags-view';

type Result = { kind: 'ok'; runId: string; awaiting: boolean } | { kind: 'error' };

export function CorrectButton({ correction }: { correction: FlagCorrection }) {
  const router = useRouter();
  const f = useDict().flags;
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function start() {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/loop/correct', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            skillKey: correction.skillKey,
            sourceRunId: correction.sourceRunId,
          }),
        });
        if (!res.ok) {
          setResult({ kind: 'error' });
          return;
        }
        const data = (await res.json()) as { runId?: string; awaitingApproval?: boolean };
        if (!data.runId) {
          setResult({ kind: 'error' });
          return;
        }
        setResult({ kind: 'ok', runId: data.runId, awaiting: Boolean(data.awaitingApproval) });
        // Land the human on the new run — the approval, if any, is there.
        router.push(`/dashboard/runs/${data.runId}`);
      } catch {
        setResult({ kind: 'error' });
      }
    });
  }

  return (
    <div style={{ marginTop: '0.35rem' }}>
      <button
        type="button"
        className="btn btn--primary select--inline"
        onClick={start}
        disabled={isPending}
      >
        {isPending ? f.startingCorrection : f.startCorrection}
      </button>
      {result?.kind === 'ok' ? (
        <div className="row-meta" style={{ marginTop: '0.3rem' }}>
          {result.awaiting ? f.correctionStarted : f.correctionStartedNoGate}
        </div>
      ) : null}
      {result?.kind === 'error' ? (
        <div className="row-meta" style={{ marginTop: '0.3rem', color: '#c0392b' }}>
          {f.correctionFailed}
        </div>
      ) : null}
    </div>
  );
}

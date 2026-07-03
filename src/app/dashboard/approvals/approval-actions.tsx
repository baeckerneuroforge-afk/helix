'use client';

import { useDict } from '@/lib/i18n/client';
import { approveRun, rejectRun } from './actions';

/**
 * Approve/Reject with a native confirmation dialog. The buttons are only
 * a convenience gate — the real role check lives in the engine's decide().
 */
export function ApprovalActions({
  runId,
  canDecide,
  requiredRole,
}: {
  runId: string;
  canDecide: boolean;
  requiredRole: string | null;
}) {
  const a = useDict().approvals;
  const tooltip = !canDecide && requiredRole ? a.requiresRole(requiredRole) : undefined;

  return (
    <div className="approval-actions">
      <form
        action={approveRun}
        onSubmit={(e) => {
          if (!window.confirm(a.confirmApprove)) e.preventDefault();
        }}
      >
        <input type="hidden" name="runId" value={runId} />
        <span title={tooltip}>
          <button type="submit" className="btn btn--primary" disabled={!canDecide}>
            {a.approve}
          </button>
        </span>
      </form>
      <form
        action={rejectRun}
        onSubmit={(e) => {
          if (!window.confirm(a.confirmReject)) e.preventDefault();
        }}
      >
        <input type="hidden" name="runId" value={runId} />
        <span title={tooltip}>
          <button type="submit" className="btn btn--ghost" disabled={!canDecide}>
            {a.reject}
          </button>
        </span>
      </form>
    </div>
  );
}

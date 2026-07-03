import Link from 'next/link';
import { requireTenant } from '@/lib/auth-context';
import { roleSatisfies } from '@/lib/policies';
import { withTenant } from '@/lib/tenant';
import { ApprovalStatusChip, amountOfInput, formatDateTime, formatEuro } from '../ui';
import { ApprovalActions } from './approval-actions';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const { orgId, role } = await requireTenant();

  const { pending, decided } = await withTenant(orgId, async (tx) => ({
    pending: await tx.approval.findMany({
      where: { status: 'pending' },
      include: { run: true },
      orderBy: { createdAt: 'asc' },
    }),
    decided: await tx.approval.findMany({
      where: { status: { not: 'pending' } },
      include: { run: true },
      orderBy: { decidedAt: 'desc' },
      take: 20,
    }),
  }));

  return (
    <>
      {pending.length === 0 ? (
        <div className="empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 12l2 2 4-4M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z" />
          </svg>
          <strong>Keine wartenden Freigaben</strong>
          <span>Alles entschieden — sobald ein Skill eine menschliche Freigabe braucht, erscheint sie hier.</span>
        </div>
      ) : (
        pending.map((approval) => {
          const amount = amountOfInput(approval.run.input);
          // Buttons follow the engine's rule: a required_role gates the
          // decision (admin/owner always qualify); no required_role = open.
          const canDecide = approval.requiredRole
            ? roleSatisfies(role, approval.requiredRole)
            : true;
          return (
            <section className="card approval-card" key={approval.id}>
              <div className="approval-head">
                <div>
                  <strong>
                    <span className="mono">{approval.run.skillKey}</span>
                  </strong>
                  <div className="row-meta">
                    angefordert {formatDateTime(approval.createdAt)} ·{' '}
                    <Link href={`/dashboard/runs/${approval.runId}`}>
                      Run <span className="mono">{approval.runId.slice(0, 8)}…</span>
                    </Link>
                  </div>
                </div>
                {amount !== null ? (
                  <span className="approval-amount">{formatEuro(amount)}</span>
                ) : null}
              </div>
              <div>
                <span className="chip chip--amber">wartet auf Freigabe</span>{' '}
                {approval.requiredRole ? (
                  <span className="chip">Rolle: {approval.requiredRole}</span>
                ) : null}
              </div>
              <div>Grund: {approval.reason}</div>
              <ApprovalActions
                runId={approval.runId}
                canDecide={canDecide}
                requiredRole={approval.requiredRole}
              />
            </section>
          );
        })
      )}

      {decided.length > 0 ? (
        <section className="card card--table">
          <div className="card-title">
            <h2>Entschieden</h2>
            <span className="row-meta">letzte {decided.length}</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Status</th>
                <th>Entschieden von</th>
                <th>Am</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((approval) => (
                <tr key={approval.id}>
                  <td>
                    <Link href={`/dashboard/runs/${approval.runId}`}>
                      <span className="mono">{approval.run.skillKey}</span>
                    </Link>
                    <div className="row-meta">{approval.reason}</div>
                  </td>
                  <td>
                    <ApprovalStatusChip status={approval.status} />
                  </td>
                  <td className="mono row-meta">{approval.decidedBy ?? '—'}</td>
                  <td className="mono row-meta" style={{ whiteSpace: 'nowrap' }}>
                    {approval.decidedAt ? formatDateTime(approval.decidedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}

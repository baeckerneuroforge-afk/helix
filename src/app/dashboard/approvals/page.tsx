import Link from 'next/link';
import { requireTenant } from '@/lib/auth-context';
import { getI18n } from '@/lib/i18n/server';
import { roleSatisfies } from '@/lib/policies';
import { withTenant } from '@/lib/tenant';
import { ApprovalStatusChip, amountOfInput, formatDateTime, formatEuro } from '../ui';
import { ApprovalActions } from './approval-actions';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const { orgId, role } = await requireTenant();
  const { locale, t } = await getI18n();
  const a = t.approvals;

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
      <p className="page-intro">{a.intro}</p>

      {pending.length === 0 ? (
        <div className="empty">{a.empty}</div>
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
                    {a.requestedAt} {formatDateTime(approval.createdAt, locale)} ·{' '}
                    <Link href={`/dashboard/runs/${approval.runId}`}>
                      {a.run} <span className="mono">{approval.runId.slice(0, 8)}…</span>
                    </Link>
                  </div>
                </div>
                {amount !== null ? (
                  <span className="approval-amount">{formatEuro(amount, locale)}</span>
                ) : null}
              </div>
              <div>
                <span className="chip chip--amber">{a.awaiting}</span>{' '}
                {approval.requiredRole ? (
                  <span className="chip">{a.roleChip(approval.requiredRole)}</span>
                ) : null}
              </div>
              <div>{a.reason} {approval.reason}</div>
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
          <h2 style={{ padding: '0.8rem 1.25rem 0' }}>{a.decided}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>{t.common.skill}</th>
                <th>{t.common.status}</th>
                <th>{a.decidedBy}</th>
                <th>{a.decidedAt}</th>
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
                    <ApprovalStatusChip status={approval.status} locale={locale} />
                  </td>
                  <td className="mono row-meta">{approval.decidedBy ?? '—'}</td>
                  <td className="mono row-meta" style={{ whiteSpace: 'nowrap' }}>
                    {approval.decidedAt ? formatDateTime(approval.decidedAt, locale) : '—'}
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

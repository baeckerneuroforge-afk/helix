import Link from 'next/link';
import { requireTenant } from '@/lib/auth-context';
import { withTenant } from '@/lib/tenant';
import { RunStatusChip, amountOfInput, formatDateTime, formatEuro } from '../ui';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const { orgId } = await requireTenant();

  // select: the list never shows `result` (can be a large JSON blob) — don't
  // pull 100 of them over the wire for a table of four columns.
  const runs = await withTenant(orgId, (tx) =>
    tx.skillRun.findMany({
      select: { id: true, skillKey: true, status: true, input: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  );

  return (
    <>
      <section className="card card--table">
        {runs.length === 0 ? (
          <div className="empty" style={{ margin: '1rem 1.3rem' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 22a10 10 0 1 0-10-10M2 22l5-5M2 17v5h5" />
            </svg>
            <strong>Noch keine Ausführungen</strong>
            <span>
              Starte einen Skill unter <Link href="/dashboard/skills">Skills</Link> — jeder Lauf
              erscheint hier mit Status und Schritt-Timeline.
            </span>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Betrag</th>
                <th>Status</th>
                <th>Gestartet am</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const amount = amountOfInput(run.input);
                return (
                  <tr key={run.id}>
                    <td>
                      <Link href={`/dashboard/runs/${run.id}`}>
                        <span className="mono">{run.skillKey}</span>
                      </Link>
                      <div className="row-meta mono">{run.id.slice(0, 8)}…</div>
                    </td>
                    <td className="mono">{amount !== null ? formatEuro(amount) : '—'}</td>
                    <td>
                      <RunStatusChip status={run.status} />
                    </td>
                    <td className="mono row-meta" style={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(run.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

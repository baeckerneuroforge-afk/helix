import Link from 'next/link';
import { requireTenant } from '@/lib/auth-context';
import { getI18n } from '@/lib/i18n/server';
import { withTenant } from '@/lib/tenant';
import { RunStatusChip, amountOfInput, formatDateTime, formatEuro } from '../ui';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const { orgId } = await requireTenant();
  const { locale, t } = await getI18n();

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
      <p className="page-intro">{t.runs.intro}</p>

      <section className="card card--table">
        {runs.length === 0 ? (
          <p className="muted" style={{ padding: '0.8rem 1.25rem' }}>
            {t.runs.noRuns} <Link href="/dashboard/skills">{t.nav.skills}</Link>.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t.common.skill}</th>
                <th>{t.common.amount}</th>
                <th>{t.common.status}</th>
                <th>{t.runs.startedAt}</th>
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
                    <td className="mono">{amount !== null ? formatEuro(amount, locale) : '—'}</td>
                    <td>
                      <RunStatusChip status={run.status} locale={locale} />
                    </td>
                    <td className="mono row-meta" style={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(run.createdAt, locale)}
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

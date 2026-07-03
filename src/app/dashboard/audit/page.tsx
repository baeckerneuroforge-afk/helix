import Link from 'next/link';
import { queryAuditLog } from '@/lib/audit';
import { requireTenant } from '@/lib/auth-context';
import { getI18n } from '@/lib/i18n/server';
import { ActorChip, JsonView, formatDateTime } from '../ui';

export const dynamic = 'force-dynamic';

// Category → action prefixes; the actual query runs through queryAuditLog()
// (withTenant + pagination) so a filter can never widen the tenant scope.
// Keys are stable URL identifiers ('all' + technical categories, not
// translated — bookmarks keep working across languages).
const FILTERS: Record<string, { prefixes: string[] }> = {
  all: { prefixes: [] },
  skill: { prefixes: ['skill.', 'guardrail.', 'approval.'] },
  policy: { prefixes: ['policy.'] },
  chat: { prefixes: ['chat.'] },
  slack: { prefixes: ['slack.'] },
  lifecycle: { prefixes: ['document.', 'knowledge.', 'org.', 'audit.', 'membership.'] },
};

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; actor?: string; p?: string }>;
}) {
  const { f, actor, p } = await searchParams;
  const active = f && f in FILTERS ? f : 'all';
  const actorFilter = (actor ?? '').trim();
  const page = Math.max(1, Number.parseInt(p ?? '1', 10) || 1);

  const { orgId } = await requireTenant();
  const { locale, t } = await getI18n();
  const au = t.audit;
  const result = await queryAuditLog(orgId, {
    actionPrefixes: FILTERS[active]!.prefixes,
    actorId: actorFilter || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const entries = result.entries;
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (active !== 'all') params.set('f', active);
    if (actorFilter) params.set('actor', actorFilter);
    if (target > 1) params.set('p', String(target));
    const qs = params.toString();
    return qs ? `/dashboard/audit?${qs}` : '/dashboard/audit';
  };

  return (
    <>
      <p className="audit-note">
        {au.note} ({au.entryCount(result.total)}
        {actorFilter ? au.forActor(actorFilter) : ''})
      </p>

      <div className="filter-chips">
        {Object.keys(FILTERS).map((key) => (
          <Link
            key={key}
            href={key === 'all' ? '/dashboard/audit' : `/dashboard/audit?f=${key}`}
            className={`filter-chip${active === key ? ' active' : ''}`}
          >
            {key === 'all' ? au.filterAll : key}
          </Link>
        ))}
        <form method="GET" action="/dashboard/audit" style={{ display: 'inline-block', marginLeft: '0.6rem' }}>
          {active !== 'all' ? <input type="hidden" name="f" value={active} /> : null}
          <input
            name="actor"
            placeholder={au.actorPlaceholder}
            defaultValue={actorFilter}
            className="select--inline"
            style={{ width: '14rem' }}
          />{' '}
          <button type="submit" className="btn btn--ghost select--inline">
            {au.filter}
          </button>
        </form>
      </div>

      <section className="card card--table">
        {entries.length === 0 ? (
          <p className="muted" style={{ padding: '0.8rem 1.25rem' }}>
            {au.noEntries}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t.common.time}</th>
                <th>{au.event}</th>
                <th>{au.actor}</th>
                <th>{t.common.detail}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="mono row-meta" style={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(entry.createdAt, locale)}
                  </td>
                  <td>
                    <span className="mono">{entry.action}</span>
                    {entry.target ? <div className="row-meta">{entry.target}</div> : null}
                  </td>
                  <td>
                    <ActorChip actorType={entry.actorType} locale={locale} />
                    <div className="row-meta mono">{entry.actorId}</div>
                  </td>
                  <td>
                    {entry.detail != null ? (
                      <details className="json-details">
                        <summary>{t.common.expand}</summary>
                        <JsonView value={entry.detail} />
                      </details>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {totalPages > 1 ? (
        <div className="filter-chips" style={{ marginTop: '0.6rem' }}>
          {page > 1 ? (
            <Link className="filter-chip" href={pageHref(page - 1)}>
              {au.newer}
            </Link>
          ) : null}
          <span className="row-meta">{au.page(page, totalPages)}</span>
          {page < totalPages ? (
            <Link className="filter-chip" href={pageHref(page + 1)}>
              {au.older}
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

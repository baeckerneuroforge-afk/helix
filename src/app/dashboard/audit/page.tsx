import Link from 'next/link';
import { queryAuditLog } from '@/lib/audit';
import { requireTenant } from '@/lib/auth-context';
import { ActorChip, JsonView, formatDateTime } from '../ui';

export const dynamic = 'force-dynamic';

// Category → action prefixes; the actual query runs through queryAuditLog()
// (withTenant + pagination) so a filter can never widen the tenant scope.
const FILTERS: Record<string, { label: string; prefixes: string[] }> = {
  alle: { label: 'alle', prefixes: [] },
  skill: { label: 'skill', prefixes: ['skill.', 'guardrail.', 'approval.'] },
  policy: { label: 'policy', prefixes: ['policy.'] },
  chat: { label: 'chat', prefixes: ['chat.'] },
  slack: { label: 'slack', prefixes: ['slack.'] },
  lifecycle: { label: 'lifecycle', prefixes: ['document.', 'knowledge.', 'org.', 'audit.', 'membership.'] },
};

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; actor?: string; p?: string }>;
}) {
  const { f, actor, p } = await searchParams;
  const active = f && f in FILTERS ? f : 'alle';
  const actorFilter = (actor ?? '').trim();
  const page = Math.max(1, Number.parseInt(p ?? '1', 10) || 1);

  const { orgId } = await requireTenant();
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
    if (active !== 'alle') params.set('f', active);
    if (actorFilter) params.set('actor', actorFilter);
    if (target > 1) params.set('p', String(target));
    const qs = params.toString();
    return qs ? `/dashboard/audit?${qs}` : '/dashboard/audit';
  };

  return (
    <>
      <p className="audit-note">
        Append-only — Einträge können nicht verändert oder gelöscht werden.
        ({result.total} Einträge{actorFilter ? ` für Akteur ${actorFilter}` : ''})
      </p>

      <div className="filter-chips">
        {Object.entries(FILTERS).map(([key, { label }]) => (
          <Link
            key={key}
            href={key === 'alle' ? '/dashboard/audit' : `/dashboard/audit?f=${key}`}
            className={`filter-chip${active === key ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
        <form method="GET" action="/dashboard/audit" style={{ display: 'inline-block', marginLeft: '0.6rem' }}>
          {active !== 'alle' ? <input type="hidden" name="f" value={active} /> : null}
          <input
            name="actor"
            placeholder="Akteur, z. B. slack:U…"
            defaultValue={actorFilter}
            className="select--inline"
            style={{ width: '14rem' }}
          />{' '}
          <button type="submit" className="btn btn--ghost select--inline">
            Filtern
          </button>
        </form>
      </div>

      <section className="card card--table">
        {entries.length === 0 ? (
          <p className="muted" style={{ padding: '0.8rem 1.25rem' }}>
            Keine Einträge für diesen Filter.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Event</th>
                <th>Akteur</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="mono row-meta" style={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td>
                    <span className="mono">{entry.action}</span>
                    {entry.target ? <div className="row-meta">{entry.target}</div> : null}
                  </td>
                  <td>
                    <ActorChip actorType={entry.actorType} />
                    <div className="row-meta mono">{entry.actorId}</div>
                  </td>
                  <td>
                    {entry.detail != null ? (
                      <details className="json-details">
                        <summary>aufklappen</summary>
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
              ← neuere
            </Link>
          ) : null}
          <span className="row-meta">
            Seite {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link className="filter-chip" href={pageHref(page + 1)}>
              ältere →
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

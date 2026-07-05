import Link from 'next/link';
import { queryAuditLog } from '@/lib/audit';
import { requireTenant } from '@/lib/auth-context';
import { getI18n } from '@/lib/i18n/server';
import { toFlagView } from '@/lib/loop/flags-view';
import { JsonView, formatDateTime } from '../ui';
import { CategoryChip, DeviationSummary, FlagSourceLink, SeverityChip } from './flag-cells';
import { CorrectButton } from './correct-button';

export const dynamic = 'force-dynamic';

// Flags are append-only audit rows whose action starts with 'flag.' (see
// loop-implementierungsplan.md §5, Stufe A). Reading them through
// queryAuditLog keeps the query inside withTenant — RLS-scoped, so this view
// can never widen beyond the caller's tenant.
const FLAG_PREFIX = 'flag.';
const PAGE_SIZE = 50;

export default async function FlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const page = Math.max(1, Number.parseInt(p ?? '1', 10) || 1);

  const { orgId } = await requireTenant();
  const { locale, t } = await getI18n();
  const f = t.flags;

  const result = await queryAuditLog(orgId, {
    actionPrefixes: [FLAG_PREFIX],
    page,
    pageSize: PAGE_SIZE,
  });
  const flags = result.entries.map(toFlagView);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const pageHref = (target: number) =>
    target > 1 ? `/dashboard/flags?p=${target}` : '/dashboard/flags';

  return (
    <>
      <p className="audit-note">
        {f.note} ({f.entryCount(result.total)})
      </p>

      {flags.length === 0 ? (
        <div className="empty">
          <h3>{f.emptyTitle}</h3>
          <p>{f.emptyBody}</p>
        </div>
      ) : (
        <section className="card card--table">
          <table className="table">
            <thead>
              <tr>
                <th>{f.time}</th>
                <th>{f.flag}</th>
                <th>{f.severity}</th>
                <th>{f.deviation}</th>
                <th>{f.source}</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((view) => (
                <tr key={view.id}>
                  <td className="mono row-meta" style={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(view.createdAt, locale)}
                  </td>
                  <td>
                    <CategoryChip view={view} locale={locale} />
                    <div className="row-meta mono">{view.action}</div>
                    {view.suggestedAction ? (
                      <div className="row-meta">
                        <span className="chip chip--gray">{f.suggested}</span>{' '}
                        {view.suggestedAction}
                      </div>
                    ) : null}
                    {view.correction ? <CorrectButton correction={view.correction} /> : null}
                  </td>
                  <td>
                    <SeverityChip view={view} locale={locale} />
                    {view.deviations.length > 1 ? (
                      <div className="row-meta">{f.deviationCount(view.deviations.length)}</div>
                    ) : null}
                  </td>
                  <td>
                    <DeviationSummary view={view} locale={locale} max={3} />
                    {view.raw != null ? (
                      <details className="json-details">
                        <summary>{t.common.expand}</summary>
                        <JsonView value={view.raw} />
                      </details>
                    ) : null}
                  </td>
                  <td>
                    <FlagSourceLink view={view} locale={locale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {totalPages > 1 ? (
        <div className="filter-chips" style={{ marginTop: '0.6rem' }}>
          {page > 1 ? (
            <Link className="filter-chip" href={pageHref(page - 1)}>
              {t.audit.newer}
            </Link>
          ) : null}
          <span className="row-meta">{t.audit.page(page, totalPages)}</span>
          {page < totalPages ? (
            <Link className="filter-chip" href={pageHref(page + 1)}>
              {t.audit.older}
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// Shared, server-renderable presentation atoms for flags — used by both the
// /flags page and the cockpit "Loop & Flags" panel so the two stay in visual
// and semantic lockstep. Pure display: they take an already-projected FlagView
// (see src/lib/loop/flags-view.ts) and the caller's locale. No data access.
//
// Chip colors follow the design-system semantics (globals.css): amber = waits
// for a human / deviation, red = failure/critical, gray = neutral/info.
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { getDictionary } from '@/lib/i18n';
import { severityChipClass, type FlagDeviation, type FlagView } from '@/lib/loop/flags-view';

export function SeverityChip({ view, locale }: { view: FlagView; locale: Locale }) {
  const f = getDictionary(locale).flags;
  return (
    <span className={`chip chip--dot ${severityChipClass(view.severity)}`}>
      {f.severityLabel[view.severity]}
    </span>
  );
}

export function CategoryChip({ view, locale }: { view: FlagView; locale: Locale }) {
  const f = getDictionary(locale).flags;
  const label = f.category[view.category];
  // Deliverable type ('framework') sharpens the category when we have it.
  const suffix = view.type ? ` · ${view.type}` : '';
  return <span className="chip chip--indigo">{`${label}${suffix}`}</span>;
}

/** One deviation rendered as "criterion  target → actual". Compact, mono. */
function DeviationLine({ dev, locale }: { dev: FlagDeviation; locale: Locale }) {
  const f = getDictionary(locale).flags;
  return (
    <div className="flag-dev">
      {dev.key ? <span className="mono flag-dev-key">{dev.key}</span> : null}
      {dev.expected != null || dev.actual != null ? (
        <span className="row-meta mono flag-dev-nums">
          {f.expected} {dev.expected ?? '—'} · {f.actual}{' '}
          <strong>{dev.actual ?? '—'}</strong>
        </span>
      ) : dev.message ? (
        <span className="row-meta">{dev.message}</span>
      ) : null}
    </div>
  );
}

/**
 * The deviation cell. Shows the first deviation in full and, when a flag bundles
 * several violated criteria, a "+N more" hint. `max` caps how many are shown
 * inline (cockpit passes 1 for a tight panel; the table passes more).
 */
export function DeviationSummary({
  view,
  locale,
  max = 2,
}: {
  view: FlagView;
  locale: Locale;
  max?: number;
}) {
  const f = getDictionary(locale).flags;
  if (view.deviations.length === 0) {
    // No structured deviation (unknown/future flag shape) — stay honest.
    return <span className="muted">—</span>;
  }
  const shown = view.deviations.slice(0, max);
  const rest = view.deviations.length - shown.length;
  return (
    <div className="flag-devs">
      {shown.map((dev, i) => (
        <DeviationLine key={dev.key ?? i} dev={dev} locale={locale} />
      ))}
      {rest > 0 ? <span className="row-meta">{f.moreDeviations(rest)}</span> : null}
    </div>
  );
}

/**
 * Link to a flag's origin. Criteria flags carry a runId → deep-link to the run.
 * When there is no runId we do NOT invent a route: we show the target id in mono
 * (or nothing), because a broken link is worse than an honest dead end.
 */
export function FlagSourceLink({ view, locale }: { view: FlagView; locale: Locale }) {
  const f = getDictionary(locale).flags;
  if (view.runId) {
    return <Link href={`/dashboard/runs/${view.runId}`}>{f.viewRun}</Link>;
  }
  if (view.target) {
    return <span className="mono row-meta">{view.target}</span>;
  }
  return <span className="muted">—</span>;
}

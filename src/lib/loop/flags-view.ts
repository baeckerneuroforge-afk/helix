// Read-only projection of a "flag" audit entry into a display-ready shape.
//
// A flag is NOT its own table (see loop-implementierungsplan.md §5, Stufe A):
// it is an append-only `audit_log` row whose action starts with `flag.` and
// whose `detail` JSON carries the deviation. Both the /flags page and the
// cockpit panel render the same rows, so the interpretation of that JSON lives
// here — once, tolerant, and unit-testable — instead of being duplicated across
// two React trees.
//
// The parser is deliberately defensive: `detail` is untyped JSONB written by
// the loop engine. Schritt A writes `flag.criteria_violated` with a
// `failedCriteria[]` array; a later metric check (Schritt C) will write
// `flag.metric_deviation` with a flatter `{ metric, expected, actual }`. This
// projection understands both and degrades gracefully (never throws) for any
// future `flag.*` shape it does not yet recognise — an unknown flag still shows
// its action, actor, target and severity rather than crashing the page.

import type { AuditLog } from '@prisma/client';

export type FlagSeverity = 'critical' | 'warning' | 'info';
export type FlagCategory = 'criteria' | 'metric' | 'other';

/** One concrete deviation inside a flag (one violated criterion or one metric). */
export interface FlagDeviation {
  /** Stable key of the criterion ('min_use_cases') or metric ('success_rate'). */
  key: string | null;
  /** Soll — the expected/threshold value, pre-stringified for display. */
  expected: string | null;
  /** Ist — the actual observed value, pre-stringified for display. */
  actual: string | null;
  /** Human-readable message from the check, if the engine provided one. */
  message: string | null;
}

/** A flag audit row, projected into everything the UI needs to render it. */
export interface FlagView {
  id: string;
  createdAt: Date;
  /** Full audit action, e.g. 'flag.criteria_violated'. */
  action: string;
  actorId: string;
  /** What the flag points at: an artifactId (criteria) or a metric key. */
  target: string | null;
  category: FlagCategory;
  /** Deliverable type ('framework') or null for non-deliverable flags. */
  type: string | null;
  severity: FlagSeverity;
  /** The concrete deviations. Criteria flags can carry several; metrics one. */
  deviations: FlagDeviation[];
  /** Skill run this flag arose from, if the detail records one (deep-linkable). */
  runId: string | null;
  /** Correction proposal (human-readable), only for autonomy 'suggest'/'autonomous'. */
  suggestedAction: string | null;
  /**
   * The machine reference the "start correction" button needs to re-run the
   * skill — present ONLY when the flag carries a concrete re-runnable run (a
   * criteria flag). null for report-mode flags and for metric flags (which have
   * no single originating run to replay). Its presence is what gates the button.
   */
  correction: FlagCorrection | null;
  /** The raw detail JSON, so the UI can still offer an "expand" escape hatch. */
  raw: unknown;
}

/** The re-run pointer projected from a flag's detail.correction (see suggest.ts). */
export interface FlagCorrection {
  skillKey: string;
  sourceRunId: string;
  clientId: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Stringify a scalar expected/actual value; objects/arrays fall back to JSON. */
function scalar(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function normalizeSeverity(value: unknown): FlagSeverity {
  return value === 'critical' || value === 'warning' || value === 'info' ? value : 'warning';
}

function normalizeCategory(value: unknown, action: string): FlagCategory {
  if (value === 'criteria' || value === 'metric') return value;
  // Fall back to the action verb when detail.category is absent.
  if (action === 'flag.criteria_violated') return 'criteria';
  if (action === 'flag.metric_deviation') return 'metric';
  return 'other';
}

/**
 * Pull the deviation list out of an untyped flag `detail`. Understands:
 *  - Schritt A criteria flag: detail.failedCriteria = [{ criterion, expected, actual, message }]
 *  - Schritt C metric flag (planned): detail.{ metric|criterion, expected, actual, message }
 * Returns [] when nothing recognisable is present (never throws).
 */
function extractDeviations(detail: Record<string, unknown>): FlagDeviation[] {
  const failed = detail.failedCriteria;
  if (Array.isArray(failed) && failed.length > 0) {
    return failed.map((entry) => {
      const e = asRecord(entry) ?? {};
      return {
        key: scalar(e.criterion ?? e.metric ?? e.key),
        expected: scalar(e.expected),
        actual: scalar(e.actual),
        message: typeof e.message === 'string' ? e.message : null,
      };
    });
  }

  // Flat single-deviation shape (metric flags, or a hand-written flag).
  const key = scalar(detail.criterion ?? detail.metric ?? detail.key);
  const expected = scalar(detail.expected);
  const actual = scalar(detail.actual);
  const message = typeof detail.message === 'string' ? detail.message : null;
  if (key != null || expected != null || actual != null || message != null) {
    return [{ key, expected, actual, message }];
  }
  return [];
}

/**
 * Pull the machine correction reference out of a flag detail, defensively.
 * Requires a non-empty skillKey AND sourceRunId — without both there is nothing
 * to re-run, so we return null and the UI shows no button (never a broken one).
 */
function extractCorrection(detail: Record<string, unknown>): FlagCorrection | null {
  const c = asRecord(detail.correction);
  if (!c) return null;
  const skillKey = typeof c.skillKey === 'string' ? c.skillKey : null;
  const sourceRunId = typeof c.sourceRunId === 'string' ? c.sourceRunId : null;
  if (!skillKey || !sourceRunId) return null;
  return {
    skillKey,
    sourceRunId,
    clientId: typeof c.clientId === 'string' ? c.clientId : null,
  };
}

/** Project a raw audit row into a FlagView. Pure; safe on any `flag.*` row. */
export function toFlagView(row: AuditLog): FlagView {
  const detail = asRecord(row.detail) ?? {};
  const suggested = detail.suggestedAction;
  return {
    id: row.id,
    createdAt: row.createdAt,
    action: row.action,
    actorId: row.actorId,
    target: row.target ?? null,
    category: normalizeCategory(detail.category, row.action),
    type: typeof detail.type === 'string' ? detail.type : null,
    severity: normalizeSeverity(detail.severity),
    deviations: extractDeviations(detail),
    runId: typeof detail.runId === 'string' ? detail.runId : null,
    suggestedAction: typeof suggested === 'string' ? suggested : null,
    correction: extractCorrection(detail),
    raw: row.detail ?? null,
  };
}

const SEVERITY_CHIP: Record<FlagSeverity, string> = {
  // Design-system semantics: red = failure, amber = waits/deviation, gray = info.
  critical: 'chip--red',
  warning: 'chip--amber',
  info: 'chip--gray',
};

/** Chip class for a severity — keeps the color semantics in one place. */
export function severityChipClass(severity: FlagSeverity): string {
  return SEVERITY_CHIP[severity];
}

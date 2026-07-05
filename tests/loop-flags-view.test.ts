import type { AuditLog } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { severityChipClass, toFlagView } from '../src/lib/loop/flags-view';

// Build an audit row with sane defaults; override what a test cares about.
function row(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'audit-1',
    orgId: 'org-1',
    actorId: 'loop-engine',
    actorType: 'agent',
    action: 'flag.criteria_violated',
    target: 'artifact-1',
    detail: null,
    createdAt: new Date('2026-07-05T10:00:00Z'),
    ...overrides,
  } as AuditLog;
}

// The exact detail shape Schritt A's evaluateDeliverableCriteria writes.
const CRITERIA_DETAIL = {
  category: 'criteria',
  type: 'framework',
  skillKey: 'transkript_zu_framework',
  runId: 'run-42',
  failedCriteria: [
    { criterion: 'min_use_cases', expected: 3, actual: 1, message: 'Found 1 use case(s), expected at least 3' },
    { criterion: 'has_sources', expected: '≥ 1 source', actual: 0, message: 'No sources line found' },
  ],
  passedCount: 3,
  failedCount: 2,
  severity: 'warning',
};

describe('toFlagView — Schritt A criteria flag', () => {
  it('projects the real failedCriteria[] shape', () => {
    const view = toFlagView(row({ detail: CRITERIA_DETAIL }));
    expect(view.category).toBe('criteria');
    expect(view.type).toBe('framework');
    expect(view.severity).toBe('warning');
    expect(view.runId).toBe('run-42');
    expect(view.target).toBe('artifact-1');
    expect(view.deviations).toHaveLength(2);
  });

  it('stringifies expected/actual for display and keeps criterion + message', () => {
    const view = toFlagView(row({ detail: CRITERIA_DETAIL }));
    const [first, second] = view.deviations;
    expect(first).toEqual({
      key: 'min_use_cases',
      expected: '3',
      actual: '1',
      message: 'Found 1 use case(s), expected at least 3',
    });
    expect(second.key).toBe('has_sources');
    expect(second.expected).toBe('≥ 1 source');
    expect(second.actual).toBe('0');
  });

  it('exposes the raw detail as an escape hatch', () => {
    const view = toFlagView(row({ detail: CRITERIA_DETAIL }));
    expect(view.raw).toBe(CRITERIA_DETAIL);
  });

  it('maps critical severity to a red chip, warning to amber', () => {
    const critical = toFlagView(row({ detail: { ...CRITERIA_DETAIL, severity: 'critical' } }));
    expect(critical.severity).toBe('critical');
    expect(severityChipClass(critical.severity)).toBe('chip--red');
    const warning = toFlagView(row({ detail: CRITERIA_DETAIL }));
    expect(severityChipClass(warning.severity)).toBe('chip--amber');
  });
});

describe('toFlagView — planned metric flag (flat shape)', () => {
  const METRIC_DETAIL = {
    category: 'metric',
    metric: 'success_rate',
    expected: 0.7,
    actual: 0.42,
    severity: 'critical',
    suggestedAction: 'Review the last 5 failed runs',
  };

  it('reads a single flat deviation and its suggestion', () => {
    const view = toFlagView(row({ action: 'flag.metric_deviation', target: 'success_rate', detail: METRIC_DETAIL }));
    expect(view.category).toBe('metric');
    expect(view.deviations).toEqual([
      { key: 'success_rate', expected: '0.7', actual: '0.42', message: null },
    ]);
    expect(view.suggestedAction).toBe('Review the last 5 failed runs');
    // No runId in the detail → the UI must not fabricate a run link.
    expect(view.runId).toBeNull();
  });

  it('derives category from the action when detail.category is absent', () => {
    const view = toFlagView(
      row({ action: 'flag.metric_deviation', detail: { metric: 'approval_rate', expected: 0.6, actual: 0.3 } }),
    );
    expect(view.category).toBe('metric');
  });
});

describe('toFlagView — correction ref (Schritt D)', () => {
  const CRITERIA_WITH_CORRECTION = {
    ...CRITERIA_DETAIL,
    suggestedAction: 'Re-run “Framework” with the same inputs.',
    correction: {
      skillKey: 'transkript_zu_framework',
      sourceRunId: 'run-42',
      clientId: 'client-7',
    },
  };

  it('projects a complete correction ref and the suggestion together', () => {
    const view = toFlagView(row({ detail: CRITERIA_WITH_CORRECTION }));
    expect(view.suggestedAction).toBe('Re-run “Framework” with the same inputs.');
    expect(view.correction).toEqual({
      skillKey: 'transkript_zu_framework',
      sourceRunId: 'run-42',
      clientId: 'client-7',
    });
  });

  it('drops an incomplete correction ref (missing sourceRunId) → no button', () => {
    const view = toFlagView(
      row({ detail: { ...CRITERIA_DETAIL, correction: { skillKey: 'x' } } }),
    );
    expect(view.correction).toBeNull();
  });

  it('a report-mode flag (no correction key) has correction null', () => {
    const view = toFlagView(row({ detail: CRITERIA_DETAIL }));
    expect(view.correction).toBeNull();
  });

  it('a metric flag with a suggestion but no correction → suggestion shown, no button', () => {
    const view = toFlagView(
      row({
        action: 'flag.metric_deviation',
        detail: { category: 'metric', metric: 'success_rate', expected: 0.7, actual: 0.4, suggestedAction: 'Review the runs.' },
      }),
    );
    expect(view.suggestedAction).toBe('Review the runs.');
    expect(view.correction).toBeNull();
  });
});

describe('toFlagView — defensive against unknown / malformed detail', () => {
  it('never throws on null detail and defaults sensibly', () => {
    const view = toFlagView(row({ detail: null }));
    expect(view.deviations).toEqual([]);
    expect(view.severity).toBe('warning'); // safe default
    expect(view.category).toBe('criteria'); // from the action verb
    expect(view.raw).toBeNull();
  });

  it('handles a wholly unknown flag action', () => {
    const view = toFlagView(row({ action: 'flag.something_new', detail: { foo: 'bar' } }));
    expect(view.category).toBe('other');
    expect(view.deviations).toEqual([]);
    expect(view.action).toBe('flag.something_new');
  });

  it('coerces an invalid severity to the safe default', () => {
    const view = toFlagView(row({ detail: { severity: 'nonsense' } }));
    expect(view.severity).toBe('warning');
  });

  it('ignores a non-array failedCriteria and falls back to the flat shape', () => {
    const view = toFlagView(row({ detail: { failedCriteria: 'oops', criterion: 'x', expected: 1, actual: 0 } }));
    expect(view.deviations).toEqual([{ key: 'x', expected: '1', actual: '0', message: null }]);
  });
});

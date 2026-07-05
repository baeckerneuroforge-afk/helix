// Block Kit for a flag's "Start correction" button + the shared action id.
//
// A flag posted to Slack under autonomy 'suggest' offers a single button. Its
// `value` carries the correction reference (skillKey + sourceRunId) as JSON —
// the SAME re-run pointer /api/loop/correct uses. The interactions handler
// (src/lib/slack/handlers.ts) re-resolves team/user/link on click and treats the
// value as untrusted input: it only names WHICH run to replay. Clicking STARTS
// the re-run through the normal approval gate — it never approves anything.

import type { Locale } from '../i18n';
import type { FlagCorrection } from '../loop/flags-view';

export const CORRECT_ACTION_ID = 'helix_correct';

const BUTTON_LABEL: Record<Locale, string> = {
  en: 'Start correction',
  de: 'Korrektur starten',
};

/** JSON payload carried in the button `value` (kept tiny — well under 2000 chars). */
export interface CorrectionButtonValue {
  skillKey: string;
  sourceRunId: string;
}

export function encodeCorrectionValue(c: FlagCorrection): string {
  const v: CorrectionButtonValue = { skillKey: c.skillKey, sourceRunId: c.sourceRunId };
  return JSON.stringify(v);
}

/** Parse a button value back into a correction ref; null when malformed. */
export function decodeCorrectionValue(raw: string | undefined): CorrectionButtonValue | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<CorrectionButtonValue>;
    if (typeof v.skillKey === 'string' && typeof v.sourceRunId === 'string') {
      return { skillKey: v.skillKey, sourceRunId: v.sourceRunId };
    }
  } catch {
    // malformed value → treated as no correction
  }
  return null;
}

/**
 * Build the blocks for a flag Slack post: a section with the text (+ the
 * suggestion when present) and, ONLY when a re-runnable correction exists, an
 * actions block with the "Start correction" button. Under 'report' (no
 * correction) it returns just the section — no button.
 */
export function correctionButtonBlocks(
  locale: Locale,
  args: { text: string; suggestedAction: string | null; correction: FlagCorrection | null },
): unknown[] {
  const bodyText = args.suggestedAction ? `${args.text}\n_${args.suggestedAction}_` : args.text;
  const blocks: unknown[] = [
    { type: 'section', text: { type: 'mrkdwn', text: bodyText } },
  ];
  if (args.correction) {
    blocks.push({
      type: 'actions',
      block_id: 'helix_flag_correction',
      elements: [
        {
          type: 'button',
          style: 'primary',
          action_id: CORRECT_ACTION_ID,
          text: { type: 'plain_text', text: BUTTON_LABEL[locale] },
          value: encodeCorrectionValue(args.correction),
        },
      ],
    });
  }
  return blocks;
}

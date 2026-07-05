// Flag notification — best-effort, NEVER part of the flag-writing mechanic.
//
// After a flag has been WRITTEN and its transaction committed, this sends a
// heads-up: an e-mail to the tenant's notify address (org_settings.
// approval_notify_email) and, when a Slack workspace + a configured flag channel
// exist, a Slack post. Under autonomy 'suggest' (a flag that carries a re-run
// `correction`) the Slack post also gets a "Start correction" button.
//
// Deliberate properties (mirrors notifyApprovalRequested, plan §6):
//   - runs AFTER the flag tx commits (the flag already exists; this only tells
//     people about it),
//   - NEVER throws: any failure (no provider key, no Slack install, network, …)
//     is logged and swallowed — the flag stands regardless,
//   - no address / no Slack channel ⇒ that channel is a silent no-op,
//   - language: the org locale (org_settings.locale) — flags go to an org-wide
//     alias/channel, not a browser.
//
// It takes an ALREADY-projected FlagView (src/lib/loop/flags-view.ts) so the
// wording matches the UI and this file needs no detail-parsing of its own.

import { getEmailProvider } from '../effects';
import { getDictionary, isLocale, type Locale } from '../i18n';
import { logError } from '../log';
// Import the poster from the leaf module, NOT the ../slack barrel: the barrel
// re-exports handlers.ts, which (via loop/correct → skills → engine → loop/
// evaluate → loop/notify) would close an import cycle back to this file.
import { postSlackMessage } from '../slack/client';
import { correctionButtonBlocks } from '../slack/correction';
import { withTenant } from '../tenant';
import type { FlagView } from './flags-view';

const MAIL_TEXTS: Record<Locale, {
  subject: (kind: string) => string;
  intro: string;
  severity: string;
  deviation: string;
  suggestion: string;
  review: string;
}> = {
  en: {
    subject: (kind) => `Loop flag: ${kind}`,
    intro: 'The loop flagged a deviation.',
    severity: 'Severity',
    deviation: 'Deviation',
    suggestion: 'Suggested',
    review: 'Review: Dashboard → Flags (/dashboard/flags)',
  },
  de: {
    subject: (kind) => `Loop-Flag: ${kind}`,
    intro: 'Der Loop hat eine Abweichung gemeldet.',
    severity: 'Schwere',
    deviation: 'Abweichung',
    suggestion: 'Vorschlag',
    review: 'Zur Prüfung: Dashboard → Flags (/dashboard/flags)',
  },
};

/** One-line summary of the first deviation, for the mail/Slack body. */
function deviationLine(flag: FlagView): string {
  const d = flag.deviations[0];
  if (!d) return '—';
  if (d.expected != null || d.actual != null) {
    return `${d.key ?? ''} — target ${d.expected ?? '—'}, actual ${d.actual ?? '—'}`.trim();
  }
  return d.message ?? d.key ?? '—';
}

/** Human label for the flag kind, from the localized category. */
function kindLabel(flag: FlagView, locale: Locale): string {
  const f = getDictionary(locale).flags;
  return f.category[flag.category];
}

/**
 * Notify about a freshly-written flag. Best-effort and total: e-mail + Slack are
 * each attempted independently and any failure is logged, never thrown. Returns
 * a small report (useful in tests) of which channels actually fired.
 */
export async function notifyFlag(
  orgId: string,
  flag: FlagView,
): Promise<{ email: boolean; slack: boolean }> {
  // One read for both channels: address, locale, and any Slack installation.
  let locale: Locale = 'en';
  let to: string | null = null;
  let slackTeamId: string | null = null;
  let botTokenRef: string | null | undefined;
  try {
    const data = await withTenant(orgId, async (tx) => {
      const settings = await tx.orgSettings.findUnique({ where: { orgId } });
      const install = await tx.slackInstallation.findFirst();
      return { settings, install };
    });
    to = data.settings?.approvalNotifyEmail ?? null;
    if (isLocale(data.settings?.locale)) locale = data.settings.locale;
    slackTeamId = data.install?.slackTeamId ?? null;
    botTokenRef = data.install?.botTokenRef ?? null;
  } catch (err) {
    logError('flag notification: settings lookup failed (best-effort)', err, { orgId });
    return { email: false, slack: false };
  }

  const texts = MAIL_TEXTS[locale];
  const email = await sendFlagEmail(orgId, flag, locale, texts, to);
  const slack = await postFlagToSlack(orgId, flag, locale, texts, slackTeamId, botTokenRef);
  return { email, slack };
}

async function sendFlagEmail(
  orgId: string,
  flag: FlagView,
  locale: Locale,
  texts: (typeof MAIL_TEXTS)[Locale],
  to: string | null,
): Promise<boolean> {
  if (!to) return false;
  try {
    const kind = kindLabel(flag, locale);
    const lines = [
      texts.intro,
      '',
      `${texts.severity}: ${flag.severity}`,
      `${texts.deviation}: ${deviationLine(flag)}`,
    ];
    if (flag.suggestedAction) lines.push(`${texts.suggestion}: ${flag.suggestedAction}`);
    lines.push('', texts.review);

    await getEmailProvider().send({
      to,
      subject: texts.subject(kind),
      text: lines.join('\n'),
    });
    return true;
  } catch (err) {
    logError('flag notification e-mail failed (best-effort, flag unaffected)', err, { orgId });
    return false;
  }
}

/**
 * Post the flag into Slack. Requires an installation AND a configured channel
 * (SLACK_FLAG_CHANNEL) — without a channel there is nowhere to post proactively,
 * so we stay silent rather than guess. Adds the "Start correction" button only
 * when the flag carries a re-runnable correction (suggest mode, criteria flag).
 */
async function postFlagToSlack(
  orgId: string,
  flag: FlagView,
  locale: Locale,
  texts: (typeof MAIL_TEXTS)[Locale],
  slackTeamId: string | null,
  botTokenRef: string | null | undefined,
): Promise<boolean> {
  const channel = process.env.SLACK_FLAG_CHANNEL;
  if (!slackTeamId || !channel) return false;
  try {
    const kind = kindLabel(flag, locale);
    const text = `:triangular_flag_on_post: ${texts.subject(kind)} — ${flag.severity}: ${deviationLine(flag)}`;
    const blocks = correctionButtonBlocks(locale, {
      text,
      suggestedAction: flag.suggestedAction,
      correction: flag.correction,
    });
    await postSlackMessage({ channel, text, blocks, botTokenRef });
    return true;
  } catch (err) {
    logError('flag notification Slack post failed (best-effort, flag unaffected)', err, { orgId });
    return false;
  }
}

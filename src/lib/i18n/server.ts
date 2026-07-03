// Server-side locale resolution (UI language of the current request).
//
// Two independent locale sources, used for different outputs:
//   - getLocale()      — the UI language of THIS request (cookie, per browser);
//                        drives every page/dialog string.
//   - getOrgLocale(tx) — the org-wide language (org_settings.locale, admin
//                        setting); drives org-level output that has no browser
//                        context: generated PDFs and outgoing e-mails.
//                        Defined in ./org (no 'server-only'), re-exported here.
import 'server-only';
import { cookies } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  isLocale,
  type Dictionary,
  type Locale,
} from './index';

export { getOrgLocale } from './org';

/** UI locale of the current request (cookie), defaulting to English. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Convenience: locale + dictionary in one call for pages/actions. */
export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}

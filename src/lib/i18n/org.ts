// Org-wide output language — deliberately WITHOUT 'server-only' so the skill
// engine, notify and tests can import it (no next/headers dependency).
import type { Tx } from '../tenant';
import { DEFAULT_LOCALE, isLocale, type Locale } from './index';

/** Org-wide output language (PDFs, e-mails) — read in the CALLER's tenant
 * transaction. No settings row or unknown value ⇒ English (fail-safe). */
export async function getOrgLocale(tx: Tx, orgId: string): Promise<Locale> {
  const row = await tx.orgSettings.findUnique({
    where: { orgId },
    select: { locale: true },
  });
  const value = row?.locale;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

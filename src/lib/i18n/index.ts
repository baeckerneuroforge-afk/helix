// i18n core — shared between server and client (no server-only imports here).
//
// English is the platform default and the source language: the dictionary
// SHAPE is defined by dictionaries/en.ts, German mirrors it type-checked.
// The UI locale lives in a cookie (set by the language switcher); org-wide
// outputs (PDFs, e-mails) follow org_settings.locale instead — see server.ts.
import { de } from './dictionaries/de';
import { en, type Dictionary } from './dictionaries/en';

export type { Dictionary };

export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie carrying the UI language of THIS browser (not org-wide). */
export const LOCALE_COOKIE = 'ergane_locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

const DICTIONARIES: Record<Locale, Dictionary> = { en, de };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? en;
}

// -----------------------------------------------------------------------------
// Locale-aware formatting (dates, currency) — EUR stays the platform currency.
// -----------------------------------------------------------------------------

const INTL_LOCALE: Record<Locale, string> = { en: 'en-GB', de: 'de-DE' };

const dateTimeFormats = new Map<Locale, Intl.DateTimeFormat>();
const currencyFormats = new Map<Locale, Intl.NumberFormat>();

export function formatDateTime(d: Date, locale: Locale = DEFAULT_LOCALE): string {
  let fmt = dateTimeFormats.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    dateTimeFormats.set(locale, fmt);
  }
  return fmt.format(d);
}

export function formatDate(d: Date, locale: Locale = DEFAULT_LOCALE): string {
  return d.toLocaleDateString(INTL_LOCALE[locale]);
}

export function formatEuro(n: number, locale: Locale = DEFAULT_LOCALE): string {
  let fmt = currencyFormats.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: 'EUR' });
    currencyFormats.set(locale, fmt);
  }
  return fmt.format(n);
}

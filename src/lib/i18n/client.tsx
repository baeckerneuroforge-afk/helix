'use client';

// Client-side locale access. The locale is resolved ONCE on the server
// (cookie, src/lib/i18n/server.ts) and provided here by the root layout —
// client components never read the cookie themselves, so server and client
// render the same language (no hydration mismatch).
import { createContext, useContext } from 'react';
import { DEFAULT_LOCALE, getDictionary, type Dictionary, type Locale } from './index';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useDict(): Dictionary {
  return getDictionary(useContext(LocaleContext));
}

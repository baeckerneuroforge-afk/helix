import './globals.css';
import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { deDE } from '@clerk/localizations';
import { LocaleProvider } from '@/lib/i18n/client';
import { getLocale } from '@/lib/i18n/server';

// display: 'swap' — text renders immediately in the fallback font instead of
// blocking on the webfont download (no invisible-text phase).
// Rollen (Branding v1): Fraunces = Wortmarke & Überschriften (Charakter,
// Wärme), Inter = Fließtext und Zahlen (B2B-nüchtern, tabular-nums),
// JetBrains Mono = nur Technisches (IDs, Zeitstempel, Events).
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['opsz'],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'helix.ai',
  description: 'Tenant-first foundation — isolation enforced by Postgres RLS.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // English is the platform default; the switcher sets the cookie.
  const locale = await getLocale();

  return (
    <ClerkProvider localization={locale === 'de' ? deDE : undefined}>
      <html lang={locale}>
        <body className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}>
          <LocaleProvider locale={locale}>{children}</LocaleProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

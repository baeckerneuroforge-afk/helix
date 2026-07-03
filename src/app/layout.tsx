import './globals.css';
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';

// display: 'swap' — text renders immediately in the fallback font instead of
// blocking on the webfont download (no invisible-text phase).
// Rollen: Instrument Sans = Fließtext, Bricolage Grotesque = Überschriften &
// Wortmarke, JetBrains Mono = Daten (IDs, Beträge, Zeitstempel).
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ergane',
  description: 'Tenant-first foundation — isolation enforced by Postgres RLS.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="de">
        <body className={`${instrumentSans.variable} ${bricolage.variable} ${jetbrainsMono.variable}`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

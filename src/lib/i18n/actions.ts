'use server';

// Set the UI language of THIS browser (cookie). Deliberately unauthenticated:
// the cookie only selects which translation of the same content is rendered —
// it grants nothing. The org-wide output language (PDFs/e-mails) is a separate
// admin-gated setting (org_settings.locale).
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, isLocale } from './index';

export async function setUiLocale(formData: FormData) {
  const raw = String(formData.get('locale') ?? '');
  if (!isLocale(raw)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, raw, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}

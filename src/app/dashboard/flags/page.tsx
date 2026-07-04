import { getI18n } from '@/lib/i18n/server';

export default async function FlagsPage() {
  const { t } = await getI18n();
  return (
    <>
      <p className="page-intro">{t.nav.subtitles.flags}</p>
      <div className="empty">
        <h3>{t.comingSoon.title}</h3>
        <p>{t.comingSoon.flags}</p>
      </div>
    </>
  );
}

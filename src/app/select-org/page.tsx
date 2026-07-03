import { OrganizationList } from '@clerk/nextjs';
import { getI18n } from '@/lib/i18n/server';

// Reached when a signed-in user has no active organization. B2B-only:
// `hidePersonal` hides personal accounts so there is always a real tenant.
export default async function SelectOrgPage() {
  const { t } = await getI18n();
  return (
    <div className="auth-page">
      <div>
        <h1>{t.selectOrg.title}</h1>
        <p className="muted">{t.selectOrg.hint}</p>
      </div>
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/dashboard"
        afterCreateOrganizationUrl="/dashboard"
      />
    </div>
  );
}

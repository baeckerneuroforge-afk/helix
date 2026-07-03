import Link from 'next/link';
import { requireTenant } from '@/lib/auth-context';
import { getI18n } from '@/lib/i18n/server';
import { listSkills } from '@/lib/skills';
import { withTenant } from '@/lib/tenant';
import { OnboardingCard } from './onboarding';
import { ActorChip, formatDateTime } from './ui';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { orgId } = await requireTenant();
  const { locale, t } = await getI18n();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { documentCount, runsLast7d, pendingApprovals, recentAudit, onboarding } =
    await withTenant(orgId, async (tx) => {
      const documents = await tx.document.count();
      return {
        documentCount: documents,
        runsLast7d: await tx.skillRun.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        pendingApprovals: await tx.approval.count({ where: { status: 'pending' } }),
        recentAudit: await tx.auditLog.findMany({
          // The overview row shows time/action/actor only — skip `detail` (JSON).
          select: { id: true, createdAt: true, action: true, actorType: true },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        // "Getting started": progress derived from real data, no extra state.
        onboarding: {
          hasDocument: documents > 0,
          hasChatMessage: (await tx.chatMessage.count()) > 0,
          hasRun: (await tx.skillRun.count()) > 0,
          hasCompanyProfile: Boolean(
            (await tx.orgSettings.findUnique({ where: { orgId } }))?.companyName,
          ),
        },
      };
    });
  const skillCount = listSkills().length;

  const kpis = [
    { label: t.overview.kpiDocuments, value: documentCount, attention: false },
    { label: t.overview.kpiSkills, value: skillCount, attention: false },
    { label: t.overview.kpiRuns7d, value: runsLast7d, attention: false },
    { label: t.overview.kpiPendingApprovals, value: pendingApprovals, attention: pendingApprovals > 0 },
  ];

  return (
    <>
      <OnboardingCard progress={onboarding} dict={t.onboarding} />

      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <div className="card" key={kpi.label}>
            <div className="kpi-label">{kpi.label}</div>
            <div className={`kpi-value${kpi.attention ? ' attention' : ''}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <section className="card card--table">
        <h2 style={{ padding: '0.8rem 1.25rem 0' }}>{t.overview.recentActivity}</h2>
        {recentAudit.length === 0 ? (
          <p className="muted" style={{ padding: '0 1.25rem 0.8rem' }}>
            {t.overview.noActivity}
          </p>
        ) : (
          <table className="table">
            <tbody>
              {recentAudit.map((entry) => (
                <tr key={entry.id}>
                  <td className="mono row-meta" style={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(entry.createdAt, locale)}
                  </td>
                  <td className="mono">{entry.action}</td>
                  <td>
                    <ActorChip actorType={entry.actorType} locale={locale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="quick-grid">
        <Link className="card quick-card" href="/dashboard/skills">
          <strong>{t.nav.skills}</strong>
          <span className="quick-hint">{t.overview.quickSkillsHint}</span>
        </Link>
        <Link className="card quick-card" href="/dashboard/knowledge">
          <strong>{t.nav.knowledge}</strong>
          <span className="quick-hint">{t.overview.quickKnowledgeHint}</span>
        </Link>
        <Link className="card quick-card" href="/dashboard/chat">
          <strong>{t.nav.chat}</strong>
          <span className="quick-hint">{t.overview.quickChatHint}</span>
        </Link>
      </div>
    </>
  );
}

import { requireTenant } from '@/lib/auth-context';
import { ensureOrgAndMembership } from '@/lib/org';
import { withTenant } from '@/lib/tenant';
import { DashboardShell } from './shell';

// Session + live badge count → always dynamic.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, clerkOrgId, orgId, orgSlug, role } = await requireTenant();

  // Mirror the Clerk org + caller's membership into our DB (idempotent) —
  // approve()/reject()'s role gate reads this membership.
  await ensureOrgAndMembership({
    clerkOrgId,
    name: orgSlug ?? clerkOrgId,
    userId,
    role,
  });

  // 7-day window for the flags nav badge — mirrors the cockpit panel's window,
  // so "N" in the sidebar and "N flags in the last 7 days" always agree.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { org, pendingApprovals, openFlags } = await withTenant(orgId, async (tx) => ({
    org: await tx.organization.findUnique({ where: { id: orgId } }),
    pendingApprovals: await tx.approval.count({ where: { status: 'pending' } }),
    openFlags: await tx.auditLog.count({
      where: { action: { startsWith: 'flag.' }, createdAt: { gte: sevenDaysAgo } },
    }),
  }));

  return (
    <DashboardShell
      tenantName={org?.name ?? orgSlug ?? clerkOrgId}
      role={role}
      pendingApprovals={pendingApprovals}
      openFlags={openFlags}
    >
      {children}
    </DashboardShell>
  );
}

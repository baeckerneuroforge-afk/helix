// GET /dashboard/settings/governance — the org's governance configuration
// (approval policies + visibility grants) as a portable JSON download.
// Same shape the import accepts. Protected by the Clerk middleware like every
// dashboard route; the admin gate + audit live in exportGovernance().
// Contains NO secrets and nothing org-identifying — governance rules only.
import { requireTenant } from '@/lib/auth-context';
import { ensureOrgAndMembership } from '@/lib/org';
import { exportGovernance } from '@/lib/policies';

export async function GET(): Promise<Response> {
  const { orgId, userId, clerkOrgId, orgSlug, role } = await requireTenant();
  await ensureOrgAndMembership({ clerkOrgId, name: orgSlug ?? clerkOrgId, userId, role });

  const config = await exportGovernance({ orgId, actorUserId: userId });

  return new Response(JSON.stringify(config, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="helix-governance.json"',
    },
  });
}

// Shared admin gate of the policy layer — extracted so both index.ts and
// governance.ts can use it without a circular import. Semantics unchanged.
import type { Role } from '@prisma/client';
import type { Tx } from '../tenant';

/** Roles allowed to administer policies. */
export const ADMIN_ROLES: Role[] = ['admin', 'owner'];

/** Membership lookup inside the CALLER's tenant transaction. Fail-closed: no
 * membership row ⇒ null (treated as "no role" by every consumer). */
export async function getMemberRole(tx: Tx, userId: string): Promise<Role | null> {
  const membership = await tx.membership.findFirst({ where: { userId } });
  return membership?.role ?? null;
}

export async function requireAdmin(tx: Tx, orgId: string, actorUserId: string): Promise<Role> {
  const role = await getMemberRole(tx, actorUserId);
  if (!role || !ADMIN_ROLES.includes(role)) {
    throw new Error(
      `policies: user ${JSON.stringify(actorUserId)} (role: ${role ?? 'none'}) may not change policies — admin required.`,
    );
  }
  return role;
}

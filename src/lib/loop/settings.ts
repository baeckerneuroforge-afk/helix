// Loop autonomy level — the org-wide governance knob for how sharply the loop
// acts on a deviation (Schritt D, plan §4). Two layers, never confused:
//   1. RLS + FORCE (migration 0012) is the hard floor: every read/write here
//      runs in withTenant(), so a tenant only ever sees and edits its OWN
//      setting.
//   2. This value configures BEHAVIOUR within a tenant: 'report' (Default) just
//      flags + notifies; 'suggest' additionally attaches a correction proposal a
//      human can trigger. 'autonomous' is reserved for Schritt E and, until then,
//      behaves exactly like 'suggest' (effectiveAutonomy() below).
//
// Fail-closed default: no org_settings row, or the field somehow unreadable,
// ⇒ 'report' — the safe, unchanged behaviour, never a surprise suggestion.
//
// Only 'admin' (or the explicitly elevated 'owner') may change the level; every
// change writes audit 'policy.changed' with { old, new } — the EXACT pattern of
// setApprovalPolicy (src/lib/policies/index.ts).

import type { LoopAutonomy } from '@prisma/client';
import { logAudit } from '../audit';
import { DEFAULT_LOCALE, isLocale, type Locale } from '../i18n';
import { requireAdmin } from '../policies/admin';
import { withTenant, type Tx } from '../tenant';

export type { LoopAutonomy };

/** The safe default when nothing is stored (or on any read fallback). */
export const DEFAULT_LOOP_AUTONOMY: LoopAutonomy = 'report';

/** The levels a user may pick — the full enum. Ordered least→most active. */
export const LOOP_AUTONOMY_LEVELS: LoopAutonomy[] = ['report', 'suggest', 'autonomous'];

/**
 * The autonomy level for a tenant, defaulting to 'report' when there is no
 * settings row yet. Read-only; runs inside withTenant (RLS-scoped).
 */
export async function getLoopAutonomy(orgId: string): Promise<LoopAutonomy> {
  const settings = await withTenant(orgId, (tx) =>
    tx.orgSettings.findUnique({ where: { orgId }, select: { loopAutonomy: true } }),
  );
  return settings?.loopAutonomy ?? DEFAULT_LOOP_AUTONOMY;
}

/**
 * The autonomy level that is actually IN EFFECT today. 'autonomous' is defined
 * in the enum and selectable in settings, but the auto-start machinery is not
 * built yet (Schritt E). Until it is, 'autonomous' behaves EXACTLY like
 * 'suggest': a proposal a human still has to trigger. Collapsing it here — in
 * one place — means the flag paths never have to special-case it, and the day
 * Schritt E lands there is a single seam to change.
 */
export function effectiveAutonomy(level: LoopAutonomy): LoopAutonomy {
  return level === 'autonomous' ? 'suggest' : level;
}

/** True when the level should attach a correction proposal to a flag. */
export function shouldSuggest(level: LoopAutonomy): boolean {
  return effectiveAutonomy(level) === 'suggest';
}

export interface AutonomyContext {
  autonomy: LoopAutonomy;
  locale: Locale;
  /** effectiveAutonomy(autonomy) === 'suggest' — the flag paths' one question. */
  suggest: boolean;
}

/**
 * Read the tenant's autonomy level + org locale in ONE org_settings query and
 * resolve both defaults. Shared by both flag paths (evaluate + tick) so the
 * "resolve autonomy + locale" step lives in one place. Runs on the caller's tx
 * (fast read); pass the tx you already hold. Fails closed to report/en.
 */
export async function resolveAutonomyContext(tx: Tx, orgId: string): Promise<AutonomyContext> {
  const settings = await tx.orgSettings.findUnique({
    where: { orgId },
    select: { loopAutonomy: true, locale: true },
  });
  const autonomy = settings?.loopAutonomy ?? DEFAULT_LOOP_AUTONOMY;
  const locale: Locale = isLocale(settings?.locale) ? settings.locale : DEFAULT_LOCALE;
  return { autonomy, locale, suggest: shouldSuggest(autonomy) };
}

export interface SetLoopAutonomyInput {
  orgId: string;
  /** The human changing the level — must hold the admin role in this org. */
  actorUserId: string;
  level: LoopAutonomy;
}

/**
 * Set the tenant's loop autonomy level. Admin-only (requireAdmin inside the same
 * withTenant tx), and every real change writes audit 'policy.changed' with
 * { old, new }. A no-op change (same level) writes nothing — no audit noise —
 * mirroring setVisibilityGrant / setMembershipRole.
 */
export async function setLoopAutonomy(input: SetLoopAutonomyInput): Promise<LoopAutonomy> {
  const { orgId, actorUserId, level } = input;
  if (!LOOP_AUTONOMY_LEVELS.includes(level)) {
    throw new Error(`setLoopAutonomy: level must be one of ${LOOP_AUTONOMY_LEVELS.join('|')}.`);
  }

  return withTenant(orgId, async (tx) => {
    await requireAdmin(tx, orgId, actorUserId);

    const old = await tx.orgSettings.findUnique({
      where: { orgId },
      select: { loopAutonomy: true },
    });
    const oldLevel = old?.loopAutonomy ?? DEFAULT_LOOP_AUTONOMY;
    if (old && oldLevel === level) return level; // no change, no audit noise

    await tx.orgSettings.upsert({
      where: { orgId },
      create: { orgId, loopAutonomy: level },
      update: { loopAutonomy: level },
    });

    await logAudit(tx, {
      orgId,
      actorId: actorUserId,
      actorType: 'human',
      action: 'policy.changed',
      target: 'org_settings:loop_autonomy',
      detail: { old: oldLevel, new: level },
    });
    return level;
  });
}

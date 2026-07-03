// Governance as a portable artifact: apply a preset, export the current
// configuration as JSON, import such a JSON — always the same core
// (applyGovernanceConfig), always admin-only, always ONE withTenant
// transaction, always audited.
//
// FAILSAFE (non-negotiable): mode 'never' on a handlesMoney skill is
// corrected fail-closed to 'always' BEFORE anything is written — a preset
// cannot smuggle it in, an imported JSON cannot smuggle it in. Every
// correction is audited as 'policy.overridden_failsafe' (the same action the
// engine uses for its runtime failsafe). The runtime failsafe in
// src/lib/skills/engine.ts stays in place regardless — defense in depth.
//
// The export contains ONLY this org's governance configuration: approval
// policies and the visibility grant matrix. No ids, no members, no Slack
// tokens, no company data — nothing another org (or attacker) could use
// beyond the plain governance rules themselves.
import type { ApprovalMode, DocumentVisibility, Role } from '@prisma/client';
import { logAudit } from '../audit';
import { getSkill, listSkills } from '../skills';
import { withTenant, type Tx } from '../tenant';
import { requireAdmin } from './admin';
import { getPolicyPreset, type PolicyPreset } from './presets';

export const GOVERNANCE_FORMAT = 'helix-governance';
export const GOVERNANCE_VERSION = 1;

const MODES: ApprovalMode[] = ['always', 'threshold', 'never'];
const APPROVER_ROLES: Role[] = ['lead', 'admin'];
const GRANT_LEVELS: DocumentVisibility[] = ['restricted', 'confidential'];
const GRANT_ROLES: Role[] = ['member', 'lead', 'admin'];
/** Sanity ceiling for thresholds (EUR) — matches the column's Decimal(14,2). */
const MAX_THRESHOLD_EUR = 999_999_999;

export interface GovernanceApprovalPolicy {
  skillKey: string;
  mode: ApprovalMode;
  /** EUR; set exactly when mode === 'threshold'. */
  thresholdAmount: number | null;
  approverRole: Role;
}

export interface GovernanceGrant {
  level: DocumentVisibility;
  role: Role;
}

/** The portable governance document (export format = import format). */
export interface GovernanceConfig {
  format: typeof GOVERNANCE_FORMAT;
  version: typeof GOVERNANCE_VERSION;
  approvalPolicies: GovernanceApprovalPolicy[];
  visibilityGrants: GovernanceGrant[];
}

export interface ApplyGovernanceResult {
  /** Skills whose mode 'never' was corrected to 'always' (money failsafe). */
  failsafeCorrected: string[];
  policiesApplied: number;
  grantsApplied: number;
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

/** Current governance configuration of the CALLER's org — admin-only,
 * audited. Contains no secrets and nothing org-identifying. */
export async function exportGovernance(input: {
  orgId: string;
  actorUserId: string;
}): Promise<GovernanceConfig> {
  return withTenant(input.orgId, async (tx) => {
    await requireAdmin(tx, input.orgId, input.actorUserId);

    const [policies, grants] = await Promise.all([
      tx.approvalPolicy.findMany({ orderBy: { skillKey: 'asc' } }),
      tx.visibilityGrant.findMany({ orderBy: [{ level: 'asc' }, { role: 'asc' }] }),
    ]);

    await logAudit(tx, {
      orgId: input.orgId,
      actorId: input.actorUserId,
      actorType: 'human',
      action: 'policy.exported',
      target: 'governance',
      detail: { policies: policies.length, grants: grants.length },
    });

    return {
      format: GOVERNANCE_FORMAT,
      version: GOVERNANCE_VERSION,
      approvalPolicies: policies.map((p) => ({
        skillKey: p.skillKey,
        mode: p.mode,
        thresholdAmount: p.thresholdAmount?.toNumber() ?? null,
        approverRole: (p.approverRole ?? 'lead') as Role,
      })),
      visibilityGrants: grants.map((g) => ({ level: g.level, role: g.role })),
    };
  });
}

// -----------------------------------------------------------------------------
// Validation (structure + value ranges) — used by import
// -----------------------------------------------------------------------------

/**
 * Parse an untrusted JSON string into a GovernanceConfig. Throws with a
 * human-readable message on ANY structural or range problem (fail-closed:
 * nothing partially valid is ever returned). The money failsafe is NOT
 * handled here — applyGovernanceConfig corrects it, so both presets and
 * imports pass through the identical guard.
 */
export function parseGovernanceConfig(raw: string): GovernanceConfig {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Import failed: not valid JSON.');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Import failed: expected a JSON object.');
  }
  const doc = data as Record<string, unknown>;
  if (doc.format !== GOVERNANCE_FORMAT) {
    throw new Error(`Import failed: "format" must be "${GOVERNANCE_FORMAT}".`);
  }
  if (doc.version !== GOVERNANCE_VERSION) {
    throw new Error(`Import failed: unsupported "version" (expected ${GOVERNANCE_VERSION}).`);
  }
  if (!Array.isArray(doc.approvalPolicies) || !Array.isArray(doc.visibilityGrants)) {
    throw new Error('Import failed: "approvalPolicies" and "visibilityGrants" must be arrays.');
  }
  const knownSkillKeys = new Set(listSkills().map((s) => s.key));
  if (doc.approvalPolicies.length > knownSkillKeys.size * 4) {
    throw new Error('Import failed: too many approval policies.');
  }
  if (doc.visibilityGrants.length > GRANT_LEVELS.length * GRANT_ROLES.length * 4) {
    throw new Error('Import failed: too many visibility grants.');
  }

  const policies: GovernanceApprovalPolicy[] = [];
  const seenSkills = new Set<string>();
  for (const [i, entry] of doc.approvalPolicies.entries()) {
    const at = `approvalPolicies[${i}]`;
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Import failed: ${at} must be an object.`);
    }
    const p = entry as Record<string, unknown>;
    if (typeof p.skillKey !== 'string' || !knownSkillKeys.has(p.skillKey)) {
      throw new Error(
        `Import failed: ${at}.skillKey is unknown (known: ${[...knownSkillKeys].join(', ')}).`,
      );
    }
    if (seenSkills.has(p.skillKey)) {
      throw new Error(`Import failed: duplicate policy for skill "${p.skillKey}".`);
    }
    seenSkills.add(p.skillKey);
    const mode = MODES.find((m) => m === p.mode);
    if (!mode) throw new Error(`Import failed: ${at}.mode must be one of ${MODES.join('|')}.`);
    const approverRole = APPROVER_ROLES.find((r) => r === (p.approverRole ?? 'lead'));
    if (!approverRole) {
      throw new Error(`Import failed: ${at}.approverRole must be one of ${APPROVER_ROLES.join('|')}.`);
    }
    let thresholdAmount: number | null = null;
    if (mode === 'threshold') {
      const t = p.thresholdAmount;
      if (typeof t !== 'number' || !Number.isFinite(t) || t <= 0 || t > MAX_THRESHOLD_EUR) {
        throw new Error(
          `Import failed: ${at}.thresholdAmount must be a number in (0, ${MAX_THRESHOLD_EUR}] for mode "threshold".`,
        );
      }
      thresholdAmount = Math.round(t * 100) / 100;
    }
    policies.push({ skillKey: p.skillKey, mode, thresholdAmount, approverRole });
  }

  const grants: GovernanceGrant[] = [];
  const seenGrants = new Set<string>();
  for (const [i, entry] of doc.visibilityGrants.entries()) {
    const at = `visibilityGrants[${i}]`;
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Import failed: ${at} must be an object.`);
    }
    const g = entry as Record<string, unknown>;
    const level = GRANT_LEVELS.find((l) => l === g.level);
    if (!level) {
      throw new Error(`Import failed: ${at}.level must be one of ${GRANT_LEVELS.join('|')}.`);
    }
    const role = GRANT_ROLES.find((r) => r === g.role);
    if (!role) {
      throw new Error(`Import failed: ${at}.role must be one of ${GRANT_ROLES.join('|')}.`);
    }
    const key = `${level}:${role}`;
    if (seenGrants.has(key)) continue; // duplicates collapse silently
    seenGrants.add(key);
    grants.push({ level, role });
  }

  return {
    format: GOVERNANCE_FORMAT,
    version: GOVERNANCE_VERSION,
    approvalPolicies: policies,
    visibilityGrants: grants,
  };
}

// -----------------------------------------------------------------------------
// Apply (shared core of preset + import)
// -----------------------------------------------------------------------------

/**
 * Money failsafe at WRITE time: 'never' on a handlesMoney skill becomes
 * 'always' (the strictest mode — fail-closed). Returns the corrected config
 * plus the list of corrected skill keys for auditing.
 */
function enforceMoneyFailsafe(config: GovernanceConfig): {
  config: GovernanceConfig;
  corrected: string[];
} {
  const corrected: string[] = [];
  const approvalPolicies = config.approvalPolicies.map((p) => {
    if (p.mode === 'never' && getSkill(p.skillKey).handlesMoney) {
      corrected.push(p.skillKey);
      return { ...p, mode: 'always' as ApprovalMode, thresholdAmount: null };
    }
    return p;
  });
  return { config: { ...config, approvalPolicies }, corrected };
}

async function snapshotGovernance(tx: Tx): Promise<{
  approvalPolicies: GovernanceApprovalPolicy[];
  visibilityGrants: GovernanceGrant[];
}> {
  const [policies, grants] = await Promise.all([
    tx.approvalPolicy.findMany({ orderBy: { skillKey: 'asc' } }),
    tx.visibilityGrant.findMany({ orderBy: [{ level: 'asc' }, { role: 'asc' }] }),
  ]);
  return {
    approvalPolicies: policies.map((p) => ({
      skillKey: p.skillKey,
      mode: p.mode,
      thresholdAmount: p.thresholdAmount?.toNumber() ?? null,
      approverRole: (p.approverRole ?? 'lead') as Role,
    })),
    visibilityGrants: grants.map((g) => ({ level: g.level, role: g.role })),
  };
}

/**
 * Write a governance configuration into the org's policy tables — ONE
 * withTenant transaction, admin-only, idempotent (upserts + declarative
 * grant sync), audited as 'policy.changed' with the full {old,new} snapshot.
 * `source` names where the config came from ('preset:kanzlei' | 'import').
 */
export async function applyGovernanceConfig(input: {
  orgId: string;
  actorUserId: string;
  config: GovernanceConfig;
  source: string;
}): Promise<ApplyGovernanceResult> {
  const { config, corrected } = enforceMoneyFailsafe(input.config);

  return withTenant(input.orgId, async (tx) => {
    await requireAdmin(tx, input.orgId, input.actorUserId);

    const old = await snapshotGovernance(tx);

    // Approval policies: upsert per skill (declarative for the listed skills;
    // skills a config does not mention keep their existing policy).
    for (const p of config.approvalPolicies) {
      const data = {
        mode: p.mode,
        thresholdAmount: p.thresholdAmount,
        approverRole: p.approverRole,
      };
      await tx.approvalPolicy.upsert({
        where: { orgId_skillKey: { orgId: input.orgId, skillKey: p.skillKey } },
        create: { orgId: input.orgId, skillKey: p.skillKey, ...data },
        update: data,
      });
    }

    // Grant matrix: declarative replacement — the config IS the matrix.
    const wanted = new Set(config.visibilityGrants.map((g) => `${g.level}:${g.role}`));
    const existing = await tx.visibilityGrant.findMany();
    for (const g of existing) {
      if (!wanted.has(`${g.level}:${g.role}`)) {
        await tx.visibilityGrant.delete({ where: { id: g.id } });
      }
    }
    const have = new Set(existing.map((g) => `${g.level}:${g.role}`));
    for (const g of config.visibilityGrants) {
      if (!have.has(`${g.level}:${g.role}`)) {
        await tx.visibilityGrant.create({
          data: { orgId: input.orgId, level: g.level, role: g.role },
        });
      }
    }

    // One failsafe audit entry per corrected skill — same action name as the
    // engine's runtime failsafe, so the audit trail reads uniformly.
    for (const skillKey of corrected) {
      await logAudit(tx, {
        orgId: input.orgId,
        actorId: input.actorUserId,
        actorType: 'human',
        action: 'policy.overridden_failsafe',
        target: `governance:${skillKey}`,
        detail: {
          source: input.source,
          requestedMode: 'never',
          appliedMode: 'always',
          reason: 'handlesMoney skill: the approval requirement cannot be disabled',
        },
      });
    }

    await logAudit(tx, {
      orgId: input.orgId,
      actorId: input.actorUserId,
      actorType: 'human',
      action: 'policy.changed',
      target: `governance:${input.source}`,
      detail: {
        source: input.source,
        failsafeCorrected: corrected,
        old,
        new: {
          approvalPolicies: config.approvalPolicies,
          visibilityGrants: config.visibilityGrants,
        },
      },
    });

    return {
      failsafeCorrected: corrected,
      policiesApplied: config.approvalPolicies.length,
      grantsApplied: config.visibilityGrants.length,
    };
  });
}

// -----------------------------------------------------------------------------
// Entry points: preset + import
// -----------------------------------------------------------------------------

function presetToConfig(preset: PolicyPreset): GovernanceConfig {
  return {
    format: GOVERNANCE_FORMAT,
    version: GOVERNANCE_VERSION,
    approvalPolicies: preset.approvalPolicies.map((p) => ({
      skillKey: p.skillKey,
      mode: p.mode,
      thresholdAmount: p.thresholdAmount ?? null,
      approverRole: p.approverRole,
    })),
    visibilityGrants: preset.visibilityGrants.map((g) => ({ level: g.level, role: g.role })),
  };
}

/** Apply one of the built-in industry presets. */
export async function applyPolicyPreset(input: {
  orgId: string;
  actorUserId: string;
  presetKey: string;
}): Promise<ApplyGovernanceResult> {
  const preset = getPolicyPreset(input.presetKey);
  return applyGovernanceConfig({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    config: presetToConfig(preset),
    source: `preset:${preset.key}`,
  });
}

/** Validate + apply an untrusted governance JSON (see parseGovernanceConfig). */
export async function importGovernance(input: {
  orgId: string;
  actorUserId: string;
  json: string;
}): Promise<ApplyGovernanceResult> {
  const config = parseGovernanceConfig(input.json);
  return applyGovernanceConfig({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    config,
    source: 'import',
  });
}

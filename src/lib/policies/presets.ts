// Governance presets — PURE DATA, no logic.
//
// One preset = sensible defaults for everything an org would otherwise
// configure piece by piece: per-skill approval policies (approval_policies)
// and the role⇄visibility grant matrix (visibility_grants). Applying a preset
// (src/lib/policies/governance.ts) writes these values transactionally into
// the EXISTING tables — nothing here invents new structures.
//
// FAILSAFE INVARIANT: no preset may set a handlesMoney skill to mode 'never'.
// The apply/import layer corrects such configs fail-closed (and audits), and
// tests/policy-presets.test.ts asserts the data below never even tries.
//
// Skill keys must match src/lib/skills/catalog (beleg_kontieren and
// rechnung_erstellen are the money skills; angebot_erstellen is external
// communication with an always-guardrail; wissen_zusammenfassen only reads).
import type { ApprovalMode, DocumentVisibility, Role } from '@prisma/client';

export interface PresetApprovalPolicy {
  skillKey: string;
  mode: ApprovalMode;
  /** EUR; required for mode 'threshold'. */
  thresholdAmount?: number;
  /** Who decides the resulting approvals ('lead' | 'admin'). */
  approverRole: Role;
}

export interface PresetVisibilityGrant {
  level: DocumentVisibility;
  role: Role;
}

export interface PolicyPreset {
  /** Stable identifier — also the i18n key for name/description. */
  key: 'kanzlei' | 'gesundheitswesen' | 'handwerk';
  approvalPolicies: PresetApprovalPolicy[];
  /** The COMPLETE desired grant matrix — applying a preset replaces the
   * existing grants declaratively (grants not listed here are revoked). */
  visibilityGrants: PresetVisibilityGrant[];
}

/**
 * Law/tax firm: strict approvals, low money thresholds, four-eyes (admin
 * approves money), knowledge tiered — members see only 'open'.
 */
const KANZLEI: PolicyPreset = {
  key: 'kanzlei',
  approvalPolicies: [
    { skillKey: 'beleg_kontieren', mode: 'threshold', thresholdAmount: 50, approverRole: 'admin' },
    { skillKey: 'rechnung_erstellen', mode: 'always', approverRole: 'admin' },
    { skillKey: 'angebot_erstellen', mode: 'always', approverRole: 'lead' },
    // Read-only skill (no acting steps): 'never' is honest, not a risk.
    { skillKey: 'wissen_zusammenfassen', mode: 'never', approverRole: 'lead' },
  ],
  visibilityGrants: [
    { level: 'restricted', role: 'lead' },
    { level: 'restricted', role: 'admin' },
    { level: 'confidential', role: 'admin' },
  ],
};

/**
 * Healthcare: maximally strict — every skill needs approval by an admin,
 * anything above 'open' is admin-only (personal data stays locked down).
 */
const GESUNDHEITSWESEN: PolicyPreset = {
  key: 'gesundheitswesen',
  approvalPolicies: [
    { skillKey: 'beleg_kontieren', mode: 'always', approverRole: 'admin' },
    { skillKey: 'rechnung_erstellen', mode: 'always', approverRole: 'admin' },
    { skillKey: 'angebot_erstellen', mode: 'always', approverRole: 'admin' },
    { skillKey: 'wissen_zusammenfassen', mode: 'always', approverRole: 'admin' },
  ],
  visibilityGrants: [
    { level: 'restricted', role: 'admin' },
    { level: 'confidential', role: 'admin' },
  ],
};

/**
 * Trades/SMB: pragmatic — higher thresholds, leads approve, broad knowledge
 * access. Money skills STAY guarded (threshold, never 'never').
 */
const HANDWERK: PolicyPreset = {
  key: 'handwerk',
  approvalPolicies: [
    { skillKey: 'beleg_kontieren', mode: 'threshold', thresholdAmount: 250, approverRole: 'lead' },
    { skillKey: 'rechnung_erstellen', mode: 'threshold', thresholdAmount: 1000, approverRole: 'lead' },
    // Quotes go out without a pause — deliberate low-friction choice for SMB
    // (not a money skill; the failsafe does not apply).
    { skillKey: 'angebot_erstellen', mode: 'never', approverRole: 'lead' },
    { skillKey: 'wissen_zusammenfassen', mode: 'never', approverRole: 'lead' },
  ],
  visibilityGrants: [
    { level: 'restricted', role: 'member' },
    { level: 'restricted', role: 'lead' },
    { level: 'restricted', role: 'admin' },
    { level: 'confidential', role: 'lead' },
    { level: 'confidential', role: 'admin' },
  ],
};

export const POLICY_PRESETS: readonly PolicyPreset[] = [KANZLEI, GESUNDHEITSWESEN, HANDWERK];

export function getPolicyPreset(key: string): PolicyPreset {
  const preset = POLICY_PRESETS.find((p) => p.key === key);
  if (!preset) throw new Error(`Unknown governance preset: ${JSON.stringify(key)}`);
  return preset;
}

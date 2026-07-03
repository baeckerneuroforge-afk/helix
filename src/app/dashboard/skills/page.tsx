import type { ApprovalPolicy } from '@prisma/client';
import { requireTenant } from '@/lib/auth-context';
import type { Dictionary, Locale } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n/server';
import { getApprovalPolicies } from '@/lib/policies';
import { listSkills } from '@/lib/skills';
import { GUARDRAIL_LIMIT_EUR } from '@/lib/skills/catalog/beleg_kontieren';
import { RECHNUNG_GUARDRAIL_LIMIT_EUR } from '@/lib/skills/catalog/rechnung_erstellen';
import type { SkillDef } from '@/lib/skills';
import { formatEuro } from '../ui';
import { startSkillRun } from './actions';

export const dynamic = 'force-dynamic';

/** Human-readable "when does a human have to approve" line per skill. */
function guardrailInfo(
  skill: SkillDef,
  policy: ApprovalPolicy | null,
  g: Dictionary['skills']['guardrail'],
  locale: Locale,
): string {
  if (policy) {
    if (policy.mode === 'always') return g.policyAlways;
    if (policy.mode === 'threshold' && policy.thresholdAmount) {
      return g.policyThreshold(formatEuro(policy.thresholdAmount.toNumber(), locale));
    }
    if (policy.mode === 'never') {
      return skill.handlesMoney ? g.policyNeverMoney : g.policyNever;
    }
  }
  if (skill.key === 'beleg_kontieren') {
    return g.receiptThreshold(formatEuro(GUARDRAIL_LIMIT_EUR, locale));
  }
  if (skill.key === 'rechnung_erstellen') {
    return g.invoiceThreshold(formatEuro(RECHNUNG_GUARDRAIL_LIMIT_EUR, locale));
  }
  if (skill.key === 'angebot_erstellen') {
    return g.quoteAlways;
  }
  if (skill.guardrail) return g.guardrailActive;
  return skill.handlesMoney ? g.moneyAlways : g.noneNeeded;
}

export default async function SkillsPage() {
  const { orgId } = await requireTenant();
  const { locale, t } = await getI18n();
  const f = t.skills.forms;
  const skills = listSkills();
  // One tenant transaction for all policies instead of one per skill.
  const policies = await getApprovalPolicies(orgId, skills.map((s) => s.key));

  return (
    <>
      <p className="page-intro">{t.skills.intro}</p>

      <div className="quick-grid">
        {skills.map((skill) => {
          const acts = skill.steps.some((s) => s.acts);
          return (
            <section className="card" key={skill.key} style={{ display: 'grid', gap: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{t.skillTitles[skill.key] ?? skill.title}</strong>
                <span className={`chip ${acts ? 'chip--orange' : 'chip--indigo'}`}>
                  {acts ? t.skills.acts : t.skills.readsOnly}
                </span>
              </div>
              <div>
                <span className="chip">{skill.key}</span>
              </div>
              <div className="row-meta">
                {guardrailInfo(skill, policies.get(skill.key) ?? null, t.skills.guardrail, locale)}
              </div>

              <form action={startSkillRun} style={{ marginTop: '0.4rem' }}>
                <input type="hidden" name="skillKey" value={skill.key} />
                {skill.key === 'beleg_kontieren' ? (
                  <>
                    <label htmlFor={`besch-${skill.key}`}>{f.description}</label>
                    <input
                      id={`besch-${skill.key}`}
                      name="beschreibung"
                      placeholder={f.descriptionPlaceholder}
                      required
                    />
                    <label htmlFor={`betrag-${skill.key}`}>{f.amountEur}</label>
                    <input
                      id={`betrag-${skill.key}`}
                      name="betragEur"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={f.amountPlaceholder}
                      required
                    />
                    <label htmlFor={`beleg-${skill.key}`}>{f.receiptNumber}</label>
                    <input id={`beleg-${skill.key}`} name="belegNummer" placeholder="B-2026-…" />
                  </>
                ) : skill.key === 'wissen_zusammenfassen' ? (
                  <>
                    <label htmlFor={`frage-${skill.key}`}>{f.questionTopic}</label>
                    <input
                      id={`frage-${skill.key}`}
                      name="frage"
                      placeholder={f.questionPlaceholder}
                      required
                    />
                  </>
                ) : skill.key === 'angebot_erstellen' ? (
                  <>
                    <label htmlFor={`kunde-${skill.key}`}>{f.customer}</label>
                    <input
                      id={`kunde-${skill.key}`}
                      name="kunde"
                      placeholder={f.customerPlaceholderQuote}
                      required
                    />
                    <label htmlFor={`leistung-${skill.key}`}>{f.service}</label>
                    <input
                      id={`leistung-${skill.key}`}
                      name="leistung"
                      placeholder={f.servicePlaceholder}
                      required
                    />
                    <label htmlFor={`betrag-${skill.key}`}>{f.amountEur}</label>
                    <input
                      id={`betrag-${skill.key}`}
                      name="betragEur"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={f.quoteAmountPlaceholder}
                      required
                    />
                    <label htmlFor={`email-${skill.key}`}>{f.recipientEmail}</label>
                    <input
                      id={`email-${skill.key}`}
                      name="email"
                      type="email"
                      placeholder={f.emailPlaceholderQuote}
                    />
                  </>
                ) : skill.key === 'rechnung_erstellen' ? (
                  <>
                    <label htmlFor={`kunde-${skill.key}`}>{f.customer}</label>
                    <input
                      id={`kunde-${skill.key}`}
                      name="kunde"
                      placeholder={f.customerPlaceholderInvoice}
                      required
                    />
                    <label htmlFor={`pos-${skill.key}`}>{f.positions}</label>
                    <textarea
                      id={`pos-${skill.key}`}
                      name="positionen"
                      rows={3}
                      placeholder={f.positionsPlaceholder}
                      required
                    />
                    <label htmlFor={`email-${skill.key}`}>{f.recipientEmail}</label>
                    <input
                      id={`email-${skill.key}`}
                      name="email"
                      type="email"
                      placeholder={f.emailPlaceholderInvoice}
                    />
                  </>
                ) : (
                  <>
                    <label htmlFor={`input-${skill.key}`}>{f.inputJson}</label>
                    <textarea id={`input-${skill.key}`} name="inputJson" rows={4} defaultValue="{}" />
                  </>
                )}
                <button type="submit" className="btn btn--primary">
                  {t.common.execute}
                </button>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}

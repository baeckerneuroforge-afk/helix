// "Getting started" — guided first run on the overview. Purely server-side:
// progress is derived from real data (no extra state, nothing to migrate) and
// the card disappears by itself once every step is done.
import Link from 'next/link';
import type { Dictionary } from '@/lib/i18n';

export interface OnboardingProgress {
  hasDocument: boolean;
  hasChatMessage: boolean;
  hasRun: boolean;
  hasCompanyProfile: boolean;
}

interface Step {
  done: boolean;
  title: string;
  hint: string;
  href: string;
  cta: string;
}

export function onboardingComplete(p: OnboardingProgress): boolean {
  return p.hasDocument && p.hasChatMessage && p.hasRun && p.hasCompanyProfile;
}

export function OnboardingCard({
  progress,
  dict,
}: {
  progress: OnboardingProgress;
  dict: Dictionary['onboarding'];
}) {
  if (onboardingComplete(progress)) return null;

  const steps: Step[] = [
    {
      done: progress.hasDocument,
      title: dict.steps.uploadTitle,
      hint: dict.steps.uploadHint,
      href: '/dashboard/knowledge',
      cta: dict.steps.uploadCta,
    },
    {
      done: progress.hasChatMessage,
      title: dict.steps.chatTitle,
      hint: dict.steps.chatHint,
      href: '/dashboard/chat',
      cta: dict.steps.chatCta,
    },
    {
      done: progress.hasRun,
      title: dict.steps.skillTitle,
      hint: dict.steps.skillHint,
      href: '/dashboard/skills',
      cta: dict.steps.skillCta,
    },
    {
      done: progress.hasCompanyProfile,
      title: dict.steps.companyTitle,
      hint: dict.steps.companyHint,
      href: '/dashboard/settings?tab=company',
      cta: dict.steps.companyCta,
    },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <section className="card onboarding">
      <h2>
        {dict.title}{' '}
        <span className="muted onboarding-count">
          {dict.doneCount(steps.length - remaining, steps.length)}
        </span>
      </h2>
      <ol className="onboarding-steps">
        {steps.map((step) => (
          <li key={step.title} className={step.done ? 'done' : undefined}>
            <span className="onboarding-check" aria-hidden>
              {step.done ? '✓' : '○'}
            </span>
            <div>
              <strong>{step.title}</strong>
              <div className="muted">{step.hint}</div>
            </div>
            {step.done ? null : (
              <Link href={step.href} className="btn btn--primary onboarding-cta">
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

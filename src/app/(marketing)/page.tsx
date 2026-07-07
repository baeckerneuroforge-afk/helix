import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  PageShell,
  Section,
  Eyebrow,
  CtaBand,
} from "@/components/marketing/site";
import { DNAStrand } from "@/components/marketing/brand";
import { LoopDiagram } from "@/components/marketing/subpage-client";
import {
  SkillRunSignature,
  CoreCard,
  DepartmentCard,
  AutonomySelector,
  LogoGrid,
  HomeArchitectureDiagram,
} from "@/components/marketing/home-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "helix — the operating system for company knowledge and work.",
  description:
    "helix is the operating system for a company's knowledge and work. Cited answers, human-gated actions, and an append-only audit — EU-hosted.",
  openGraph: {
    title: "helix — the operating system for company knowledge and work.",
    description:
      "Two strands: what your company knows, and what it does with it. Cited answers, human-gated actions, append-only audit.",
  },
};

export default async function Home() {
  const { userId, orgId } = await auth();
  if (userId) redirect(orgId ? "/dashboard" : "/select-org");

  return (
    <PageShell>
      {/* ------------------------------------------------------------------ */}
      {/* 1. HERO                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="m-hairline-b"
        style={{
          position: "relative",
          overflow: "hidden",
          background: "var(--m-background)",
        }}
      >
        {/* gridpaper background */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.35,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(to right, var(--m-hairline) 1px, transparent 1px), linear-gradient(to bottom, var(--m-hairline) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 60% 60% at 30% 30%, black 40%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 60% at 30% 30%, black 40%, transparent 75%)",
          }}
        />
        {/* ember glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: -160,
            top: -160,
            width: 520,
            height: 520,
            borderRadius: "50%",
            pointerEvents: "none",
            background:
              "radial-gradient(circle, rgba(214,83,26,0.14) 0%, rgba(214,83,26,0) 65%)",
          }}
        />
        <DNAStrand
          variant="diagonal"
          className="m-pointer-events-none"
          style={{
            position: "absolute",
            left: -96,
            top: 0,
            height: "140%",
            width: 360,
            opacity: 0.09,
          }}
        />

        <div
          style={{
            position: "relative",
            maxWidth: 1200,
            margin: "0 auto",
            padding: "80px 24px",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 56,
              gridTemplateColumns: "1.05fr 1fr",
              alignItems: "center",
            }}
            className="m-md-grid-1"
          >
            {/* Left — copy */}
            <div className="m-rise-in">
              {/* Pilot badge */}
              <div
                className="m-mono-sm"
                style={{
                  marginBottom: 24,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  border: "1px solid var(--m-hairline)",
                  background: "var(--m-surface)",
                  padding: "4px 12px",
                  color: "var(--m-muted-foreground)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--m-ember)",
                  }}
                  className="m-amber-pulse"
                />
                pilot program 2026 · three seats open
              </div>

              <h1
                style={{
                  color: "var(--m-foreground)",
                  fontFamily: 'var(--font-display, "Fraunces", Georgia, serif)',
                  letterSpacing: "-0.03em",
                }}
              >
                The operating <span className="m-text-ember">DNA</span> of your
                company.
              </h1>

              <p
                style={{
                  marginTop: 24,
                  fontSize: 18,
                  color: "var(--m-body)",
                }}
              >
                Two strands: what your company knows, and what it does with it.
                helix gathers the knowledge, keeps it current, and executes the
                real work on top of it — every answer cited, every risky action
                gated, every step written to an append-only ledger.
              </p>

              <div
                style={{
                  marginTop: 36,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Link href="/pilot" className="m-btn-primary">
                  Request a pilot →
                </Link>
                <Link href="/product" className="m-btn-secondary">
                  See the product
                </Link>
              </div>

              {/* Trust line */}
              <div
                className="m-mono-sm"
                style={{
                  marginTop: 32,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px 20px",
                  color: "var(--m-muted-foreground)",
                }}
              >
                <span>· EU hosting</span>
                <span>· no training on your data</span>
                <span>· append-only audit</span>
                <span>· enterprise-grade access control</span>
              </div>
            </div>

            {/* Right — SkillRunSignature */}
            <div className="m-rise-in" style={{ animationDelay: "80ms" }}>
              <SkillRunSignature />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. THE SHIFT                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Section bg="surface" border="bottom">
        <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
          <Eyebrow>The shift</Eyebrow>
          <h2
            style={{
              marginTop: 16,
              fontSize: 44,
              fontFamily: 'var(--font-display, "Fraunces", Georgia, serif)',
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            Most AI tools answer questions.
            <br />
            An <span className="m-text-ember">operating system</span> runs the
            work.
          </h2>
        </div>
        <div
          className="m-grid m-grid-3 m-md-grid-1"
          style={{ maxWidth: 1100, margin: "56px auto 0", gap: 40 }}
        >
          {(
            [
              ["01 · system", "Not a chatbot — a system of record and action."],
              ["02 · core", "Not one tool — one core, every department on top."],
              ["03 · trust", "Not a black box — every step cited, gated, and logged."],
            ] as const
          ).map(([label, line]) => (
            <div
              key={label}
              style={{
                borderLeft: "1px solid var(--m-hairline)",
                paddingLeft: 20,
              }}
            >
              <div
                className="m-mono-sm"
                style={{ marginBottom: 12, color: "var(--m-ember)" }}
              >
                {label}
              </div>
              <p style={{ fontSize: 16, color: "var(--m-foreground)" }}>
                {line}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. HOW IT WORKS — architecture diagram                             */}
      {/* ------------------------------------------------------------------ */}
      <Section>
        <Eyebrow>How it works</Eyebrow>
        <h2 style={{ maxWidth: "22ch" }}>One core. Four moving parts.</h2>
        <p style={{ marginTop: 16, maxWidth: "62ch", color: "var(--m-body)" }}>
          Inputs flow in from the tools your company already uses. The core
          turns them into knowledge and action. Outputs land back in the same
          tools — and the loop keeps watching.
        </p>
        <div
          className="m-gridpaper"
          style={{
            marginTop: 48,
            overflow: "hidden",
            borderRadius: 16,
            border: "1px solid var(--m-hairline)",
            padding: 40,
          }}
        >
          <HomeArchitectureDiagram />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. THE CORE, IN DETAIL                                             */}
      {/* ------------------------------------------------------------------ */}
      <Section bg="surface" border="both">
        <Eyebrow>The core, in detail</Eyebrow>
        <h2 style={{ maxWidth: "22ch" }}>Four parts. One audited foundation.</h2>

        <div
          className="m-grid m-grid-2 m-md-grid-1"
          style={{ marginTop: 48, gap: 24 }}
        >
          <CoreCard
            label="knowledge"
            title="Grounded, never guessed."
            body="Every answer is retrieved from your own documents and cited to the source. If it isn't in your knowledge, helix says so."
            run={[
              { t: "query · refund policy for enterprise", k: "info" },
              { t: "retrieved · 2 passages", k: "ok" },
              { t: "answer · prorated within 30 days", k: "ok" },
              { t: "source: refund-policy.pdf p.14", k: "audit" },
            ]}
          />
          <CoreCard
            label="skills"
            title="Agents that do the work."
            body="helix runs multi-step skills — read a transcript, build the deliverable, prepare the booking — not just chat."
            run={[
              { t: "skill · draft_proposal", k: "info" },
              { t: "read brief · pull wins & pricing", k: "ok" },
              { t: "assemble draft · 6 sections", k: "ok" },
              { t: "artifact ready · proposal_v1.pdf", k: "done" },
            ]}
          />
          <CoreCard
            label="governance"
            title="Powerful, but never unchecked."
            body="Risky actions pause for human approval. Money and external actions are gated. Every step is written to an append-only ledger."
            run={[
              { t: "booking prepared · €1,240.00", k: "ok" },
              { t: "guardrail: amount over €1,000 — waiting for human", k: "wait" },
              { t: "approved · anna k → markus r", k: "approved" },
              { t: "+1 audit_log · immutable", k: "audit" },
            ]}
          />
          <CoreCard
            label="memory"
            title="It remembers your customers."
            body="Every client keeps their own context across runs, so helix picks up where it left off — without leaking anything between tenants."
            run={[
              { t: "customer · acme corp", k: "info" },
              { t: "recalled: 3 prior interactions", k: "ok" },
              { t: "context loaded · scoped to tenant", k: "ok" },
              { t: "ready · continue where you left off", k: "done" },
            ]}
          />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. THE LOOP                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Section>
        <Eyebrow>The loop</Eyebrow>
        <h2 style={{ maxWidth: "22ch" }}>The system watches its own work.</h2>
        <p style={{ marginTop: 16, maxWidth: "62ch", color: "var(--m-body)" }}>
          helix doesn&apos;t just run once. It observes what happened, compares
          it against the target, flags the gap, and corrects — with as much or
          as little autonomy as you allow.
        </p>

        <div
          className="m-md-grid-1"
          style={{
            marginTop: 48,
            display: "grid",
            alignItems: "center",
            gap: 48,
            gridTemplateColumns: "minmax(0,1fr) 1.1fr",
          }}
        >
          <div
            className="m-gridpaper"
            style={{
              borderRadius: 16,
              border: "1px solid var(--m-hairline)",
              padding: 40,
            }}
          >
            <LoopDiagram />
          </div>

          <div>
            <div
              className="m-mono-sm"
              style={{ marginBottom: 16, color: "var(--m-muted-foreground)" }}
            >
              autonomy · per workflow
            </div>
            <AutonomySelector />
            <p
              style={{
                marginTop: 24,
                maxWidth: "52ch",
                fontSize: 15,
                color: "var(--m-body)",
              }}
            >
              You decide how much autonomy each workflow gets. Money and
              irreversible actions always stay gated.
            </p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. INTEGRATIONS                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Section bg="surface" border="both">
        <Eyebrow>Integrations</Eyebrow>
        <h2 style={{ maxWidth: "24ch" }}>
          Connect the tools your company already runs on.
        </h2>
        <p style={{ marginTop: 16, maxWidth: "62ch", color: "var(--m-body)" }}>
          helix reads from your tools and, with approval, writes back into
          them. New connectors are added to the same core — one integration
          layer, every department.
        </p>
        <LogoGrid />
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12.5,
            color: "var(--m-muted-foreground)",
          }}
        >
          <span>15+ connectors shipped and shipping</span>
          <Link
            href="/product/integrations"
            className="m-hover-text-ember"
            style={{ color: "var(--m-foreground)" }}
          >
            See all integrations →
          </Link>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 7. DEPARTMENTS                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Section>
        <Eyebrow>Every department</Eyebrow>
        <h2 style={{ maxWidth: "22ch" }}>
          One operating system. Every team on top.
        </h2>

        <div
          className="m-grid m-grid-2 m-md-grid-1"
          style={{ marginTop: 48, gap: 24 }}
        >
          <DepartmentCard
            label="consulting"
            title="Turn a call into a finished framework."
            line="transcript → deliverable"
            run={[
              { t: "ingest · zoom transcript (47 min)", k: "ok" },
              { t: "extract · decisions, owners, dates", k: "ok" },
              { t: "assemble · framework_v1.docx", k: "done" },
            ]}
          />
          <DepartmentCard
            label="customer support"
            title="Answer from your knowledge, not guesses."
            line="ticket → cited reply"
            run={[
              { t: "ticket · refund on annual plan?", k: "info" },
              { t: "retrieved · policy p.14", k: "ok" },
              { t: "reply drafted · source cited", k: "done" },
            ]}
          />
          <DepartmentCard
            label="sales"
            title="From call to proposal."
            line="call → draft offer, gated"
            run={[
              { t: "call · acme corp · 32 min", k: "ok" },
              { t: "assemble · proposal draft", k: "ok" },
              { t: "guardrail: pricing outside band — waiting for human", k: "wait" },
            ]}
          />
          <DepartmentCard
            label="finance"
            title="Process the routine, gate the risky."
            line="invoice → booking, human-approved"
            run={[
              { t: "invoice received · €1,240.00", k: "ok" },
              { t: "guardrail: amount over €1,000 — waiting for human", k: "wait" },
              { t: "approved · +1 audit_log · immutable", k: "audit" },
            ]}
          />
        </div>
        <p
          className="m-mono-sm"
          style={{ marginTop: 32, color: "var(--m-muted-foreground)" }}
        >
          {"// same core, same governance, same audit — a new department is a new skill, not a new system."}
        </p>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 8. SECURITY & TRUST                                                */}
      {/* ------------------------------------------------------------------ */}
      <Section bg="surface" border="both">
        <Eyebrow>Security &amp; trust</Eyebrow>
        <h2 style={{ maxWidth: "22ch" }}>Enterprise-grade by default.</h2>

        <div
          className="m-grid m-grid-3 m-md-grid-1"
          style={{ marginTop: 48, gap: 24 }}
        >
          {(
            [
              ["eu hosting", "Data stays in the EU — inference, storage, backups."],
              ["no training on your data", "Your data is never used to train models."],
              ["append-only audit", "Every action is logged and immutable."],
              ["access control", "Strict per-tenant isolation, role-based access."],
              ["human-in-the-loop", "Risky actions require approval before they run."],
              ["dpa from day one", "Signed before you upload anything."],
            ] as const
          ).map(([label, line]) => (
            <div
              key={label}
              style={{
                borderRadius: 14,
                border: "1px solid var(--m-hairline)",
                background: "var(--m-background)",
                padding: 24,
              }}
            >
              <div
                className="m-mono-sm"
                style={{ marginBottom: 12, color: "var(--m-ember)" }}
              >
                {label}
              </div>
              <p style={{ fontSize: 15, color: "var(--m-foreground)" }}>
                {line}
              </p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32 }}>
          <Link
            href="/security"
            className="m-mono m-hover-text-ember"
            style={{ color: "var(--m-foreground)" }}
          >
            → read the full security page
          </Link>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 9. PILOT CTA                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Section>
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <Eyebrow>Pilot 2026</Eyebrow>
          <h2 style={{ marginTop: 12 }}>Three pilot seats. 2026.</h2>
          <p
            style={{
              margin: "20px auto 0",
              maxWidth: "58ch",
              color: "var(--m-body)",
            }}
          >
            helix is onboarding a small number of pilot companies in 2026. Work
            directly with the founder, shape the roadmap, get white-glove setup
            — DPA before you upload anything.
          </p>
          <div
            style={{
              marginTop: 32,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <Link href="/pilot" className="m-btn-primary">
              Request a pilot →
            </Link>
            <a
              href="mailto:pilot@helix.ai"
              className="m-mono m-hover-text-ember"
              style={{ color: "var(--m-foreground)" }}
            >
              pilot@helix.ai
            </a>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 10. CTA BAND                                                       */}
      {/* ------------------------------------------------------------------ */}
      <CtaBand />
    </PageShell>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HelixWordmark } from "@/components/marketing/brand";

/* ========================================================================== */
/*  NAV data                                                                  */
/* ========================================================================== */

type MenuLink = { label: string; href: string; desc?: string };
type MenuGroup = { heading: string; links: MenuLink[] };
type NavItem = {
  href: string;
  label: string;
  menu?: {
    groups: MenuGroup[];
    feature: {
      eyebrow: string;
      title: string;
      body: string;
      img: string;
      href: string;
    };
  };
};

const NAV: NavItem[] = [
  {
    href: "/product",
    label: "Product",
    menu: {
      groups: [
        {
          heading: "The core",
          links: [
            { label: "Knowledge",  href: "/product/knowledge",   desc: "Grounded, never guessed." },
            { label: "Skills",     href: "/product/skills",      desc: "Agents that do the work." },
            { label: "Governance", href: "/product/governance",  desc: "Powerful, never unchecked." },
            { label: "Memory",     href: "/product/memory",      desc: "It remembers your customers." },
          ],
        },
        {
          heading: "Platform",
          links: [
            { label: "The Loop",     href: "/product/loop",         desc: "Observe → compare → flag → correct." },
            { label: "Integrations", href: "/product/integrations", desc: "Read + write, one core." },
            { label: "Overview",     href: "/product",              desc: "The full architecture." },
            { label: "Security",     href: "/security",             desc: "Enterprise-grade by default." },
          ],
        },
      ],
      feature: {
        eyebrow: "Architecture",
        title: "One core. Every department on top.",
        body: "See how input, core and output share one audited foundation.",
        img: "/marketing/stack.jpg",
        href: "/product",
      },
    },
  },
  {
    href: "/use-cases",
    label: "Use cases",
    menu: {
      groups: [
        {
          heading: "By department",
          links: [
            { label: "Consulting",       href: "/use-cases/consulting", desc: "Call → framework." },
            { label: "Customer support", href: "/use-cases/support",    desc: "Cited answers, in-tab." },
            { label: "Sales",            href: "/use-cases/sales",      desc: "Call → proposal, gated." },
            { label: "Finance",          href: "/use-cases/finance",    desc: "Book routine, gate risky." },
          ],
        },
      ],
      feature: {
        eyebrow: "Same engine",
        title: "Every department, one core",
        body: "One audit trail, one knowledge base, one guardrail model.",
        img: "/marketing/thread.jpg",
        href: "/use-cases",
      },
    },
  },
  {
    href: "/industries",
    label: "Industries",
    menu: {
      groups: [
        {
          heading: "How helix fits",
          links: [
            { label: "Professional services & agencies", href: "/industries/professional-services" },
            { label: "SaaS & technology",                href: "/industries/saas" },
            { label: "Financial services",               href: "/industries/financial-services" },
            { label: "Manufacturing & Mittelstand",      href: "/industries/manufacturing" },
          ],
        },
      ],
      feature: {
        eyebrow: "Fluent in yours",
        title: "Built for every company",
        body: "helix ships as an engine, not a vertical. Your knowledge shapes the skills.",
        img: "/marketing/gears.jpg",
        href: "/industries",
      },
    },
  },
  {
    href: "/security",
    label: "Security",
    menu: {
      groups: [
        {
          heading: "Pillars",
          links: [
            { label: "Data & Hosting",     href: "/security/data-hosting",     desc: "EU · encrypted · yours." },
            { label: "Access & Isolation", href: "/security/access-isolation", desc: "Tenant-isolated at the DB." },
            { label: "Audit & Compliance", href: "/security/audit-compliance", desc: "Append-only ledger." },
            { label: "Human-in-the-loop",  href: "/product/governance",        desc: "Risky steps pause." },
          ],
        },
        {
          heading: "Legal",
          links: [
            { label: "DPA",     href: "/dpa",     desc: "Available on request." },
            { label: "Privacy", href: "/privacy", desc: "Privacy notice." },
          ],
        },
      ],
      feature: {
        eyebrow: "Architecture",
        title: "GDPR isn't an annex",
        body: "It's how helix is built — from the data plane to the audit log.",
        img: "/marketing/vault.jpg",
        href: "/security",
      },
    },
  },
  {
    href: "/pilot",
    label: "Pilot",
    menu: {
      groups: [
        {
          heading: "Program 2026",
          links: [
            { label: "Pilot program",   href: "/pilot",         desc: "Three seats. 2026." },
            { label: "Request a pilot", href: "/pilot/request", desc: "Tell us what you need." },
          ],
        },
      ],
      feature: {
        eyebrow: "Three seats",
        title: "Work with the founder",
        body: "Free during pilot. DPA before you upload anything.",
        img: "/marketing/ledger.jpg",
        href: "/pilot",
      },
    },
  },
];

/* ========================================================================== */
/*  Wordmark wrapper                                                          */
/* ========================================================================== */

export function Wordmark({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  return <HelixWordmark tone={tone} className={className} />;
}

/* ========================================================================== */
/*  MegaMenu                                                                  */
/* ========================================================================== */

function MegaMenu({ item, onClose }: { item: NavItem; onClose: () => void }) {
  if (!item.menu) return null;
  const { groups, feature } = item.menu;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: 0,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: groups.length > 1 ? "1fr 1fr" : "1fr",
          gap: 40,
          padding: 40,
        }}
      >
        {groups.map((g) => (
          <div key={g.heading}>
            <div className="m-eyebrow" style={{ marginBottom: 16 }}>
              {g.heading}
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {g.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} onClick={onClose} className="m-mega-link">
                    <span
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 500,
                          color: "var(--m-foreground)",
                        }}
                      >
                        {l.label}
                      </span>
                      <span className="m-mega-arrow" aria-hidden>
                        →
                      </span>
                    </span>
                    {l.desc && (
                      <span
                        style={{
                          display: "block",
                          marginTop: 2,
                          fontSize: 13.5,
                          color: "var(--m-body)",
                        }}
                      >
                        {l.desc}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Link
        href={feature.href}
        onClick={onClose}
        className="m-mega-feature"
        style={{ background: "#141519", color: "#EDE9E1", padding: 40 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={feature.img}
          alt=""
          loading="lazy"
          className="m-img-tinted m-pointer-events-none"
          style={{
            position: "absolute",
            inset: 0,
            height: "100%",
            width: "100%",
            objectFit: "cover",
            opacity: 0.7,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top right, rgba(20,21,25,0.95), rgba(20,21,25,0.7), transparent)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            height: "100%",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 32,
          }}
        >
          <div
            className="m-mono-sm"
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--m-ember)",
            }}
          >
            {feature.eyebrow}
          </div>
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                lineHeight: 1.2,
                color: "#F5F2EA",
              }}
            >
              {feature.title}
            </div>
            <p
              style={{
                marginTop: 8,
                maxWidth: "32ch",
                fontSize: 14.5,
                color: "#C9C7BE",
              }}
            >
              {feature.body}
            </p>
            <div
              className="m-mono-sm m-mega-explore"
              style={{
                marginTop: 24,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "#EDE9E1",
              }}
            >
              explore <span>→</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ========================================================================== */
/*  TopNav                                                                    */
/* ========================================================================== */

export function TopNav() {
  const [mobile, setMobile] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenIdx(null), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  useEffect(() => () => cancelClose(), []);

  return (
    <header className="m-header">
      <div className="m-header-inner">
        <Wordmark />

        <nav
          className="m-sm-only-hidden m-flex m-items-center m-gap-1"
          style={{ position: "relative" }}
        >
          {NAV.map((n, i) => (
            <div
              key={n.href}
              style={{ position: "relative" }}
              onMouseEnter={() => {
                cancelClose();
                if (n.menu) setOpenIdx(i);
              }}
              onMouseLeave={scheduleClose}
            >
              <Link href={n.href} className="m-nav-item-link">
                {n.label}
                {n.menu && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    style={{
                      transition: "transform 200ms ease",
                      transform: openIdx === i ? "rotate(180deg)" : undefined,
                      color:
                        openIdx === i
                          ? "var(--m-ember)"
                          : "var(--m-muted-foreground)",
                    }}
                    aria-hidden
                  >
                    <path
                      d="M2 4l3 3 3-3"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </Link>
            </div>
          ))}
        </nav>

        <div className="m-sm-only-hidden m-flex m-items-center m-gap-3">
          <a
            href="mailto:pilot@helix.ai"
            className="m-mono m-text-muted-foreground m-transition-colors m-hover-text-foreground"
          >
            pilot@helix.ai
          </a>
          <Link
            href="/pilot"
            className="m-btn-primary"
            style={{ padding: "8px 16px", fontSize: 14 }}
          >
            Request a pilot
          </Link>
        </div>

        <button
          onClick={() => setMobile(!mobile)}
          className="m-mono m-md-hidden"
          aria-label="menu"
          style={{
            all: "unset",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {mobile ? "close" : "menu"}
        </button>
      </div>

      {/* Desktop mega menu panel */}
      {openIdx !== null && NAV[openIdx].menu && (
        <div
          className="m-sm-only-hidden"
          style={{
            position: "absolute",
            insetInline: 0,
            top: 64,
            zIndex: 40,
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
            <div className="m-mega-panel m-rise-in">
              <MegaMenu item={NAV[openIdx]} onClose={() => setOpenIdx(null)} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile */}
      {mobile && (
        <div
          className="m-md-hidden m-hairline-t"
          style={{
            maxHeight: "70vh",
            overflowY: "auto",
            background: "var(--m-surface)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "16px 24px",
            }}
          >
            {NAV.map((n) => (
              <div key={n.href} className="m-hairline-b" style={{ padding: "12px 0" }}>
                <Link
                  href={n.href}
                  onClick={() => setMobile(false)}
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--m-foreground)",
                  }}
                >
                  {n.label}
                </Link>
                {n.menu && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px 16px",
                    }}
                  >
                    {n.menu.groups.flatMap((g) => g.links).map((l) => (
                      <Link
                        key={l.label}
                        href={l.href}
                        onClick={() => setMobile(false)}
                        className="m-mono-sm m-text-muted-foreground m-hover-text-ember"
                      >
                        {l.label.toLowerCase()}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link
              href="/pilot"
              onClick={() => setMobile(false)}
              className="m-btn-primary"
              style={{
                marginTop: 16,
                justifyContent: "center",
                padding: "12px 16px",
              }}
            >
              Request a pilot
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

"use client";

import type { CSSProperties } from "react";
import { BrandLogo } from "@/components/marketing/logo";

type Connector = {
  name: string;
  status: "shipped" | "roadmap";
  category: "comms" | "docs" | "work" | "crm" | "mail";
  svgl?: string;
  gilbarbara?: string;
  simpleicons?: string;
  color?: string; // brand hex, no '#'
  tint?: string; // ring/glow hex, no '#'
  src?: string; // absolute URL override
};

const CONNECTORS: Connector[] = [
  { name: "Slack",           category: "comms", status: "shipped", gilbarbara: "slack-icon",      simpleicons: "slack",            color: "611F69", tint: "ECB22E" },
  { name: "Zoom",            category: "comms", status: "shipped", gilbarbara: "zoom-icon",       simpleicons: "zoom",             color: "0B5CFF", tint: "0B5CFF" },
  { name: "Microsoft Teams", category: "comms", status: "shipped", gilbarbara: "microsoft-teams", simpleicons: "microsoftteams",   color: "6264A7", tint: "6264A7" },
  { name: "Intercom",        category: "comms", status: "shipped", gilbarbara: "intercom-icon",   simpleicons: "intercom",         color: "1F8DED", tint: "1F8DED" },
  { name: "Gmail",           category: "mail",  status: "shipped", gilbarbara: "google-gmail",    simpleicons: "gmail",            color: "EA4335", tint: "EA4335" },
  { name: "Outlook",         category: "mail",  status: "shipped", svgl: "microsoft-outlook",     simpleicons: "microsoftoutlook", color: "0078D4", tint: "0078D4" },
  { name: "Notion",          category: "docs",  status: "shipped", gilbarbara: "notion-icon",     simpleicons: "notion",           color: "111111", tint: "8A8880" },
  { name: "Google Drive",    category: "docs",  status: "shipped", gilbarbara: "google-drive",    simpleicons: "googledrive",      color: "4285F4", tint: "0F9D58" },
  { name: "Google Calendar", category: "docs",  status: "shipped", gilbarbara: "google-calendar", simpleicons: "googlecalendar",   color: "4285F4", tint: "4285F4" },
  { name: "Confluence",      category: "docs",  status: "roadmap", gilbarbara: "confluence",      simpleicons: "confluence",       color: "172B4D", tint: "2684FF" },
  { name: "Linear",          category: "work",  status: "shipped", gilbarbara: "linear-icon",     simpleicons: "linear",           color: "5E6AD2", tint: "5E6AD2" },
  { name: "GitHub",          category: "work",  status: "shipped", gilbarbara: "github-icon",     simpleicons: "github",           color: "181717", tint: "8A8880" },
  { name: "Jira",            category: "work",  status: "roadmap", gilbarbara: "jira",            simpleicons: "jira",             color: "0052CC", tint: "2684FF" },
  { name: "HubSpot",         category: "crm",   status: "shipped", src: "https://cdn.simpleicons.org/hubspot/FF7A59", simpleicons: "hubspot", color: "FF7A59", tint: "FF7A59" },
  { name: "Salesforce",      category: "crm",   status: "roadmap", gilbarbara: "salesforce",      simpleicons: "salesforce",       color: "00A1E0", tint: "00A1E0" },
];

const CATEGORY_LABEL: Record<Connector["category"], string> = {
  comms: "Communication",
  mail: "Email",
  docs: "Docs & drive",
  work: "Issues & code",
  crm: "CRM",
};

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        height: 6,
        width: 6,
        borderRadius: 999,
        background: color,
      }}
    />
  );
}

function LogoTile({
  c,
  index,
  size = 36,
}: {
  c: Connector;
  index: number;
  size?: number;
}) {
  return (
    <div
      className={`m-logo-tile m-rise-stagger ${c.status === "roadmap" ? "m-logo-tile--roadmap" : ""}`}
      style={{
        "--i": index,
        "--brand": `#${c.color ?? "171310"}`,
        "--tint": `#${c.tint ?? c.color ?? "171310"}`,
        position: "relative",
        display: "flex",
        aspectRatio: "1 / 1",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16,
        border: "1px solid var(--m-hairline)",
        background: "#fff",
      } as CSSProperties}
      title={`${c.name}${c.status === "roadmap" ? " · roadmap" : ""}`}
      aria-label={c.name}
    >
      <span className="m-logo-tile__glow" aria-hidden />
      <BrandLogo
        name={c.name}
        svgl={c.svgl}
        gilbarbara={c.gilbarbara}
        simpleicons={c.simpleicons}
        fallbackColor={c.color}
        src={c.src}
        size={size}
      />
      {c.status === "roadmap" && <span className="m-logo-tile__badge">soon</span>}
    </div>
  );
}

/* ============================================================
 * IntegrationGrid — connectors grouped by category, with legend
 * ============================================================ */
export function IntegrationGrid() {
  const groups = (Object.keys(CATEGORY_LABEL) as Connector["category"][]).map(
    (cat) => ({
      cat,
      items: CONNECTORS.filter((c) => c.category === cat),
    }),
  );

  return (
    <>
      <div
        className="m-sm-only-hidden"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 24,
          fontSize: 12,
          color: "var(--m-muted-foreground)",
          marginTop: -28,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Dot color="#2E7D55" /> shipped
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Dot color="#B7B4AA" /> roadmap
        </span>
      </div>

      <div style={{ marginTop: 40, display: "grid", gap: 40 }}>
        {groups.map((g) => (
          <div key={g.cat}>
            <div
              style={{
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "var(--m-muted-foreground)",
                }}
              >
                {CATEGORY_LABEL[g.cat]}
              </span>
              <span
                style={{ height: 1, flex: 1, background: "var(--m-hairline)" }}
              />
              <span
                style={{ fontSize: 11, color: "var(--m-muted-foreground)" }}
              >
                {g.items.length}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                gap: 12,
              }}
            >
              {g.items.map((c, i) => (
                <LogoTile key={c.name} c={c} index={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================================================
 * IntegrationConstellation — rotating ring of logos around the core.
 * ============================================================ */
export function IntegrationConstellation() {
  const ring: Connector[] = [
    { name: "Slack",   category: "comms", status: "shipped", gilbarbara: "slack-icon",   simpleicons: "slack",       color: "611F69", tint: "ECB22E" },
    { name: "Notion",  category: "docs",  status: "shipped", gilbarbara: "notion-icon",  simpleicons: "notion",      color: "111111", tint: "8A8880" },
    { name: "Linear",  category: "work",  status: "shipped", gilbarbara: "linear-icon",  simpleicons: "linear",      color: "5E6AD2", tint: "5E6AD2" },
    { name: "GitHub",  category: "work",  status: "shipped", gilbarbara: "github-icon",  simpleicons: "github",      color: "181717", tint: "8A8880" },
    { name: "Gmail",   category: "mail",  status: "shipped", gilbarbara: "google-gmail", simpleicons: "gmail",       color: "EA4335", tint: "EA4335" },
    { name: "Drive",   category: "docs",  status: "shipped", gilbarbara: "google-drive", simpleicons: "googledrive", color: "4285F4", tint: "0F9D58" },
    { name: "HubSpot", category: "crm",   status: "shipped", src: "https://cdn.simpleicons.org/hubspot/FF7A59", simpleicons: "hubspot", color: "FF7A59", tint: "FF7A59" },
    { name: "Zoom",    category: "comms", status: "shipped", gilbarbara: "zoom-icon",    simpleicons: "zoom",        color: "0B5CFF", tint: "0B5CFF" },
  ];
  const size = 420,
    cx = size / 2,
    cy = size / 2,
    r = 160;
  return (
    <div
      style={{
        position: "relative",
        margin: "0 auto",
        width: size,
        height: size,
        maxWidth: "100%",
      }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", inset: 0, height: "100%", width: "100%" }}
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#171310" strokeOpacity="0.08" strokeDasharray="3 6" />
        <circle cx={cx} cy={cy} r={r - 36} fill="none" stroke="#171310" strokeOpacity="0.06" />
        <circle cx={cx} cy={cy} r={r + 36} fill="none" stroke="#171310" strokeOpacity="0.04" />
        <g className="m-spin-slower" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          {ring.map((_, i) => {
            const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
            const x = cx + r * Math.cos(a),
              y = cy + r * Math.sin(a);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="#BE5A2C"
                strokeOpacity="0.18"
                strokeWidth="1"
                className="m-dash-flow-slow"
              />
            );
          })}
        </g>
      </svg>

      <div
        className="m-spin-slow"
        style={{ position: "absolute", inset: 0, transformOrigin: "center" }}
      >
        {ring.map((it, i) => {
          const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + r * Math.cos(a),
            y = cy + r * Math.sin(a);
          return (
            <div
              key={it.name}
              className="m-logo-tile"
              style={{
                position: "absolute",
                left: x - 28,
                top: y - 28,
                display: "flex",
                height: 56,
                width: 56,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 16,
                border: "1px solid var(--m-hairline)",
                background: "#fff",
                "--brand": `#${it.color ?? "171310"}`,
                "--tint": `#${it.tint ?? it.color ?? "171310"}`,
              } as CSSProperties}
              title={it.name}
            >
              <span className="m-logo-tile__glow" aria-hidden />
              <div className="m-spin-slower" style={{ transformOrigin: "center" }}>
                <BrandLogo
                  name={it.name}
                  svgl={it.svgl}
                  gilbarbara={it.gilbarbara}
                  simpleicons={it.simpleicons}
                  fallbackColor={it.color}
                  src={it.src}
                  size={28}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            height: 96,
            width: 96,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            border: "1px solid var(--m-hairline)",
            background: "var(--m-surface)",
            boxShadow: "0 20px 50px -20px rgba(190,90,44,0.55)",
          }}
        >
          <span
            className="m-soft-pulse"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              background: "color-mix(in oklab, var(--m-ember) 10%, transparent)",
            }}
          />
          <span
            style={{
              position: "relative",
              fontFamily: 'var(--font-display, "Fraunces", Georgia, serif)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: "var(--m-foreground)" }}>helix</span>
            <span style={{ color: "var(--m-ember)" }}>.ai</span>
          </span>
        </div>
      </div>
    </div>
  );
}

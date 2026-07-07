"use client";

import { useState, type CSSProperties } from "react";

// ---------------------------------------------------------------------------
// RunLine type — shared between AnimatedTerminal and page-level usage
// ---------------------------------------------------------------------------
export type RunLine = {
  t: string;
  k: "info" | "ok" | "wait" | "approved" | "done" | "audit";
};

// ---------------------------------------------------------------------------
// Trace — a warm, editorial timeline card. Each row = icon + label + text.
// ---------------------------------------------------------------------------
const KIND_META: Record<
  RunLine["k"],
  { label: string; dot: string; icon: "spark" | "check" | "clock" | "shield" | "quote" | "info" }
> = {
  info:     { label: "Question",  dot: "#8A8880", icon: "info"  },
  ok:       { label: "Retrieved", dot: "#2E7D55", icon: "spark" },
  wait:     { label: "Pending",   dot: "#BE5A2C", icon: "clock" },
  approved: { label: "Approved",  dot: "#2E7D55", icon: "shield" },
  done:     { label: "Answer",    dot: "#2E7D55", icon: "check" },
  audit:    { label: "Source",    dot: "#B7B4AA", icon: "quote" },
};

function TraceIcon({ kind }: { kind: RunLine["k"] }) {
  const t = KIND_META[kind].icon;
  const s = {
    stroke: "currentColor",
    strokeWidth: 1.5,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      {t === "spark" && <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" {...s} />}
      {t === "check" && <path d="M3 8.5l3 3 7-7" {...s} />}
      {t === "clock" && <><circle cx="8" cy="8" r="5.5" {...s} /><path d="M8 5v3l2 1.5" {...s} /></>}
      {t === "shield" && <path d="M8 2l5 2v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4l5-2z" {...s} />}
      {t === "quote" && <path d="M4 6h3v3H4c0-2 1-3 2-3M9 6h3v3H9c0-2 1-3 2-3" {...s} />}
      {t === "info" && <><circle cx="8" cy="8" r="5.5" {...s} /><path d="M8 7.5v3M8 5.5v.1" {...s} /></>}
    </svg>
  );
}

export function AnimatedTerminal({
  title,
  lines,
  className = "",
}: {
  title: string;
  lines: RunLine[];
  className?: string;
}) {
  return (
    <div className={`m-trace ${className}`}>
      <div className="m-trace__head">
        <div className="m-flex m-items-center m-gap-3">
          <span className="m-trace__mark" />
          <span className="m-trace__title">
            helix
            <span style={{ color: "var(--m-muted-foreground)" }}> · {title}</span>
          </span>
        </div>
        <span className="m-trace__live">
          <span className="m-trace__livedot" /> live
        </span>
      </div>
      <ol className="m-trace__body">
        {lines.map((l, i) => {
          const meta = KIND_META[l.k];
          const isPending = l.k === "wait";
          return (
            <li
              key={i}
              className="m-trace__row m-reveal-line"
              style={{ "--i": i, "--kind": meta.dot } as CSSProperties}
            >
              <span className="m-trace__icon" style={{ color: meta.dot }}>
                <TraceIcon kind={l.k} />
              </span>
              <div className="m-trace__content">
                <div className="m-trace__label">{meta.label}</div>
                <div
                  className={`m-trace__text ${l.k === "done" ? "m-trace__text--answer" : ""} ${l.k === "audit" ? "m-trace__text--source" : ""}`}
                >
                  {l.t}
                  {isPending && (
                    <span
                      className="m-soft-pulse"
                      style={{
                        marginLeft: 8,
                        display: "inline-block",
                        height: 8,
                        width: 8,
                        borderRadius: 999,
                        background: "var(--m-ember)",
                        verticalAlign: "middle",
                      }}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArchitectureDiagram — clean editorial: INPUT · CORE · OUTPUT
// ---------------------------------------------------------------------------
export function ArchitectureDiagram() {
  const inputs = [
    { name: "Email",  meta: "threads & attachments" },
    { name: "Zoom",   meta: "meeting transcripts" },
    { name: "Slack",  meta: "channels & DMs" },
    { name: "Notion", meta: "docs & wikis" },
    { name: "Linear", meta: "issues & specs" },
    { name: "GitHub", meta: "code & PRs" },
  ];
  const outputs = [
    { name: "Deliverables",          meta: "drafts, briefs, memos" },
    { name: "Flags & alerts",        meta: "gaps, risks, decisions" },
    { name: "Actions in your tools", meta: "issues, replies, updates" },
  ];
  const core = [
    { t: "Knowledge",  d: "grounded, cited" },
    { t: "Skills",     d: "agents that act" },
    { t: "Governance", d: "gates & audit" },
    { t: "Memory",     d: "per customer" },
  ];

  return (
    <div className="m-arch m-relative">
      <div className="m-arch__topbar">
        <span className="m-arch__eyebrow">architecture</span>
        <span className="m-arch__meta">input · core · output</span>
      </div>

      <div className="m-arch__grid">
        {/* INPUT */}
        <div className="m-arch__col">
          <div className="m-arch__collabel">Input</div>
          <ul className="m-arch__stack">
            {inputs.map((i) => (
              <li key={i.name} className="m-arch__node">
                <span className="m-arch__nodetitle">{i.name}</span>
                <span className="m-arch__nodemeta">{i.meta}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CORE */}
        <div className="m-arch__col">
          <div className="m-arch__collabel m-arch__collabel--accent">
            Helix · Core
          </div>
          <div className="m-arch__core">
            {core.map((c) => (
              <div key={c.t} className="m-arch__coreCell">
                <div className="m-arch__coreTitle">{c.t}</div>
                <div className="m-arch__coreDesc">{c.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* OUTPUT */}
        <div className="m-arch__col">
          <div className="m-arch__collabel m-arch__collabel--right">Output</div>
          <ul className="m-arch__stack">
            {outputs.map((o) => (
              <li key={o.name} className="m-arch__node m-arch__node--out">
                <span className="m-arch__nodetitle">{o.name}</span>
                <span className="m-arch__nodemeta">{o.meta}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Loop label */}
      <div className="m-arch__loop">
        <span className="m-arch__loopdot" />
        <span>The Loop — observe · compare · flag · correct</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoopDiagram — clean HTML+SVG hybrid, no clipped labels
// ---------------------------------------------------------------------------
const LOOP_STATIONS = [
  { key: "observe", sub: "what happened",  x: 50, y: 8,  align: "center" as const },
  { key: "compare", sub: "vs. the target", x: 92, y: 50, align: "left"   as const },
  { key: "flag",    sub: "the gap",        x: 50, y: 92, align: "center" as const },
  { key: "correct", sub: "within limits",  x: 8,  y: 50, align: "right"  as const },
];

const STATION_ALIGN: Record<"center" | "left" | "right", string> = {
  center: "",
  left: "m-loop-diagram__station--right",
  right: "m-loop-diagram__station--left",
};

export function LoopDiagram() {
  return (
    <div className="m-loop-diagram">
      <svg className="m-loop-diagram__svg" viewBox="0 0 400 400" aria-hidden>
        <defs>
          <marker
            id="lp-arr"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="#BE5A2C" />
          </marker>
        </defs>
        {/* soft guide rings */}
        <circle cx="200" cy="200" r="150" fill="none" stroke="#171310" strokeOpacity="0.10" strokeDasharray="2 6" />
        <circle cx="200" cy="200" r="120" fill="none" stroke="#171310" strokeOpacity="0.06" />
        {/* 4 sweeping arcs, one per quadrant */}
        {LOOP_STATIONS.map((_, i) => {
          const start = ((i * 90 - 90 + 12) * Math.PI) / 180;
          const end = (((i + 1) * 90 - 90 - 12) * Math.PI) / 180;
          const x1 = 200 + 150 * Math.cos(start);
          const y1 = 200 + 150 * Math.sin(start);
          const x2 = 200 + 150 * Math.cos(end);
          const y2 = 200 + 150 * Math.sin(end);
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A 150 150 0 0 1 ${x2} ${y2}`}
              fill="none"
              stroke="#BE5A2C"
              strokeWidth="1.6"
              markerEnd="url(#lp-arr)"
              className="m-dash-flow"
              strokeDasharray="6 6"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          );
        })}
      </svg>

      {/* Station markers + labels (HTML — no clipping) */}
      {LOOP_STATIONS.map((s, i) => (
        <div
          key={s.key}
          className={`m-loop-diagram__station ${STATION_ALIGN[s.align]}`}
          style={{ left: `${s.x}%`, top: `${s.y}%`, "--i": i } as CSSProperties}
        >
          <span className="m-loop-diagram__mark" />
          <div className="m-loop-diagram__label">
            <div className="m-loop-diagram__step">
              <span className="m-loop-diagram__stepnum">0{i + 1}</span>
              <span className="m-loop-diagram__stepname">{s.key}</span>
            </div>
            <div className="m-loop-diagram__stepsub">{s.sub}</div>
          </div>
        </div>
      ))}

      {/* Center medallion */}
      <div className="m-loop-diagram__center">
        <div className="m-loop-diagram__center-halo" aria-hidden />
        <span className="m-loop-diagram__center-title">the loop</span>
        <span className="m-loop-diagram__center-sub">always on</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutonomySelector
// ---------------------------------------------------------------------------
const AUTONOMY = [
  { key: "report", title: "Report", body: "helix tells you what it found." },
  { key: "suggest", title: "Suggest", body: "helix proposes the fix, you approve with one click." },
  { key: "autonomous", title: "Autonomous", body: "helix corrects on its own, within hard safety limits." },
];

export function AutonomySelector() {
  const [active, setActive] = useState(1);
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 4,
          borderRadius: 8,
          border: "1px solid var(--m-hairline)",
          background: "var(--m-surface)",
          padding: 4,
        }}
      >
        {AUTONOMY.map((a, i) => (
          <button
            key={a.key}
            onClick={() => setActive(i)}
            style={{
              flex: 1,
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 13.5,
              border: "none",
              cursor: "pointer",
              transition: "background 200ms, color 200ms",
              background: active === i ? "var(--m-foreground)" : "transparent",
              color: active === i ? "var(--m-background)" : "var(--m-body)",
            }}
          >
            {a.title}
          </button>
        ))}
      </div>
      <div
        style={{
          marginTop: 20,
          borderRadius: 14,
          border: "1px solid var(--m-hairline)",
          background: "var(--m-surface)",
          padding: 20,
        }}
      >
        <div className="m-mono-sm" style={{ color: "var(--m-ember)", marginBottom: 8 }}>
          level · {AUTONOMY[active].key}
        </div>
        <div style={{ fontSize: 16, color: "var(--m-foreground)" }}>
          {AUTONOMY[active].title}
        </div>
        <p style={{ marginTop: 4, fontSize: 14.5, color: "var(--m-body)" }}>
          {AUTONOMY[active].body}
        </p>
      </div>
      <p
        className="m-mono-sm m-mt-4"
        style={{ color: "var(--m-muted-foreground)" }}
      >
        {"// money and irreversible actions always stay gated."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RAGPipeline — clean 6-step numbered flow
// ---------------------------------------------------------------------------
const RAG_STEPS = [
  { t: "Your docs",  s: "pdf · docx · md",     hint: "you upload" },
  { t: "Chunks",     s: "semantic split",      hint: "we prepare" },
  { t: "Vectors",    s: "embedded",            hint: "we index" },
  { t: "Your store", s: "isolated per tenant", hint: "we secure" },
  { t: "Retrieval",  s: "top-k passages",      hint: "on question" },
  { t: "Answer",     s: "cited to source",     hint: "grounded" },
];

export function RAGPipeline() {
  return (
    <div className="m-rag">
      <div className="m-rag__topbar">
        <span className="m-rag__eyebrow">Retrieval-augmented generation</span>
        <span className="m-rag__meta">grounded · never guessed</span>
      </div>

      <div className="m-rag__flow">
        {RAG_STEPS.map((s, i) => (
          <div key={s.t} className="m-rag__step" style={{ "--i": i } as CSSProperties}>
            <div className="m-rag__num">{String(i + 1).padStart(2, "0")}</div>
            <div className="m-rag__card">
              <div className="m-rag__hint">{s.hint}</div>
              <div className="m-rag__title">{s.t}</div>
              <div className="m-rag__sub">{s.s}</div>
            </div>
            {i < RAG_STEPS.length - 1 && <div className="m-rag__connector" aria-hidden />}
          </div>
        ))}
      </div>

      <div className="m-rag__fence">
        <span className="m-rag__fencedot" />
        Your corpus stays isolated — no internet lookups, no cross-tenant reads.
      </div>
    </div>
  );
}

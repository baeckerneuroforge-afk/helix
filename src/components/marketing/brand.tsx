import Link from "next/link";

/* ---------- HelixMark — SVG helix logo icon ---------- */
export function HelixMark({
  size = 28,
  tone,
  variant,
  className = "",
}: {
  size?: number;
  /** @deprecated use `tone` */
  variant?: "light" | "dark";
  tone?: "light" | "dark";
  className?: string;
}) {
  // `variant` is a legacy alias for `tone`
  const resolvedTone = tone ?? variant ?? "light";
  const steel = resolvedTone === "dark" ? "#8A93C7" : "#39426B";
  const ember = resolvedTone === "dark" ? "#F26B1F" : "#D6531A";
  const rung = resolvedTone === "dark" ? "#6C6E78" : "#85878F";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M18 6 C18 20, 46 26, 46 40 C46 50, 36 56, 26 58"
        fill="none"
        stroke={steel}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M46 6 C46 20, 18 26, 18 40 C18 50, 28 56, 38 58"
        fill="none"
        stroke={ember}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <line x1="24" y1="14" x2="40" y2="14" stroke={rung} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="27" y1="32" x2="37" y2="32" stroke={rung} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="24" y1="48" x2="40" y2="48" stroke={rung} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- HelixWordmark — Logo + "helix.ai" as Link to "/" ---------- */
export function HelixWordmark({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const helix = tone === "dark" ? "#EDE9E1" : "#15161B";
  const ai = tone === "dark" ? "#F26B1F" : "#D6531A";
  return (
    <Link
      href="/"
      className={`m-flex m-items-center m-gap-3 ${className}`}
      style={{ textDecoration: "none" }}
      aria-label="helix.ai — home"
    >
      <HelixMark size={28} tone={tone} />
      <span
        style={{
          fontFamily: 'var(--font-display, "Fraunces", Georgia, serif)',
          fontWeight: 600,
          letterSpacing: "-0.03em",
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        <span style={{ color: helix }}>helix</span>
        <span style={{ color: ai }}>.ai</span>
      </span>
    </Link>
  );
}

/**
 * DNAStrand — the recurring double-strand motif for backgrounds.
 * Two intertwining sine curves (steel + ember) with occasional rungs.
 * Extremely subtle by default; caller controls opacity via className/style.
 */
export function DNAStrand({
  className = "",
  tone = "light",
  variant = "vertical",
  style,
}: {
  className?: string;
  tone?: "light" | "dark";
  variant?: "vertical" | "diagonal";
  style?: React.CSSProperties;
}) {
  const steel = tone === "dark" ? "#8A93C7" : "#39426B";
  const ember = tone === "dark" ? "#F26B1F" : "#D6531A";
  const rung = tone === "dark" ? "#6C6E78" : "#85878F";

  // 8 crossovers along a 1600px vertical run — two sine paths that swap
  // sides every 200px. Rungs sit at each crossover.
  const path = (phase: 0 | 1) => {
    const cx = 100;
    const amp = 60;
    const step = 200;
    let d = `M ${cx + (phase === 0 ? -amp : amp)} 0`;
    for (let i = 1; i <= 8; i++) {
      const y1 = (i - 1) * step + step / 2;
      const y2 = i * step;
      const to = phase === 0 ? (i % 2 === 0 ? -amp : amp) : i % 2 === 0 ? amp : -amp;
      const from = phase === 0 ? (i % 2 === 0 ? amp : -amp) : i % 2 === 0 ? -amp : amp;
      d += ` C ${cx + from} ${y1}, ${cx + to} ${y1}, ${cx + to} ${y2}`;
    }
    return d;
  };

  const rungs = Array.from({ length: 8 }, (_, i) => (
    <line
      key={i}
      x1={70}
      x2={130}
      y1={(i + 0.5) * 200}
      y2={(i + 0.5) * 200}
      stroke={rung}
      strokeWidth="4"
      strokeLinecap="round"
    />
  ));

  const rotate = variant === "diagonal" ? "rotate(-12deg)" : undefined;

  return (
    <svg
      viewBox="0 0 200 1600"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ transform: rotate, ...style }}
    >
      <path d={path(0)} stroke={steel} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d={path(1)} stroke={ember} strokeWidth="6" strokeLinecap="round" fill="none" />
      {rungs}
    </svg>
  );
}

/**
 * Rung — a short horizontal divider: thin grey line with a steel dot on
 * one end and an ember dot on the other.
 */
export function Rung({ className = "" }: { className?: string }) {
  return (
    <div
      className={`m-flex m-items-center m-gap-2 ${className}`}
      style={{ display: "inline-flex" }}
      aria-hidden="true"
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: "#39426B" }} />
      <span style={{ height: 1, width: 64, background: "#85878F", opacity: 0.5 }} />
      <span style={{ width: 6, height: 6, borderRadius: 999, background: "#D6531A" }} />
    </div>
  );
}

/**
 * HelixBand — a horizontal double-strand ribbon used as a divider.
 */
export function HelixBand({
  className = "",
  tone = "light",
  height = 64,
  crossovers = 12,
}: {
  className?: string;
  tone?: "light" | "dark";
  height?: number;
  crossovers?: number;
}) {
  const steel = tone === "dark" ? "#8A93C7" : "#39426B";
  const ember = tone === "dark" ? "#F26B1F" : "#D6531A";
  const rung = tone === "dark" ? "#6C6E78" : "#85878F";

  const step = 200;
  const totalW = step * crossovers;
  const cy = 50;
  const amp = 34;

  const path = (phase: 0 | 1) => {
    let d = `M 0 ${cy + (phase === 0 ? -amp : amp)}`;
    for (let i = 1; i <= crossovers; i++) {
      const x1 = (i - 1) * step + step / 2;
      const x2 = i * step;
      const to = phase === 0 ? (i % 2 === 0 ? -amp : amp) : i % 2 === 0 ? amp : -amp;
      const from = phase === 0 ? (i % 2 === 0 ? amp : -amp) : i % 2 === 0 ? -amp : amp;
      d += ` C ${x1} ${cy + from}, ${x1} ${cy + to}, ${x2} ${cy + to}`;
    }
    return d;
  };

  const rungs = Array.from({ length: crossovers }, (_, i) => (
    <line
      key={i}
      y1={cy - 26}
      y2={cy + 26}
      x1={(i + 0.5) * step}
      x2={(i + 0.5) * step}
      stroke={rung}
      strokeWidth="3"
      strokeLinecap="round"
    />
  ));

  return (
    <svg
      viewBox={`0 0 ${totalW} 100`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ height, width: "100%", display: "block" }}
    >
      <path d={path(0)} stroke={steel} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d={path(1)} stroke={ember} strokeWidth="3" strokeLinecap="round" fill="none" />
      {rungs}
    </svg>
  );
}

/**
 * HelixOrbit — a circular double-helix ring used as a decorative badge.
 */
export function HelixOrbit({
  size = 200,
  className = "",
  tone = "light",
}: {
  size?: number;
  className?: string;
  tone?: "light" | "dark";
}) {
  const steel = tone === "dark" ? "#8A93C7" : "#39426B";
  const ember = tone === "dark" ? "#F26B1F" : "#D6531A";
  const rung = tone === "dark" ? "#6C6E78" : "#85878F";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="100" cy="100" rx="82" ry="30" fill="none" stroke={steel} strokeWidth="2.5" transform="rotate(-30 100 100)" />
      <ellipse cx="100" cy="100" rx="82" ry="30" fill="none" stroke={ember} strokeWidth="2.5" transform="rotate(30 100 100)" />
      <ellipse cx="100" cy="100" rx="82" ry="30" fill="none" stroke={steel} strokeWidth="1.5" opacity="0.5" transform="rotate(90 100 100)" />
      <line x1="18" y1="100" x2="34" y2="100" stroke={rung} strokeWidth="2" strokeLinecap="round" />
      <line x1="166" y1="100" x2="182" y2="100" stroke={rung} strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="100" r="3" fill={steel} />
      <circle cx="182" cy="100" r="3" fill={ember} />
    </svg>
  );
}

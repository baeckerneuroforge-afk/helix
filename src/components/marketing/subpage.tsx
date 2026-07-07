import Link from "next/link";
import type { ReactNode } from "react";
import {
  PageShell,
  Eyebrow,
  Section,
  CtaBand,
} from "@/components/marketing/site";

// ---------------------------------------------------------------------------
// Re-export Eyebrow, Section and Link so subpages can import from one place
// ---------------------------------------------------------------------------
export { Eyebrow, Section, Link };

// ---------------------------------------------------------------------------
// SubPageShell — wraps PageShell + closing CTA
// ---------------------------------------------------------------------------
export function SubPageShell({
  children,
  ctaLine,
}: {
  children: ReactNode;
  ctaLine?: string;
}) {
  return (
    <PageShell>
      {children}
      {ctaLine !== undefined && <CtaBand line={ctaLine} />}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// SubHero — consistent hero for every subpage
// ---------------------------------------------------------------------------
export function SubHero({
  eyebrow,
  title,
  accent,
  after,
  sub,
  subtitle,
  tags = [],
  right,
  children,
}: {
  eyebrow?: string;
  title: string; // text before the accent word
  accent?: string; // one rust-colored word
  after?: string; // text after the accent word
  sub?: string;
  /** @deprecated use `sub` */
  subtitle?: string;
  tags?: string[];
  right?: ReactNode;
  children?: ReactNode;
}) {
  const subText = sub ?? subtitle;
  return (
    <section
      className="m-subhero m-helix-bg m-helix-strands"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <div className="m-subhero-inner">
        {/* Left column */}
        <div>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1
            style={{
              maxWidth: "22ch",
              fontFamily: 'var(--font-display, "Fraunces", Georgia, serif)',
              letterSpacing: "-0.03em",
            }}
          >
            {title}
            {accent && (
              <>
                {" "}
                <span className="m-text-ember">{accent}</span>
              </>
            )}
            {after && <>{after}</>}
          </h1>
          {subText && (
            <p
              style={{
                marginTop: 24,
                maxWidth: "58ch",
                fontSize: 17.5,
                color: "var(--m-body)",
              }}
            >
              {subText}
            </p>
          )}
          {tags.length > 0 && (
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
              {tags.map((t) => (
                <span key={t}>· {t}</span>
              ))}
            </div>
          )}
          {children}
        </div>

        {/* Right column (optional) */}
        {right && <div style={{ position: "relative" }}>{right}</div>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// TintedImage — rounded, tinted photograph
// ---------------------------------------------------------------------------
export function TintedImage({
  src,
  alt = "",
  className = "",
  height = 420,
}: {
  src: string;
  alt?: string;
  className?: string;
  height?: number;
}) {
  return (
    <figure className={`m-img-frame ${className}`} style={{ margin: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="m-img-tinted"
        style={{
          width: "100%",
          display: "block",
          objectFit: "cover",
          height,
          maxHeight: height,
        }}
      />
    </figure>
  );
}

// ---------------------------------------------------------------------------
// VideoPlaceholder — 16:9 slot with rust play button
// ---------------------------------------------------------------------------
export function VideoPlaceholder({
  caption = "product walkthrough",
  image,
}: {
  caption?: string;
  image?: string;
}) {
  return (
    <figure
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        border: "1px solid var(--m-hairline)",
        background: "var(--m-ink)",
        margin: 0,
      }}
    >
      <div style={{ position: "relative", aspectRatio: "16 / 9", width: "100%" }}>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="m-img-tinted"
            style={{
              position: "absolute",
              inset: 0,
              height: "100%",
              width: "100%",
              objectFit: "cover",
              opacity: 0.5,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top right, rgba(20,21,25,0.85), rgba(20,21,25,0.6), rgba(20,21,25,0.85))",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              borderRadius: 999,
              border: "1px solid rgba(214,83,26,0.4)",
              background: "rgba(214,83,26,0.1)",
              padding: "12px 24px",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            <span
              style={{
                display: "flex",
                height: 40,
                width: 40,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                background: "var(--m-ember)",
                color: "var(--m-ember-foreground)",
                boxShadow: "0 10px 24px -8px rgba(214,83,26,0.6)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3 1.5 L12 7 L3 12.5 Z" />
              </svg>
            </span>
            <span
              className="m-mono"
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.16em",
                color: "rgba(237,233,225,0.85)",
              }}
            >
              {caption}
            </span>
          </div>
        </div>
        <div
          className="m-mono-sm"
          style={{
            position: "absolute",
            bottom: 12,
            right: 16,
            color: "rgba(237,233,225,0.5)",
          }}
        >
          [VIDEO · placeholder]
        </div>
      </div>
    </figure>
  );
}

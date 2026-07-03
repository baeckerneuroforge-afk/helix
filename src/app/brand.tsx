// helix.ai — das Doppelstrang-Markenzeichen (Kern-Erzählung des Brandings):
// Wissens-Strang (Stahl-Indigo, liest) und Handlungs-Strang (Glut-Orange,
// handelt), versprosst durch Governance-Sprossen (Grau) — die Punkte, an denen
// ein Mensch freigibt. Zwei Farbvarianten: 'light' für Papier-Hintergründe,
// 'dark' für die Graphit-Sidebar.
const STRANDS = {
  light: { knowledge: '#39426B', action: '#D6531A', rung: '#85878F' },
  dark: { knowledge: '#8A93C7', action: '#F26B1F', rung: '#6C6E78' },
} as const;

export function HelixMark({
  size = 22,
  variant = 'light',
}: {
  size?: number;
  variant?: 'light' | 'dark';
}) {
  const c = STRANDS[variant];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        d="M18 6 C18 20, 46 26, 46 40 C46 50, 36 56, 26 58"
        fill="none"
        stroke={c.knowledge}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M46 6 C46 20, 18 26, 18 40 C18 50, 28 56, 38 58"
        fill="none"
        stroke={c.action}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <line x1="24" y1="14" x2="40" y2="14" stroke={c.rung} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="27" y1="32" x2="37" y2="32" stroke={c.rung} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="24" y1="48" x2="40" y2="48" stroke={c.rung} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

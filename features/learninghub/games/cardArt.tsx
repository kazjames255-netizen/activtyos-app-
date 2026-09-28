"use client";
// SHARED CARD ART for the Games tab grid (GamesPanel.tsx). Every game's card image goes through <GameCardArt id=.../>
// below — a real illustrated scene (mascot + environment specific to that game), not a generic emoji on a flat
// gradient. This is the single leverage point: add a game's id to GAME_ACCENT + the SCENES switch here and every
// card — including ones sibling agents are still adding tonight — gets real art automatically; GamesPanel.tsx
// itself only ever renders <GameCardArt id={g.id} />, never a per-game special case.
//
// Penguin Slide and Turbo Slide do not re-imagine new art: they reuse the EXACT colours already built for their
// full canvas game engines — POLAR (games/penguin/theme.ts, the real glacier sky/ice/mountain palette) and Pip's
// own body colours (games/penguin/characters/penguin.ts: navy body, white belly, gold beak, gold mortarboard) —
// plus Turbo's own dusk-highway/rocket-sled colours (games/turbo/engine/render.ts). Every other game is a fresh
// small illustration in the same cel-shaded, thick-dark-outline house style (docs/games-prototypes/GRAPHICS-
// BRIEF.md), built from that game's OWN already-assigned accent colour (its existing theme.accent / QuizTheme.accent
// / accentVar / ACCENT constant — never a re-invented colour), so every card is instantly recognisable as ITS game.
import { POLAR } from "./penguin/theme";

/** Shared thick-outline ink used by every scene (never pure black — matches the in-game engines). */
const INK = "#14163a";

/** Per-game accent, reused as-is from each game's own existing theme file (see the imports/greps this was built
 *  from: AppliedGameUI theme.accent for market/bakeoff/reef, quiz/QuizRunner QuizTheme.accent for compass/museum/
 *  colourlab, each quiz-quest game's own THEME.accent for debate/detective/vault, WordPop's ACCENT, and the
 *  quizArcade games.ts accentVar CSS tokens for the three arcade games). Bot Foundry/Sort Yard/Training Ground
 *  don't carry a UI accent of their own yet, so these three get a new colour here, chosen off-palette from every
 *  other game and never green (content rule: no green as a persistent brand colour). */
export const GAME_ACCENT: Record<string, string> = {
  penguin: POLAR.palette.royal,
  turbo: "#2a1f6b",
  market: "#b8860b",
  bakeoff: "#c2185b",
  reef: "#2b6cb0",
  compass: "#b5651d",
  museum: "#6b3fa0",
  colourlab: "#3b5bdb",
  botfoundry: "#3d6d99",
  sortyard: "#c9822b",
  training: "#5b3fd6",
  debate: "#7c5cff",
  detective: "#c9822b",
  vault: "#2b8fc9",
  wordpop: "#c1447e",
  primereef: "var(--cat-5)",
  datacarnival: "var(--cat-10)",
  shapeworkshop: "var(--cat-2)",
};

function darken(hex: string, amt: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex; // CSS var accents (e.g. var(--cat-5)) pass through
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - amt), g = Math.max(0, ((n >> 8) & 255) - amt), b = Math.max(0, (n & 255) - amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** A round cel-shaded "mascot blob" body: base fill + a lighter rim highlight + dark outline, reused by most scenes. */
function Blob({ cx, cy, rx, ry, fill, rim }: { cx: number; cy: number; rx: number; ry: number; fill: string; rim?: string }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} stroke={INK} strokeWidth={2.5} />
      <ellipse cx={cx - rx * 0.3} cy={cy - ry * 0.4} rx={rx * 0.35} ry={ry * 0.25} fill={rim ?? "rgba(255,255,255,.35)"} />
    </>
  );
}
function EyeDot({ x, y }: { x: number; y: number }) {
  return <><circle cx={x} cy={y} r={3.4} fill={INK} /><circle cx={x + 1} cy={y - 1} r={1} fill="#fff" /></>;
}

/** Fixed art-kit viewBox every scene draws into; GameCardArt scales it to fill the card's image band. */
const VB = "0 0 260 130";

function PenguinScene() {
  const P = POLAR.palette;
  return (
    <svg viewBox={VB} className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="pen-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={P.skyTop} /><stop offset="55%" stopColor={P.skyMid} /><stop offset="100%" stopColor={P.skyLow} />
        </linearGradient>
      </defs>
      <rect width="260" height="130" fill="url(#pen-sky)" />
      <circle cx="210" cy="26" r="14" fill={P.horizonGlow} opacity={0.85} />
      <path d="M0 78 L40 48 L78 78 L118 42 L160 78 L200 54 L260 78 L260 130 L0 130 Z" fill={P.mountainFar} />
      <path d="M0 96 L36 70 L70 96 L110 62 L150 96 L190 74 L260 96 L260 130 L0 130 Z" fill={P.mountainNear} />
      <path d="M0 104 Q130 78 260 104 L260 130 L0 130 Z" fill={P.ice1} />
      <path d="M0 116 Q130 96 260 116 L260 130 L0 130 Z" fill={P.ice0} />
      {/* Pip: navy body / white belly / gold beak / gold-tassel mortarboard — same shapes+colours as the in-game host character */}
      <g transform="translate(130 96)">
        <ellipse cx="0" cy="8" rx="34" ry="8" fill="rgba(20,30,90,.25)" />
        <ellipse cx="-20" cy="-14" rx="9" ry="20" fill={P.penguin} stroke={INK} strokeWidth={2} transform="rotate(-18 -20 -14)" />
        <ellipse cx="20" cy="-14" rx="9" ry="20" fill={P.penguin} stroke={INK} strokeWidth={2} transform="rotate(18 20 -14)" />
        <ellipse cx="0" cy="-6" rx="26" ry="34" fill={P.penguin} stroke={INK} strokeWidth={2.5} />
        <ellipse cx="0" cy="6" rx="16" ry="22" fill="#fff" />
        <circle cx="-9" cy="-24" r="9.5" fill="rgba(255,150,180,.5)" />
        <circle cx="9" cy="-24" r="9.5" fill="rgba(255,150,180,.5)" />
        <EyeDot x={-9} y={-30} /><EyeDot x={9} y={-30} />
        <path d="M-8 -18 Q0 -22 8 -18 Q6 -12 0 -10 Q-6 -12 -8 -18 Z" fill="#ffc94a" stroke={INK} strokeWidth={1.5} />
        <rect x="-16" y="-46" width="32" height="6" rx="2" fill={P.navy} stroke={INK} strokeWidth={1.5} />
        <path d="M-20 -52 L20 -52 L0 -40 Z" fill={P.royal} stroke={INK} strokeWidth={1.5} />
        <circle cx="14" cy="-46" r="2.5" fill={P.gold} /><path d="M14 -46 L18 -36 L12 -34 Z" fill={P.gold} />
      </g>
    </svg>
  );
}

function TurboScene() {
  const P = POLAR.palette;
  return (
    <svg viewBox={VB} className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="turbo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1440" /><stop offset="55%" stopColor="#2a1f6b" /><stop offset="100%" stopColor="#8a4a5a" />
        </linearGradient>
      </defs>
      <rect width="260" height="130" fill="url(#turbo-sky)" />
      <circle cx="200" cy="30" r="16" fill="#fff0c8" opacity={0.9} />
      {[24, 70, 120, 168, 210].map((x, i) => <rect key={i} x={x} y={30 + (i % 2) * 8} width="8" height={18 - (i % 2) * 6} fill="#141a52" opacity={0.8} />)}
      <path d="M0 96 L260 96 L260 130 L0 130 Z" fill="#232a6a" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 70 - 10} y="110" width="34" height="6" rx="3" fill="#ffd84a" opacity={0.8} />)}
      {/* motion streaks = speed */}
      {[40, 56, 72].map((y, i) => <rect key={i} x="4" y={y} width={30 - i * 6} height="3" rx="1.5" fill="#fff" opacity={0.35} />)}
      {/* a rival car rushing past behind Pip */}
      <g transform="translate(206 74)">
        <rect x="-20" y="-8" width="40" height="16" rx="7" fill="#ff5a6a" stroke={INK} strokeWidth={2} />
        <rect x="-11" y="-15" width="24" height="10" rx="4" fill="#ffb0b8" stroke={INK} strokeWidth={1.5} />
        <circle cx="-13" cy="8" r="5" fill={INK} /><circle cx="13" cy="8" r="5" fill={INK} />
      </g>
      {/* Pip on the rocket-sled */}
      <g transform="translate(96 88)">
        <ellipse cx="0" cy="10" rx="32" ry="7" fill="rgba(10,15,50,.35)" />
        <rect x="-30" y="0" width="60" height="9" rx="4" fill="#ff9ec7" stroke={INK} strokeWidth={2} />
        <path d="M-30 3 L-44 -1 L-44 7 L-30 7 Z" fill="#ffce4a" stroke={INK} strokeWidth={1.5} />
        <ellipse cx="-6" cy="-22" rx="9" ry="19" fill={P.penguin} stroke={INK} strokeWidth={2} transform="rotate(-10 -6 -22)" />
        <ellipse cx="4" cy="-16" rx="24" ry="30" fill={P.penguin} stroke={INK} strokeWidth={2.5} />
        <ellipse cx="6" cy="-6" rx="15" ry="19" fill="#fff" />
        <EyeDot x={-4} y={-30} /><EyeDot x={14} y={-30} />
        <path d="M-6 -22 Q2 -26 10 -22 Q8 -16 2 -14 Q-4 -16 -6 -22 Z" fill="#ffc94a" stroke={INK} strokeWidth={1.5} />
      </g>
    </svg>
  );
}

/** Generic scene shell every non-hero game uses: a sky gradient + ground band from its accent, ink outline mascot
 *  blob, and whatever bespoke props the game passes in — same visual language (rounded cel-shading, thick ink
 *  outline, one accent colour) applied per-game rather than per-game-invented palettes. */
function Scene({ id, accent, ground, children }: { id: string; accent: string; ground?: string; children: React.ReactNode }) {
  const soft = accent.startsWith("#") ? `color-mix(in srgb, ${accent} 30%, white)` : accent;
  const deep = darken(accent, 60);
  return (
    <svg viewBox={VB} className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={soft} /><stop offset="100%" stopColor={accent} />
        </linearGradient>
      </defs>
      <rect width="260" height="130" fill={`url(#${id}-sky)`} />
      <path d="M0 100 Q130 84 260 100 L260 130 L0 130 Z" fill={ground ?? deep} opacity={0.9} />
      {children}
    </svg>
  );
}

function MarketScene({ accent }: { accent: string }) {
  return (
    <Scene id="market" accent={accent}>
      <path d="M50 46 L130 30 L210 46 L200 60 L60 60 Z" fill="#c0392b" stroke={INK} strokeWidth={2.5} />
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${58 + i * 30} 46 L${73 + i * 30} 34 L${88 + i * 30} 46 Z`} fill={i % 2 ? "#fff" : "#f1c40f"} stroke={INK} strokeWidth={1.5} />)}
      <rect x="60" y="60" width="140" height="40" rx="4" fill="#a5682f" stroke={INK} strokeWidth={2.5} />
      <rect x="70" y="68" width="34" height="24" rx="3" fill="#e8b84b" stroke={INK} strokeWidth={2} />
      <circle cx="80" cy="76" r="6" fill="#e74c3c" stroke={INK} strokeWidth={1.5} /><circle cx="92" cy="78" r="6" fill="#f39c12" stroke={INK} strokeWidth={1.5} /><circle cx="86" cy="86" r="6" fill="#e74c3c" stroke={INK} strokeWidth={1.5} />
      <g transform="translate(150 88)">
        <Blob cx={0} cy={-4} rx={20} ry={24} fill="#e8b84b" />
        <rect x="-20" y="-4" width="40" height="14" rx="4" fill="#fff" stroke={INK} strokeWidth={2} />
        <EyeDot x={-6} y={-14} /><EyeDot x={6} y={-14} />
        <path d="M-6 -6 Q0 -2 6 -6" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
      </g>
    </Scene>
  );
}

function BakeoffScene({ accent }: { accent: string }) {
  return (
    <Scene id="bakeoff" accent={accent}>
      <rect x="150" y="40" width="60" height="60" rx="8" fill="#5a3020" stroke={INK} strokeWidth={2.5} />
      <circle cx="180" cy="70" r="16" fill="#2b1712" stroke={INK} strokeWidth={2} /><circle cx="180" cy="70" r="10" fill="#ff9e4a" opacity={0.8} />
      <rect x="156" y="46" width="12" height="6" rx="2" fill="#ffce4a" /><rect x="172" y="46" width="12" height="6" rx="2" fill="#ffce4a" />
      {[0, 1, 2].map((i) => <path key={i} d={`M${188 + i * 6} 36 q-4 -8 0 -14`} stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />)}
      <g transform="translate(80 92)">
        <path d="M-26 6 L26 6 L20 -20 Q0 -32 -20 -20 Z" fill="#e8558a" stroke={INK} strokeWidth={2.5} />
        {[-14, 0, 14].map((x, i) => <path key={i} d={`M${x - 6} 6 L${x} -14 L${x + 6} 6 Z`} fill={i % 2 ? "#c2185b" : "#f06ba0"} />)}
        <path d="M-24 -20 Q0 -44 24 -20 Q0 -30 -24 -20 Z" fill="#fff5e6" stroke={INK} strokeWidth={2.5} />
        <circle cx="0" cy="-30" r="4" fill="#ff5a6a" stroke={INK} strokeWidth={1.5} />
      </g>
      <g transform="translate(50 60)">
        <Blob cx={0} cy={0} rx={14} ry={16} fill="#fff" />
        <rect x="-14" y="-24" width="28" height="12" rx="4" fill="#fff" stroke={INK} strokeWidth={2} />
        <EyeDot x={-4} y={-2} /><EyeDot x={4} y={-2} />
      </g>
    </Scene>
  );
}

function ReefScene({ accent }: { accent: string }) {
  return (
    <Scene id="reef" accent={accent} ground={darken(accent, 20)}>
      <ellipse cx="40" cy="112" rx="10" ry="16" fill="#e08b3a" /><ellipse cx="60" cy="118" rx="8" ry="10" fill="#e8a24f" />
      <ellipse cx="220" cy="110" rx="12" ry="18" fill="#e08b3a" />
      {[[30, 30], [70, 16], [200, 26], [230, 40]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3 + (i % 2) * 2} fill="#fff" opacity={0.6} />)}
      <g transform="translate(130 60)">
        <Blob cx={0} cy={0} rx={26} ry={18} fill="#4aa3e0" />
        <path d="M22 0 L40 -12 L40 12 Z" fill="#3d86bd" stroke={INK} strokeWidth={2} />
        <EyeDot x={-10} y={-4} />
        <path d="M-30 0 Q-40 -6 -38 4" stroke={INK} strokeWidth={2} fill="none" />
        {[0, 1, 2].map((i) => <path key={i} d={`M${-4 + i * 10} 16 q4 6 0 12`} stroke="#2f6f9e" strokeWidth={3} fill="none" strokeLinecap="round" />)}
      </g>
    </Scene>
  );
}

function CompassScene({ accent }: { accent: string }) {
  return (
    <Scene id="compass" accent={accent}>
      <path d="M0 90 L60 50 L110 90 L160 40 L210 90 L260 60 L260 130 L0 130 Z" fill={darken(accent, 30)} />
      <g transform="translate(130 68)">
        <circle cx="0" cy="0" r="34" fill="#f4e6c8" stroke={INK} strokeWidth={3} />
        <circle cx="0" cy="0" r="26" fill="none" stroke="#c9a26a" strokeWidth={1.5} />
        <path d="M0 -26 L8 0 L0 26 L-8 0 Z" fill="#c0392b" stroke={INK} strokeWidth={1.5} />
        <path d="M-26 0 L0 -8 L26 0 L0 8 Z" fill="#eee" stroke={INK} strokeWidth={1.5} />
        <circle cx="0" cy="0" r="4" fill={INK} />
      </g>
      <path d="M40 100 L50 70 L60 100 Z" fill={accent} stroke={INK} strokeWidth={2} />
      <path d="M50 70 L50 60 L68 66 L50 72 Z" fill="#f4e6c8" stroke={INK} strokeWidth={1.5} />
    </Scene>
  );
}

function MuseumScene({ accent }: { accent: string }) {
  return (
    <Scene id="museum" accent={accent}>
      <rect x="30" y="50" width="200" height="8" fill="#f4e6c8" stroke={INK} strokeWidth={2} />
      {[46, 100, 154, 208].map((x, i) => <rect key={i} x={x} y="58" width="14" height="42" fill="#e9dcc0" stroke={INK} strokeWidth={2} />)}
      <rect x="20" y="98" width="220" height="10" fill="#f4e6c8" stroke={INK} strokeWidth={2} />
      <g transform="translate(130 78)">
        <path d="M-16 20 L16 20 L12 -6 Q0 -16 -12 -6 Z" fill="#c9a5e6" stroke={INK} strokeWidth={2.5} />
        <ellipse cx="0" cy="-6" rx="12" ry="6" fill="#e9d5f7" stroke={INK} strokeWidth={2} />
        <circle cx="0" cy="-2" r="18" fill="#ffe36b" opacity={0.5} />
      </g>
    </Scene>
  );
}

function ColourlabScene({ accent }: { accent: string }) {
  return (
    <Scene id="colourlab" accent={accent}>
      <rect x="20" y="94" width="220" height="14" fill="#2a3a7a" stroke={INK} strokeWidth={2} />
      <g transform="translate(90 90)">
        <path d="M-8 -30 L8 -30 L8 -8 L20 16 Q0 28 -20 16 L-8 -8 Z" fill="#dbe6ff" stroke={INK} strokeWidth={2.5} />
        <path d="M-14 6 Q0 16 14 6 L20 16 Q0 28 -20 16 Z" fill="#3b5bdb" opacity={0.85} />
        {[[-4, -2], [4, 2], [0, -8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2} fill="#fff" opacity={0.7} />)}
      </g>
      <g transform="translate(160 84)">
        <Blob cx={0} cy={0} rx={18} ry={20} fill="#eef2ff" />
        <circle cx="-6" cy="-2" r="6" fill="#fff" stroke={INK} strokeWidth={2} /><circle cx="6" cy="-2" r="6" fill="#fff" stroke={INK} strokeWidth={2} />
        <circle cx="-6" cy="-2" r="2.4" fill={INK} /><circle cx="6" cy="-2" r="2.4" fill={INK} />
        <rect x="-14" y="-4" width="28" height="3" fill={INK} />
      </g>
    </Scene>
  );
}

function BotfoundryScene({ accent }: { accent: string }) {
  return (
    <Scene id="botfoundry" accent={accent}>
      <circle cx="60" cy="40" r="10" fill="#dfe8f5" opacity={0.5} /><circle cx="200" cy="30" r="8" fill="#dfe8f5" opacity={0.5} />
      <g transform="translate(130 76)">
        <rect x="-8" y="-46" width="4" height="14" fill="#9fb3d0" /><circle cx="-6" cy="-48" r="4" fill="#ffce4a" stroke={INK} strokeWidth={1.5} />
        <rect x="-30" y="-32" width="60" height="44" rx="10" fill="#cdd9ec" stroke={INK} strokeWidth={2.5} />
        <rect x="-20" y="-22" width="16" height="12" rx="3" fill="#3b5bdb" stroke={INK} strokeWidth={1.5} /><rect x="4" y="-22" width="16" height="12" rx="3" fill="#3b5bdb" stroke={INK} strokeWidth={1.5} />
        <rect x="-14" y="0" width="28" height="6" rx="3" fill={INK} />
        <rect x="-40" y="-16" width="12" height="30" rx="5" fill="#aebede" stroke={INK} strokeWidth={2} /><rect x="28" y="-16" width="12" height="30" rx="5" fill="#aebede" stroke={INK} strokeWidth={2} />
        <rect x="-24" y="14" width="16" height="20" rx="4" fill="#9fb3d0" stroke={INK} strokeWidth={2} /><rect x="8" y="14" width="16" height="20" rx="4" fill="#9fb3d0" stroke={INK} strokeWidth={2} />
      </g>
    </Scene>
  );
}

function SortyardScene({ accent }: { accent: string }) {
  return (
    <Scene id="sortyard" accent={accent}>
      <rect x="10" y="86" width="240" height="10" fill="#8a5a2b" stroke={INK} strokeWidth={2} />
      {[30, 46, 62].map((x, i) => <circle key={i} cx={x} cy="91" r="5" fill="#5a3a1a" />)}
      {[[0, "#e67e22"], [1, "#3b5bdb"], [2, "#c1447e"]].map(([i, c], k) => (
        <rect key={k} x={70 + (i as number) * 26} y={70} width="20" height="20" rx="3" fill={c as string} stroke={INK} strokeWidth={2} />
      ))}
      <g transform="translate(190 86)">
        <rect x="-22" y="-10" width="44" height="30" rx="4" fill="#e8b84b" stroke={INK} strokeWidth={2.5} />
        <circle cx="-10" cy="-20" r="9" fill="#e8b84b" stroke={INK} strokeWidth={2} />
        <EyeDot x={-13} y={-22} /><EyeDot x={-7} y={-22} />
        <rect x="-32" y="-6" width="12" height="6" rx="3" fill="#c9822b" /><rect x="22" y="-6" width="12" height="6" rx="3" fill="#c9822b" />
      </g>
    </Scene>
  );
}

function TrainingScene({ accent }: { accent: string }) {
  return (
    <Scene id="training" accent={accent}>
      <circle cx="90" cy="66" r="30" fill="#fff" stroke={INK} strokeWidth={3} />
      <circle cx="90" cy="66" r="20" fill="#7c5cff" opacity={0.8} /><circle cx="90" cy="66" r="10" fill="#ffce4a" />
      <path d="M60 40 L92 64 L86 70 Z" fill={INK} />
      <g transform="translate(190 84)">
        <Blob cx={0} cy={0} rx={16} ry={20} fill="#e6dcff" />
        <EyeDot x={-5} y={-4} /><EyeDot x={5} y={-4} />
        <rect x="-30" y="4" width="14" height="8" rx="3" fill="#5b3fd6" stroke={INK} strokeWidth={1.5} />
        <rect x="16" y="4" width="14" height="8" rx="3" fill="#5b3fd6" stroke={INK} strokeWidth={1.5} />
        <rect x="-16" y="4" width="32" height="6" fill="#8a7ae0" />
      </g>
    </Scene>
  );
}

function DebateScene({ accent }: { accent: string }) {
  return (
    <Scene id="debate" accent={accent}>
      <rect x="40" y="46" width="24" height="54" fill="#cdbdfa" stroke={INK} strokeWidth={2.5} />
      <rect x="196" y="46" width="24" height="54" fill="#cdbdfa" stroke={INK} strokeWidth={2.5} />
      {[40, 50, 60].map((x, i) => <rect key={i} x={x} y="40" width="8" height="8" fill="#cdbdfa" stroke={INK} strokeWidth={1.5} />)}
      {[196, 206, 216].map((x, i) => <rect key={i} x={x} y="40" width="8" height="8" fill="#cdbdfa" stroke={INK} strokeWidth={1.5} />)}
      <rect x="64" y="70" width="132" height="30" fill="#b3a0f0" stroke={INK} strokeWidth={2.5} />
      <path d="M130 40 L130 20" stroke={INK} strokeWidth={2} /><path d="M130 20 L154 28 L130 36 Z" fill="#ffce4a" stroke={INK} strokeWidth={1.5} />
      <g transform="translate(130 96)">
        <Blob cx={0} cy={-8} rx={20} ry={22} fill="#d9cdfc" />
        <path d="M-20 -8 Q0 -34 20 -8 Q0 -18 -20 -8 Z" fill="#8f7ae0" stroke={INK} strokeWidth={2} />
        <EyeDot x={-6} y={-10} /><EyeDot x={6} y={-10} />
      </g>
    </Scene>
  );
}

function DetectiveScene({ accent }: { accent: string }) {
  return (
    <Scene id="detective" accent={accent}>
      <rect x="20" y="96" width="220" height="8" fill="#5a3a1a" opacity={0.4} />
      <g transform="translate(110 76)">
        <Blob cx={0} cy={0} rx={18} ry={22} fill="#e8c99a" />
        <path d="M-20 -14 Q0 -34 20 -14 Q0 -22 -20 -14 Z" fill="#8a5a2b" stroke={INK} strokeWidth={2.5} />
        <rect x="-22" y="-16" width="44" height="6" fill="#5a3a1a" stroke={INK} strokeWidth={1.5} />
        <EyeDot x={-5} y={-2} /><EyeDot x={5} y={-2} />
      </g>
      <g transform="translate(170 82) rotate(20)">
        <circle cx="0" cy="0" r="18" fill="rgba(255,255,255,.25)" stroke={INK} strokeWidth={3} />
        <rect x="12" y="12" width="22" height="7" rx="3" fill="#8a5a2b" stroke={INK} strokeWidth={2} transform="rotate(20 12 12)" />
      </g>
      <path d="M40 108 q6 -8 14 0 q6 -8 14 0" stroke={INK} strokeWidth={2} fill="none" opacity={0.5} />
    </Scene>
  );
}

function VaultScene({ accent }: { accent: string }) {
  return (
    <Scene id="vault" accent={accent}>
      <rect x="70" y="24" width="120" height="90" rx="10" fill="#9fc4e8" stroke={INK} strokeWidth={3} />
      <circle cx="130" cy="68" r="34" fill="#dbeaf9" stroke={INK} strokeWidth={3} />
      <circle cx="130" cy="68" r="24" fill="none" stroke="#2b8fc9" strokeWidth={3} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
        <line key={i} x1={130 + Math.cos((a * Math.PI) / 180) * 18} y1={68 + Math.sin((a * Math.PI) / 180) * 18}
          x2={130 + Math.cos((a * Math.PI) / 180) * 24} y2={68 + Math.sin((a * Math.PI) / 180) * 24} stroke={INK} strokeWidth={2} />
      ))}
      <circle cx="130" cy="68" r="6" fill="#ffce4a" stroke={INK} strokeWidth={2} />
      <rect x="182" y="60" width="10" height="16" rx="2" fill="#ffce4a" stroke={INK} strokeWidth={1.5} />
    </Scene>
  );
}

function WordpopScene({ accent }: { accent: string }) {
  const letters = ["A", "P", "O", "P"];
  return (
    <Scene id="wordpop" accent={accent}>
      {letters.map((l, i) => (
        <g key={i} transform={`translate(${58 + i * 44} ${44 + (i % 2) * 26})`}>
          <circle r="20" fill="rgba(255,255,255,.9)" stroke={INK} strokeWidth={2.5} />
          <circle cx="-6" cy="-6" r="5" fill="#fff" opacity={0.7} />
          <text x="0" y="7" textAnchor="middle" fontSize="18" fontWeight="800" fill={accent}>{l}</text>
        </g>
      ))}
      <path d="M220 30 l4 8 8 2 -8 3 -4 8 -3 -8 -8 -3 8 -2Z" fill="#fff" opacity={0.8} />
    </Scene>
  );
}

function QuizArcadeScene({ id, accent, glyph }: { id: string; accent: string; glyph: string }) {
  return (
    <Scene id={id} accent={accent}>
      <circle cx="130" cy="60" r="30" fill="rgba(255,255,255,.25)" />
      <text x="130" y="76" textAnchor="middle" fontSize="46">{glyph}</text>
      {[40, 220].map((x, i) => <circle key={i} cx={x} cy={30 + (i % 2) * 10} r="4" fill="#fff" opacity={0.6} />)}
    </Scene>
  );
}

const SCENES: Record<string, (accent: string) => React.ReactNode> = {
  penguin: () => <PenguinScene />,
  turbo: () => <TurboScene />,
  market: (a) => <MarketScene accent={a} />,
  bakeoff: (a) => <BakeoffScene accent={a} />,
  reef: (a) => <ReefScene accent={a} />,
  compass: (a) => <CompassScene accent={a} />,
  museum: (a) => <MuseumScene accent={a} />,
  colourlab: (a) => <ColourlabScene accent={a} />,
  botfoundry: (a) => <BotfoundryScene accent={a} />,
  sortyard: (a) => <SortyardScene accent={a} />,
  training: (a) => <TrainingScene accent={a} />,
  debate: (a) => <DebateScene accent={a} />,
  detective: (a) => <DetectiveScene accent={a} />,
  vault: (a) => <VaultScene accent={a} />,
  wordpop: (a) => <WordpopScene accent={a} />,
  primereef: (a) => <QuizArcadeScene id="primereef" accent={a} glyph="🐠" />,
  datacarnival: (a) => <QuizArcadeScene id="datacarnival" accent={a} glyph="🎡" />,
  shapeworkshop: (a) => <QuizArcadeScene id="shapeworkshop" accent={a} glyph="🛠️" />,
};

/** The one thing GamesPanel.tsx's card grid renders per game — a real illustrated scene keyed off the game's own
 *  id. Unknown ids (a brand-new game a sibling agent is still wiring up, before its scene lands here) fall back to
 *  its emoji on that same house-style gradient rather than breaking, so this is purely additive. */
export function GameCardArt({ id, emoji, accent }: { id: string; emoji: string; accent?: string }) {
  const a = accent ?? GAME_ACCENT[id] ?? "var(--brand)";
  const build = SCENES[id];
  if (build) return <>{build(a)}</>;
  return (
    <div className="flex h-full w-full items-center justify-center text-[46px]"
      style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${a} 25%, var(--surface)), color-mix(in srgb, ${a} 45%, var(--surface)))` }}>
      {emoji}
    </div>
  );
}

import type { ReactNode } from "react";

// Catalogue hero artwork. Each course's `cover` key maps to a hand-drawn line-art
// motif that reflects the SUBJECT (a shield for safeguarding, an ECG heart for
// first aid, a padlock for data, a puzzle for SEND …) so the card image says what
// the course is at a glance. Drawn in a 0–100 space, white line on the category
// gradient, with a soft glow + fine texture for a premium, catalogue feel.

const S = { fill: "none", stroke: "currentColor", strokeWidth: 4.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const F = { fill: "currentColor" };

// —————————————————————————— the motifs ——————————————————————————
const MOTIFS: Record<string, ReactNode> = {
  shield: <><path {...S} d="M50 12 L80 23 V49 C80 68 67 81 50 89 C33 81 20 68 20 49 V23 Z" /><path {...S} d="M39 50 l8 9 15-18" /></>,
  shieldHeart: <><path {...S} d="M50 12 L80 23 V49 C80 68 67 81 50 89 C33 81 20 68 20 49 V23 Z" /><path {...S} d="M50 68 C42 60 34 55 34 47 a7 7 0 0 1 16-3 a7 7 0 0 1 16 3 c0 8-8 13-16 21 Z" /></>,
  heart: <path {...S} d="M50 82 C29 66 15 54 15 38 a15 15 0 0 1 35-6 a15 15 0 0 1 35 6 c0 16-14 28-35 44 Z" />,
  heartPulse: <><path {...S} d="M50 82 C29 66 15 54 15 38 a15 15 0 0 1 35-6 a15 15 0 0 1 35 6 c0 16-14 28-35 44 Z" /><path fill="none" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" d="M24 46 h11 l5-10 8 22 6-12 h16" /></>,
  cross: <><rect {...F} x="42" y="20" width="16" height="60" rx="5" /><rect {...F} x="20" y="42" width="60" height="16" rx="5" /></>,
  pill: <g transform="rotate(-42 50 50)"><rect {...S} x="24" y="39" width="52" height="22" rx="11" /><line {...S} x1="50" y1="39" x2="50" y2="61" /></g>,
  lungs: <><path {...S} d="M50 24 v20" /><path {...S} d="M50 33 C43 29 33 33 31 47 c-3 17-1 29 8 30 c8 1 11-9 11-17" /><path {...S} d="M50 33 C57 29 67 33 69 47 c3 17 1 29-8 30 c-8 1-11-9-11-17" /></>,
  drop: <path {...S} d="M50 18 C50 18 29 46 29 61 a21 21 0 0 0 42 0 C71 46 50 18 50 18 Z" />,
  brain: <><path {...S} d="M47 22 a13 13 0 0 0-13 13 a11 11 0 0 0-6 18 a11 11 0 0 0 9 15 a12 12 0 0 0 10 8 Z" /><path {...S} d="M53 22 a13 13 0 0 1 13 13 a11 11 0 0 1 6 18 a11 11 0 0 1-9 15 a12 12 0 0 1-10 8 Z" /><path {...S} d="M50 22 V76" /></>,
  puzzle: <path {...S} d="M32 34 h13 a6 6 0 1 1 12 0 h13 v13 a6 6 0 1 1 0 12 v13 h-13 a6 6 0 1 0-12 0 H32 v-13 a6 6 0 1 0 0-12 Z" />,
  flame: <path {...S} d="M50 16 C59 30 71 38 71 54 a21 21 0 0 1-42 0 c0-9 5-15 9-19 c1 7 6 9 10 9 c-5-9-2-19 2-28 Z" />,
  sun: <><circle {...S} cx="50" cy="50" r="15" />{[0, 45, 90, 135, 180, 225, 270, 315].map((d) => { const r = (d * Math.PI) / 180; const x1 = 50 + 24 * Math.cos(r), y1 = 50 + 24 * Math.sin(r), x2 = 50 + 33 * Math.cos(r), y2 = 50 + 33 * Math.sin(r); return <line key={d} {...S} x1={x1} y1={y1} x2={x2} y2={y2} />; })}</>,
  waves: <>{[38, 52, 66].map((y) => <path key={y} {...S} d={`M16 ${y} q8-9 17 0 t17 0 t17 0`} />)}</>,
  lock: <><rect {...S} x="27" y="45" width="46" height="35" rx="7" /><path {...S} d="M36 45 v-8 a14 14 0 0 1 28 0 v8" /><circle {...F} cx="50" cy="60" r="3.5" /><line {...S} x1="50" y1="60" x2="50" y2="70" /></>,
  globe: <><circle {...S} cx="50" cy="50" r="30" /><ellipse {...S} cx="50" cy="50" rx="14" ry="30" /><line {...S} x1="20" y1="50" x2="80" y2="50" /><path {...S} d="M25 35 h50 M25 65 h50" /></>,
  phone: <><rect {...S} x="34" y="18" width="32" height="64" rx="7" /><line {...S} x1="44" y1="74" x2="56" y2="74" /><path {...S} d="M45 34 h10 M45 44 h10" /></>,
  people: <><circle {...S} cx="39" cy="39" r="9" /><path {...S} d="M24 73 a15 15 0 0 1 30 0" /><circle {...S} cx="64" cy="42" r="8" /><path {...S} d="M53 73 a13 13 0 0 1 24-2" /></>,
  person: <><circle {...S} cx="50" cy="37" r="12" /><path {...S} d="M28 79 a22 22 0 0 1 44 0" /></>,
  magnifier: <><circle {...S} cx="45" cy="45" r="21" /><line {...S} x1="60" y1="60" x2="79" y2="79" /><circle {...S} cx="45" cy="40" r="6" /><path {...S} d="M35 55 a11 11 0 0 1 20 0" /></>,
  warning: <><path {...S} d="M50 20 L82 76 H18 Z" /><line {...S} x1="50" y1="42" x2="50" y2="58" /><circle {...F} cx="50" cy="66" r="2.4" /></>,
  bus: <><rect {...S} x="19" y="28" width="62" height="36" rx="7" /><line {...S} x1="19" y1="46" x2="81" y2="46" /><path {...S} d="M30 36 h12 M46 36 h12 M62 36 h8" /><circle {...S} cx="34" cy="70" r="5" /><circle {...S} cx="66" cy="70" r="5" /></>,
  box: <><path {...S} d="M50 28 l22 11 v22 l-22 11 -22-11 V39 Z" /><path {...S} d="M28 39 l22 11 22-11 M50 50 v22" /></>,
  plant: <><path {...S} d="M50 84 V48" /><path {...S} d="M50 56 C39 56 29 47 29 34 c13 0 21 9 21 22 Z" /><path {...S} d="M50 48 C61 48 71 39 71 26 c-13 0-21 9-21 22 Z" /></>,
  dove: <path {...S} d="M20 55 C35 50 44 53 53 40 C57 53 67 55 80 52 C71 63 58 67 47 62 C36 67 27 63 20 55 Z" />,
  plate: <><circle {...S} cx="52" cy="52" r="22" /><circle {...S} cx="52" cy="52" r="12" /><line {...S} x1="18" y1="34" x2="18" y2="70" /><path {...S} d="M14 34 v10 a4 4 0 0 0 8 0 V34" /></>,
  bubbles: <><circle {...S} cx="43" cy="53" r="17" /><circle {...S} cx="66" cy="43" r="9" /><circle {...S} cx="68" cy="66" r="6" /></>,
  compass: <><circle {...S} cx="50" cy="50" r="29" /><path {...S} d="M50 33 l7 17-7 17-7-17 Z" /><circle {...F} cx="50" cy="50" r="2.6" /></>,
  chain: <><rect {...S} x="20" y="42" width="28" height="16" rx="8" /><rect {...S} x="52" y="42" width="28" height="16" rx="8" /><path {...S} d="M48 40 v20 M52 40 v20" /></>,
  ribbon: <><path {...S} d="M50 42 C43 55 37 66 41 76 l9-9 9 9 c4-10-2-21-9-34 Z" /><path {...S} d="M50 42 L38 26 M50 42 L62 26" /></>,
  home: <><path {...S} d="M22 52 L50 27 L78 52" /><path {...S} d="M30 49 V79 H70 V49" /><path {...S} d="M43 79 V60 h14 v19" /></>,
};

// cover key → motif
const MOTIF_FOR: Record<string, string> = {
  shield: "shield", cse: "shield", prevent: "compass", slavery: "chain", domestic: "home", fgm: "ribbon", antibully: "shieldHeart",
  listen: "people", parents: "people", behaviour: "people", recruit: "magnifier",
  county: "phone", online: "globe", edi: "globe", data: "lock",
  epipen: "heartPulse", firstaid: "cross", med: "pill", asthma: "lungs", diabetes: "drop", epilepsy: "brain", aces: "heart",
  autism: "puzzle", send: "puzzle", adhd: "brain", mind: "brain",
  fire: "flame", sun: "sun", water: "waves", risk: "warning", trips: "bus", lifting: "box", lone: "person", hygiene: "bubbles", food: "plate",
  develop: "plant", wellbeing: "plant", grief: "dove",
};

export const courseMotif = (cover: string): ReactNode => MOTIFS[MOTIF_FOR[cover] ?? "shield"] ?? MOTIFS.shield;

// Large catalogue hero: category gradient + fine texture + soft glow + the
// subject motif, with an optional frosted level tag.
export function CourseHero({ cover, grad, level, height = 150 }: { cover: string; grad: string; level?: string; height?: number }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: grad }}>
      {/* fine dot texture */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]" aria-hidden>
        <defs><pattern id={`dots-${cover}`} width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#fff" /></pattern></defs>
        <rect width="100%" height="100%" fill={`url(#dots-${cover})`} />
      </svg>
      {/* soft depth circles + glow behind the motif */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <circle cx="262" cy="18" r="70" fill="#fff" opacity="0.08" />
        <circle cx="40" cy="146" r="54" fill="#fff" opacity="0.06" />
        <circle cx="150" cy="72" r="52" fill="#fff" opacity="0.09" />
      </svg>
      {/* the subject motif */}
      <div className="absolute inset-0 grid place-items-center">
        <svg width={Math.round(height * 0.62)} height={Math.round(height * 0.62)} viewBox="0 0 100 100" className="text-white drop-shadow-[0_10px_18px_rgba(8,16,45,.35)]" style={{ opacity: 0.96 }} aria-hidden>{courseMotif(cover)}</svg>
      </div>
      {/* bottom scrim for a premium, grounded finish */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14" style={{ background: "linear-gradient(to top, rgba(6,12,35,.28), transparent)" }} />
      {level && <span className="absolute right-3 top-3 rounded-full bg-white/22 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-white backdrop-blur-sm">{level}</span>}
    </div>
  );
}

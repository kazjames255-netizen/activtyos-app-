// THE one place a skin lives (docs/games-research/deep/B): palette, backdrop, props and the collectible for the "polar" world. A later world (for example
// "Lantern Cove": a dusk-gold harbour with lanterns and earned "Glimmers") is a second Theme object here plus its own prop drawers in engine/render.ts;
// nothing else in the game hard-codes a colour or a theme word (child-facing words come from the `hubgames` catalogue keys, e.g. `collectible`).
// The game's TITLE is a working title too: keep it in this one constant.

import { penguinCharacter, type CharacterDef } from "./characters/penguin";
import { JUICE, POLICY, COSMETICS, type BiomeDef, type Skin } from "./config";
export { JUICE, POLICY, COSMETICS };

export const GAME_TITLE = "Penguin Slide";
export const GAME_ID = "penguin-slide";

export interface Theme {
  id: string;
  /** Teaching Hub palette: navy / royal blue / violet with gold accents and icy light blues. NO green as a theme colour. */
  palette: {
    skyTop: string; skyMid: string; skyLow: string; horizonGlow: string;
    mountainFar: string; mountainNear: string; mountainCap: string;
    ice0: string; ice1: string; ice2: string; iceEdge: string; snow: string;
    blockTop: string; blockFront0: string; blockFront1: string; blockSide: string; plate: string; ink: string;
    gold: string; goldSoft: string; rose: string; cyan: string; violet: string; royal: string; navy: string;
    penguin: string; penguinRim: string; belly: string; beak0: string; beak1: string;
    deadBlock: string;
  };
  /** Aurora ribbons: slow, low contrast (WCAG 2.3.1: nothing here may flash). */
  aurora: { a: string; b: string; y: number; amp: number; speed: number; alpha: number }[];
  /** Roadside props, in the order they repeat. */
  props: ("pine" | "igloo" | "berg" | "lamp")[];
  /** The host character drawn on the ice. Swappable: the platform mascot is becoming a cast (fox, otter, hedgehog, red panda, ...). */
  character: CharacterDef;
  /** Muted variant used in Calm mode. */
  calm: { saturation: number; auroraAlpha: number };
}

export const POLAR: Theme = {
  id: "polar",
  palette: {
    skyTop: "#070b2e", skyMid: "#1a2a78", skyLow: "#5b4bc4", horizonGlow: "#c9b8ff",
    mountainFar: "#26357f", mountainNear: "#1a2760", mountainCap: "#dfe9ff",
    ice0: "#f4fbff", ice1: "#cfeaff", ice2: "#93c7f4", iceEdge: "#7fb2ee", snow: "#ffffff",
    blockTop: "#f3fbff", blockFront0: "#d7efff", blockFront1: "#8ec4f2", blockSide: "#6aa6e6", plate: "#ffffff", ink: "#1b2350",
    gold: "#ffce4a", goldSoft: "#fff0b3", rose: "#ff9ec7", cyan: "#7fe3ff", violet: "#9b7bff", royal: "#3b57d6", navy: "#1b2350",
    penguin: "#1b2350", penguinRim: "#3b4a92", belly: "#fbfbff", beak0: "#ffc94a", beak1: "#f08a1c",
    deadBlock: "#a9bcd6",
  },
  aurora: [
    { a: "#7fe3ff", b: "#6f8bff", y: 0.10, amp: 0.035, speed: 0.045, alpha: 0.34 },
    { a: "#9b7bff", b: "#ff9ec7", y: 0.145, amp: 0.03, speed: 0.033, alpha: 0.26 },
    { a: "#5fd0ff", b: "#b39dff", y: 0.06, amp: 0.028, speed: 0.06, alpha: 0.2 },
  ],
  props: ["pine", "berg", "igloo", "pine", "pine", "berg"],
  character: penguinCharacter,
  calm: { saturation: 0.62, auroraAlpha: 0.12 },
};
export const THEME: Theme = POLAR;


export type PropKind = "pine" | "igloo" | "berg" | "crystal" | "stalag" | "flag" | "cairn" | "arch";
export type Weather = "snow" | "motes" | "blizzard" | "sparkle" | "clouds";
/** How one biome looks and feels. A new world skin (for example "Lantern Cove") is a new set of these, nothing else. */
export interface BiomeLook {
  id: BiomeDef["id"];
  sky: [string, string, string, string];               // top, mid, low, horizon glow
  ridge: [string, string, string] | null;               // far, near, cap  (null = a cave ceiling instead of mountains)
  ground: [string, string, string];                     // snow field beside the road, far -> near
  road: [string, string, string, string];               // far -> near
  edge: string;                                          // road edge / snow bank
  aurora: { a: string; b: string; y: number; amp: number; speed: number; alpha: number }[] | null;
  props: PropKind[]; propTint: [string, string]; weather: Weather; stars: boolean; cave: boolean; sun: boolean;
  dim: number;                                           // 0..1 darkness laid over the world (caves, storm)
  frame: [string, string, string];                       // gate pillar top, bottom, beam
  chaser: { c0: string; c1: string };
  music: { bpm: number; chords: number[][]; arp: number[]; pad: OscillatorType; shimmer: boolean; bass: boolean; scale: number[] };
}
const A = POLAR.aurora;
export const LOOKS: Record<BiomeDef["id"], BiomeLook> = {
  glacier: {
    id: "glacier", sky: [POLAR.palette.skyTop, POLAR.palette.skyMid, POLAR.palette.skyLow, POLAR.palette.horizonGlow], ridge: [POLAR.palette.mountainFar, POLAR.palette.mountainNear, POLAR.palette.mountainCap],
    ground: ["#9fbff2", "#d7e8ff", "#f4f9ff"], road: ["#7fa8ea", POLAR.palette.ice2, POLAR.palette.ice1, POLAR.palette.ice0], edge: "#ffffff", aurora: A, props: POLAR.props as PropKind[], propTint: ["#2f47a8", "#3a56c0"],
    weather: "snow", stars: true, cave: false, sun: false, dim: 0, frame: ["#f6fcff", "#8ec4f2", "#e8f6ff"], chaser: { c0: "#ffffff", c1: "#c9dcff" },
    music: { bpm: 92, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], arp: [0, 1, 2, 1, 2, 1, 0, 2], pad: "triangle", shimmer: false, bass: false, scale: [0, 2, 4, 7, 9] },
  },
  aurora: {
    id: "aurora", sky: ["#0a0630", "#2a1a86", "#7a49d6", "#f0b8ff"], ridge: ["#33208f", "#231768", "#f3e9ff"], ground: ["#a99af0", "#d6ccff", "#f1ecff"], road: ["#8f7ee8", "#b5a8f5", "#d9d1ff", "#f0ecff"], edge: "#fff5ff",
    aurora: [{ a: "#7fe3ff", b: "#b39dff", y: 0.08, amp: 0.055, speed: 0.05, alpha: 0.55 }, { a: "#ff9ec7", b: "#9b7bff", y: 0.14, amp: 0.05, speed: 0.04, alpha: 0.45 }, { a: "#ffd86a", b: "#ff9ec7", y: 0.05, amp: 0.04, speed: 0.065, alpha: 0.3 }],
    props: ["arch", "crystal", "pine", "berg"], propTint: ["#5b3fc4", "#7d5cf0"], weather: "sparkle", stars: true, cave: false, sun: false, dim: 0, frame: ["#fbf6ff", "#b39dff", "#efe6ff"], chaser: { c0: "#c9b8ff", c1: "#7fe3ff" },
    music: { bpm: 78, chords: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 68]], arp: [0, 2, 1, 3, 2, 1, 3, 2], pad: "sine", shimmer: true, bass: false, scale: [0, 2, 4, 7, 9] },
  },
  caves: {
    id: "caves", sky: ["#04122a", "#0d2a55", "#164a86", "#52c8ff"], ridge: null, ground: ["#1c3a6e", "#2a5590", "#3a70b0"], road: ["#1d4d8f", "#2f6db8", "#5aa0e0", "#9ad0ff"], edge: "#8fe0ff",
    aurora: null, props: ["crystal", "stalag", "crystal", "berg"], propTint: ["#3fb6ff", "#8a6bff"], weather: "motes", stars: false, cave: true, sun: false, dim: 0.28, frame: ["#bfe8ff", "#3f86d0", "#7fd0ff"], chaser: { c0: "#7a8aa8", c1: "#3a4666" },
    music: { bpm: 70, chords: [[52, 55, 59], [48, 52, 55], [50, 53, 57], [47, 50, 54]], arp: [0, 2, 1, 2, 0, 1, 2, 1], pad: "sine", shimmer: true, bass: true, scale: [0, 3, 5, 7, 10] },
  },
  storm: {
    id: "storm", sky: ["#0c1024", "#2b3556", "#56658f", "#a5b3d8"], ridge: ["#3a4670", "#2a3358", "#e6ecfa"], ground: ["#8896bd", "#b9c5e2", "#e3eaf8"], road: ["#6f82b8", "#8fa2d0", "#b7c6e6", "#dbe5f6"], edge: "#f2f6ff",
    aurora: null, props: ["pine", "berg", "pine", "flag"], propTint: ["#3a4a86", "#4a5c9c"], weather: "blizzard", stars: false, cave: false, sun: false, dim: 0.16, frame: ["#e9f0ff", "#7d92c8", "#d3ddf5"], chaser: { c0: "#e6ecfa", c1: "#8fa2d0" },
    music: { bpm: 108, chords: [[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47]], arp: [0, 1, 0, 2, 0, 1, 2, 1], pad: "sawtooth", shimmer: false, bass: true, scale: [0, 3, 5, 7, 10] },
  },
  summit: {
    id: "summit", sky: ["#1a3a8a", "#4a86e0", "#f2c47a", "#fff0b8"], ridge: ["#5a78c8", "#3f5aa8", "#ffffff"], ground: ["#cfe0ff", "#eaf2ff", "#ffffff"], road: ["#9fc4f5", "#c4dcfb", "#e2efff", "#f7fbff"], edge: "#ffffff",
    aurora: null, props: ["flag", "cairn", "berg", "pine"], propTint: ["#3b57d6", "#5a78e8"], weather: "clouds", stars: false, cave: false, sun: true, dim: 0, frame: ["#fffbe8", "#e8c060", "#ffe58a"], chaser: { c0: "#ffffff", c1: "#dbe6ff" },
    music: { bpm: 100, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], arp: [0, 1, 2, 1, 2, 0, 2, 1], pad: "triangle", shimmer: true, bass: false, scale: [0, 2, 4, 7, 9] },
  },
};
export const lookOf = (biome: number | undefined): BiomeLook => LOOKS[(["glacier", "aurora", "caves", "storm", "summit"] as const)[Number.isFinite(biome) ? Math.max(0, Math.min(4, (biome as number) - 1)) : 0]!];
/** Kept for the summary screen while the wardrobe moves to config.ts: how many cosmetics a child has earned. */
export const unlockedCosmetics = (fluentFacts: number) => COSMETICS.filter((c) => (c.unlock.secured ?? 0) <= fluentFacts).map((c) => c.id);

/** Junior / Explorer: same world, two voices. The child chooses (autonomy). Junior is round, big and bright. Explorer is for older kids: a duller, cooler, more serious palette (desaturated, darker, a steel-blue
 *  wash and amber accents), angular blocks with a condensed sans on them, a leaner penguin in an expedition hood, and shorter, plainer words (`<key>__x` in the catalogue). */
export const SKIN_LOOK: Record<Skin, { penguin: number; sat: number; bright: number; blockRadius: number; hudScale: number; wash: string; washAlpha: number; font: string; blockFont: number }> = {
  junior: { penguin: 1.1, sat: 1.06, bright: 1.03, blockRadius: 1.25, hudScale: 1.06, wash: "#000000", washAlpha: 0, font: "", blockFont: 1 },
  explorer: { penguin: 0.92, sat: 0.62, bright: 0.9, blockRadius: 0.3, hudScale: 1, wash: "#1a2a55", washAlpha: 0.2, font: '"Barlow Condensed","Roboto Condensed","Arial Narrow","Helvetica Neue",system-ui,sans-serif', blockFont: 1.12 },
};
export { JUICE as JUICE_CFG };

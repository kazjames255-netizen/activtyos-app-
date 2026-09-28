// EVERY tunable number and every piece of journey content for Penguin Slide lives here, in ONE place (pure data, no DOM: the server imports it too).
// Numbers marked [D] are design PROPOSALS to tune in playtest, not findings (docs/games-research/deep/A). Visual/theme tokens live in theme.ts.

/** Play policy (server + client). None of it is a lock: rewards are informational, rest is always free. */
export const POLICY = {
  xpDailyCap: 120,          // points only for correct FIRST-attempt answers, capped per day
  weekGoalDays: 3,          // "3 days this week": a weekly rhythm that only goes up; rest days are free; no loss framing
  restAfterMs: 12 * 60_000, // ages 7-11: a friendly break prompt after ~10-15 min; progress is always saved
  restAfterRuns: 5,
  dailySoftCap: 5,          // runs before a friendly "rest" (never a lock)
  unlockStars: 2,           // the next stage opens at 2 stars (>= 80% first-try accuracy): MASTERY, never time. A tutor can open everything.
  loadoutSlots: 2,
  starAccuracy: [0.8, 0.92] as const, // 2nd star: first-try accuracy >= 80%; 3rd: >= 92% with no helper used. NEVER speed.
} as const;

/** Juice (docs A). One tunable object. */
export const JUICE = {
  inputBufferMs: 120, coyoteMs: 100, laneEaseMs: 150, overshootPct: 0.05,
  stretch: 1.1, stretchMs: 80, squash: 0.92, squashMs: 100, correctPulse: 1.15, pulseMs: 120,
  windupMs: 70, windupLean: 0.06, hitStopMs: 60, shakeCorrectPx: 2.5, shakeWrongPx: 4, shakeMs: 110,
  cameraLookahead: 0.06, cameraSmoothS: 0.15,  // NO zoom pulses, NO roll (vestibular)
  snowPuff: { n: 8, ms: 420 }, chips: 14, starPop: 7,
  reducedParticleFactor: 0.2, reducedPulse: 1.05,
  flashesPerSecMax: 3,   // WCAG 2.3.1 ceiling. There is no full-screen flash and no lightning strobe anywhere.
  hoverDrift: 0.035, ghostAlpha: 0.5,
  restAfterMs: POLICY.restAfterMs, restAfterRuns: POLICY.restAfterRuns, xpDailyCap: POLICY.xpDailyCap, weekGoalDays: POLICY.weekGoalDays,
} as const;

// ─── the journey ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Form = "x" | "d" | "m";   // 7 x 8 = ?   56 / 7 = ?   ? x 8 = 56
export type GateStyle = "blocks" | "ramps" | "hazards" | "shoals" | "summit";
export type ChaserKind = "avalanche" | "serpent" | "cavein" | "blizzard" | "whiteout";

export interface BiomeDef {
  n: 1 | 2 | 3 | 4 | 5; id: "glacier" | "aurora" | "caves" | "storm" | "summit";
  /** How its gates look and what is new to learn here. */
  style: GateStyle; chaser: ChaserKind; tables: number[];
  /** Mechanics INTRODUCED in this biome (shown on the stage card the first time): keys into the hubgames catalogue `mech_<key>`. */
  intro: string[];
}
export const BIOMES: BiomeDef[] = [
  { n: 1, id: "glacier", style: "blocks", chaser: "avalanche", tables: [2, 5, 10], intro: ["steer", "catch"] },
  { n: 2, id: "aurora", style: "ramps", chaser: "serpent", tables: [3, 4, 8], intro: ["ramps"] },
  { n: 3, id: "caves", style: "hazards", chaser: "cavein", tables: [6, 7, 9], intro: ["hazards"] },
  { n: 4, id: "storm", style: "shoals", chaser: "blizzard", tables: [11, 12], intro: ["shoals", "divide"] },
  { n: 5, id: "summit", style: "summit", chaser: "whiteout", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], intro: ["combo", "missing"] },
];

export interface StageDef {
  id: string; biome: BiomeDef["n"]; idx: 1 | 2 | 3 | 4; boss: boolean;
  /** The facts this stage practises (any factor in the list). */
  tables: number[]; forms: Form[]; n: number;
  /** A boss / family stage is built from FACT FAMILIES: given a, b and a x b, make all four facts. */
  family: boolean;
  /** Moving gates ("shoals"): the blocks drift sideways until you commit. */
  shoals: boolean;
  /** Two-step combo: a fact then its inverse ("6 x 7 = 42, so 42 / 6 = ?"). */
  combo: boolean;
}
const S = (id: string, biome: StageDef["biome"], idx: StageDef["idx"], tables: number[], o: Partial<StageDef> = {}): StageDef => ({ id, biome, idx, boss: false, tables, forms: ["x"], n: 10, family: false, shoals: false, combo: false, ...o });
export const STAGES: StageDef[] = [
  S("b1s1", 1, 1, [2], { n: 8 }), S("b1s2", 1, 2, [5], { n: 8 }), S("b1s3", 1, 3, [2, 5, 10]), S("b1s4", 1, 4, [2, 5, 10], { boss: true, family: true, n: 12, forms: ["x", "d"] }),
  S("b2s1", 2, 1, [3]), S("b2s2", 2, 2, [4]), S("b2s3", 2, 3, [8]), S("b2s4", 2, 4, [3, 4, 8], { boss: true, family: true, n: 12, forms: ["x", "d"] }),
  S("b3s1", 3, 1, [6]), S("b3s2", 3, 2, [7]), S("b3s3", 3, 3, [9]), S("b3s4", 3, 4, [6, 7, 9], { boss: true, family: true, n: 12, forms: ["x", "d"] }),
  S("b4s1", 4, 1, [11], { shoals: true }), S("b4s2", 4, 2, [12], { shoals: true }), S("b4s3", 4, 3, [11, 12], { shoals: true, forms: ["x", "d"] }), S("b4s4", 4, 4, [11, 12, 6, 7, 8, 9], { boss: true, family: true, shoals: true, n: 12, forms: ["x", "d"] }),
  S("b5s1", 5, 1, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], { forms: ["x", "m"] }), S("b5s2", 5, 2, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], { forms: ["x", "d"] }), S("b5s3", 5, 3, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], { combo: true, forms: ["x", "d", "m"] }),
  S("b5s4", 5, 4, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], { boss: true, family: true, combo: true, shoals: true, n: 12, forms: ["x", "d", "m"] }),
];
export const stageById = (id: string): StageDef | null => STAGES.find((s) => s.id === id) ?? null;
export const biomeOf = (n: number): BiomeDef => BIOMES[Math.max(0, Math.min(4, n - 1))]!;

// ─── earned helpers: unlocked by MASTERY (facts secured / bosses cleared), never by time, never bought, never random ──────────────────────
export type PowerId = "hint" | "shield" | "freeze" | "magnet" | "radar";
export interface PowerDef { id: PowerId; /** run charges */ charges: number; unlock: { secured?: number; boss?: number }; /** using it counts as help: it costs the 3rd star, never anything else */ help: boolean }
export const POWERS: PowerDef[] = [
  { id: "hint", charges: 2, unlock: { secured: 3 }, help: true },     // hint fish: melts one wrong block
  { id: "shield", charges: 1, unlock: { secured: 8 }, help: true },   // a slip will not break the streak
  { id: "magnet", charges: 1, unlock: { boss: 1 }, help: false },     // pulls nearby fish to you (fish only, never answers)
  { id: "freeze", charges: 2, unlock: { boss: 2 }, help: true },      // slow-time crystal: moving blocks hold still for this gate
  { id: "radar", charges: 1, unlock: { boss: 3 }, help: true },       // fact radar: shows which table each block belongs to
];

/** Penguin wardrobe: EARNED only (mastery, stars, bosses, rescued friends, the village). Never random, never paid for with money; the few fish items are bought with fish a child collected by playing.
 *  Chosen only at the end of a run. `friends` / `built` are counted on the device (friends rescued, village buildings built); everything else the server can verify. */
export type Slot = "hat" | "scarf" | "trail" | "sled" | "back";
export interface CosUnlock { secured?: number; stars?: number; boss?: number; /** stages cleared with 3 stars */ perfect?: number; /** friends rescued (device) */ friends?: number; /** village buildings built (device) */ built?: number; /** bought in the Igloo Village with fish (never a server unlock) */ fish?: number }
export interface CosDef { id: string; slot: Slot; unlock: CosUnlock }
/** Unlock keys the SERVER cannot see: those items are unlocked on the device only. */
export const DEVICE_UNLOCKS = ["fish", "friends", "built"] as const;
export const isDeviceCos = (c: CosDef) => DEVICE_UNLOCKS.some((k) => c.unlock[k] !== undefined);
export const COSMETICS: CosDef[] = [
  // hats (12)
  { id: "cap", slot: "hat", unlock: {} }, { id: "beanie", slot: "hat", unlock: { stars: 6 } }, { id: "crown", slot: "hat", unlock: { boss: 5 } },
  { id: "earmuffs", slot: "hat", unlock: { stars: 12 } }, { id: "wizard", slot: "hat", unlock: { secured: 40 } }, { id: "viking", slot: "hat", unlock: { boss: 3 } },
  { id: "chef", slot: "hat", unlock: { built: 3 } }, { id: "pirate", slot: "hat", unlock: { friends: 4 } }, { id: "spacehelmet", slot: "hat", unlock: { stars: 45 } },
  { id: "antlers", slot: "hat", unlock: { friends: 10 } }, { id: "tophat", slot: "hat", unlock: { perfect: 6 } }, { id: "goggles", slot: "hat", unlock: { fish: 120 } },
  // scarves and neckwear (7)
  { id: "scarf", slot: "scarf", unlock: { secured: 4 } }, { id: "stripe", slot: "scarf", unlock: { stars: 15 } }, { id: "bowtie", slot: "scarf", unlock: { secured: 16 } },
  { id: "medal", slot: "scarf", unlock: { boss: 1 } }, { id: "bell", slot: "scarf", unlock: { friends: 2 } }, { id: "pearls", slot: "scarf", unlock: { perfect: 3 } },
  { id: "cape", slot: "scarf", unlock: { fish: 200 } },
  // trails (8)
  { id: "snow", slot: "trail", unlock: {} }, { id: "sparkle", slot: "trail", unlock: { secured: 24 } }, { id: "stars", slot: "trail", unlock: { boss: 2 } },
  { id: "bubbles", slot: "trail", unlock: { stars: 9 } }, { id: "flakes", slot: "trail", unlock: { secured: 32 } }, { id: "embers", slot: "trail", unlock: { boss: 4 } },
  { id: "hearts", slot: "trail", unlock: { friends: 6 } }, { id: "rainbow", slot: "trail", unlock: { fish: 320 } },
  // sleds and boards (7)
  { id: "nosled", slot: "sled", unlock: {} }, { id: "sled", slot: "sled", unlock: { boss: 1 } }, { id: "tube", slot: "sled", unlock: { boss: 3 } },
  { id: "toboggan", slot: "sled", unlock: { stars: 21 } }, { id: "skis", slot: "sled", unlock: { built: 5 } }, { id: "snowboard", slot: "sled", unlock: { perfect: 9 } },
  { id: "rocket", slot: "sled", unlock: { fish: 480 } },
  // backs (6)
  { id: "noback", slot: "back", unlock: {} }, { id: "backpack", slot: "back", unlock: { stars: 3 } }, { id: "wings", slot: "back", unlock: { boss: 2 } },
  { id: "balloon", slot: "back", unlock: { friends: 3 } }, { id: "kite", slot: "back", unlock: { secured: 28 } }, { id: "jetpack", slot: "back", unlock: { boss: 5 } },
];

/** The Igloo Village: fish rebuild it, one building at a time, and YOU choose where each one goes (tap a building, then tap a plot). Cost in fish; a skilled 10-question run earns roughly 150-300.
 *  Cosmetic only: nothing here makes maths easier. `plot` is where it sits by default (front row 0-5, back row 6-11). */
export const VILLAGE = [
  { id: "hut", cost: 60 }, { id: "market", cost: 90 }, { id: "bakery", cost: 120 }, { id: "shed", cost: 200 }, { id: "library", cost: 300 }, { id: "school", cost: 380 },
  { id: "lighthouse", cost: 450 }, { id: "rink", cost: 650 }, { id: "observatory", cost: 750 }, { id: "springs", cost: 900 }, { id: "bridge", cost: 1050 }, { id: "square", cost: 1200 },
] as const;
export type BuildingId = (typeof VILLAGE)[number]["id"];
export const VILLAGE_PLOTS = 12;

/** The friends. One is frozen in ice in every stage's world (crack the ice with a belly-flop); a boss stage's friend is freed when the boss is beaten. A freed friend helps for the rest of that run
 *  (reaches for fish, takes the first bump) and then moves into the Igloo Village. Their species follows the world. */
export const FRIEND_SPECIES = ["seal", "fox", "mole", "puffin", "hare"] as const;
export type FriendSpecies = (typeof FRIEND_SPECIES)[number];
export const friendOf = (biome: number): FriendSpecies => FRIEND_SPECIES[Math.max(0, Math.min(4, biome - 1))]!;

// ─── hand-authored set pieces ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The level generator (core.ts startLeg) mixes weighted-random patterns with these hand-made segments. A piece is a small ASCII picture: each STRING is one row across the ice
// (9 columns, left to right = x -0.8 .. +0.8), and the rows are met from the FIRST one to the last (each row is SET_ROW distance units, about 0.17 s of sliding). Write one like this:
//
//   ["....o....",      o fish   O big fish (worth 3)   * sky fish (only while airborne)   c crystal (relights the lantern)
//    "...o.o...",      R rock   B snowball (both hard: stun + drop fish)   d drift (soft; a belly-flop smashes it)
//    "..o...o.."]      = boost pad   ^ launch ramp   ~ aurora ring   . nothing
//
// Rules the validator (validateSetPiece, run by the travel selftest) enforces so a piece can never be unfair: rows are exactly 9 wide, only these characters, and there is always a way through the
// hard objects that never asks for more than one column of sideways movement per row, with at least 3 safe columns in any row that has a rock. A stage script (STAGE_SCRIPT) names the pieces a stage opens with; after that the world picks from its own pool.
export const SET_ROW = 3.4; export const SET_COLS = 9;
export const setColX = (c: number) => Math.round((-0.8 + c * 0.2) * 10) / 10;
export interface SetPiece { id: string; biome: 1 | 2 | 3 | 4 | 5; rows: string[] }
const SP = (id: string, biome: SetPiece["biome"], rows: string[]): SetPiece => ({ id, biome, rows });
export const SET_PIECES: SetPiece[] = [
  // 1 Glacier: drifts and pads (belly-flop school)
  SP("g_arc", 1, ["....o....", "...o.o...", "..o...o..", ".o.....o.", "..o...o..", "...o.o...", "....o...."]),
  SP("g_flopwall", 1, ["....o....", "....o....", "ddddddddd", ".........", "....O....", "....o....", "....o...."]),
  SP("g_padslalom", 1, ["..=......", "..o......", "...o.....", "....o....", ".....o...", "......=..", ".....o...", "....o....", "...o.....", "..=......"]),
  SP("g_driftgap", 1, ["ddd...ddd", "ddd...ddd", ".........", "...ooo...", ".........", "dd.....dd", "dd..o..dd", "........."]),
  SP("g_tunnel", 1, ["oo.....oo", "oo.....oo", ".o.....o.", "..o...o..", "...o.o...", "....O....", "...o.o...", "..o...o.."]),
  // 2 Aurora: ramps, sky fish, rings
  SP("a_ladder", 2, ["....^....", ".........", ".........", "....*....", "...*.*...", "..*...*..", "...*.*...", "....*....", "....O...."]),
  SP("a_twin", 2, ["..^...^..", ".........", "..*...*..", ".........", "...*.*...", "....*....", ".........", "....o...."]),
  SP("a_ringweave", 2, ["~........", ".o.......", "...~.....", ".....o...", ".....~...", "....o....", "...~.....", "..o......", ".~......."]),
  SP("a_rise", 2, ["..o......", "...o.....", "....^....", ".........", "....*....", "....*....", "...*.*...", "....O...."]),
  SP("a_ringline", 2, ["....~....", ".........", "....~....", "...o.o...", "....~....", ".........", "....~...."]),
  // 3 Caves: rocks with a corridor, crystals for the lantern
  SP("c_slalom", 3, ["RR.......", "RR.......", ".RR.....o", "..RR...o.", "...RR..o.", "..RR.....", ".RR.....o", "RR......."]),
  SP("c_crystal", 3, ["....c....", "...o.o...", "RR.....RR", "RR..c..RR", "RR.....RR", ".........", "....O...."]),
  SP("c_pillars", 3, ["R.......R", "R...o...R", "RR.....RR", ".R..o..R.", "..R...R..", ".R..c..R.", "R.......R"]),
  SP("c_zig", 3, ["RR.......", ".RR......", "..RR.....", "...RR....", "....RR...", "...RR....", "..RR.....", ".RR......"]),
  SP("c_dark", 3, ["....o....", "R.......R", ".R.....R.", "....o....", "R.......R", "....c....", "....o...."]),
  // 4 Storm: snowballs in pairs, floes
  SP("s_gustgap", 4, ["B.......B", "....o....", "B.......B", ".........", ".B.....B.", "....o....", ".........", "....O...."]),
  SP("s_floes", 4, ["dd.....dd", "..dd.dd..", "....o....", "..dd.dd..", "dd.....dd", "....o....", ".........", "....O...."]),
  SP("s_zigzag", 4, ["BB.......", "BB.......", ".BB......", ".BB......", "..BB.....", "..BB.....", ".BB......", ".BB......", "BB......."]),
  SP("s_lane", 4, ["B...o...B", "B...o...B", "B.......B", ".........", "....o....", ".B.....B.", "....o...."]),
  // 5 Summit: forks and everything at once
  SP("m_fork", 5, ["....o....", "...o.o...", "..R...oo.", "..R...oo.", ".RR...=..", ".........", "....O...."]),
  SP("m_ridge", 5, ["R.......R", ".R..o..R.", "....o....", "....=....", ".........", "....^....", ".........", "...*.*...", "....O...."]),
  SP("m_gauntlet", 5, ["BB.......", "....o....", ".......BB", "....~....", "RR.......", "....c....", "....O...."]),
  SP("m_stairs", 5, ["oo.......", ".oo......", "..oo.....", "...oo....", "....oo...", ".....oo..", "......oo.", "R.......O"]),
];
export const setPiecesOf = (biome: number) => SET_PIECES.filter((p) => p.biome === biome);
/** Stage scripts: the pieces a stage opens with, one per leg after the first (then the world's weighted mix, seasoned with its pool). Authoring a stage = writing its list. */
export const STAGE_SCRIPT: Record<string, string[]> = {
  b1s1: ["g_arc", "g_padslalom", "g_flopwall"], b1s2: ["g_tunnel", "g_flopwall", "g_padslalom"], b1s3: ["g_driftgap", "g_arc", "g_tunnel", "g_padslalom"],
  b2s1: ["a_ladder", "a_ringline", "a_rise"], b2s2: ["a_twin", "a_ringweave", "a_ladder"], b2s3: ["a_ringweave", "a_ladder", "a_twin", "a_rise"],
  b3s1: ["c_crystal", "c_slalom", "c_pillars"], b3s2: ["c_pillars", "c_dark", "c_slalom"], b3s3: ["c_zig", "c_dark", "c_crystal", "c_pillars"],
  b4s1: ["s_floes", "s_gustgap", "s_lane"], b4s2: ["s_gustgap", "s_zigzag", "s_floes"], b4s3: ["s_zigzag", "s_lane", "s_floes", "s_gustgap"],
  b5s1: ["m_fork", "m_stairs", "m_ridge"], b5s2: ["m_ridge", "m_gauntlet", "m_fork"], b5s3: ["m_gauntlet", "m_stairs", "m_ridge", "m_fork"],
};
const SET_CHARS = ".oO*cRBd=^~";
/** Problems with a set piece (empty = fine). Hard cells are R and B; the path check lets the child change at most one column per row (well inside what the ice allows). */
export function validateSetPiece(p: SetPiece): string[] {
  const bad: string[] = [];
  if (p.rows.length < 3 || p.rows.length > 14) bad.push("3-14 rows");
  p.rows.forEach((r, i) => { if (r.length !== SET_COLS) bad.push(`row ${i} is ${r.length} wide (need ${SET_COLS})`); for (const ch of r) if (!SET_CHARS.includes(ch)) bad.push(`row ${i}: unknown '${ch}'`); });
  if (bad.length) return bad;
  const hard = (r: string, c: number) => r[c] === "R" || r[c] === "B";
  const clear = (r: string, c: number) => !hard(r, c) && !hard(r, c - 1) && !hard(r, c + 1); // a rock reaches 0.2 to either side: a cell is only safe with both neighbours clear too
  let reach = new Set<number>(Array.from({ length: SET_COLS }, (_, c) => c));
  p.rows.forEach((r, i) => {
    const nx = new Set<number>(); let free = 0;
    for (let c = 0; c < SET_COLS; c++) { if (clear(r, c)) free++; if (clear(r, c) && [c - 1, c, c + 1].some((q) => reach.has(q))) nx.add(c); }
    if (/[RB]/.test(r) && free < 3) bad.push(`row ${i} leaves only ${free} safe columns (need 3)`);
    reach = nx; if (!reach.size) bad.push(`no way through at row ${i}`);
  });
  return bad;
}
export interface SetItem { kind: "fish" | "rock" | "ball" | "drift" | "pad" | "ramp" | "sky" | "crystal" | "ring"; x: number; d: number; w: number; v: number }
/** A piece as objects, distances relative to its start; `mirror` flips it left-right. */
export function setPieceItems(p: SetPiece, mirror = false): SetItem[] {
  const out: SetItem[] = [];
  p.rows.forEach((r, i) => { for (let c = 0; c < SET_COLS; c++) {
    const ch = r[c]!; if (ch === ".") continue; const x = setColX(mirror ? SET_COLS - 1 - c : c), d = i * SET_ROW;
    if (ch === "o") out.push({ kind: "fish", x, d, w: 0.1, v: 1 }); else if (ch === "O") out.push({ kind: "fish", x, d, w: 0.1, v: 3 });
    else if (ch === "*") out.push({ kind: "sky", x, d, w: 0.14, v: 1 }); else if (ch === "c") out.push({ kind: "crystal", x, d, w: 0.24, v: 1 });
    else if (ch === "R") out.push({ kind: "rock", x, d, w: 0.15, v: 1 }); else if (ch === "B") out.push({ kind: "ball", x, d, w: 0.15, v: 1 });
    else if (ch === "d") out.push({ kind: "drift", x, d, w: 0.11, v: 1 }); else if (ch === "=") out.push({ kind: "pad", x, d, w: 0.22, v: 1 });
    else if (ch === "^") out.push({ kind: "ramp", x, d, w: 0.26, v: 1 }); else if (ch === "~") out.push({ kind: "ring", x, d, w: 0.28, v: 3 });
  } });
  return out;
}
export const setPieceLen = (p: SetPiece) => p.rows.length * SET_ROW;

/** Challenge of the Day: SAFE modifiers only (nothing that adds pressure or hides the answer). Picked from the calendar day, the same for everyone. */
export const MODIFIERS = ["fish2", "mirror", "backwards", "sparkle", "family"] as const;
export type Modifier = (typeof MODIFIERS)[number];
export const modifierOfDay = (dayKey: string): Modifier => { let h = 0; for (const c of dayKey) h = (h * 31 + c.charCodeAt(0)) >>> 0; return MODIFIERS[h % MODIFIERS.length]!; };

export const SKINS = ["junior", "explorer"] as const;
export type Skin = (typeof SKINS)[number];

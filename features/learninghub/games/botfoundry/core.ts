// Bot Foundry — a computing/logic game. A child assembles a short PROGRAM (a list of instructions) that a bot then
// runs on a small grid to reach its goal. Grounded in the National Curriculum computing programme of study:
//   sequence   (KS1)  — a fixed, ordered list of steps.
//   selection  (KS2)  — "if wall ahead, turn" branches the program on what the bot senses.
//   iteration  (KS2)  — "repeat N [ ... ]" loops instead of writing the same step N times.
//   debugging  (KS2)  — given a program that ALMOST works, find and fix the bug.
// Same server-authoritative contract as every hub game: the server issues a seeded PLAN (which puzzles, in which
// order) from a curated puzzle bank; the browser builds programs and sends only the programs it built; the server
// RE-SIMULATES each program against the puzzle's grid with this same pure engine and marks it. A modified client
// can submit any program it likes — it can only ever change what gets ignored, never whether it actually solves
// the grid. Pure + isomorphic (imported by the client UI and by server/src/lib/games/botFoundry.ts).
import { makeRng } from "../../tools/engine/rng";

export type Dir = 0 | 1 | 2 | 3; // 0=N, 1=E, 2=S, 3=W
export type Step =
  | { op: "forward" }
  | { op: "left" }
  | { op: "right" }
  | { op: "repeat"; n: number; body: Step[] }
  | { op: "if_wall"; then: Step[] };
export type Program = Step[];

export type Concept = "sequence" | "selection" | "iteration" | "debug";
export interface Puzzle {
  id: string;
  title: string;
  concept: Concept;
  years: string[];
  /** Rows of the grid, top to bottom; '#' = wall, '.' = floor, 'G' = goal, 'S' = start (facing east). */
  grid: string[];
  /** Fewest instructions any solution needs (for the 3rd star / hint copy) — NOT enforced as a limit. */
  parMoves: number;
  /** debug puzzles ship a starting program with exactly one bug for the child to fix, rather than build from scratch. */
  starterBug?: Program;
}

const DX: Record<Dir, number> = { 0: 0, 1: 1, 2: 0, 3: -1 };
const DY: Record<Dir, number> = { 0: -1, 1: 0, 2: 1, 3: 0 };

function parseGrid(grid: string[]): { walls: Set<string>; start: { x: number; y: number }; goal: { x: number; y: number } } {
  const walls = new Set<string>();
  let start = { x: 0, y: 0 }, goal = { x: 0, y: 0 };
  grid.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === "#") walls.add(`${x},${y}`);
    if (c === "S") start = { x, y };
    if (c === "G") goal = { x, y };
  }));
  return { walls, start, goal };
}

export interface RunTrace { reached: boolean; steps: number; crashed: boolean; path: { x: number; y: number }[] }

const MAX_STEPS = 400;

/** Run a program against a puzzle's grid. Pure, deterministic, no randomness — this IS the re-simulation the server
 *  performs; the client runs the identical function to animate the bot, but the number that gets recorded is
 *  whatever the SERVER computes from the SAME function. */
export function runProgram(puzzle: Puzzle, program: Program): RunTrace {
  const { walls, start, goal } = parseGrid(puzzle.grid);
  let x = start.x, y = start.y, dir: Dir = 1; // bots always start facing east
  let steps = 0, crashed = false;
  const path: { x: number; y: number }[] = [{ x, y }];
  const wallAhead = () => walls.has(`${x + DX[dir]},${y + DY[dir]}`);
  const exec = (ops: Program): boolean => { // returns true if it should keep going (goal not yet reached, no crash)
    for (const s of ops) {
      if (steps >= MAX_STEPS || crashed) return false;
      if (x === goal.x && y === goal.y) return false;
      if (s.op === "forward") {
        steps++;
        const nx = x + DX[dir], ny = y + DY[dir];
        if (walls.has(`${nx},${ny}`) || ny < 0 || ny >= puzzle.grid.length || nx < 0 || nx >= puzzle.grid[0]!.length) { crashed = true; return false; }
        x = nx; y = ny; path.push({ x, y });
      } else if (s.op === "left") { steps++; dir = ((dir + 3) % 4) as Dir; }
      else if (s.op === "right") { steps++; dir = ((dir + 1) % 4) as Dir; }
      else if (s.op === "repeat") { for (let i = 0; i < Math.max(0, Math.min(20, s.n)); i++) { if (!exec(s.body)) return false; } }
      else if (s.op === "if_wall") { if (wallAhead()) { if (!exec(s.then)) return false; } }
      if (x === goal.x && y === goal.y) return false;
    }
    return true;
  };
  exec(program);
  return { reached: x === goal.x && y === goal.y, steps, crashed, path };
}

// ── curated puzzle bank, grounded in the computing curriculum's own progression ────────────────────────────────
export const PUZZLES: Puzzle[] = [
  { id: "seq1", title: "Straight line", concept: "sequence", years: ["1", "2"], parMoves: 3, grid: ["S..G"] },
  { id: "seq2", title: "Turn the corner", concept: "sequence", years: ["1", "2"], parMoves: 5, grid: ["S..", "..#", "..G"] },
  { id: "seq3", title: "Around the wall", concept: "sequence", years: ["2", "3"], parMoves: 7, grid: ["S....", ".###.", "....G"] },
  { id: "sel1", title: "Sense a wall", concept: "selection", years: ["3", "4"], parMoves: 4, grid: ["S.#.", "....", "...G"] },
  { id: "sel2", title: "Choose a path", concept: "selection", years: ["4", "5"], parMoves: 6, grid: ["S..#..", "..#...", "......", "....#G"] },
  { id: "iter1", title: "Repeat forward", concept: "iteration", years: ["3", "4"], parMoves: 6, grid: ["S.....G"] },
  { id: "iter2", title: "Loop the square", concept: "iteration", years: ["4", "5"], parMoves: 8, grid: ["S...", "....", "....", "...G"] },
  { id: "iter3", title: "Nested loops", concept: "iteration", years: ["5", "6"], parMoves: 10, grid: ["S.......", "........", "........", ".......G"] },
  {
    id: "debug1", title: "Fix the bug: one wrong turn", concept: "debug", years: ["3", "4"], parMoves: 5, grid: ["S..", ".#.", "..G"],
    starterBug: [{ op: "forward" }, { op: "forward" }, { op: "left" }, { op: "forward" }, { op: "forward" }],
  },
  {
    id: "debug2", title: "Fix the bug: loop runs too far", concept: "debug", years: ["4", "5"], parMoves: 6, grid: ["S.....G"],
    starterBug: [{ op: "repeat", n: 8, body: [{ op: "forward" }] }],
  },
];
export const puzzleById = (id: string): Puzzle | null => PUZZLES.find((p) => p.id === id) ?? null;

export const BOT_RUN = { n: 5 } as const;

/** One (child, puzzle) mastery-lite record: has it ever been solved, best move count, attempts. */
export interface PuzzleState { id: string; solved: boolean; bestSteps: number | null; attempts: number; updatedAt: string }
export const freshPuzzleState = (id: string): PuzzleState => ({ id, solved: false, bestSteps: null, attempts: 0, updatedAt: "" });

/** Pick `n` puzzles for a run: unsolved puzzles first (in curriculum order: sequence -> selection -> iteration ->
 *  debug, easiest first within each), then a light shuffle so a repeat run isn't byte-identical. Deterministic
 *  from `seed`. `years` narrows the bank to a child's own year group when known. */
export function makeBotPlan(seed: number, states: ReadonlyMap<string, PuzzleState>, years?: string[]): Puzzle[] {
  const rng = makeRng(seed);
  const bank = years?.length ? PUZZLES.filter((p) => p.years.some((y) => years.includes(y))) : PUZZLES;
  // Only narrow to the year-tagged bank when it actually has enough puzzles for a FULL run — a year group at the
  // edge of the bank's coverage (e.g. Y7, above every puzzle's tagged years) must still get a full, varied run
  // rather than a 1-puzzle plan silently starved by an over-narrow filter.
  const pool = bank.length >= BOT_RUN.n ? bank : PUZZLES;
  const order: Concept[] = ["sequence", "selection", "iteration", "debug"];
  const sorted = [...pool].sort((a, b) => order.indexOf(a.concept) - order.indexOf(b.concept) || a.parMoves - b.parMoves);
  const unsolved = sorted.filter((p) => !states.get(p.id)?.solved);
  const solved = sorted.filter((p) => states.get(p.id)?.solved);
  const n = Math.min(BOT_RUN.n, pool.length);
  const picked = [...unsolved, ...rng.shuffle(solved)].slice(0, n);
  return picked.length ? picked : rng.shuffle(sorted).slice(0, n);
}

export interface BotSubmission { puzzleId: string; program: Program }
export interface BotRow { puzzleId: string; title: string; concept: Concept; reached: boolean; crashed: boolean; steps: number; parMoves: number; stars: 0 | 1 | 2 | 3 }
export interface BotResult { solved: number; total: number; rows: BotRow[] }

const starsFor = (reached: boolean, steps: number, par: number): 0 | 1 | 2 | 3 => {
  if (!reached) return 0;
  if (steps <= par) return 3;
  if (steps <= par + 3) return 2;
  return 1;
};

/** Mark a run. Pure — re-simulates every submitted program against ITS OWN puzzle from the stored plan; the
 *  client's claimed outcome is never trusted, only the program (the "input log" of this game). */
export function markBotRun(plan: Puzzle[], submissions: BotSubmission[]): BotResult {
  const rows: BotRow[] = plan.map((puzzle) => {
    const sub = submissions.find((s) => s.puzzleId === puzzle.id);
    const trace = sub ? runProgram(puzzle, cleanProgram(sub.program) ?? []) : { reached: false, crashed: false, steps: 0, path: [] };
    return { puzzleId: puzzle.id, title: puzzle.title, concept: puzzle.concept, reached: trace.reached, crashed: trace.crashed, steps: trace.steps, parMoves: puzzle.parMoves, stars: starsFor(trace.reached, trace.steps, puzzle.parMoves) };
  });
  return { solved: rows.filter((r) => r.reached).length, total: rows.length, rows };
}

export function applyBotToItems(rows: BotRow[], states: ReadonlyMap<string, PuzzleState>, nowIso: string): Map<string, PuzzleState> {
  const out = new Map(states);
  for (const r of rows) {
    const s = out.get(r.puzzleId) ?? freshPuzzleState(r.puzzleId);
    out.set(r.puzzleId, { id: r.puzzleId, solved: s.solved || r.reached, bestSteps: r.reached ? Math.min(s.bestSteps ?? Infinity, r.steps) : s.bestSteps, attempts: s.attempts + 1, updatedAt: nowIso });
  }
  return out;
}

// ── validation: a program tree from an untrusted client, bounded so it can never blow the stack / loop forever ──
const MAX_DEPTH = 4, MAX_LEN = 40, MAX_REPEAT = 20;
export function cleanProgram(raw: unknown, depth = 0): Program | null {
  if (!Array.isArray(raw) || raw.length > MAX_LEN || depth > MAX_DEPTH) return null;
  const out: Program = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") return null;
    const op = (s as { op?: unknown }).op;
    if (op === "forward" || op === "left" || op === "right") out.push({ op });
    else if (op === "repeat") {
      const n = (s as { n?: unknown }).n;
      const body = cleanProgram((s as { body?: unknown }).body, depth + 1);
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_REPEAT || !body) return null;
      out.push({ op: "repeat", n, body });
    } else if (op === "if_wall") {
      const then = cleanProgram((s as { then?: unknown }).then, depth + 1);
      if (!then) return null;
      out.push({ op: "if_wall", then });
    } else return null;
  }
  return out;
}
export const cleanSubmissions = (raw: unknown, plan: Puzzle[]): BotSubmission[] | null => {
  if (!Array.isArray(raw)) return null;
  const ids = new Set(plan.map((p) => p.id));
  const out: BotSubmission[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") return null;
    const puzzleId = (s as { puzzleId?: unknown }).puzzleId;
    if (typeof puzzleId !== "string" || !ids.has(puzzleId)) return null;
    const program = cleanProgram((s as { program?: unknown }).program) ?? [];
    out.push({ puzzleId, program });
  }
  return out;
};

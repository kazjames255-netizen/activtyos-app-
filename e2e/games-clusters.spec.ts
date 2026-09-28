import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { loadAccounts, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { COMPASS_ITEMS } from "../features/learninghub/games/compass/content";
import { MUSEUM_ITEMS } from "../features/learninghub/games/museum/content";
import { COLOUR_ITEMS } from "../features/learninghub/games/colourlab/content";
import { DEBATE_ITEMS } from "../features/learninghub/games/debate/content";
import { DETECTIVE_ITEMS } from "../features/learninghub/games/detective/content";
import { VAULT_ITEMS } from "../features/learninghub/games/vault/content";
import { WORDPOP_ITEMS } from "../features/learninghub/games/wordpop/content";
import { PUZZLES, runProgram, type Puzzle, type Program, type Step } from "../features/learninghub/games/botfoundry/core";
import { roundById, type Submission } from "../features/learninghub/games/sortyard/core";
import { packById } from "../features/learninghub/games/training/core";
import type { QuizItem } from "../features/learninghub/games/quiz/core";

// Every non-Penguin game cluster, end to end at the API: start a real server session -> play it the way a perfect
// child would (using the answer key the browser never sees) -> finish -> the SERVER marks it. Also proves the marking
// is the server's: a blank run scores 0, a re-finish is idempotent (repeat:true), and the progress read reflects the
// run. Anchored to THIS run's throwaway children — never the real tenants. Children are split across the three
// per-router "12 runs / 10 min" throttles (hub/gamesApi, appliedGamesApi, quizArcadeApi) so no run hits a 429.
test.describe.configure({ mode: "serial" });

const HUB = "/api/learning-hub";
const stamp = Date.now().toString(36);
let accounts: AccountManifest["accounts"];
let tenantId = "";
const kids: Record<"quiz" | "applied" | "arcade", string> = { quiz: "", applied: "", arcade: "" };

const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
const q = (childId: string) => `?tenantId=${tenantId}&childId=${childId}`;
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<{ settings?: { features?: Record<string, boolean> } & Record<string, unknown> } | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
function gameDoc<T = Record<string, unknown>>(collection: string, id: string): T {
  const out = execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/gameDoc.ts"), collection, id], { cwd: path.join(ROOT, "server"), stdio: "pipe" }).toString();
  const m = out.match(/@@DOC@@([\s\S]*)@@END@@/);
  if (!m) throw new Error(`no doc printed for ${collection}/${id}: ${out.slice(-300)}`);
  return JSON.parse(m[1]!) as T;
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  const p = await token(accounts.parent);
  await provisionLiveListing(accounts.freelancer, { title: `E2E Games ${stamp}`, price: 0 }); // /providers/follow only accepts a tenant that publishes
  await apiPost("/api/my/providers/follow", p, { tenantId });
  await markParentWelcomed(accounts.parent);
  for (const k of ["quiz", "applied", "arcade"] as const) {
    kids[k] = await createParentChild(accounts.parent, { name: `Clusterkid${k}${stamp}`, dob: "2015-04-01" });
    await apiPost(`${HUB}/students`, t, { childId: kids[k], subjects: [`Maths ${stamp}`] });
  }
});

// ── quiz-quest + English cluster (compass / museum / colour lab / debate / detective / vault / word pop) ───────────
const BANKS: Record<string, readonly QuizItem[]> = {
  "compass-quest": COMPASS_ITEMS, "museum-vault": MUSEUM_ITEMS, "colour-lab": COLOUR_ITEMS, "debate-keep": DEBATE_ITEMS,
  "story-detective": DETECTIVE_ITEMS, "word-vault": VAULT_ITEMS, "word-pop": WORDPOP_ITEMS,
};
interface QuizStart { sessionId: string; plan: { key: string; options: { id: string; text: string }[] }[]; itemsTotal: number }
interface QuizFinish { score: number; total: number; points: number; rows: { key: string; correct: boolean; correctId: string; chosenId: string | null }[]; repeat?: boolean }

for (const [gameId, bank] of Object.entries(BANKS)) {
  test(`quiz cluster · ${gameId}: server issues a plan, marks a perfect run 100%, is idempotent and reflects it in progress`, async () => {
    test.setTimeout(120_000);
    const tk = await token(accounts.parent), childId = kids.quiz;
    const started = await apiPost<QuizStart>(`${HUB}/games/sessions${q(childId)}`, tk, { gameId, childId });
    expect(started.sessionId).toBeTruthy();
    expect(started.plan.length).toBeGreaterThanOrEqual(6);
    expect(started.itemsTotal).toBe(bank.length);
    // No answer key leaks in the issued plan.
    expect(JSON.stringify(started.plan)).not.toMatch(/correctId|explanation/);
    const byKey = new Map(bank.map((i) => [i.key, i]));
    const answers = started.plan.map((p) => ({ key: p.key, chosenId: byKey.get(p.key)!.correctId, ms: 1200 }));
    const done = await apiPost<QuizFinish>(`${HUB}/games/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, answers });
    expect(done.total).toBe(started.plan.length);
    // Word Pop is a timed arcade drill: its score is points (10 x combo per hit), not a count of right answers.
    if (gameId === "word-pop") expect(done.score).toBeGreaterThan(done.total * 10);
    else expect(done.score).toBe(done.total);
    expect(done.points).toBeGreaterThan(0);
    expect(done.rows.length).toBe(done.total);
    expect(done.rows.every((r) => r.correct && r.chosenId === r.correctId)).toBe(true);
    // Idempotent: a second finish (even with blank answers) returns the stored result untouched.
    const again = await apiPost<QuizFinish>(`${HUB}/games/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, answers: answers.map((a) => ({ ...a, chosenId: null })) });
    expect(again.repeat).toBe(true);
    expect(again.score).toBe(done.score);
    const prog = await apiFetch<{ bestScore: number; totals: { facts: number }; runs: { score: number; total: number }[] }>(`${HUB}/games/${gameId}/progress${q(childId)}`, tk);
    expect(prog.runs.length).toBeGreaterThanOrEqual(1);
    expect(prog.runs[0]!.score).toBe(done.score);
    expect(prog.totals.facts).toBeGreaterThanOrEqual(1);
  });
}

test("quiz cluster · a blank run is marked by the server as 0/N (the browser cannot claim a score)", async () => {
  const tk = await token(accounts.parent), childId = kids.quiz;
  const started = await apiPost<QuizStart>(`${HUB}/games/sessions${q(childId)}`, tk, { gameId: "compass-quest", childId });
  const done = await apiPost<QuizFinish>(`${HUB}/games/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, answers: started.plan.map((p) => ({ key: p.key, chosenId: null, ms: 900 })) });
  expect(done.score).toBe(0);
  expect(done.rows.every((r) => !r.correct && r.chosenId === null)).toBe(true);
  // A malformed answer list (wrong length) is rejected, not silently accepted.
  const fresh = await apiPost<QuizStart>(`${HUB}/games/sessions${q(childId)}`, tk, { gameId: "word-vault", childId });
  const rej = await fetch(`${API_URL}${HUB}/games/sessions/${fresh.sessionId}/finish${q(childId)}`, { method: "POST", headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" }, body: JSON.stringify({ childId, answers: [] }) });
  expect(rej.status).toBe(400);
});

// ── mini games (bot foundry / sort yard / training ground) ────────────────────────────────────────────────────────
/** Breadth-first search over (x, y, facing) for a straight-line program that reaches the goal — verified by the game's own runProgram. */
function solve(p: Puzzle): Program {
  const rows = p.grid.map((r) => [...r]);
  let sx = 0, sy = 0;
  rows.forEach((r, y) => r.forEach((c, x) => { if (c === "S") { sx = x; sy = y; } }));
  const seen = new Set<string>([`${sx},${sy},1`]);
  const queue: { x: number; y: number; d: number; prog: Step[] }[] = [{ x: sx, y: sy, d: 1, prog: [] }];
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  while (queue.length) {
    const cur = queue.shift()!;
    if (rows[cur.y]![cur.x] === "G") return cur.prog;
    const moves: [Step, number, number, number][] = [
      [{ op: "forward" }, cur.x + DX[cur.d]!, cur.y + DY[cur.d]!, cur.d],
      [{ op: "left" }, cur.x, cur.y, (cur.d + 3) % 4],
      [{ op: "right" }, cur.x, cur.y, (cur.d + 1) % 4],
    ];
    for (const [step, nx, ny, nd] of moves) {
      if (ny < 0 || ny >= rows.length || nx < 0 || nx >= rows[0]!.length || rows[ny]![nx] === "#") continue;
      const k = `${nx},${ny},${nd}`;
      if (seen.has(k)) continue;
      seen.add(k); queue.push({ x: nx, y: ny, d: nd, prog: [...cur.prog, step] });
    }
  }
  throw new Error(`no route for puzzle ${p.id}`);
}

test("mini cluster · Bot Foundry: the server re-runs each submitted program on the grid and awards stars", async () => {
  test.setTimeout(120_000);
  const tk = await token(accounts.parent), childId = kids.quiz;
  const started = await apiPost<{ sessionId: string; plan: { id: string; grid: string[] }[] }>(`${HUB}/games/sessions${q(childId)}`, tk, { gameId: "bot-foundry", childId });
  expect(started.plan.length).toBeGreaterThanOrEqual(3);
  const submissions = started.plan.map((pl) => {
    const puzzle = PUZZLES.find((x) => x.id === pl.id)!;
    const program = solve(puzzle);
    expect(runProgram(puzzle, program).reached).toBe(true);
    return { puzzleId: pl.id, program };
  });
  const done = await apiPost<{ done: boolean; solved: number; total: number; stars: number; rows: { reached: boolean }[]; repeat?: boolean }>(`${HUB}/games/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, submissions });
  expect(done.done).toBe(true);
  expect(done.solved).toBe(done.total);
  expect(done.stars).toBeGreaterThan(0);
  expect(done.rows.every((r) => r.reached)).toBe(true);
  const again = await apiPost<{ repeat?: boolean; solved: number }>(`${HUB}/games/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, submissions: [] });
  expect(again.repeat).toBe(true);
  const prog = await apiFetch<{ puzzlesSolved: number; runs: { solved: number }[] }>(`${HUB}/games/bot-foundry/progress${q(childId)}`, tk);
  expect(prog.puzzlesSolved).toBeGreaterThanOrEqual(started.plan.length);
  expect(prog.runs[0]!.solved).toBe(done.solved);
});

test("mini cluster · Sort Yard: the server grades sort / chart / order rounds against its own answer key", async () => {
  test.setTimeout(120_000);
  const tk = await token(accounts.parent), childId = kids.quiz;
  const started = await apiPost<{ sessionId: string; plan: { id: string; kind: string }[] }>(`${HUB}/games/sessions${q(childId)}`, tk, { gameId: "sort-yard", childId });
  expect(started.plan.length).toBeGreaterThanOrEqual(3);
  expect(JSON.stringify(started.plan)).not.toMatch(/"answer"/);
  const submissions: Submission[] = started.plan.map((pl) => {
    const round = roundById(pl.id)!;
    if (round.kind === "sort") return { kind: "sort", roundId: round.id, assignments: Object.fromEntries(round.items.map((it) => [it.label, it.category])) };
    if (round.kind === "chart") return { kind: "chart", roundId: round.id, value: round.answer };
    return { kind: "order", roundId: round.id, order: [...round.values].sort((a, b) => (round.direction === "ascending" ? a - b : b - a)) };
  });
  const done = await apiPost<{ correct?: number; total: number; score?: number; repeat?: boolean }>(`${HUB}/games/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, submissions });
  expect(done.total).toBe(started.plan.length);
  expect(done.correct ?? done.score).toBe(done.total);
  const prog = await apiFetch<{ runs: unknown[] }>(`${HUB}/games/sort-yard/progress${q(childId)}`, tk);
  expect(prog.runs.length).toBeGreaterThanOrEqual(1);
});

test("mini cluster · Training Ground: typed answers are re-marked by the server, a slow answer is a miss", async () => {
  test.setTimeout(120_000);
  const tk = await token(accounts.parent), childId = kids.quiz;
  const started = await apiPost<{ sessionId: string; packId: string; plan: { id: string; prompt: string }[]; limits: { answerMs: number } }>(`${HUB}/games/sessions${q(childId)}`, tk, { gameId: "training-ground", childId, packId: "spell-ks2-y34" });
  const pack = packById(started.packId)!;
  const byId = new Map(pack.items.map((i) => [i.id, i]));
  const answers = started.plan.map((p, i) => ({ v: byId.get(p.id)!.answer, ms: i === 0 ? started.limits.answerMs + 1000 : 2000 }));
  const done = await apiPost<{ done: boolean; score: number; total: number; wrong: unknown[] }>(`${HUB}/games/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, answers });
  expect(done.done).toBe(true);
  expect(done.total).toBe(started.plan.length);
  expect(done.score).toBe(done.total - 1); // answer #1 was right but slower than the limit -> the server scores it a miss
  const prog = await apiFetch<{ runs: { score: number }[] }>(`${HUB}/games/training-ground/progress${q(childId)}`, tk);
  expect(prog.runs[0]!.score).toBe(done.score);
});

// ── applied maths (market day / bake off blitz / rhythm reef) ─────────────────────────────────────────────────────
for (const gameId of ["market", "bakeoff", "reef"]) {
  test(`applied cluster · ${gameId}: server issues seeded items without the key, marks a perfect run, then a blank run scores 0`, async () => {
    test.setTimeout(150_000);
    const tk = await token(accounts.parent), childId = kids.applied;
    const started = await apiPost<{ sessionId: string; level: number; items: { id: string }[] }>(`${HUB}/games/applied/${gameId}/sessions${q(childId)}`, tk, { childId });
    expect(started.items.length).toBe(8);
    expect(JSON.stringify(started.items)).not.toMatch(/"answer"/);
    const doc = gameDoc<{ items: { id: string; answer: number | string }[] }>("hubAppliedSessions", started.sessionId);
    const perfect = started.items.map((it) => ({ id: it.id, value: doc.items.find((d) => d.id === it.id)!.answer, ms: 2500 }));
    const done = await apiPost<{ score: number; total: number; nextLevel: number; rows: { correct: boolean }[]; newBest: boolean }>(`${HUB}/games/applied/${gameId}/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, answers: perfect });
    expect(done.score).toBe(done.total);
    expect(done.rows.every((r) => r.correct)).toBe(true);
    expect(done.newBest).toBe(true);
    expect(done.nextLevel).toBeGreaterThanOrEqual(started.level); // a perfect run never drops the level
    const repeat = await apiPost<{ repeat?: boolean }>(`${HUB}/games/applied/${gameId}/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, answers: perfect });
    expect(repeat.repeat).toBe(true);
    // Second run, all blank: the server scores 0 whatever the client "felt".
    const second = await apiPost<{ sessionId: string; items: { id: string }[] }>(`${HUB}/games/applied/${gameId}/sessions${q(childId)}`, tk, { childId });
    const blank = await apiPost<{ score: number; total: number }>(`${HUB}/games/applied/${gameId}/sessions/${second.sessionId}/finish${q(childId)}`, tk, { childId, answers: second.items.map((it) => ({ id: it.id, value: null, ms: 900 })) });
    expect(blank.score).toBe(0);
    const state = await apiFetch<{ level: number; best: { score: number } | null }>(`${HUB}/games/applied/${gameId}/state${q(childId)}`, tk);
    expect(state.best?.score).toBe(done.total);
  });
}

// ── quiz arcade (prime reef / data carnival / shape workshop) ─────────────────────────────────────────────────────
for (const gameId of ["prime-reef", "data-carnival", "shape-workshop"]) {
  test(`quiz-arcade cluster · ${gameId}: multiple-choice plan without the key, perfect run scores full and earns coins, blank run scores 0`, async () => {
    test.setTimeout(150_000);
    const tk = await token(accounts.parent), childId = kids.arcade;
    const started = await apiPost<{ sessionId: string; items: { id: string; choices: string[] }[]; runLength: number }>(`${HUB}/games/quiz/${gameId}/sessions${q(childId)}`, tk, { childId });
    expect(started.items.length).toBe(started.runLength);
    expect(JSON.stringify(started.items)).not.toMatch(/correctIndex|explain/);
    const doc = gameDoc<{ plan: { id: string; correctIndex: number }[] }>("hubGameSessions", started.sessionId);
    const perfect = started.items.map((it) => ({ id: it.id, chosen: doc.plan.find((p) => p.id === it.id)!.correctIndex, ms: 3000 }));
    const done = await apiPost<{ score: number; total: number; coins: number; newBest: boolean; rows: { ok: boolean; explain: string }[] }>(`${HUB}/games/quiz/${gameId}/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, answers: perfect });
    expect(done.score).toBe(done.total);
    expect(done.coins).toBeGreaterThan(0);
    expect(done.newBest).toBe(true);
    expect(done.rows.every((r) => r.ok)).toBe(true);
    const again = await apiPost<{ repeat?: boolean }>(`${HUB}/games/quiz/${gameId}/sessions/${started.sessionId}/finish${q(childId)}`, tk, { childId, answers: perfect });
    expect(again.repeat).toBe(true);
    const second = await apiPost<{ sessionId: string; items: { id: string }[] }>(`${HUB}/games/quiz/${gameId}/sessions${q(childId)}`, tk, { childId });
    const blank = await apiPost<{ score: number }>(`${HUB}/games/quiz/${gameId}/sessions/${second.sessionId}/finish${q(childId)}`, tk, { childId, answers: second.items.map((it) => ({ id: it.id, chosen: null, ms: 900 })) });
    expect(blank.score).toBe(0);
    const facts = await apiFetch<{ runs: number; bestScore: number; totalAnswered: number }>(`${HUB}/games/quiz/${gameId}/facts${q(childId)}`, tk);
    expect(facts.runs).toBe(2);
    expect(facts.bestScore).toBe(done.total);
  });
}

test("quiz-arcade summary reflects the three games this child actually played", async () => {
  const tk = await token(accounts.parent), childId = kids.arcade;
  const s = await apiFetch<{ played: boolean; runs: number; gamesPlayed: number }>(`${HUB}/games/quiz-arcade/summary${q(childId)}`, tk);
  expect(s.played).toBe(true);
  expect(s.gamesPlayed).toBe(3);
  expect(s.runs).toBe(6);
});

test("a tutor cannot start any of these games for a child (family-only)", async () => {
  const tt = await token(accounts.freelancer);
  for (const [p, body] of [
    [`${HUB}/games/applied/market/sessions`, {}], [`${HUB}/games/quiz/prime-reef/sessions`, {}], [`${HUB}/games/sessions`, { gameId: "compass-quest" }],
  ] as const) {
    const r = await fetch(`${API_URL}${p}${q(kids.quiz)}`, { method: "POST", headers: { Authorization: `Bearer ${tt}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect(r.status, p).toBe(403);
  }
});

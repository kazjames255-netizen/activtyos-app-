// Shared plumbing for the THREE new Learning Hub games built together tonight — Bot Foundry, Sort Yard, Training
// Ground (docs/games-prototypes/BACKEND-PATTERN.md). Each teaches a genuinely different thing (own puzzle bank /
// data bank / drill pack — see each game's own core.ts under features/learninghub/games/<game>/core.ts), so per
// Step 1 of the pattern they do NOT share a fact-mastery collection with each other or with Penguin/Turbo. What
// they DO share, because it is infrastructure rather than content, is:
//   - the SAME `hubGameSessions` collection Penguin/Turbo/MTC use (one doc per run; `kind` tells them apart)
//   - a generic per-(child, game) profile doc (`hubMiniGameProfile`) for the small set of things every one of
//     these three needs regardless of subject: points, a practice streak, days played, personal bests by pack/set.
// A per-item mastery collection is still SEPARATE per game (hubTrainingItemState / hubBotPuzzleState /
// hubSortRoundState) because what counts as "an item" is different in each (a spelling word vs a puzzle vs a
// data round) - forcing them into one shape would be exactly the "force a fact-key shape it doesn't fit" the
// pattern warns against.
import { db } from "../../firebase";
import { GameError, sessionsCol } from "../hubGames";

// Re-export the SAME GameError class hubGames.ts / hubQuizGames.ts use, not a lookalike: gamesApi.ts's
// `e instanceof GameError` check has to recognise errors thrown from here too.
export { GameError, sessionsCol };
export const SESSION_TTL_MS = 48 * 3600_000;

export const miniProfileCol = db.collection("hubMiniGameProfile");
export const miniProfileId = (tenantId: string, childId: string, gameId: string) => `${tenantId}__${childId}__${gameId}`;

export interface MiniProfile {
  tenantId: string; franchiseId: string | null; childId: string; gameId: string;
  points: number; streakDays: number; lastPlayedDay: string | null; daysPlayed: string[];
  bests: Record<string, { score: number; total: number; at: string }>;
  createdAt: string; updatedAt: string;
}
export const defMiniProfile = (tenantId: string, franchiseId: string | null, childId: string, gameId: string, now: string): MiniProfile => ({
  tenantId, franchiseId, childId, gameId, points: 0, streakDays: 0, lastPlayedDay: null, daysPlayed: [], bests: {}, createdAt: now, updatedAt: now,
});

export async function loadMiniProfile(tenantId: string, childId: string, gameId: string): Promise<MiniProfile | null> {
  const s = await miniProfileCol.doc(miniProfileId(tenantId, childId, gameId)).get();
  return s.exists ? (s.data() as MiniProfile) : null;
}

/** Fold one finished run's result into the shared mini profile: today's day added, a simple streak (today vs
 *  yesterday), a personal best recorded per set/pack key, one point per correct item. Pure-ish (only touches the
 *  passed-in profile, never reads/writes Firestore itself) so it's easy to call inside a transaction. */
export function recordMiniRun(prof: MiniProfile, o: { setKey: string; correct: number; total: number; nowIso: string }): MiniProfile {
  const day = o.nowIso.slice(0, 10);
  const days = prof.daysPlayed.includes(day) ? prof.daysPlayed : [...prof.daysPlayed, day].slice(-60);
  const yesterday = new Date(new Date(day).getTime() - 86_400_000).toISOString().slice(0, 10);
  const streakDays = prof.lastPlayedDay === day ? prof.streakDays : prof.lastPlayedDay === yesterday ? prof.streakDays + 1 : 1;
  const prevBest = prof.bests[o.setKey];
  const best = !prevBest || o.correct > prevBest.score ? { score: o.correct, total: o.total, at: o.nowIso } : prevBest;
  return { ...prof, points: prof.points + o.correct, lastPlayedDay: day, daysPlayed: days, streakDays, bests: { ...prof.bests, [o.setKey]: best }, updatedAt: o.nowIso };
}

// A per-child run-rate guard, identical in spirit to gamesApi.ts's own `tooMany` (12 runs / 10 min) — kept local
// to each of the three new game modules rather than exported, so one game's bursty play never throttles another's.
export function makeRunGuard() {
  const recent = new Map<string, number[]>();
  return (childId: string, max = 12, windowMs = 600_000): boolean => {
    const now = Date.now(); const xs = (recent.get(childId) ?? []).filter((t) => now - t < windowMs);
    if (xs.length >= max) { recent.set(childId, xs); return true; }
    xs.push(now); recent.set(childId, xs);
    if (recent.size > 5000) recent.clear();
    return false;
  };
}

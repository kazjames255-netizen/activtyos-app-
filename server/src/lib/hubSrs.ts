// Learning Hub — spaced repetition (SM-2). PURE: no I/O, no clock reads (the
// caller passes `now`), so it can be self-tested (src/hubSelfTest2.ts) and the
// route stays a thin wrapper. Server-side only: the browser never computes an
// interval (docs/learning-hub.md → "Spaced repetition").
//
// Contract:
//   quality ∈ {1 Again, 3 Hard, 4 Good, 5 Easy}
//   q < 3      → repetitions = 0, interval = 1 day
//   otherwise  → interval = 1 (first success) | 6 (second) | round(interval × EF),
//                then repetitions++
//   EF' = max(minEase, EF + 0.1 − (5−q) × (0.08 + (5−q) × 0.02))   (applied on every review)
//   The interval uses the ease factor the card had BEFORE this review (classic SM-2).
//   nextDueAt = now + interval days.

export const SRS_QUALITIES = [1, 3, 4, 5] as const;
export type SrsQuality = (typeof SRS_QUALITIES)[number];
export const isQuality = (q: unknown): q is SrsQuality => SRS_QUALITIES.includes(q as SrsQuality);

export const DEFAULT_EASE = 2.5;
const DAY_MS = 86_400_000;

export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}
export interface SrsResult extends SrsState {
  nextDueAt: string;
  lastQuality: SrsQuality;
  lastReviewedAt: string;
}

/** A card nobody has reviewed yet. */
export const freshState = (): SrsState => ({ easeFactor: DEFAULT_EASE, intervalDays: 0, repetitions: 0 });

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One review. `prev` = null for a card's first review. */
export function sm2(prev: SrsState | null, quality: SrsQuality, minEase: number, now: Date): SrsResult {
  const p = prev ?? freshState();
  const q = quality;
  let interval: number;
  let reps: number;
  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    interval = p.repetitions === 0 ? 1 : p.repetitions === 1 ? 6 : Math.round(p.intervalDays * p.easeFactor);
    reps = p.repetitions + 1;
  }
  // Never let a corrupt stored interval schedule a card into next century.
  interval = Math.min(Math.max(1, interval), 3650);
  const ef = round2(Math.max(minEase, p.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return {
    easeFactor: ef,
    intervalDays: interval,
    repetitions: reps,
    nextDueAt: new Date(now.getTime() + interval * DAY_MS).toISOString(),
    lastQuality: q,
    lastReviewedAt: now.toISOString(),
  };
}

export interface SrsReviewRow { cardId: string; nextDueAt: string }
export interface SrsQueue<C extends { id: string }> {
  /** Reviewed cards whose time has come, most overdue first. */
  due: C[];
  /** Cards never reviewed, in the order given. */
  fresh: C[];
  /** Reviewed cards scheduled for later. */
  upcoming: number;
}

/** Split a child's cards into the due queue, the never-seen ones and the rest. */
export function buildQueue<C extends { id: string }>(cards: C[], reviews: Map<string, SrsReviewRow>, now: Date): SrsQueue<C> {
  const nowIso = now.toISOString();
  const due: (C & { _at: string })[] = [];
  const fresh: C[] = [];
  let upcoming = 0;
  for (const c of cards) {
    const r = reviews.get(c.id);
    if (!r) fresh.push(c);
    else if (r.nextDueAt <= nowIso) due.push({ ...c, _at: r.nextDueAt });
    else upcoming++;
  }
  due.sort((a, b) => a._at.localeCompare(b._at));
  return { due: due.map(({ _at, ...c }) => c as unknown as C), fresh, upcoming };
}

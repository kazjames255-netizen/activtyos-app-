// Per-child support profile (R-5). Lives on the enrolment as an OPTIONAL `support` object; absent = today's behaviour.
// Pure and shared: the server validates/applies it, the browser only reads it (a child can never edit it).

export interface SupportProfile {
  /** No countdown and no auto hand-in: the attempt is untimed for this child. */
  noTimer: boolean;
  /** Extra time on a timed quiz: 0 | 25 | 50 (%). Ignored when noTimer. */
  extraTimePercent: 0 | 25 | 50;
  /** Calm: no streaks, XP, confetti or motion. */
  calm: boolean;
  /** Read-aloud speaker is offered up front (never auto-plays). */
  readAloudDefault: boolean;
  textSize: "normal" | "large";
}

export const DEFAULT_SUPPORT: SupportProfile = { noTimer: false, extraTimePercent: 0, calm: false, readAloudDefault: false, textSize: "normal" };

/** Tolerant clean-up of anything stored/received: unknown or bad fields fall back to the default. Never throws. */
export function cleanSupport(raw: unknown): SupportProfile {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const x = r.extraTimePercent;
  return {
    noTimer: r.noTimer === true,
    extraTimePercent: x === 25 || x === 50 ? x : 0,
    calm: r.calm === true,
    readAloudDefault: r.readAloudDefault === true,
    textSize: r.textSize === "large" ? "large" : "normal",
  };
}

/** True when the profile changes nothing (so it needn't be stored). */
export const isDefaultSupport = (s: SupportProfile) =>
  !s.noTimer && s.extraTimePercent === 0 && !s.calm && !s.readAloudDefault && s.textSize === "normal";

/** The time limit (minutes) this child gets for a quiz set to `limit` minutes. null = untimed. Rounds up to a whole minute. */
export function effectiveLimitMins(limit: number | null | undefined, s: SupportProfile | null | undefined): number | null {
  if (!limit) return null;
  if (!s) return limit;
  if (s.noTimer) return null;
  return s.extraTimePercent ? Math.ceil(limit * (1 + s.extraTimePercent / 100)) : limit;
}

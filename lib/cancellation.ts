// ─────────────────────────────────────────────────────────────────────────
// Cancellation policy — as rules, not prose.
//
// A policy written only as a sentence ("cancel 48 hours before for a full
// refund") can't do anything. The provider still has to work out the notice
// period by hand on every cancellation, decide the refund, and get it right
// consistently — which is the arithmetic a computer should be doing, and the
// place a tired human quietly stops being fair.
//
// So the policy is bands, and the sentence is generated from them. One source
// of truth, and the wording can never drift from what's actually applied.
//
// Pure functions, no React and no browser: the same rules will need to run
// server-side the day parents can cancel themselves.
// ─────────────────────────────────────────────────────────────────────────

import { pickPlural } from "./i18n/plural";
/** "an 80%" / "an 18%" / "a 50%": the English article for a percentage as it is read aloud. Other languages ignore it. */
export const aPct = (n: number): string => (/^(8|11|18|8\d)$/.test(String(n)) ? `an ${n}` : `a ${n}`);

export interface RefundBand {
  /** Cancel at least this many hours before the first session starts. */
  hoursBefore: number;
  /** How much comes back, as a percentage of what was paid. */
  refundPercent: number;
}

export interface CancellationPolicy {
  bands: RefundBand[];
  /**
   * What parents read. Left blank it's generated from the bands, which is
   * almost always what you want — a provider who overrides it can say the
   * same thing in their own voice, but takes on keeping the two in step.
   */
  wording?: string;
}

/** A policy with a name, so a listing can point at one. */
export interface NamedPolicy extends CancellationPolicy {
  id: string;
  /** What the provider calls it — "Holiday camps", "Weekly clubs". */
  name: string;
}


export const HOURS = { day: 24, twoDays: 48, week: 168, twoWeeks: 336 } as const;

/** A middling default: full refund a week out, half at 48 hours, nothing after. */
export const DEFAULT_POLICY: CancellationPolicy = {
  bands: [
    { hoursBefore: HOURS.week, refundPercent: 100 },
    { hoursBefore: HOURS.twoDays, refundPercent: 50 },
    { hoursBefore: 0, refundPercent: 0 },
  ],
};

/**
 * The usual policies, ready to use.
 *
 * Seeded rather than left to the provider to invent, because "add a policy"
 * on an empty screen asks someone to design a refund scheme from nothing.
 * These are the shapes real providers actually use; edit the numbers, rename
 * them, delete the ones you don't want. Standard first — it's the one most
 * listings will use, and it's what a new listing starts on.
 */
export const DEFAULT_POLICIES: NamedPolicy[] = [
  { id: "standard", name: "Standard", ...DEFAULT_POLICY },
  {
    id: "flexible",
    name: "Flexible",
    bands: [
      { hoursBefore: HOURS.day, refundPercent: 100 },
      { hoursBefore: 0, refundPercent: 0 },
    ],
  },
  {
    id: "strict",
    name: "Strict",
    bands: [
      { hoursBefore: HOURS.twoWeeks, refundPercent: 100 },
      { hoursBefore: HOURS.week, refundPercent: 50 },
      { hoursBefore: 0, refundPercent: 0 },
    ],
  },
  {
    id: "none",
    name: "No refunds",
    bands: [{ hoursBefore: 0, refundPercent: 0 }],
  },
];

/**
 * The policy a listing uses, by id.
 *
 * Falls back to the first rather than to nothing: a listing whose policy was
 * deleted still has to be able to answer "what do we owe?", and the provider's
 * first policy is a better guess than no refund at all.
 */
export function policyById(policies: NamedPolicy[], id: string | undefined): NamedPolicy | null {
  if (!policies.length) return null;
  return policies.find((p) => p.id === id) ?? policies[0];
}

/** Bands longest-notice first, which is the order they're applied in. */
export const sortBands = (bands: RefundBand[]): RefundBand[] =>
  [...bands].sort((a, b) => b.hoursBefore - a.hoursBefore);

/** The parent-facing sentence starts with a capital ("Cancel at least 1 week before ..."). */
const upFirst = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

function noticeLabel(hours: number): string {
  if (hours <= 0) return "less than that";
  if (hours % HOURS.week === 0) {
    const w = hours / HOURS.week;
    return w === 1 ? "1 week" : `${w} weeks`;
  }
  // 24 and 48 hours are how the Setup editor shows them, so the parent wording says the same (not "1 day" / "2 days").
  if (hours % 24 === 0 && hours !== HOURS.day && hours !== HOURS.twoDays) {
    const d = hours / 24;
    return d === 1 ? "1 day" : `${d} days`;
  }
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/** The policy as a sentence a parent can read. */
export function policyWording(policy: CancellationPolicy): string {
  if (policy.wording?.trim()) return policy.wording.trim();
  const bands = sortBands(policy.bands).filter((b) => b.hoursBefore > 0);
  const floor = sortBands(policy.bands).find((b) => b.hoursBefore <= 0);

  if (bands.length === 0) {
    const pct = floor?.refundPercent ?? 0;
    return pct >= 100
      ? "Cancel at any time for a full refund."
      : pct <= 0
        ? "Refunds are not given once a place is booked."
        : `Cancel at any time for ${aPct(pct)}% refund.`;
  }

  const parts = bands.map((b) => {
    const amount = b.refundPercent >= 100 ? "a full refund" : b.refundPercent <= 0 ? "no refund" : `${aPct(b.refundPercent)}% refund`;
    return `cancel at least ${noticeLabel(b.hoursBefore)} before it starts for ${amount}`;
  });
  const tail = floor && floor.refundPercent > 0 ? `After that, ${floor.refundPercent}% is refunded.` : "After that, no refund is given.";
  return `${upFirst(parts.join("; "))}. ${tail}`;
}

export interface RefundAdvice {
  /** Percent of what was paid. */
  percent: number;
  /** Rounded to the penny. */
  amount: number;
  /** How much notice was actually given. */
  hoursNotice: number;
  /** The band that matched, for showing the working. */
  band: RefundBand | null;
  /** Plain-English reason, shown beside the figure. */
  reason: string;
  /** True when the provider cancelled (full refund, notice bands ignored) — lets the UI re-word `reason` in the active language. */
  byProvider?: boolean;
}

/**
 * The date a refund's notice is judged on: the EARLIER of a session's original date and the date it sits on now. Moving a session
 * LATER must not buy a bigger refund (book 3 days out, move it to 14 days out, cancel for 100%), and moving it earlier counts from the
 * earlier date. A missing / malformed original (a booking never moved, or an old one) means "judge on the current date".
 */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export function effectiveRefundDate(original: string | undefined | null, current: string | undefined | null): string | undefined {
  const o = original && ISO_DAY.test(original) ? original : undefined;
  const c = current && ISO_DAY.test(current) ? current : undefined;
  if (o && c) return o < c ? o : c;
  return o ?? c;
}

/**
 * What the policy says should come back.
 *
 * A recommendation, never an action — ActivityLane doesn't move money, and the
 * provider can always override. But it should never be the provider's job to
 * work out that 61 hours is more than 48.
 *
 * Returns null when it can't be worked out (no session date, no amount), so
 * the caller shows nothing rather than a confident zero. A wrong refund
 * figure presented as authoritative is worse than no figure at all.
 */
export function refundFor(
  policy: CancellationPolicy,
  firstSessionIso: string | undefined,
  paid: number | undefined,
  nowIso: string,
  /**
   * Whose decision this was — not who clicked the button.
   *
   * A provider cancelling their own session refunds in full whatever the
   * notice bands say: the family did nothing wrong, and charging them for a
   * flooded venue is indefensible. The bands only ever apply to a family
   * changing their mind — including when they ring up and the operator does
   * it for them, which is why this can't be inferred from who is signed in.
   */
  initiator: "provider" | "parent" = "parent",
): RefundAdvice | null {
  if (paid == null || !Number.isFinite(paid)) return null;

  if (initiator === "provider") {
    const pence = Math.round(paid * 100);
    return {
      percent: 100,
      amount: pence / 100,
      hoursNotice: 0,
      band: null,
      reason: "You cancelled this, so the full amount goes back — your notice periods don't apply.",
      byProvider: true,
    };
  }

  if (!firstSessionIso) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstSessionIso)) return null;

  // The session date carries no time, so treat it as starting at midnight —
  // the conservative reading. Assuming a 9am start would hand a parent an
  // extra nine hours of notice they didn't give.
  const start = Date.parse(`${firstSessionIso}T00:00:00Z`);
  const now = Date.parse(nowIso);
  if (Number.isNaN(start) || Number.isNaN(now)) return null;

  const hoursNotice = Math.floor((start - now) / 3_600_000);
  const bands = sortBands(policy.bands);
  // Cancelling after it has started gives negative notice, which correctly
  // falls past every band to the floor.
  const band = bands.find((b) => hoursNotice >= b.hoursBefore) ?? null;
  const percent = band?.refundPercent ?? 0;
  // In pence, not pounds. `Math.round(37.55 * 50) / 100` gives £18.77, because
  // 37.55 * 50 is 1877.4999999999998 in binary floating point — a penny short
  // on every refund that lands on a half. Converting to integer pence first
  // makes the half exact, and it rounds up, which is the way to be wrong about
  // a penny of someone else's money.
  const pence = Math.round(paid * 100);
  const amount = Math.round((pence * percent) / 100) / 100;

  const notice =
    hoursNotice < 0
      ? "after it started"
      : hoursNotice < 24
        ? `${Math.max(0, hoursNotice)} hours before it starts`
        : `${Math.floor(hoursNotice / 24)} days before it starts`;

  return {
    percent,
    amount,
    hoursNotice,
    band,
    reason:
      percent >= 100
        ? `Cancelled ${notice} — your policy gives a full refund.`
        : percent <= 0
          ? `Cancelled ${notice} — your policy gives no refund.`
          : `Cancelled ${notice} — your policy gives ${percent}%.`,
  };
}

// ---- Translated wording -------------------------------------------------------------------------------------------------------------
// The functions above build English sentences (used by emails / the API). The parent- and operator-facing screens call these instead so the
// same policy reads in the active language. `t` is the caller's useT(), `locale` the active code (for plural forms).
type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function noticeLabelT(t: TFn, locale: string, hours: number): string {
  if (hours <= 0) return t("p7pol.lessThanThat");
  if (hours % HOURS.week === 0) return pickPlural(t, locale, "p7pol.wk", hours / HOURS.week);
  if (hours % 24 === 0 && hours !== HOURS.day && hours !== HOURS.twoDays) return pickPlural(t, locale, "p7pol.dy", hours / 24);
  return pickPlural(t, locale, "p7pol.hr", hours);
}

export function policyWordingT(t: TFn, locale: string, policy: CancellationPolicy): string {
  if (policy.wording?.trim()) return policy.wording.trim(); // provider-typed text is shown as they wrote it
  const bands = sortBands(policy.bands).filter((b) => b.hoursBefore > 0);
  const floor = sortBands(policy.bands).find((b) => b.hoursBefore <= 0);
  if (bands.length === 0) {
    const pct = floor?.refundPercent ?? 0;
    return pct >= 100 ? t("p7pol.allFull") : pct <= 0 ? t("p7pol.allNone") : t("p7pol.allPct", { pct, aPct: aPct(pct) });
  }
  const parts = bands.map((b) => {
    const notice = noticeLabelT(t, locale, b.hoursBefore);
    return b.refundPercent >= 100 ? t("p7pol.bandFull", { notice }) : b.refundPercent <= 0 ? t("p7pol.bandNone", { notice }) : t("p7pol.bandPct", { notice, pct: b.refundPercent, aPct: aPct(b.refundPercent) });
  });
  const tail = floor && floor.refundPercent > 0 ? t("p7pol.tailPct", { pct: floor.refundPercent }) : t("p7pol.tailNone");
  return `${upFirst(parts.join("; "))}. ${tail}`;
}

export function adviceReasonT(t: TFn, locale: string, a: RefundAdvice): string {
  if (a.byProvider) return t("p7pol.byProvider");
  const notice = a.hoursNotice < 0 ? t("p7pol.afterStart")
    : a.hoursNotice < 24 ? t("p7pol.beforeHours", { hours: pickPlural(t, locale, "p7pol.hr", Math.max(0, a.hoursNotice)) })
    : t("p7pol.beforeDays", { days: pickPlural(t, locale, "p7pol.dy", Math.floor(a.hoursNotice / 24)) });
  return a.percent >= 100 ? t("p7pol.reasonFull", { notice }) : a.percent <= 0 ? t("p7pol.reasonNone", { notice }) : t("p7pol.reasonPct", { notice, pct: a.percent });
}

/**
 * "Credit note when no cash refund is due" (Setup → noRefundCredit). When the
 * policy works out to nothing back but the family paid something, the provider
 * keeps the cash and the family keeps the value as wallet credit. Returns the
 * credit amount, or 0 when it doesn't apply. Pure so server and tests share it.
 */
export function noRefundCreditAmount(opts: { noRefundCredit: boolean; walletOn: boolean; policyAmount: number | null; paid: number }): number {
  if (!opts.noRefundCredit || !opts.walletOn) return 0;
  if (opts.policyAmount === null || opts.policyAmount > 0) return 0;
  return opts.paid > 0 ? Math.round(opts.paid * 100) / 100 : 0;
}

/** CN-022: a per-day release adds to a refund still awaiting approval instead of replacing it; never above what's refundable. */
export function accumulatePendingRelease(
  prior: { refundOnly?: boolean; refund?: string; amount?: number } | null | undefined,
  value: number,
  refundable: number,
): number {
  const before = prior && prior.refundOnly && prior.refund === "pending" ? Math.max(0, prior.amount ?? 0) : 0;
  const sum = Math.round((before + value) * 100) / 100;
  return before > 0 ? Math.min(sum, refundable) : value;
}

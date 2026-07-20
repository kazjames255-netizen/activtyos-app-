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

function noticeLabel(hours: number): string {
  if (hours <= 0) return "less than that";
  if (hours % HOURS.week === 0) {
    const w = hours / HOURS.week;
    return w === 1 ? "1 week" : `${w} weeks`;
  }
  if (hours % 24 === 0) {
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
        : `Cancel at any time for a ${pct}% refund.`;
  }

  const parts = bands.map((b) => {
    const amount = b.refundPercent >= 100 ? "a full refund" : b.refundPercent <= 0 ? "no refund" : `a ${b.refundPercent}% refund`;
    return `cancel at least ${noticeLabel(b.hoursBefore)} before it starts for ${amount}`;
  });
  const tail = floor && floor.refundPercent > 0 ? `After that, ${floor.refundPercent}% is refunded.` : "After that, no refund is given.";
  return `${parts.join("; ")}. ${tail}`;
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
}

/**
 * What the policy says should come back.
 *
 * A recommendation, never an action — ActivityOS doesn't move money, and the
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

import { money } from "../bookings/helpers";
import { pickPlural } from "../../lib/i18n/plural";

/** Optional display translator. The server calls these functions without it (English, stored as before); the browser
 *  passes `{ tr: useT(), locale }` so the summaries/terms/scope it SHOWS follow the picked language. Pure: no React import. */
export type DiscountTx = { tr: (k: string, v?: Record<string, string | number>) => string; locale: string };

// ─────────────────────────────────────────────────────────────────────────
// Automatic discounts — the ONE implementation, shared verbatim by the
// listing builder (live preview while the operator types) and the server
// (server/src/routes/my.ts prices every parent booking with it). Keep this
// module pure: no React, no browser APIs, no Firebase.
//
// Three rule types. Multi-session is always applied after multi-person, and
// where rules conflict the booker gets the best price.
// ─────────────────────────────────────────────────────────────────────────

export type DiscountKind = "person" | "session" | "early";
export interface DiscountRule {
  id: string;
  kind: DiscountKind;
  name: string; // shown to bookers
  passNames: string[]; // which tickets it applies to; [] = all
  enabled: boolean;
  /** person: applies when attendees > this. session: when sessions > this. */
  moreThan: number;
  /**
   * @deprecated Every child on the line gets the discount. Kept so existing
   * rules still parse; "after1" and "second" now behave as "all" — a sibling
   * discount that quietly applied to one of two children was read as a bug
   * every time it was seen.
   */
  appliesTo?: "all" | "after1" | "second";
  method: "price" | "subtract" | "percent";
  value: number; // £ for price/subtract, % for percent
  /** early only — must book on or before this date. */
  beforeDate: string;
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/** "2026-10-04" -> "4 Oct". Display only; the stored rule/date never changes. */
export function friendlyIso(iso: string, locale = "en-GB"): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  try { return d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" }); } catch { return iso; }
}
/** Replace any raw ISO date inside a (possibly stored) rule name with a friendly one. */
export const DISCOUNT_KIND_LABEL: Record<DiscountKind, string> = { person: "Multi-person discount", session: "Multi-session discount", early: "Early bird discount" };
export function prettyRuleName(name: string, locale?: string): string {
  return name.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (m) => friendlyIso(m, locale));
}

export function emptyRule(kind: DiscountKind): DiscountRule {
  return {
    id: newId(),
    kind,
    name: "",
    passNames: [],
    enabled: true,
    moreThan: kind === "session" ? 3 : 1,
    appliesTo: "all",
    method: kind === "session" || kind === "person" ? "percent" : "subtract",
    // Presets match their card copy ("10% off", "£10 off").
    value: 10,
    beforeDate: "",
  };
}

/** The name parents/operators should see for a rule. A name the operator typed themselves is kept; a name that was
 *  auto-generated from the rule when it was saved (and has since gone stale after the amount or date was edited) is
 *  rebuilt from the rule, so "Book by the cut-off date - GBP10.00 off" can never sit on a GBP12 rule. */
const AUTO_NAME = /^(More than \d+ child(ren)? on a pass|Book more than \d+ sessions|Book by .+ — .+ off|Early bird — .+ off)/i;
export function isAutoRuleName(r: DiscountRule): boolean {
  const n = (r.name ?? "").trim();
  return !n || AUTO_NAME.test(n);
}
export function ruleDisplayName(r: DiscountRule, tx?: DiscountTx): string {
  if (isAutoRuleName(r)) return ruleSummary(r, tx);
  return prettyRuleName((r.name ?? "").trim(), tx?.locale);
}

/** Plain-English summary shown to the operator and the booker. */
export function ruleSummary(r: DiscountRule, tx?: DiscountTx): string {
  const amount = r.method === "percent" ? `${r.value}%` : money(r.value);
  if (tx) {
    if (r.kind === "person") return pickPlural(tx.tr, tx.locale, r.method === "price" ? "p8lst.lm8DscPersonPrice" : "p8lst.lm8DscPersonOff", r.moreThan, { amt: amount });
    if (r.kind === "session") return pickPlural(tx.tr, tx.locale, "p8lst.lm8DscSession", r.moreThan, { amt: amount });
    return r.beforeDate ? tx.tr("p8lst.lm8DscEarly", { date: friendlyIso(r.beforeDate, tx.locale), amt: amount }) : tx.tr("p8lst.lm8DscEarlyOpen", { amt: amount });
  }
  if (r.kind === "person")
    return r.method === "price"
      ? `More than ${r.moreThan} child${r.moreThan === 1 ? "" : "ren"} on a pass — every child pays ${amount} per ticket`
      : `More than ${r.moreThan} child${r.moreThan === 1 ? "" : "ren"} on a pass — ${amount} off every child`;
  if (r.kind === "session") return `Book more than ${r.moreThan} sessions — ${amount} off`;
  return r.beforeDate ? `Book by ${friendlyIso(r.beforeDate)} — ${amount} off` : `Early bird — ${amount} off`;
}

export interface DiscountLine {
  name: string;
  amount: number;
  scope: string;
  /**
   * What this rule took off each item, index-aligned with `items`. Lets a
   * basket show the saving on the line that earned it, instead of only as a
   * lump at the bottom. Callers that don't need it can ignore it.
   */
  perItem?: number[];
  /** "10%" / "£5 off" — and who it covers, so £3 on a £60 line makes sense. */
  terms?: string;
  /** Which kind of discount this is, so screens can label it ("Early bird discount"). */
  kind?: DiscountKind;
  /** True when the operator typed their own name for the rule (otherwise the name is auto-generated from it). */
  custom?: boolean;
  /** Set on an early-bird line that was a fixed £ amount (limited to once per family per season). */
  earlyFixed?: boolean;
}
/**
 * Work out what comes off a basket. Returns each applied rule's saving.
 * Multi-person runs first, then multi-session on the reduced total, then
 * early bird; where several rules of a kind match, the best one wins.
 */
export function applyDiscounts(
  rules: DiscountRule[],
  /**
   * One entry per thing being bought. `heads` is how many children are on it
   * (the saving is taken for each of them). Whether a multi-person rule applies
   * is decided by `attendees` — the children in the WHOLE checkout, whichever
   * weeks or passes they are on. Omit `heads` and every item is assumed to
   * carry `attendees`.
   */
  items: { name: string; price: number; days: number; heads?: number }[],
  attendees: number,
  today = new Date().toISOString().slice(0, 10),
  tx?: DiscountTx,
  /** earlyFixedUsed: this family already used a fixed-£ early bird this season, so those rules are skipped. */
  opts?: { earlyFixedUsed?: boolean },
): { lines: DiscountLine[]; total: number } {
  const headsOf = (i: { heads?: number }) => Math.max(0, i.heads ?? attendees);
  const gross = items.reduce((s, i) => s + i.price * headsOf(i), 0);
  if (!items.length) return { lines: [], total: 0 };
  const live = rules.filter((r) => r.enabled);
  const covers = (r: DiscountRule, n: string) => r.passNames.length === 0 || r.passNames.includes(n);
  const scopeOf = (r: DiscountRule) => (r.passNames.length === 0 ? (tx ? tx.tr("p7pg.allPasses") : "All passes") : r.passNames.join(", "));
  const termsOf = (r: DiscountRule) => {
    const amount = r.method === "percent" ? `${r.value}%` : r.method === "subtract" ? (tx ? tx.tr("p8lst.lm8AmtOff", { amt: money(r.value) }) : `${money(r.value)} off`) : (tx ? tx.tr("p8lst.lm8AmtEach", { amt: money(r.value) }) : `${money(r.value)} each`);
    return r.kind === "person" ? (tx ? tx.tr("p8lst.lm8EveryChild", { amt: amount }) : `${amount} · every child`) : amount;
  };
  const off = (r: DiscountRule, unit: number) =>
    r.method === "percent" ? (unit * r.value) / 100 : r.method === "subtract" ? Math.min(unit, r.value) : Math.max(0, unit - r.value);

  const lines: DiscountLine[] = [];
  let running = gross;

  // 1) Multi-person — priced per discounted attendee, per covered ticket.
  // Judged across the whole checkout: siblings booked together earn it even on different weeks or passes.
  const discountedHeads = (n: number) => Math.max(0, n);
  const person = live.filter((r) => r.kind === "person");
  let bestPerson: { r: DiscountRule; amount: number; perItem: number[] } | null = null;
  for (const r of person) {
    // Counted across the whole checkout: child A in week 1 and child B in week 2, booked together, are siblings
    // for this rule even though they are not on the same line. Every child on a covered line gets the percentage.
    const perItem = items.map((i) =>
      covers(r, i.name) && attendees > r.moreThan ? off(r, i.price) * discountedHeads(headsOf(i)) : 0,
    );
    const amount = perItem.reduce((s, n) => s + n, 0);
    if (amount > 0 && (!bestPerson || amount > bestPerson.amount)) bestPerson = { r, amount, perItem };
  }
  if (bestPerson) {
    lines.push({ name: ruleDisplayName(bestPerson.r, tx), kind: "person", custom: !isAutoRuleName(bestPerson.r), amount: bestPerson.amount, scope: scopeOf(bestPerson.r), terms: termsOf(bestPerson.r), perItem: bestPerson.perItem });
    running -= bestPerson.amount;
  }

  // A rule limited to certain tickets may only discount those tickets' share
  // of the basket — not the whole thing.
  const shareOf = (r: DiscountRule) => {
    if (r.passNames.length === 0) return 1;
    const covered = items.filter((i) => covers(r, i.name)).reduce((s, i) => s + i.price * headsOf(i), 0);
    return gross > 0 ? covered / gross : 0;
  };

  // These rules come off the whole (reduced) total, so their saving is split
  // across the items they cover, by each item's share of that gross.
  const spread = (r: DiscountRule, amount: number) => {
    const weights = items.map((i) => (covers(r, i.name) ? i.price * headsOf(i) : 0));
    const sum = weights.reduce((s, n) => s + n, 0);
    return weights.map((w) => (sum > 0 ? Math.round(((amount * w) / sum) * 100) / 100 : 0));
  };

  // 2) Multi-session — on the already-reduced total, counting only the
  //    sessions on tickets this rule covers.
  const session = live.filter((r) => {
    if (r.kind !== "session") return false;
    const sessions = items.filter((i) => covers(r, i.name)).reduce((s, i) => s + i.days * headsOf(i), 0);
    return sessions > r.moreThan;
  });
  let bestSession: { r: DiscountRule; amount: number } | null = null;
  for (const r of session) {
    const amount = off(r, running * shareOf(r));
    if (amount > 0 && (!bestSession || amount > bestSession.amount)) bestSession = { r, amount };
  }
  if (bestSession) {
    lines.push({ name: ruleDisplayName(bestSession.r, tx), kind: "session", custom: !isAutoRuleName(bestSession.r), amount: bestSession.amount, scope: scopeOf(bestSession.r), terms: termsOf(bestSession.r), perItem: spread(bestSession.r, bestSession.amount) });
    running -= bestSession.amount;
  }

  // 3) Early bird.
  const early = live.filter((r) => r.kind === "early" && (!r.beforeDate || today <= r.beforeDate) && !(opts?.earlyFixedUsed && r.method !== "percent"));
  let bestEarly: { r: DiscountRule; amount: number } | null = null;
  for (const r of early) {
    const amount = off(r, running * shareOf(r));
    if (amount > 0 && (!bestEarly || amount > bestEarly.amount)) bestEarly = { r, amount };
  }
  if (bestEarly) {
    lines.push({ name: ruleDisplayName(bestEarly.r, tx), kind: "early", custom: !isAutoRuleName(bestEarly.r), amount: bestEarly.amount, scope: scopeOf(bestEarly.r), terms: termsOf(bestEarly.r), perItem: spread(bestEarly.r, bestEarly.amount), ...(bestEarly.r.method !== "percent" ? { earlyFixed: true } : {}) });
    running -= bestEarly.amount;
  }

  return { lines, total: Math.max(0, Math.round(running * 100) / 100) };
}

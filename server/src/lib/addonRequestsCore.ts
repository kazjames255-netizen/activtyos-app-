import { addAmendFee } from "./dateChange";
import { applyAddonRelease, settleShareRemoval } from "../../../features/bookings/mutations";
import { cashReceivedOf, refundableSoFar } from "../../../features/bookings/helpers";
import { addonLineKey, parseAddonLabel } from "../../../features/bookings/addons";
import { DEFAULT_ADDON_REQUEST_DAYS, labelWithAnswers, lineDayStates, pendingForLine, requestKeys, requestTargets, splittableLine } from "../../../features/bookings/addonRequests";
import { addonString, addonStringIndex, dayShare, removeLineDays } from "../../../features/bookings/addonDays";
import type { AddonRequest, AddonRequestTarget, Booking } from "../../../features/bookings/types";

// PURE rules (no database): applying a provider's decision on a family's request to change / cancel extras. See addonRequests.ts for the rest.
// A CANCEL request now carries a list of targets (an extra and, for a daily extra, the specific days), approved or declined as ONE action.
// A request made before that (no `targets`) is the one whole extra named by its `key`.

const round2 = (n: number) => Math.round(n * 100) / 100;
export class AddonRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Line = NonNullable<Booking["addonLines"]>[number];
type BookingLine = Line;

/** What the family chose, by question label ("size" -> "m"): read from the line's structured answers, else from the label's "(size: m, colour: red)". */
export function currentAnswers(line: Line): Record<string, string> {
  const list = line.answers?.length ? line.answers : parseAddonLabel(line.label).answers;
  return Object.fromEntries(list.map((a) => [a.label, a.value]));
}

export const findLine = (b: Booking, key: string): Line | undefined => (b.addonLines ?? []).find((l) => addonLineKey(l.child, l.label) === key);

/** The line a request target points at. Normally by key; if the extra was reworded since (a day was cancelled on it), the same child's same extra. */
export function findLineForTarget(b: Booking, t: Pick<AddonRequestTarget, "key" | "child" | "name">): Line | undefined {
  const hit = findLine(b, t.key);
  if (hit) return hit;
  const name = (t.name ?? parseAddonLabel(t.key.split("|")[1] ?? "").name).trim().toLowerCase();
  if (!name) return undefined;
  const child = (t.child ?? "").trim().toLowerCase();
  const same = (b.addonLines ?? []).filter((l) => (l.child ?? "").trim().toLowerCase() === child && (l.name ?? parseAddonLabel(l.label).name).trim().toLowerCase() === name);
  return same.length === 1 ? same[0] : undefined;
}

export type Resolution = "refund" | "wallet" | "none" | "charge" | "waive";
export interface DecisionResult { request: AddonRequest; release: { resolution: "refund" | "wallet" | "none"; amount: number } | null }

/** Approve: the extra(s) are changed / removed on the booking, and the money follows ONLY what the provider chose. Throws AddonRequestError. */
export function approveAddonRequest(b: Booking, id: string, opts: { resolution?: Resolution; amount?: number; by: string; /** today (YYYY-MM-DD) and the provider's cut-off: a change then reaches only the days still open */ today?: string; cutoffDays?: number }): DecisionResult {
  const r = (b.addonRequests ?? []).find((x) => x.id === id);
  if (!r) throw new AddonRequestError(404, "That request isn't on this booking.");
  if (r.status !== "pending") throw new AddonRequestError(409, "This request has already been decided.");
  let release: DecisionResult["release"] = null;

  if (r.kind === "cancel") {
    // Work out every target BEFORE touching the booking: a refused approve must leave it exactly as it was.
    const targets = requestTargets(r);
    const plan: { line: Line; days: string[] | null; amount: number; label: string }[] = [];
    for (const t of targets) {
      const line = findLineForTarget(b, t);
      if (!line || plan.some((p) => p.line === line)) continue;
      if (splittableLine(line) && t.days?.length) {
        const days = t.days.filter((d) => (line.days ?? []).includes(d));
        if (days.length) plan.push({ line, days, amount: dayShare(line, days), label: days.length === line.days.length ? line.label : `${line.label} (${days.length} of ${line.days.length} days)` });
      } else plan.push({ line, days: null, amount: round2(line.price), label: line.label });
    }
    if (!plan.length) throw new AddonRequestError(409, targets.length > 1 || targets[0].days?.length ? "Those extras and days are no longer on this booking." : "That extra is no longer on this booking.");
    const total = round2(plan.reduce((n, p) => n + p.amount, 0));
    const label = plan.length > 1 ? `${plan.length} extras` : plan[0].label;
    const resolution = (opts.resolution === "refund" || opts.resolution === "wallet" || opts.resolution === "none" ? opts.resolution : "refund") as "refund" | "wallet" | "none";
    // ONE money rule (see settleShareRemoval): the removed share leaves the amount; only what is then overpaid can be refunded or credited.
    const wasPaid = refundableSoFar(b) > 0.004;
    const res = settleShareRemoval(b, `${label} (extra)`, total, { resolution, amount: opts.amount != null && Number.isFinite(opts.amount) ? Math.min(Math.max(0, opts.amount), total) : undefined });
    release = wasPaid ? { resolution: res.resolution, amount: res.amount } : null;
    r.money = wasPaid && res.amount > 0 ? { resolution: res.resolution, amount: res.amount } : { resolution: "none", amount: 0 };
    for (const p of plan) removeLineDays(b, p.line, p.days);
  } else {
    const line = findLineForTarget(b, requestTargets(r)[0]);
    if (!line) throw new AddonRequestError(409, "That extra is no longer on this booking.");
    const idx = addonStringIndex(b, line);
    // A change of choice (size, colour) is not a price change: new requests carry no difference. A request stored before that rule may still
    // carry one; then the provider must say what to do about it.
    const diff = round2(r.priceDiff ?? 0);
    const to = r.to ?? {};
    // Validate BEFORE touching the booking: a refused approve must leave it exactly as it was.
    if (Math.abs(diff) > 0.004 && !opts.resolution) throw new AddonRequestError(400, "Choose what to do about the price difference (charge it, refund it or waive it).");
    const oldLabel = line.label;
    const oldAnswers = currentAnswers(line);
    // REMAINING-DAYS RULE: a change reaches only the days still open (not past, not inside the cut-off). Days already locked keep what was booked, as
    // their own line (x1 Blue), and the rest become the new choice (x6 Red). Nothing open left: refused.
    let locked: BookingLine | null = null;
    if (opts.today && splittableLine(line)) {
      const states = lineDayStates(line.days, opts.today, opts.cutoffDays ?? DEFAULT_ADDON_REQUEST_DAYS);
      const open = states.filter((d) => d.state === "none").map((d) => d.date);
      const shut = (line.days ?? []).filter((d) => !open.includes(d));
      if (!open.length) throw new AddonRequestError(409, "Every day of that extra has passed or is too close to change.");
      if (shut.length) {
        const pOld = parseAddonLabel(oldLabel);
        const share = dayShare(line, shut);
        locked = { ...line, label: labelWithAnswers(pOld.name, shut.length, true, Object.entries(oldAnswers).map(([label, value]) => ({ label, value }))), days: shut, price: share, qty: shut.length, ...(line.answers ? { answers: line.answers.map((x) => ({ ...x })) } : {}) };
        line.days = open; line.price = round2(line.price - share); if (line.qty != null) line.qty = open.length;
      }
    }
    line.answers = Object.entries({ ...oldAnswers, ...to }).map(([label, value]) => ({ label, value }));
    // Reword from the line AS IT IS NOW (a day may have been cancelled since the request: x7 must not come back), not from the request's stored text.
    const p = parseAddonLabel(oldLabel);
    line.label = r.toLabel ? labelWithAnswers(p.name, line.perDay ? (line.days?.length || p.qty) : p.qty, !!line.perDay, line.answers) : oldLabel;
    if (Math.abs(diff) > 0.004) {
      const res = opts.resolution!;
      if (res === "charge" && diff > 0) {
        const unpaid = cashReceivedOf(b) <= 0;
        if (unpaid) b.amount = round2((b.amount ?? 0) + diff); else addAmendFee(b, diff);
        line.price = round2(line.price + diff);
        r.money = { resolution: "charge", amount: diff };
      } else if ((res === "refund" || res === "wallet") && diff < 0) {
        if (refundableSoFar(b) > 0.004) {
          const out = applyAddonRelease(b, oldLabel, Math.abs(diff), res);
          release = { resolution: out.resolution, amount: out.amount };
          r.money = { resolution: out.resolution, amount: out.amount };
        } else {
          b.amount = round2(Math.max(0, (b.amount ?? 0) + diff));
          r.money = { resolution: "none", amount: 0 };
        }
        line.price = round2(line.price + diff);
      } else {
        r.money = { resolution: "waive", amount: 0 }; // the price stays as booked
      }
    } else {
      r.money = { resolution: "none", amount: 0 };
    }
    if (locked) b.addonLines = (b.addonLines ?? []).flatMap((l) => (l === line ? [locked!, l] : [l]));
    if (idx >= 0) {
      b.addons[idx] = addonString(line.label, line.price);
      if (locked) b.addons.splice(idx, 0, addonString(locked.label, locked.price));
    }
  }
  r.status = "approved";
  r.decidedAt = new Date().toISOString();
  r.decidedBy = opts.by;
  return { request: r, release };
}

export function declineAddonRequest(b: Booking, id: string, reason: string | undefined, by: string): AddonRequest {
  const r = (b.addonRequests ?? []).find((x) => x.id === id);
  if (!r) throw new AddonRequestError(404, "That request isn't on this booking.");
  if (r.status !== "pending") throw new AddonRequestError(409, "This request has already been decided.");
  r.status = "declined";
  r.decidedAt = new Date().toISOString();
  r.decidedBy = by;
  const why = (reason ?? "").trim().slice(0, 300);
  if (why) r.declineReason = why;
  return r;
}

export function withdrawAddonRequest(b: Booking, id: string): AddonRequest {
  const r = (b.addonRequests ?? []).find((x) => x.id === id);
  if (!r) throw new AddonRequestError(404, "That request isn't on this booking.");
  if (r.status !== "pending") throw new AddonRequestError(409, "This request has already been decided.");
  r.status = "withdrawn";
  r.decidedAt = new Date().toISOString();
  return r;
}

/** One pending request per extra, enforced when adding (a request covering several extras needs every one of them to be free). */
export function addAddonRequest(b: Booking, r: AddonRequest): void {
  for (const k of requestKeys(r)) if (pendingForLine(b, k)) throw new AddonRequestError(409, "There is already a request waiting for your provider on this extra.");
  b.addonRequests = [...(b.addonRequests ?? []), r];
}

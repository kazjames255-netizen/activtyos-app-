import { addAmendFee } from "./dateChange";
import { applyAddonRelease } from "../../../features/bookings/mutations";
import { cashReceivedOf, refundableSoFar } from "../../../features/bookings/helpers";
import { addonLineKey, parseAddonLabel } from "../../../features/bookings/addons";
import { pendingForLine } from "../../../features/bookings/addonRequests";
import type { AddonRequest, Booking } from "../../../features/bookings/types";

// PURE rules (no database): applying a provider's decision on a family's request to change / cancel one extra. See addonRequests.ts for the rest.

const round2 = (n: number) => Math.round(n * 100) / 100;
export class AddonRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Line = NonNullable<Booking["addonLines"]>[number];

/** What the family chose, by question label ("size" -> "m"): read from the line's structured answers, else from the label's "(size: m, colour: red)". */
export function currentAnswers(line: Line): Record<string, string> {
  const list = line.answers?.length ? line.answers : parseAddonLabel(line.label).answers;
  return Object.fromEntries(list.map((a) => [a.label, a.value]));
}

export const findLine = (b: Booking, key: string): Line | undefined => (b.addonLines ?? []).find((l) => addonLineKey(l.child, l.label) === key);

export type Resolution = "refund" | "wallet" | "none" | "charge" | "waive";
export interface DecisionResult { request: AddonRequest; release: { resolution: "refund" | "wallet" | "none"; amount: number } | null }

const stringOf = (label: string, price: number) => `${label} — £${price.toFixed(2)}`;

/** Approve: the extra is changed / removed on the booking, and the money follows ONLY what the provider chose. Throws AddonRequestError. */
export function approveAddonRequest(b: Booking, id: string, opts: { resolution?: Resolution; amount?: number; by: string }): DecisionResult {
  const r = (b.addonRequests ?? []).find((x) => x.id === id);
  if (!r) throw new AddonRequestError(404, "That request isn't on this booking.");
  if (r.status !== "pending") throw new AddonRequestError(409, "This request has already been decided.");
  const line = findLine(b, r.key);
  if (!line) throw new AddonRequestError(409, "That extra is no longer on this booking.");
  const idx = (b.addons ?? []).findIndex((s) => s === stringOf(line.label, line.price) || s.startsWith(`${line.label} — `));
  let release: DecisionResult["release"] = null;

  if (r.kind === "cancel") {
    const received = refundableSoFar(b);
    const resolution = (opts.resolution === "refund" || opts.resolution === "wallet" || opts.resolution === "none" ? opts.resolution : "refund") as "refund" | "wallet" | "none";
    if (received > 0.004) {
      const asked = opts.amount != null && Number.isFinite(opts.amount) ? Math.max(0, opts.amount) : line.price;
      const res = applyAddonRelease(b, r.label, Math.min(asked, line.price), resolution);
      release = { resolution: res.resolution, amount: res.amount };
      r.money = { resolution: res.resolution, amount: res.amount };
    } else {
      // Nothing has been paid yet: the extra simply comes off what is owed.
      b.amount = round2(Math.max(0, (b.amount ?? 0) - line.price));
      r.money = { resolution: "none", amount: 0 };
    }
    b.addonLines = (b.addonLines ?? []).filter((l) => l !== line);
    if (idx >= 0) b.addons = b.addons.filter((_, i) => i !== idx);
  } else {
    const diff = round2(r.priceDiff ?? 0);
    const to = r.to ?? {};
    // Validate BEFORE touching the booking: a refused approve must leave it exactly as it was.
    if (Math.abs(diff) > 0.004 && !opts.resolution) throw new AddonRequestError(400, "Choose what to do about the price difference (charge it, refund it or waive it).");
    const oldLabel = line.label;
    const oldAnswers = currentAnswers(line);
    line.label = r.toLabel ?? line.label;
    line.answers = Object.entries({ ...oldAnswers, ...to }).map(([label, value]) => ({ label, value }));
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
    if (idx >= 0) b.addons[idx] = stringOf(line.label, line.price);
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

/** One pending request per extra, enforced when adding. */
export function addAddonRequest(b: Booking, r: AddonRequest): void {
  if (pendingForLine(b, r.key)) throw new AddonRequestError(409, "There is already a request waiting for your provider on this extra.");
  b.addonRequests = [...(b.addonRequests ?? []), r];
}

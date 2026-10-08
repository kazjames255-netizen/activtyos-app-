import { randomUUID } from "node:crypto";
import { librarySnap } from "./tenantLibrary";
import type { LibAddonDef } from "./addonPricing";
import { parseAddonLabel } from "../../../features/bookings/addons";
import { addonRequestBlock, changeProblem, dayBlock, labelWithAnswers, pendingForLine, splittableLine, DEFAULT_ADDON_REQUEST_DAYS } from "../../../features/bookings/addonRequests";
import { dayShare } from "../../../features/bookings/addonDays";
import type { AddonRequest, AddonRequestTarget, Booking } from "../../../features/bookings/types";
import { AddonRequestError, currentAnswers, findLine } from "./addonRequestsCore";

export { AddonRequestError, addAddonRequest, approveAddonRequest, currentAnswers, declineAddonRequest, withdrawAddonRequest } from "./addonRequestsCore";
export type { DecisionResult, Resolution } from "./addonRequestsCore";

// A family's request to CHANGE (size, colour...) or CANCEL extras (several extras, and several days of a daily extra, in ONE request). Never
// automatic, never part of cancelling the booking: it waits for the provider. This file is the part that reads the provider's real options
// (database); the pure rules are in addonRequestsCore.ts.

const round2 = (n: number) => Math.round(n * 100) / 100;
type Line = NonNullable<Booking["addonLines"]>[number];

/** The provider's real add-on definition behind a booking line (its questions and options). Newer lines carry the id; older ones match by name. */
export async function defForLine(b: Booking, line: Line): Promise<LibAddonDef | null> {
  if (!b.tenantId || line.meal) return null;
  const lib = (await librarySnap(b.tenantId, b.franchiseId ?? null)).data() ?? {};
  const defs = ((lib.addons ?? []) as LibAddonDef[]);
  if (line.addonId) { const hit = defs.find((d) => d.id === line.addonId); if (hit) return hit; }
  const name = parseAddonLabel(line.label).name.toLowerCase();
  return defs.find((d) => d.name.trim().toLowerCase() === name) ?? null;
}

export interface NewRequestInput {
  /** A single extra (a change always names exactly one; a cancel may use it instead of `targets`). */
  key?: string;
  kind: "change" | "cancel";
  answers?: Record<string, string>;
  note?: string;
  /** CANCEL only: every extra, and for a daily extra the specific days (omitted = every day still open to a request). One request, one decision. */
  targets?: { key: string; days?: string[] }[];
}

const cutoffText = (cutoffDays: number) => `Your provider takes extra changes up to ${cutoffDays} day${cutoffDays === 1 ? "" : "s"} before the session. Please message them.`;

/** Validate a family's request against the booking, the provider's real options and the cut-off, and build it. Throws AddonRequestError. */
export async function buildAddonRequest(b: Booking, input: NewRequestInput, today: string, cutoffDays: number = DEFAULT_ADDON_REQUEST_DAYS): Promise<AddonRequest> {
  if (b.status === "Cancelled" || b.status === "Declined") throw new AddonRequestError(409, "This booking is cancelled.");
  const note = (input.note ?? "").trim().slice(0, 300);
  const base = { id: randomUUID(), status: "pending" as const, createdAt: new Date().toISOString(), ...(note ? { note } : {}) };
  if (input.kind === "cancel") return buildCancelRequest(b, input, base, today, cutoffDays);

  // A change: only a size/colour/choice, and only to something the provider really offers. (A meal can be cancelled but not "changed".)
  const key = input.key ?? input.targets?.[0]?.key;
  const line = key ? findLine(b, key) : undefined;
  if (!key || !line) throw new AddonRequestError(404, "That extra isn't on this booking.");
  const block = addonRequestBlock(b, { key, days: line.days }, today, cutoffDays);
  if (block === "pending") throw new AddonRequestError(409, "There is already a request waiting for your provider on this extra.");
  if (block === "past") throw new AddonRequestError(409, "That session has already happened.");
  if (block === "cutoff") throw new AddonRequestError(409, cutoffText(cutoffDays));
  if (line.meal) throw new AddonRequestError(400, "A meal can't be changed here: cancel it and ask your provider, or message them.");
  const def = await defForLine(b, line);
  if (!def || !(def.questions ?? []).length) throw new AddonRequestError(400, "There is nothing to change on this extra. You can ask to cancel it.");
  const wanted = Object.fromEntries(Object.entries(input.answers ?? {}).map(([k, v]) => [k, String(v ?? "").trim()]));
  const current = currentAnswers(line);
  const problem = changeProblem(def.questions ?? [], current, wanted);
  if (problem) throw new AddonRequestError(400, problem);
  const merged: { label: string; value: string }[] = [];
  for (const q of def.questions ?? []) {
    const value = (wanted[q.label] ?? current[q.label] ?? "").trim();
    if (value) merged.push({ label: q.label, value });
  }
  const qty = parseAddonLabel(line.label).qty;
  const toLabel = labelWithAnswers(def.name, qty, line.perDay, merged);
  // A change of choice keeps the price AS BOOKED: it is never worked out again from the provider's current library price.
  return { ...base, key, child: line.child, label: line.label, price: round2(line.price), kind: "change", to: Object.fromEntries(merged.map((m) => [m.label, m.value])), toLabel, priceDiff: 0 };
}

function buildCancelRequest(b: Booking, input: NewRequestInput, base: { id: string; status: "pending"; createdAt: string; note?: string }, today: string, cutoffDays: number): AddonRequest {
  const asked = input.targets?.length ? input.targets : input.key ? [{ key: input.key } as { key: string; days?: string[] }] : [];
  if (!asked.length) throw new AddonRequestError(400, "Pick what you would like to cancel.");
  if (new Set(asked.map((t) => t.key)).size !== asked.length) throw new AddonRequestError(400, "An extra is listed twice in this request.");
  const targets: AddonRequestTarget[] = [];
  for (const t of asked) {
    const line = findLine(b, t.key);
    if (!line) throw new AddonRequestError(404, "That extra isn't on this booking.");
    if (pendingForLine(b, t.key)) throw new AddonRequestError(409, "There is already a request waiting for your provider on this extra.");
    const name = line.name ?? parseAddonLabel(line.label).name;
    if (splittableLine(line)) {
      // A daily extra goes a day at a time. Each day is checked against the cut-off on ITS OWN date; leaving the days out means every day still open.
      const have = [...line.days].sort();
      let days: string[];
      if (t.days?.length) {
        days = [...new Set(t.days)].sort();
        const stray = days.find((d) => !have.includes(d));
        if (stray) throw new AddonRequestError(400, `${name} isn't booked for ${stray}.`);
        for (const d of days) {
          const blk = dayBlock(today, d, cutoffDays);
          if (blk === "past") throw new AddonRequestError(409, `${d} has already happened, so it can't be included.`);
          if (blk === "cutoff") throw new AddonRequestError(409, `${d} is too close to include. ${cutoffText(cutoffDays)}`);
        }
      } else {
        days = have.filter((d) => dayBlock(today, d, cutoffDays) === "none");
        if (!days.length) throw new AddonRequestError(409, have.every((d) => dayBlock(today, d, cutoffDays) === "past") ? "That session has already happened." : cutoffText(cutoffDays));
      }
      targets.push({ key: t.key, child: line.child, label: line.label, name, days, price: dayShare(line, days) });
    } else {
      // A one-off extra or a meal is asked about whole, judged on its own (first) day.
      if (t.days?.length) throw new AddonRequestError(400, `${name} isn't a daily extra, so it can only be cancelled whole.`);
      const block = addonRequestBlock(b, { key: t.key, days: line.days }, today, cutoffDays);
      if (block === "past") throw new AddonRequestError(409, "That session has already happened.");
      if (block === "cutoff") throw new AddonRequestError(409, cutoffText(cutoffDays));
      targets.push({ key: t.key, child: line.child, label: line.label, name, price: round2(line.price) });
    }
  }
  const total = round2(targets.reduce((n, t) => n + t.price, 0));
  return { ...base, key: targets[0].key, child: targets[0].child, label: targets[0].label, price: total, kind: "cancel", targets };
}

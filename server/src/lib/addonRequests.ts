import { randomUUID } from "node:crypto";
import { librarySnap } from "./tenantLibrary";
import type { LibAddonDef } from "./addonPricing";
import { addonLineKey, parseAddonLabel } from "../../../features/bookings/addons";
import { addonRequestBlock, changeProblem, labelWithAnswers, DEFAULT_ADDON_REQUEST_DAYS } from "../../../features/bookings/addonRequests";
import type { AddonRequest, Booking } from "../../../features/bookings/types";
import { AddonRequestError, currentAnswers, findLine } from "./addonRequestsCore";

export { AddonRequestError, addAddonRequest, approveAddonRequest, currentAnswers, declineAddonRequest, withdrawAddonRequest } from "./addonRequestsCore";
export type { DecisionResult, Resolution } from "./addonRequestsCore";

// A family's request to CHANGE (size, colour...) or CANCEL one extra. Never automatic, never part of cancelling the booking: it waits for the
// provider. This file is the part that reads the provider's real options (database); the pure rules are in addonRequestsCore.ts.

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

export interface NewRequestInput { key: string; kind: "change" | "cancel"; answers?: Record<string, string>; note?: string }

/** Validate a family's request against the booking, the provider's real options and the cut-off, and build it. Throws AddonRequestError. */
export async function buildAddonRequest(b: Booking, input: NewRequestInput, today: string, cutoffDays: number = DEFAULT_ADDON_REQUEST_DAYS): Promise<AddonRequest> {
  const line = findLine(b, input.key);
  if (!line) throw new AddonRequestError(404, "That extra isn't on this booking.");
  const block = addonRequestBlock(b, { key: input.key, days: line.days }, today, cutoffDays);
  if (block === "cancelled") throw new AddonRequestError(409, "This booking is cancelled.");
  if (block === "pending") throw new AddonRequestError(409, "There is already a request waiting for your provider on this extra.");
  if (block === "past") throw new AddonRequestError(409, "That session has already happened.");
  if (block === "cutoff") throw new AddonRequestError(409, `Your provider takes extra changes up to ${cutoffDays} day${cutoffDays === 1 ? "" : "s"} before the session. Please message them.`);
  const note = (input.note ?? "").trim().slice(0, 300);
  const base = { id: randomUUID(), key: input.key, child: line.child, label: line.label, price: round2(line.price), status: "pending" as const, createdAt: new Date().toISOString(), ...(note ? { note } : {}) };
  if (input.kind === "cancel") return { ...base, kind: "cancel" };
  // A change: only a size/colour/choice, and only to something the provider really offers. (A meal can be cancelled but not "changed".)
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
  const newPrice = def.type === "perday" ? round2(Math.max(0, def.price) * Math.max(1, line.days?.length ?? qty)) : round2(Math.max(0, def.price));
  const priceDiff = round2(newPrice - line.price);
  return { ...base, kind: "change", to: Object.fromEntries(merged.map((m) => [m.label, m.value])), toLabel, priceDiff };
}


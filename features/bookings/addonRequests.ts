import type { AddonRequest, AddonRequestTarget, Booking } from "./types";

// Pure rules for a family's REQUESTS to change or cancel an extra (add-on). Shared by the server (validation, applying a decision) and the
// screens (what a family / provider sees). Nothing here is ever automatic: a request waits for the provider.

export const DEFAULT_ADDON_REQUEST_DAYS = 3;

const ymd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/** Requests still waiting for the provider. */
export const pendingAddonRequests = (b: Pick<Booking, "addonRequests">): AddonRequest[] => (b.addonRequests ?? []).filter((r) => r.status === "pending");
export const hasPendingAddonRequest = (b: Pick<Booking, "addonRequests">): boolean => pendingAddonRequests(b).length > 0;
/** The extras a request covers. A request made before bulk requests has no `targets`: it is the one whole extra named by `key`. */
export function requestTargets(r: Pick<AddonRequest, "key" | "child" | "label" | "price" | "targets">): AddonRequestTarget[] {
  return r.targets?.length ? r.targets : [{ key: r.key, child: r.child, label: r.label, price: r.price }];
}
export const requestKeys = (r: Pick<AddonRequest, "key" | "child" | "label" | "price" | "targets">): string[] => requestTargets(r).map((t) => t.key);
export const pendingForLine = (b: Pick<Booking, "addonRequests">, key: string): AddonRequest | undefined => pendingAddonRequests(b).find((r) => requestKeys(r).includes(key));

/** Can this extra be cancelled a day at a time? Only a daily extra that knows its days (a one-off and a meal are asked about whole). */
export const splittableLine = (l: { perDay?: boolean; meal?: boolean; days?: string[] }): boolean => !!l.perDay && !l.meal && (l.days?.length ?? 0) > 0;

/** The first day an extra is for (its own days, else the booking's days). */
export function firstDayOf(line: { days?: string[] }, bookingDays: string[] | undefined): string | undefined {
  const ds = [...(line.days?.length ? line.days : bookingDays ?? [])].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return ds[0];
}

/** Whole days from `today` (YYYY-MM-DD) to `day`; negative when `day` has passed. */
export function daysUntil(today: string, day: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export type RequestBlock = "past" | "cutoff" | "pending" | "cancelled" | "none";

/** The cut-off for ONE day: has it passed, is it too close, or can the family still ask about it. Measured per day, not from the first day. */
export function dayBlock(today: string, day: string, cutoffDays: number = DEFAULT_ADDON_REQUEST_DAYS): "past" | "cutoff" | "none" {
  const until = daysUntil(today, day);
  if (until < 0) return "past";
  if (until < Math.max(0, Math.floor(cutoffDays))) return "cutoff";
  return "none";
}

/** Each day of a daily extra with whether a request may still include it. */
export function lineDayStates(days: string[] | undefined, today: string, cutoffDays: number = DEFAULT_ADDON_REQUEST_DAYS): { date: string; state: "none" | "past" | "cutoff" }[] {
  return [...(days ?? [])].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().map((date) => ({ date, state: dayBlock(today, date, cutoffDays) }));
}

/**
 * Can a family still ask about this extra? `cutoffDays` is the provider's Setup option "allow add-on requests until N days before the session"
 * (default 3; 0 = until the day of the session). Returns the reason when not.
 */
export function addonRequestBlock(
  b: Pick<Booking, "status" | "days" | "addonRequests">,
  line: { key: string; days?: string[] },
  today: string,
  cutoffDays: number = DEFAULT_ADDON_REQUEST_DAYS,
): RequestBlock {
  if (b.status === "Cancelled" || b.status === "Declined") return "cancelled";
  if (pendingForLine(b, line.key)) return "pending";
  const first = firstDayOf(line, b.days);
  if (!first) return "none";
  const until = daysUntil(today, first);
  if (until < 0) return "past";
  if (until < Math.max(0, Math.floor(cutoffDays))) return "cutoff";
  return "none";
}

/**
 * Can a family still ask about this extra at all (a change OR a cancel)? A daily extra is judged day by day: while any of its days is still open
 * (not past, not inside the cut-off) it can be asked about, even after day 1 has passed. A one-off extra and a meal are judged on their first day.
 */
export function lineRequestBlock(
  b: Pick<Booking, "status" | "days" | "addonRequests">,
  line: { key: string; days?: string[]; perDay?: boolean; meal?: boolean },
  today: string,
  cutoffDays: number = DEFAULT_ADDON_REQUEST_DAYS,
): RequestBlock {
  if (!splittableLine(line)) return addonRequestBlock(b, line, today, cutoffDays);
  if (b.status === "Cancelled" || b.status === "Declined") return "cancelled";
  if (pendingForLine(b, line.key)) return "pending";
  const states = lineDayStates(line.days, today, cutoffDays);
  if (!states.length || states.some((d) => d.state === "none")) return "none";
  return states.every((d) => d.state === "past") ? "past" : "cutoff";
}

/** The date a family can ask until, for the message ("until 3 days before: Sat 24 Oct"). */
export function requestDeadline(first: string, cutoffDays: number): string {
  const d = new Date(`${first}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - Math.max(0, Math.floor(cutoffDays)));
  return ymd(d);
}

/** "tshirty (size: m)" with the new answers swapped in: "tshirty (size: L)". `answers` is by question label, in the order of `labels`. */
export function labelWithAnswers(name: string, qty: number, perDay: boolean, answers: { label: string; value: string }[]): string {
  const suffix = answers.length ? ` (${answers.map((x) => `${x.label}: ${x.value}`).join(", ")})` : "";
  return (perDay ? `${name} × ${qty}` : name) + suffix;
}

/** Why a requested change is not valid, or null. `options` are the real choices the provider offers per question. */
export function changeProblem(
  questions: { id: string; label: string; type: string; options?: string[]; required?: boolean }[],
  current: Record<string, string>,
  wanted: Record<string, string>,
): string | null {
  const asked = Object.keys(wanted);
  if (!asked.length) return "Pick what you would like instead.";
  let differs = false;
  for (const q of questions) {
    const next = (wanted[q.label] ?? current[q.label] ?? "").trim();
    if (!next) { if (q.required) return `Please choose ${q.label}.`; continue; }
    if (q.type === "choice" && (q.options ?? []).length && !(q.options ?? []).includes(next)) return `"${next}" isn't one of the options for ${q.label}.`;
    if (next !== (current[q.label] ?? "").trim()) differs = true;
  }
  return differs ? null : "That's what you already have.";
}

/** What a request asks for, as a phrase for sentences: "cancel Water bottle × 7 (Colour: Blue) for 3 days", "cancel 2 extras", "change X to Y". */
export function requestWhat(r: Pick<AddonRequest, "kind" | "key" | "child" | "label" | "price" | "toLabel" | "targets">): string {
  if (r.kind !== "cancel") return `change ${r.label} to ${r.toLabel ?? "something else"}`;
  const ts = requestTargets(r);
  if (ts.length > 1) return `cancel ${ts.length} extras`;
  const t = ts[0];
  return t.days?.length ? `cancel ${t.label} for ${t.days.length} day${t.days.length === 1 ? "" : "s"}` : `cancel ${t.label}`;
}

/** A short sentence for bells and emails. */
export function describeRequest(r: Pick<AddonRequest, "kind" | "key" | "child" | "label" | "price" | "toLabel" | "targets">): string {
  const who = r.child.trim().split(/\s+/)[0] || "Child";
  return `${who} asks to ${requestWhat(r)}`;
}

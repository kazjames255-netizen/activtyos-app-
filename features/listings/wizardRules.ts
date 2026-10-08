// PURE listing-wizard rules (extracted from ListingWizard.tsx, behaviour unchanged) so they can be regression-tested. See tests/regression/.

export function isOnlineVenue(v: { kind?: string } | null | undefined): boolean {
  return v?.kind === "online";
}

/** A date box typed as "26/10/20" yields the year 0020 (and 20 weeks becomes 58 weeks of nothing). Two-digit years mean 20xx; three-digit
 *  years are still being typed, so they are left alone until there are four digits. */
export function fixYear(v: string): string {
  const m = /^(\d{1,6})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const y = Number(m[1]);
  if (y >= 1000 && y <= 9999) return v;
  if (y < 100) return `${2000 + y}-${m[2]}-${m[3]}`;
  return v;
}

/** The "check the dates" warning: a run of over 40 weeks, or a start year before 2000, is almost always a typo. */
export const runLooksWrong = (weeks: number, runFrom: string | undefined): boolean => weeks > 40 || (!!runFrom && Number(runFrom.slice(0, 4)) < 2000);

/** The top-right "Save" button must NEVER take a live listing offline: it saves a live listing as live, anything else as a draft. */
export const saveStatusFor = (current: "draft" | "live"): "draft" | "live" => (current === "live" ? "live" : "draft");

/** Picking "Online": use the account's existing online place, or create one (the caller supplies the new id). */
export function onlineVenueChoice(venues: { id: string; kind?: string }[], newId: string): { id: string; create: boolean } {
  const existing = venues.find((v) => isOnlineVenue(v));
  return existing ? { id: existing.id, create: false } : { id: newId, create: true };
}

/** The draft changes when the provider picks a delivery mode. Any NON-online choice clears a leftover online place, so a listing can never be
 *  published as "At a venue" with the Online place still attached; Home visits starts a blank postcode list. */
export function deliveryPatch(mode: "venue" | "home-visit" | "both", venues: { id: string; kind?: string }[], venueId: string | null | undefined, hasCoverage: boolean) {
  const clearsOnline = isOnlineVenue(venues.find((v) => v.id === venueId));
  return {
    deliveryMode: mode,
    ...(clearsOnline ? { venueId: null } : {}),
    ...(mode === "home-visit" && !hasCoverage ? { coverageArea: { mode: "postcodePrefixes" as const, postcodePrefixes: [] as string[] } } : {}),
  };
}

/** Today's date as a local YYYY-MM-DD (what a date box compares against). */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The latest date a listing may run to: three years from today. */
export const maxRunIso = (today: string = todayIso()): string => `${Number(today.slice(0, 4)) + 3}${today.slice(4)}`;

/** Is a typed date wrong for a listing? "past" = before today (less `graceDays`), "far" = beyond three years. A year still being typed
 *  (fewer than four digits) is never judged, so typing 2-0-2-6 into the year box is left alone. */
export function dateProblem(iso: string | undefined, today: string = todayIso(), graceDays = 0): "past" | "far" | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m || Number(m[1]) < 1000) return null;
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() - graceDays);
  if (iso! < limit.toISOString().slice(0, 10)) return "past";
  if (iso! > maxRunIso(today)) return "far";
  return null;
}

// ── Separate date periods (e.g. a week now and another in 6 months: nothing in between) ───────────────────────────────────────────────
export type RunPeriod = { from: string; to: string };

/** A draft's run-days: each period on its own (nothing generated in the gaps), or the single From..To range. Switched-off days are NOT removed here. */
export function periodDates(d: { runFrom: string; runTo: string; days: number[]; runPeriods?: RunPeriod[] }, gen: (from: string, to: string, days: number[]) => string[]): string[] {
  const periods = (d.runPeriods ?? []).filter((p) => p.from && p.to);
  if (!periods.length) return gen(d.runFrom, d.runTo, d.days);
  const all = new Set<string>();
  for (const p of periods) for (const x of gen(p.from, p.to, d.days)) all.add(x);
  return [...all].sort();
}

/** The outer span of the periods (what runFrom / runTo hold, for the screens that show one range). */
export function periodSpan(periods: RunPeriod[]): { from: string; to: string } {
  const ok = periods.filter((p) => p.from && p.to);
  if (!ok.length) return { from: periods[0]?.from ?? "", to: periods[0]?.to ?? "" };
  return { from: ok.map((p) => p.from).sort()[0], to: ok.map((p) => p.to).sort().reverse()[0] };
}

/** What is wrong with a list of periods (first problem only), or null. */
export function periodsProblem(periods: RunPeriod[]): "incomplete" | "endBefore" | "overlap" | null {
  const list = periods ?? [];
  if (list.some((p) => !p.from || !p.to)) return "incomplete";
  if (list.some((p) => p.to < p.from)) return "endBefore";
  const sorted = [...list].sort((a, b) => (a.from < b.from ? -1 : 1));
  for (let i = 1; i < sorted.length; i++) if (sorted[i].from <= sorted[i - 1].to) return "overlap";
  return null;
}

/** Tick a whole week on or off: its days go in / out of the switched-off list. */
export function setWeekOff(datesOff: string[], weekDays: string[], off: boolean): string[] {
  const set = new Set(datesOff);
  for (const d of weekDays) { if (off) set.add(d); else set.delete(d); }
  return [...set].sort();
}

/** After a save finishes, fold ONLY what the server decided (id, status, uploaded image URLs) into the draft as it is NOW. The save used to
 *  `setD(<snapshot taken when it started>)`, so any letters typed while the request was in flight were wiped (typing "testing" left "esting"). */
export function mergeSaved<T extends { images?: unknown; gallery?: unknown }>(
  now: T,
  sent: { images?: unknown; gallery?: unknown },
  saved: { id?: string; status: string; images: unknown; gallery: unknown },
): T & { id?: string; status: string } {
  return {
    ...now,
    id: saved.id,
    status: saved.status,
    // Swap in uploaded URLs only if the photos are still the ones we sent; otherwise the person changed them mid-save.
    ...(now.images === sent.images ? { images: saved.images } : {}),
    ...(now.gallery === sent.gallery ? { gallery: saved.gallery } : {}),
  };
}

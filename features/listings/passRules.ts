// Pure pass-selling rules ("Any n days in a week", "Any n days, any week",
// "Whole n-day block"), extracted unchanged from useBooking in booking.ts so
// they can be unit-tested. Behaviour-preserving.
import { mondayOf } from "./format";

export type PassRule = "week" | "listing" | "blocks";
export type PassWeek = { n: number; mon: string; days: string[] };

/** Guard impossible rules for old/edge data: a "week" pass longer than a week,
 * or a "fixed block" that's neither a week block nor the whole run — both
 * fall back to picking across the listing. */
export function effectiveRule(rawRule: PassRule, need: number, weekMax: number, runTotal: number): PassRule {
  return rawRule === "week" && weekMax > 0 && need > weekMax ? "listing"
    : rawRule === "blocks" && weekMax > 0 && need !== weekMax && need !== runTotal ? "listing"
    : rawRule;
}

/** Bookable days a single week offers (max over weeks) and across the whole run. */
export function weekMaxAndRunTotal(weeks: PassWeek[], datesOff: string[]) {
  const weekMax = weeks.reduce((m, w) => Math.max(m, w.days.filter((x) => !datesOff.includes(x)).length), 0);
  const runTotal = weeks.reduce((n, w) => n + w.days.filter((x) => !datesOff.includes(x)).length, 0);
  return { weekMax, runTotal };
}

/**
 * The new selection after a parent/operator clicks `iso` (in the week starting
 * `weekMon`), or `sel` unchanged when the click is ignored.
 * `past(iso)` is true for days a parent can no longer book.
 */
export function pickDaySelection(a: {
  iso: string; weekMon: string; sel: string[]; need: number; rule: PassRule; isSingle: boolean;
  weeks: PassWeek[]; weekMax: number; datesOff: string[]; past: (iso: string) => boolean;
}): string[] {
  const { iso, weekMon, sel, need, rule, isSingle, weeks, weekMax, datesOff, past } = a;
  const off = (x: string) => datesOff.includes(x);
  if (off(iso) || past(iso)) return sel;
  if (isSingle) return sel.includes(iso) ? sel.filter((x) => x !== iso) : [...sel, iso];
  if (rule === "blocks") {
    // A whole-run block (need spans more than a week) takes every day; a
    // within-a-week block takes that week's days.
    const avail = need > weekMax
      ? weeks.flatMap((w) => w.days).filter((x) => !off(x) && !past(x)).slice(0, need)
      : (weeks.find((w) => w.mon === weekMon)?.days ?? []).filter((x) => !off(x) && !past(x)).slice(0, need);
    const same = avail.length === sel.length && avail.every((x) => sel.includes(x));
    return same ? [] : avail;
  }
  // "Any N days in one week" where the pass needs the WHOLE week (N >= the
  // week's running days) — picking any day takes the entire week.
  if (rule === "week") {
    const wk = weeks.find((w) => w.mon === weekMon);
    const avail = (wk?.days ?? []).filter((x) => !off(x));
    if (avail.length > 0 && need >= avail.length) {
      const same = avail.length === sel.length && avail.every((x) => sel.includes(x));
      return same ? [] : avail.slice(0, need);
    }
  }
  // "Any N days across the listing" where the pass needs the WHOLE run.
  if (rule === "listing") {
    const allAvail = weeks.flatMap((w) => w.days).filter((x) => !off(x));
    if (allAvail.length > 0 && need >= allAvail.length) {
      const same = allAvail.length === sel.length && allAvail.every((x) => sel.includes(x));
      return same ? [] : allAvail.slice(0, need);
    }
  }
  if (sel.includes(iso)) return sel.filter((x) => x !== iso);
  if (sel.length >= need) return sel;
  if (rule === "week" && sel.length && mondayOf(sel[0]) !== weekMon) return sel;
  return [...sel, iso];
}

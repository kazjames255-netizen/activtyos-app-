import type { Student } from "../types";

// September year-group reminder — pure logic (no React, no network). England's school year starts 1 Sept.
// Students whose year was typed by hand never move on their own; this lists them so the tutor can move them up.

/** "2026-27" for any date from 1 Sept 2026 to 31 Aug 2027. */
export function academicYearKey(on: Date = new Date()): string {
  const start = on.getMonth() >= 8 ? on.getFullYear() : on.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** The reminder shows from 1 Aug to 31 Oct (inclusive). */
export function inShowWindow(on: Date = new Date()): boolean {
  const m = on.getMonth();
  return m === 7 || m === 8 || m === 9;
}

/** The label after `current` in the tenant's own ordered list ('Year 5' -> 'Year 6'), or null at the end / when unknown. */
export function nextYearLabel(current: string, yearGroups: string[]): string | null {
  const c = current.trim().toLowerCase();
  const i = yearGroups.findIndex((y) => y.trim().toLowerCase() === c);
  return i >= 0 && i < yearGroups.length - 1 ? yearGroups[i + 1] : null;
}

export interface YearRow {
  childId: string;
  name: string;
  current: string;
  /** null = last year in the list (or not in it): nothing to move to — "Leave/Left school?" with no action. */
  next: string | null;
  /** A date of birth is on file, so "Set to automatic" would work. */
  canAuto: boolean;
}

/** Active students whose year group is set by hand (not from the date of birth). `franchiseId` limits a franchise to its own rows. */
export function manualYearStudents(students: Student[], yearGroups: string[], franchiseId?: string | null): YearRow[] {
  return students
    .filter((s) => s.active !== false && s.yearGroupAuto !== true && typeof s.yearGroup === "string" && s.yearGroup.trim() !== "")
    .filter((s) => !franchiseId || (s.franchiseId ?? null) === franchiseId)
    .map((s) => ({ childId: s.childId, name: s.childName, current: s.yearGroup!.trim(), next: nextYearLabel(s.yearGroup!, yearGroups), canAuto: s.hasDob === true }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── dismissal (localStorage, per tenant + academic year) ─────────────────────
export const SNOOZE_DAYS = 7;
const kDone = (tenant: string, on: Date) => `hub.yearReminder.done.${tenant}.${academicYearKey(on)}`;
const kSnooze = (tenant: string) => `hub.yearReminder.snooze.${tenant}`;

export function isDismissed(tenant: string, on: Date = new Date()): boolean {
  try {
    if (localStorage.getItem(kDone(tenant, on)) === "1") return true;
    const until = Number(localStorage.getItem(kSnooze(tenant)) ?? 0);
    return until > on.getTime();
  } catch { return false; }
}
export function snooze(tenant: string, on: Date = new Date()): void {
  try { localStorage.setItem(kSnooze(tenant), String(on.getTime() + SNOOZE_DAYS * 86_400_000)); } catch { /* private mode */ }
}
export function markDone(tenant: string, on: Date = new Date()): void {
  try { localStorage.setItem(kDone(tenant, on), "1"); } catch { /* private mode */ }
}

/** Whether the card should show at all. */
export function shouldShow(o: { on: Date; canEdit: boolean; rows: YearRow[]; dismissed: boolean }): boolean {
  return o.canEdit && inShowWindow(o.on) && o.rows.length > 0 && !o.dismissed;
}

// ── rows the tutor has already dealt with this academic year (moved up / kept) ──
const kHandled = (tenant: string, on: Date) => `hub.yearReminder.handled.${tenant}.${academicYearKey(on)}`;
export function loadHandled(tenant: string, on: Date = new Date()): Set<string> {
  try { const v = JSON.parse(localStorage.getItem(kHandled(tenant, on)) ?? "[]"); return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []); } catch { return new Set(); }
}
export function saveHandled(tenant: string, ids: Set<string>, on: Date = new Date()): void {
  try { localStorage.setItem(kHandled(tenant, on), JSON.stringify([...ids])); } catch { /* private mode */ }
}
/** Rows still waiting for a decision. */
export const pendingRows = (rows: YearRow[], handled: Set<string>): YearRow[] => rows.filter((r) => !handled.has(r.childId));

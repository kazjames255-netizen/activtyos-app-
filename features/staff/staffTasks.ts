"use client";

// Shared "what does this staffer still owe?" logic, used by both the first-login
// launcher (StaffWelcome) and the persistent top reminder bar (StaffReminderBanner)
// so the two never disagree. All demo/localStorage-backed; per-user identity is
// Amir's. Demo "me" = Marcus Bell, matching the other staff areas.
import { DOCS_KEY, seedDocs, type DocItem } from "@/features/documents/DocumentsApp";
import { DEFAULT_FIELDS, fieldApplies, satisfied, type OnboardRecord } from "@/features/team/OnboardingApp";

export const ME = "Marcus Bell";
const ME_ROLE = "Lead";
const ME_TITLE = "Coach / Staff";
const MY_LISTINGS = ["After-School Football Club"];
// onboarding field types the staffer fills in themselves (mirrors StaffOnboardingApp)
const STAFF_EDITABLE = new Set(["text", "tel", "email", "date", "textarea", "select", "checkbox", "readdoc", "file"]);

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v ?? fallback; } catch { return fallback; }
};
const rmatch = (list: string[], me: string) => list.some((r) => { const rl = r.toLowerCase(), m = me.toLowerCase(); return rl.includes(m) || m.includes(rl.split(/[ /]/)[0]); });
const courseRoleMatch = (roles: string[]) => roles.some((r) => { const rl = r.toLowerCase(); return rl.includes("lead") || rl.includes("manager") || rl.includes(ME_ROLE.toLowerCase()); });

/** Availability is "done" once the staffer has submitted at least one working day. */
export function availabilityDone(): boolean {
  const a = read<{ days?: Record<string, { on?: boolean }>; submittedAt?: string | null }>("aos.myavailability.v1", {});
  const anyOn = a.days ? Object.values(a.days).some((d) => d?.on) : false;
  return !!a.submittedAt && anyOn;
}

/** Compliance (onboarding) progress across the required fields the staffer fills. */
export function complianceProgress(): { done: number; total: number } {
  const all = read<OnboardRecord[]>("aos.team.onboardrecords.v1", []);
  const rec = (Array.isArray(all) ? all : []).find((r) => r.staff === ME);
  const values = rec?.values ?? {};
  const extra = rec?.extra ?? [];
  const req = DEFAULT_FIELDS.filter((f) => f.required && STAFF_EDITABLE.has(f.type) && fieldApplies(f, ME, undefined, extra));
  const done = req.filter((f) => satisfied(f, values[f.id])).length;
  return { done, total: req.length };
}
export const complianceDone = () => { const { done, total } = complianceProgress(); return total > 0 && done >= total; };

/** Documents assigned to me that I haven't read-and-confirmed yet. */
export function outstandingDocs(): number {
  const stored = read<DocItem[]>(DOCS_KEY, []);
  const docs = Array.isArray(stored) && stored.length ? stored : seedDocs();
  const mine = docs.filter((d) => d.all || rmatch(d.roles, ME_ROLE) || rmatch(d.titles, ME_TITLE) || d.listings.some((l) => MY_LISTINGS.includes(l)));
  const reads = read<Record<string, Record<string, unknown>>>("aos.docs.read.v1", {})[ME] || {};
  return mine.filter((d) => !reads[d.id]).length;
}

/** Courses assigned to me that I haven't passed yet. */
export function outstandingCourses(): number {
  const asns = read<{ assignments?: { kind: string; roles: string[]; staff: string[]; course: string }[] }>("aos.learn.lcm.v2", {}).assignments ?? [];
  const progress = read<Record<string, { passed?: boolean }>>("aos.learn.progress.v1", {});
  const mine = asns.filter((a) => a.kind === "all" || (a.kind === "roles" && courseRoleMatch(a.roles)) || (a.kind === "staff" && a.staff.includes(ME)));
  return mine.filter((a) => !progress[a.course]?.passed).length;
}

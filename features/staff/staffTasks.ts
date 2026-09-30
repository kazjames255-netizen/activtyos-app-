"use client";

// Shared "what does this staffer still owe?" logic, used by both the first-login
// launcher (StaffWelcome) and the persistent top reminder bar (StaffReminderBanner)
// so the two never disagree. All demo/localStorage-backed; per-user identity is
// Amir's. Demo "me" = Marcus Bell, matching the other staff areas.
import { DOCS_KEY, seedDocs, type DocItem } from "@/features/documents/DocumentsApp";
import { DEFAULT_FIELDS, fieldApplies, satisfied, type OnboardRecord } from "@/features/team/OnboardingApp";
import { isDemoMode } from "@/lib/api";
import { rolesCover, withoutDemoAssignments } from "@/features/learning/courseCompletions";
import { fetchLibrary } from "@/features/documents/docStore";
import { peekMe } from "@/components/auth/PortalGuard";
import { capLevel } from "@/lib/accessMap";

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
// "Lead / manager" used to match every role. This device doesn't know a real
// staffer's role here, so outside the demo only all-staff / named courses count.
const courseRoleMatch = (roles: string[]) => rolesCover(roles, isDemoMode() ? ME_ROLE : "");

/** Availability is "done" once the staffer has submitted at least one working day. */
export function availabilityDone(): boolean {
  const a = read<{ days?: Record<string, { on?: boolean }>; submittedAt?: string | null }>("aos.myavailability.v1", {});
  const anyOn = a.days ? Object.values(a.days).some((d) => d?.on) : false;
  return !!a.submittedAt && anyOn;
}

/** Compliance (onboarding) progress across the required fields the staffer fills. */
export function complianceProgress(): { done: number; total: number } {
  const all = read<OnboardRecord[]>("aos.team.onboardrecords.v1", []);
  const list = Array.isArray(all) ? all : [];
  // For a real member of staff the server hands back only their own record.
  const rec = list.find((r) => r.staff === ME) ?? (isDemoMode() ? undefined : list[0]);
  const values = rec?.values ?? {};
  const extra = rec?.extra ?? [];
  const req = DEFAULT_FIELDS.filter((f) => f.required && STAFF_EDITABLE.has(f.type) && fieldApplies(f, rec?.staff ?? ME, undefined, extra));
  const done = req.filter((f) => satisfied(f, values[f.id])).length;
  return { done, total: req.length };
}
export const complianceDone = () => { const { done, total } = complianceProgress(); return total > 0 && done >= total; };

/** Documents assigned to me that I haven't read-and-confirmed yet. In the guided-tour demo that's the seeded sample library; for a real account it is
 *  whatever the operator's server library says (see syncOutstandingDocs) — it used to count the seeded demo policies for every real member of
 *  staff, so a provider with NO documents told each new starter "10 documents to read". */
let docsOutstandingCache: number | null = null;
export function outstandingDocs(): number {
  if (!isDemoMode()) return docsOutstandingCache ?? 0;
  const stored = read<DocItem[]>(DOCS_KEY, []);
  const docs = Array.isArray(stored) && stored.length ? stored : seedDocs();
  const mine = docs.filter((d) => d.all || rmatch(d.roles, ME_ROLE) || rmatch(d.titles, ME_TITLE) || d.listings.some((l) => MY_LISTINGS.includes(l)));
  const reads = read<Record<string, Record<string, unknown>>>("aos.docs.read.v1", {})[ME] || {};
  return mine.filter((d) => !reads[d.id]).length;
}
/** Real accounts: ask the server which assigned documents this person still has to confirm (same rule as the Documents page). */
export async function syncOutstandingDocs(): Promise<number> {
  if (isDemoMode()) return outstandingDocs();
  // A role at None on Documents is refused the library (403) and sees no Documents page — nothing to read, and don't ask on every screen.
  if (capLevel(peekMe()?.caps, "documents") === "none") { docsOutstandingCache = 0; return 0; }
  try {
    const r = await fetchLibrary<DocItem>();
    const list = r.docs ?? [];
    const me = r.me;
    const has = (arr: string[], m: string) => !!m && arr.some((x) => { const xl = x.toLowerCase(), ml = m.toLowerCase(); return xl.includes(ml) || ml.includes(xl.split(/[ /]/)[0]); });
    const mine = list.filter((d) => d.all || has(d.roles, me?.role ?? "") || has(d.titles, me?.role ?? "") || d.listings.some((l) => (me?.listings ?? []).includes(l)));
    const cur = new Map(list.map((d) => [d.id, d.version]));
    const done = new Set((r.reads ?? []).filter((x) => cur.get(x.docId) === x.version).map((x) => x.docId));
    docsOutstandingCache = mine.filter((d) => !done.has(d.id)).length;
  } catch { /* keep the last answer — a reminder must never break the page */ }
  return docsOutstandingCache ?? 0;
}

/** Courses assigned to me that I haven't passed yet. */
export function outstandingCourses(): number {
  const asns = withoutDemoAssignments(read<{ assignments?: { kind: string; roles: string[]; staff: string[]; course: string; due?: string }[] }>("aos.learn.lcm.v2", {}).assignments ?? []);
  const progress = read<Record<string, { passed?: boolean }>>("aos.learn.progress.v1", {});
  const mine = asns.filter((a) => a.kind === "all" || (a.kind === "roles" && courseRoleMatch(a.roles)) || (a.kind === "staff" && a.staff.includes(ME)));
  return mine.filter((a) => !progress[a.course]?.passed).length;
}

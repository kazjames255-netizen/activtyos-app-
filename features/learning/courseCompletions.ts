// Per-staff INTERNAL course completions (ActivityOS training). The live progress
// store (aos.learn.progress.v1) is single-learner in the demo, so who-completed-
// -what across the team is seeded here. Real per-user completion + scores are
// Amir's backend. Shared by the manager oversight (CredentialsApp) and could feed
// the staff view. Certificate download reuses the same openCertificate() the
// course player uses, so a manager-issued cert is identical to the staff's own.
import { SEED_LIBRARY } from "./courseContent";
import { openCertificate, makeRef, type CertData } from "./certificates";
import type { TenantSettings } from "@/lib/settings";
import { useEffect, useState } from "react";
import { get as apiGet, isDemoMode, post as apiPost } from "@/lib/api";

export interface CourseDone { courseId: string; title: string; score: number; date: string;
  /** Recorded by the staff member from their own device (quiz marked in their browser). */
  selfReported?: boolean }

// staff name → indices into SEED_LIBRARY they've completed (+ score + ISO date)
const SEED: Record<string, [number, number, string][]> = {
  "Marcus Bell": [[0, 96, "2026-05-12"], [1, 88, "2026-05-20"], [4, 92, "2026-06-03"], [7, 100, "2026-07-01"]],
  "Jess Patel": [[0, 84, "2026-04-18"], [1, 90, "2026-04-25"], [3, 78, "2026-06-14"]],
  "Aisha Rahman": [[0, 100, "2026-03-30"], [2, 86, "2026-05-09"], [5, 94, "2026-06-22"], [8, 81, "2026-07-19"]],
  "Tom Lewis": [[0, 88, "2026-05-02"], [1, 82, "2026-05-02"]],
  "Priya Khan": [[0, 91, "2026-06-11"], [4, 95, "2026-06-28"], [6, 89, "2026-07-05"]],
  "Dan Reed": [[0, 100, "2026-02-14"], [1, 100, "2026-02-14"], [2, 97, "2026-04-01"], [3, 90, "2026-05-16"], [9, 85, "2026-07-22"]],
};

// Live completions a staff member has actually done in the app (demo store; real
// per-user completion + scores are Amir's). Merged with the seed so the manager
// oversight (CredentialsApp) sees what staff complete in real time.
const LIVE_KEY = "aos.learn.completions.v1";
type LiveStore = Record<string, CourseDone[]>;
export const LEARN_EVENT = "aos:learn";
const ASSIGN_KEY = "aos.learn.lcm.v2";
/** Refresh this device's copy of the team's completions and the assignment
 *  list from the server (/api/learning). The screens read the copies. */
let learnSync: Promise<void> | null = null;
export function syncLearning(): Promise<void> {
  if (typeof window === "undefined" || isDemoMode()) return Promise.resolve();
  if (learnSync) return learnSync;
  learnSync = Promise.all([
    apiGet<LiveStore>("/api/learning/completions").then((m) => { try { localStorage.setItem(LIVE_KEY, JSON.stringify(m)); } catch { /* ignore */ } }),
    apiGet<{ assignments: unknown[] | null }>("/api/learning/assignments").then((r) => {
      if (!r.assignments) return; // nothing saved on the server yet — keep this device's list
      try { const cur = JSON.parse(localStorage.getItem(ASSIGN_KEY) || "{}"); localStorage.setItem(ASSIGN_KEY, JSON.stringify({ ...cur, assignments: r.assignments })); } catch { /* ignore */ }
    }),
  ]).then(() => { window.dispatchEvent(new Event(LEARN_EVENT)); }).catch(() => {}).finally(() => { learnSync = null; });
  return learnSync;
}
// The three sample assignments the Learning Centre used to start EVERY provider
// on (Safeguarding "due 30 Jun", First Aid for "First-aider, Lead / manager",
// Water Safety "15 Jul"). The first real assignment PUT them to the server, so
// staff phones showed made-up required/overdue courses. Real due dates come
// from the date picker (ISO) or are "—", so these are recognisable — they're
// dropped wherever a list is read outside the demo.
const DEMO_ASSIGN_SIG = new Set(["c1|all|30 Jun", "c2|roles|15 Jul", "c26|roles|15 Jul"]);
export function withoutDemoAssignments<T extends { course: string; kind: string; due?: string }>(xs: T[]): T[] {
  return isDemoMode() ? xs : xs.filter((a) => !DEMO_ASSIGN_SIG.has(`${a.course}|${a.kind}|${a.due ?? ""}`));
}
/** Does an assignment's job-role list cover this person's role? Each label is
 *  split on "/", "," and "&" ("Lead / manager" → lead, manager) and matched
 *  against their own role. It used to match ANY label containing "lead" or
 *  "manager" — so a "Lead / manager" course landed on every member of staff —
 *  and an empty role matched everything. */
export function rolesCover(roles: string[], myRole: string | undefined | null): boolean {
  const mine = (myRole ?? "").trim().toLowerCase();
  if (!mine) return false;
  return roles.some((r) => r.toLowerCase().split(/[/,&]/).map((p) => p.trim()).filter(Boolean).some((p) => p === mine || mine.includes(p) || p.includes(mine)));
}
/** Re-render when the server copy lands. */
export function useLearnRefresh(): number {
  const [n, setN] = useState(0);
  useEffect(() => { const h = () => setN((x) => x + 1); window.addEventListener(LEARN_EVENT, h); return () => window.removeEventListener(LEARN_EVENT, h); }, []);
  return n;
}
function loadLive(): LiveStore { if (typeof window === "undefined") return {}; try { const v = JSON.parse(localStorage.getItem(LIVE_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } }

export function recordCompletion(staffName: string, done: CourseDone) {
  if (typeof window === "undefined" || !staffName) return;
  // To the server — a pass used to exist only on the device it was taken on.
  if (!isDemoMode()) void apiPost("/api/learning/completions", { ...done, staffName }).then(() => syncLearning()).catch(() => {});
  try {
    const all = loadLive(); const list = all[staffName] ? [...all[staffName]] : [];
    const i = list.findIndex((d) => d.courseId === done.courseId);
    if (i >= 0) { if (done.score >= list[i].score) list[i] = done; } else list.push(done);
    all[staffName] = list; localStorage.setItem(LIVE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function completionsFor(staffName: string): CourseDone[] {
  // The demo team's history is for the demo only.
  const seed = (isDemoMode() ? SEED[staffName] ?? [] : []).map(([i, score, date]) => { const c = SEED_LIBRARY[i]; return c ? { courseId: c.id, title: c.title, score, date } : null; }).filter(Boolean) as CourseDone[];
  const map = new Map<string, CourseDone>();
  for (const d of seed) map.set(d.courseId, d);
  for (const d of loadLive()[staffName] ?? []) map.set(d.courseId, d); // live wins on the same course
  return [...map.values()];
}

const fmtLong = (isoDate: string) => { const d = new Date(isoDate + "T00:00:00"); return isNaN(+d) ? isoDate : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); };

// A completed course's certificate expiry = completion date + the course's
// renewal interval (or the provider default). Null = never expires.
export function courseExpiry(done: CourseDone, settings: TenantSettings): Date | null {
  const course = SEED_LIBRARY.find((c) => c.id === done.courseId);
  const rm = course?.renewMonths ?? settings.learning?.renewMonths ?? 0;
  if (!rm) return null;
  const issued = new Date(done.date + "T00:00:00");
  return new Date(issued.getFullYear(), issued.getMonth() + rm, issued.getDate());
}
// Still valid today? (never-expiring courses are always in date)
export function courseInDate(done: CourseDone, settings: TenantSettings): boolean {
  const exp = courseExpiry(done, settings);
  if (!exp) return true;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return exp.getTime() >= today.getTime();
}

// Build the CertData for one staff+course, styled with the provider's chosen
// certificate template/branding from Setup → Learning. Shared by the single
// download and the bulk export pack.
export function courseCertData(staffName: string, done: CourseDone, settings: TenantSettings): CertData {
  const course = SEED_LIBRARY.find((c) => c.id === done.courseId);
  const rm = course?.renewMonths ?? settings.learning?.renewMonths ?? 0;
  const issued = new Date(done.date + "T00:00:00");
  const exp = rm ? new Date(issued.getFullYear(), issued.getMonth() + rm, issued.getDate()) : null;
  const l = settings.learning;
  return {
    name: staffName || "Team member", course: done.title, pct: done.score,
    date: fmtLong(done.date), expiry: exp ? exp.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : undefined,
    provider: settings.providerName || settings.billing?.businessName || "Your organisation",
    logo: l?.certLogo === false ? undefined : course?.logo,
    ref: makeRef(done.title + staffName + done.date),
    signImg: l?.certSignature, signName: l?.certSignatory, signRole: l?.certSignatoryRole,
    accent: l?.certColor, title: l?.certTitle || undefined, showScore: l?.certShowScore, showQr: l?.certShowQr,
  };
}

// Download the completion certificate for one staff+course (opens the print view).
export function downloadCourseCertificate(staffName: string, done: CourseDone, settings: TenantSettings) {
  openCertificate(courseCertData(staffName, done, settings), settings.learning?.certTemplate);
}

// The template id the provider chose (for the bulk pack to match single downloads).
export const courseCertTemplate = (settings: TenantSettings) => settings.learning?.certTemplate;

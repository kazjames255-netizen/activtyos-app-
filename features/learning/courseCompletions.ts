// Per-staff INTERNAL course completions (ActivityOS training). The live progress
// store (aos.learn.progress.v1) is single-learner in the demo, so who-completed-
// -what across the team is seeded here. Real per-user completion + scores are
// Amir's backend. Shared by the manager oversight (CredentialsApp) and could feed
// the staff view. Certificate download reuses the same openCertificate() the
// course player uses, so a manager-issued cert is identical to the staff's own.
import { SEED_LIBRARY } from "./courseContent";
import { openCertificate, makeRef, type CertData } from "./certificates";
import type { TenantSettings } from "@/lib/settings";

export interface CourseDone { courseId: string; title: string; score: number; date: string }

// staff name → indices into SEED_LIBRARY they've completed (+ score + ISO date)
const SEED: Record<string, [number, number, string][]> = {
  "Marcus Bell": [[0, 96, "2026-05-12"], [1, 88, "2026-05-20"], [4, 92, "2026-06-03"], [7, 100, "2026-07-01"]],
  "Jess Patel": [[0, 84, "2026-04-18"], [1, 90, "2026-04-25"], [3, 78, "2026-06-14"]],
  "Aisha Rahman": [[0, 100, "2026-03-30"], [2, 86, "2026-05-09"], [5, 94, "2026-06-22"], [8, 81, "2026-07-19"]],
  "Tom Lewis": [[0, 88, "2026-05-02"], [1, 82, "2026-05-02"]],
  "Priya Khan": [[0, 91, "2026-06-11"], [4, 95, "2026-06-28"], [6, 89, "2026-07-05"]],
  "Dan Reed": [[0, 100, "2026-02-14"], [1, 100, "2026-02-14"], [2, 97, "2026-04-01"], [3, 90, "2026-05-16"], [9, 85, "2026-07-22"]],
};

export function completionsFor(staffName: string): CourseDone[] {
  const rows = SEED[staffName] ?? [];
  return rows.map(([i, score, date]) => { const c = SEED_LIBRARY[i]; return c ? { courseId: c.id, title: c.title, score, date } : null; }).filter(Boolean) as CourseDone[];
}

const fmtLong = (isoDate: string) => { const d = new Date(isoDate + "T00:00:00"); return isNaN(+d) ? isoDate : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); };

// Download the completion certificate for one staff+course, styled with the
// provider's chosen certificate template/branding from Setup → Learning.
export function downloadCourseCertificate(staffName: string, done: CourseDone, settings: TenantSettings) {
  const course = SEED_LIBRARY.find((c) => c.id === done.courseId);
  const rm = course?.renewMonths ?? settings.learning?.renewMonths ?? 0;
  const issued = new Date(done.date + "T00:00:00");
  const exp = rm ? new Date(issued.getFullYear(), issued.getMonth() + rm, issued.getDate()) : null;
  const l = settings.learning;
  const data: CertData = {
    name: staffName || "Team member", course: done.title, pct: done.score,
    date: fmtLong(done.date), expiry: exp ? exp.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : undefined,
    provider: settings.providerName || settings.billing?.businessName || "Your organisation",
    logo: l?.certLogo === false ? undefined : course?.logo,
    ref: makeRef(done.title + staffName + done.date),
    signImg: l?.certSignature, signName: l?.certSignatory, signRole: l?.certSignatoryRole,
    accent: l?.certColor, title: l?.certTitle || undefined, showScore: l?.certShowScore, showQr: l?.certShowQr,
  };
  openCertificate(data, l?.certTemplate);
}

// Parent digest / homework nudge — dry-run CLI. NEVER sends mail (real sends are the scheduler only, HUB_DIGEST_ENABLED=1).
//   tsx src/hubDigestRun.ts --samples [--out DIR]                 render synthetic emails (all 11 locales), no Firestore
//   tsx src/hubDigestRun.ts --dry --tenant <id> [--what digest|nudges|both] [--out DIR]
//        render what WOULD go out for that tenant right now (read-only: the sent-log is not touched), ignoring the on/off switches
// Output HTML lands in DIR (default <tmp>/hub-digest). Use a throwaway / staging tenant.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES } from "../../lib/i18n/config";
import { renderDigest, renderNudge } from "./lib/hubDigestEmail";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (k: string) => process.argv.includes(k);
const out = arg("--out") || join(process.env.TMPDIR || "/tmp", "hub-digest");
mkdirSync(out, { recursive: true });

if (has("--samples")) {
  const day = 86_400_000, now = Date.now();
  const links = { hub: "https://app.example.test/custdash/learninghub?child=c1", stop: "https://api.example.test/api/hub-digest/unsubscribe?u=SAMPLE" };
  for (const l of LOCALES) {
    const d = renderDigest({
      childName: "Maya", provider: "Sunny Tutors",
      homework: [
        { title: "Fractions practice", status: "marked", dueAt: new Date(now - 2 * day).toISOString(), score: 9, max: 10 },
        { title: "Reading log", status: "submitted", dueAt: new Date(now - day).toISOString() },
        { title: "Spelling list 5", status: "assigned", dueAt: new Date(now + 3 * day).toISOString() },
      ],
      quizzes: [{ title: "Times tables check", pct: 90 }, { title: "Place value", pct: 76 }], lessons: [{ title: "Live maths lesson" }],
      streakDays: 4, strongest: "Maths", celebrate: { kind: "score", title: "Fractions practice", pct: 90 },
      upcoming: [{ kind: "homework", title: "Spelling list 5", at: new Date(now + 3 * day).toISOString() }, { kind: "lesson", title: "Live maths lesson", at: new Date(now + 5 * day).toISOString() }],
    }, l.code, links);
    writeFileSync(join(out, `digest__${l.code}.html`), d.html);
    for (const k of ["nudge_before", "nudge_after"] as const) {
      const r = renderNudge(k, { childName: "Maya", provider: "Sunny Tutors", title: "Spelling list 5", dueAt: new Date(now + (k === "nudge_before" ? 20 * 3_600_000 : -30 * 3_600_000)).toISOString() }, l.code, links);
      writeFileSync(join(out, `${k}__${l.code}.html`), r.html);
    }
  }
  console.log(`rendered ${LOCALES.length * 3} sample emails → ${out}`);
} else if (has("--dry")) {
  const tenant = arg("--tenant");
  if (!tenant) { console.error("Pass --tenant <id> (use a throwaway/staging tenant)"); process.exit(2); }
  const what = (arg("--what") ?? "both") as "digest" | "nudges" | "both";
  const { runTenant } = await import("./lib/hubDigestStore");
  const items = await runTenant(tenant, { digest: what !== "nudges", nudges: what !== "digest" }, { dry: true, dir: out, ignoreSwitch: true });
  console.table(items.map((i) => ({ child: i.childName, kind: i.kind, locale: i.locale, status: i.status, reason: i.reason ?? "", file: i.file ?? "" })));
  console.log(`${items.filter((i) => i.status === "dry").length} rendered → ${out} (nothing sent)`);
  process.exit(0);
} else {
  console.error("Use --samples or --dry --tenant <id>. This script never sends mail.");
  process.exit(2);
}

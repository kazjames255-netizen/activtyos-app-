// Tag every question that has no year group yet with the year(s) it is for — so the question bank can be filtered by year and a
// quiz for Year 5 only offers Year 5 questions.
//   npx tsx src/backfillQuestionYears.ts <tenantId> [--dry]
// A question's year comes from (1) its topic's "Year N" subtopic, else (2) the audience of a QUIZ that uses it (placement papers
// are skipped: they mix years on purpose). Questions with neither stay untagged ("No year set" in the bank). Idempotent; never
// overwrites a year a tutor already set.
import { db } from "./firebase";

const TID = process.argv[2];
const DRY = process.argv.includes("--dry");
if (!TID || TID.startsWith("--")) { console.error("Usage: npx tsx src/backfillQuestionYears.ts <tenantId> [--dry]"); process.exit(1); }

(async () => {
  const [topicSnap, qSnap, aSnap] = await Promise.all([
    db.collection("hubTopics").where("tenantId", "==", TID).select("subtopic").get(),
    db.collection("hubQuestions").where("tenantId", "==", TID).select("topicId", "yearGroups").get(),
    db.collection("hubAssessments").where("tenantId", "==", TID).select("type", "audience", "questionIds").get(),
  ]);
  const topicYear = new Map<string, string>();
  for (const t of topicSnap.docs) { const m = /^\s*year\s*(\d{1,2})\s*$/i.exec(String(t.get("subtopic") ?? "")); if (m) topicYear.set(t.id, `Year ${Number(m[1])}`); }
  const quizYears = new Map<string, Set<string>>();
  for (const a of aSnap.docs) {
    if (a.get("type") !== "quiz") continue;
    const yg: string[] = a.get("audience.yearGroups") ?? [];
    if (!yg.length) continue;
    for (const id of (a.get("questionIds") ?? []) as string[]) { const s = quizYears.get(id) ?? new Set<string>(); yg.forEach((g) => s.add(g)); quizYears.set(id, s); }
  }
  const writer = db.bulkWriter();
  let tagged = 0, already = 0, none = 0;
  const by = new Map<string, number>();
  for (const q of qSnap.docs) {
    if ((q.get("yearGroups") ?? []).length) { already++; continue; }
    const fromTopic = topicYear.get(q.get("topicId"));
    const years = fromTopic ? [fromTopic] : [...(quizYears.get(q.id) ?? [])];
    if (!years.length) { none++; continue; }
    tagged++; for (const y of years) by.set(y, (by.get(y) ?? 0) + 1);
    if (!DRY) void writer.update(q.ref, { yearGroups: years });
  }
  if (!DRY) await writer.close();
  console.log(`${TID}: ${qSnap.size} questions · already tagged ${already} · tagged now ${tagged}${DRY ? " (dry run)" : ""} · left untagged ${none}`);
  console.log([...by].sort((a, b) => Number(a[0].replace(/\D/g, "")) - Number(b[0].replace(/\D/g, ""))).map(([y, n]) => `${y}: ${n}`).join(" · "));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

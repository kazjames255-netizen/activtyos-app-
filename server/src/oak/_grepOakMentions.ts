// One-off awareness scan (not a fix): case-sensitive literal "Oak" across the full lesson content of hubNotes docs
// (note.body, lesson.plan, lesson.notes, lesson.outline/points/keywords, deckSlides text, etc.) for the two real
// tenants, to catch any OTHER Oak leaks beyond the Teacher-Guidance slide. Case-sensitive to dodge "cloak"/"soak".
import { db } from "../firebase";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };

function collectStrings(v: unknown, out: string[]) {
  if (typeof v === "string") { out.push(v); return; }
  if (Array.isArray(v)) { for (const x of v) collectStrings(x, out); return; }
  if (v && typeof v === "object") { for (const x of Object.values(v)) collectStrings(x, out); return; }
}

// Word-boundary-ish, case-sensitive "Oak" (not "oak" lowercase alone, not part of another word).
const OAK_RE = /\bOak\b/;

async function main() {
  const tenants = (arg("tenants") ?? "").split(",").filter(Boolean);
  if (!tenants.length) throw new Error("usage: npx tsx src/oak/_grepOakMentions.ts --tenants <id[,id…]>");
  for (const tenant of tenants) {
    console.log(`\n=== tenant ${tenant} ===`);
    const snap = await db.collection("hubNotes").where("tenantId", "==", tenant).get();
    console.log(`  ${snap.size} hubNotes docs`);
    let hits = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const strs: string[] = [];
      collectStrings(data, strs);
      const matches = strs.filter((s) => OAK_RE.test(s));
      if (matches.length) {
        hits++;
        console.log(`  ${d.id}: ${matches.length} string(s) with "Oak" — e.g. "${matches[0]!.slice(0, 160)}"`);
      }
    }
    console.log(`  docs with an "Oak" mention: ${hits} / ${snap.size}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

// ONE-TIME migration: strip Oak's own "Teacher Guidance" template slides out of `lesson.deckSlides` on hubNotes docs
// that were already uploaded before deckConvert.ts learned to filter them (see deckConvert.ts "Owner decision
// (2026-09-23)"). Two known Oak-branded template slides slipped through the earlier import:
//   1. "Oak's lesson structure" page — title varies ("How our teaching resources are designed for the classroom" /
//      "This lesson includes additional materials which can be downloaded from the lesson page…") but the body copy
//      is stable: "Oak's lessons are structured around learning cycles… Oak's lesson structure / Useful links…".
//   2. The follow-on "Available/Video clips" page (blank title, no literal "Oak" mention) — same template family,
//      identified by its own stable body copy + the "Teacher guidance" footer label common to both.
// Neither is ever pupil-facing content; both are dropped unconditionally, matching the fix now in deckConvert.ts so
// a future re-run of deckBulk.ts never reintroduces them.
//
// Usage:
//   cd server && npx tsx src/oak/fixOakGuidanceSlides.ts --tenants <id[,id…]> [--dry] [--limit N]
//
// Idempotent: a doc with no matching slide is left untouched (0 writes), so this is always safe to re-run — e.g.
// once now and again after deckBulk.ts's tail end adds more lessons.
import { db } from "../firebase";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(`--${n}`);

// Same body-copy markers as deckConvert.ts's isOakTeacherGuidance / isOakClipsGuidance, applied to the TEXT already
// stored in a saved DeckSlide (not the raw pptx) — a slide's own text runs, not its title (title can be blank).
const isOakTeacherGuidance = (t: string) => /oak.?s lessons? (?:are|is) structured around/i.test(t) || /oak.?s lesson structure/i.test(t);
const isOakClipsGuidance = (t: string) => /teacher guidance/i.test(t) && /to help you teach this lesson, we/i.test(t);
// The closing "© Oak National Academy / Open Government Licence" attribution slide — deckConvert.ts already drops this
// for anything converted after 2026-09-21, but older rows may still carry it.
const isOakAttribution = (t: string) => /oak national academy/i.test(t) && /©|open government licen[cs]e|licensed under/i.test(t);
const isHowToUseOak = (t: string) => /how to use oak lessons/i.test(t);

function slideText(slide: unknown): string {
  const s = slide as { blocks?: { els?: { k?: string; paras?: { runs?: { t?: string }[] }[] }[] }[] } | null | undefined;
  const texts: string[] = [];
  for (const b of s?.blocks ?? []) for (const e of b.els ?? []) if (e.k === "text") for (const p of e.paras ?? []) for (const r of p.runs ?? []) if (r.t) texts.push(r.t);
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

function isOakGuidanceSlide(slide: unknown): { drop: boolean; why?: string } {
  const t = slideText(slide);
  if (!t) return { drop: false };
  if (isHowToUseOak(t)) return { drop: true, why: "how-to-use-oak-lessons" };
  if (isOakTeacherGuidance(t)) return { drop: true, why: "oak-teacher-guidance" };
  if (isOakClipsGuidance(t)) return { drop: true, why: "oak-clips-guidance" };
  if (isOakAttribution(t)) return { drop: true, why: "attribution" };
  return { drop: false };
}

async function main() {
  const tenants = (arg("tenants") ?? "").split(",").filter(Boolean);
  if (!tenants.length) throw new Error("usage: npx tsx src/oak/fixOakGuidanceSlides.ts --tenants <id[,id…]> [--dry] [--limit N]");
  const dry = flag("dry");
  const limit = Number(arg("limit")) || Infinity;

  for (const tenant of tenants) {
    console.log(`\n=== tenant ${tenant} ===`);
    // Only Oak-imported docs (id prefix `oak-<tenantId>-`, per import.ts's own convention) can carry a deckBulk.ts-fetched
    // real deck — scoping the query this way skips the tenant's non-Oak curriculum notes (which have no `lesson.deckSlides`
    // at all) instead of paying to stream all of them just to find they don't match.
    const P = `oak-${tenant}-`;
    let q = db.collection("hubNotes").where("tenantId", "==", tenant).where("__name__", ">=", P).where("__name__", "<", `${P}`).select("lesson.deckSlides");
    if (Number.isFinite(limit)) q = q.limit(limit);
    const snap = await q.get();
    console.log(`  ${snap.size} oak-${tenant}-* hubNotes docs`);

    let scanned = 0, withDeck = 0, docsFixed = 0, slidesRemoved = 0;
    const byWhy: Record<string, number> = {};
    let batch = db.batch();
    let inBatch = 0;
    const commits: Promise<unknown>[] = [];

    const flushBatch = () => {
      if (inBatch === 0) return;
      commits.push(batch.commit());
      batch = db.batch();
      inBatch = 0;
    };

    for (const d of snap.docs) {
      if (scanned >= limit) break;
      scanned++;
      const l = d.get("lesson") as { deckSlides?: unknown[] } | undefined;
      const slides = l?.deckSlides;
      if (!Array.isArray(slides) || !slides.length) continue;
      withDeck++;

      const kept: unknown[] = [];
      let removedHere = 0;
      for (const s of slides) {
        const verdict = isOakGuidanceSlide(s);
        if (verdict.drop) {
          removedHere++;
          byWhy[verdict.why!] = (byWhy[verdict.why!] ?? 0) + 1;
        } else {
          kept.push(s);
        }
      }
      if (removedHere === 0) continue;

      docsFixed++;
      slidesRemoved += removedHere;
      console.log(`  fix ${d.id} · removed ${removedHere} slide(s) (${slides.length} → ${kept.length})`);
      if (!dry) {
        batch.update(d.ref, { "lesson.deckSlides": kept });
        inBatch++;
        if (inBatch >= 400) flushBatch();
      }
    }
    flushBatch();
    await Promise.all(commits);

    console.log(`  scanned ${scanned} · with deck ${withDeck} · docs fixed ${docsFixed} · slides removed ${slidesRemoved}${dry ? " (dry run — nothing written)" : ""}`);
    console.log(`  by reason: ${JSON.stringify(byWhy)}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

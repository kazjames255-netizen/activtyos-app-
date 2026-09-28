// npx tsx src/oak/noOakSelftest.ts
import { scrubPayload, scrubHtml } from "./noOakResponse";
import { scrubText, scrubDeep, findOakDeep, mentionsOak, assertNoOak } from "./noOak";
let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) { bad++; console.error("FAIL", m); } };
ok(scrubText("Oak's lesson structure has 3 parts. Count to ten.") === "Count to ten.", "sentence drop");
ok(scrubText("A maths lesson by Oak National Academy licensed under Open Government Licence (OGL)") === "", "credit");
ok(scrubText("See [the lesson](https://teachers.thenational.academy/lessons/x) now") === "See the lesson now", "link");
ok(!mentionsOak("An oak tree has acorns"), "botanical ok");
ok(mentionsOak("Oak"), "bare Oak flagged");
ok(scrubText("Oak lessons are structured around learning cycles.") === "", "guidance");
const d = { title: "T", source: { provider: "oak", url: "https://teachers.thenational.academy/x" }, id: "oak-abc-def", lesson: { keywords: ["a", "Oak National Academy"], deckSlides: [{ blocks: [{ els: [{ k: "text", paras: [{ runs: [{ t: "How to use Oak lessons" }] }] }] }] }, { blocks: [{ els: [{ k: "text", paras: [{ runs: [{ t: "Fractions" }] }] }] }] }] } };
const r = scrubDeep(d); const v = r.value as typeof d;
ok(r.changed && v.lesson.deckSlides.length === 1 && v.lesson.keywords.length === 1, "deep");
ok(v.source.provider === "oak" && v.id === "oak-abc-def", "internal kept");
ok(findOakDeep(v).length === 0, "rescan clean");
let threw = false; try { assertNoOak(d, "x"); } catch { threw = true; } ok(threw, "validator throws");
{
  // render-time path (routes/learningHub under /api/learning-hub): a plain note BODY and list excerpt must come out clean
  const note = { id: "n1", title: "Cells", body: "**Cells**\n\n- Cells are small.\n\nA Biology lesson by Oak National Academy licensed under Open Government Licence (OGL).", excerpt: "Cells. A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)." };
  const out = scrubPayload({ items: [note] });
  ok(findOakDeep(out).length === 0 && !/oak|OGL/i.test(JSON.stringify(out)), "payload scrub (note body + excerpt)");
  ok((out.items[0]!.body as string).includes("Cells are small."), "payload scrub keeps lesson text");
  const src = scrubPayload({ lesson: { source: { provider: "oak", licence: "OGL-3.0", attribution: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)" } } });
  ok(!/oak national|OGL/i.test(JSON.stringify(src)), "source.attribution dropped");
  const h = scrubHtml("<p>Fractions</p><p>Credit: Oak National Academy licensed under Open Government Licence (OGL)</p>");
  ok(!/oak|OGL/i.test(h) && h.includes("Fractions"), "html scrub");
}
console.log(bad ? `${bad} FAILED` : "noOak selftest: all passed"); process.exit(bad ? 1 : 0);

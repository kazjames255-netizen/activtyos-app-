// npx tsx src/oak/noOakSelftest.ts
import { scrubPayload, scrubHtml } from "./noOakResponse";
import { scrubText, scrubDeep, findOakDeep, mentionsOak, assertNoOak } from "./noOak";
let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) { bad++; console.error("FAIL", m); } };
ok(scrubText("Oak's lesson structure has 3 parts. Count to ten.") === "Count to ten.", "sentence drop");
ok(scrubText("A maths lesson by Oak National Academy licensed under Open Government Licence (OGL)") === "", "credit");
ok(scrubText("See [the lesson](https://teachers.thenational.academy/lessons/x) now") === "See the lesson now", "link");
ok(!mentionsOak("An oak tree has acorns"), "botanical ok");
// A bare "Oak" is a child / class / provider name or a tree, NOT the publisher (10 Oct follow-up); real publisher names and credits still are.
for (const n of ["Oak", "Oak Class", "Oak Lane Tutors", "Oakley", "Oakwood Primary", "oak tree", "Your child Oak joined Oak Class at Oak Lane Tutors."]) ok(!mentionsOak(n), `not the publisher: ${n}`);
for (const n of ["Oak National Academy", "Oak Academy", "oaknational.academy", "Oak's slides", "Oak lessons", "Made by Oak.", "Source: Oak", "https://teachers.thenational.academy/x"]) ok(mentionsOak(n), `is the publisher: ${n}`);
ok(scrubText("Oak Class starts at 9. Oak Lane Tutors say hello.") === "Oak Class starts at 9. Oak Lane Tutors say hello.", "names kept");
ok(!JSON.stringify(scrubPayload({ lesson: { source: { provider: "oak", url: "https://www.thenational.academy/teachers/lessons/x" } } })).includes("thenational"), "source.url dropped");
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
